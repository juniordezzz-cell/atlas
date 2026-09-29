/* Gateway de visão separado das consultas matemáticas do Oráculo. */
(function(g){
 'use strict';let flow=null,ready=null;const promises=new Map();
 function script(src,key){if(g[key])return Promise.resolve();if(promises.has(src))return promises.get(src);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>g[key]?resolve():reject(Error('Componente não inicializado.'));s.onerror=()=>{s.remove();reject(Error('Componente indisponível.'));};document.head.appendChild(s);});promises.set(src,p);p.catch(()=>promises.delete(src));return p;}
 async function init(raiz){if(flow)return flow;if(ready)return ready;ready=(async()=>{await script(raiz+'core/atlas-supabase-config.js','ATLAS_SUPABASE');await script(raiz+'core/atlas-oraculo-operacoes-loader.js','AtlasOraculoAcoes');await g.AtlasOraculoAcoes.carregarDados(raiz);await script(raiz+'core/atlas-oraculo-imagem-fluxo.js','AtlasOraculoImagemFluxo');const schema=await import(new URL(raiz+'core/atlas-oraculo-imagem-schema.mjs',document.baseURI).href);flow=g.AtlasOraculoImagemFluxo.criar(schema);return flow;})();ready.catch(()=>ready=null);return ready;}
 async function imagem(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Envie PNG, JPEG ou WebP.');if(file.size>12000000)throw Error('Arquivo grande demais. Recorte o print antes de enviar.');
  const bitmap=await g.createImageBitmap(file);try{if(bitmap.width*bitmap.height>25000000)throw Error('Imagem grande demais. Recorte a área da pool.');const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.94);if(data.length>4000000)throw Error('Print grande demais. Recorte a parte da posição.');return data;}finally{bitmap.close();}
 }
 async function ler(file,caption,raiz){
  const f=await init(raiz);f.responder('cancelar');await g.AtlasOraculoAcoes.responder('cancelar',raiz);
  const user=g.firebase?.auth?.().currentUser;if(!user?.getIdToken)throw Error('Entre no Atlas para ler o print.');const uid=user.uid;
  const image=await imagem(file),token=await user.getIdToken();const url=g.ATLAS_SUPABASE.url.replace(/\/$/,'')+'/functions/v1/oraculo-imagem';
  let r;try{r=await g.fetch(url,{method:'POST',headers:{apikey:g.ATLAS_SUPABASE.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({image,caption:String(caption||'').slice(0,800)}),signal:AbortSignal.timeout(60000)});}catch(_){throw Error('Não consegui acessar a leitura de prints. Nenhuma pool foi criada.');}
  let data={};try{data=await r.json();}catch(_){}
  if(!r.ok)throw Error(r.status===404?'A função oraculo-imagem ainda precisa ser publicada no Supabase. Nenhuma pool foi criada.':data.error||'Leitura de prints indisponível; nenhuma pool foi criada.');
  if(g.firebase?.auth?.().currentUser?.uid!==uid)throw Error('Sessão mudou durante a leitura. Envie o print novamente.');
  return f.receber(data.extraction);
 }
 async function responder(q,raiz){if(!flow&&!/^retomar rascunho /i.test(q))return null;const f=await init(raiz);return f.responder(q);}
 g.AtlasOraculoImagem={ler,responder,corrigir:d=>flow?.corrigir(d),dados:()=>flow?.dados()||null,pendente:()=>!!flow?.pendente()};
})(window);
