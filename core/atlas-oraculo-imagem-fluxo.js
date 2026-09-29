/* Conversa e rascunhos de prints. Não executa texto retornado pela IA. */
(function(g){
 'use strict';
 function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
 function usuario(){return g.firebase?.auth?.().currentUser?.uid||null;}
 function chave(){const u=usuario();return u?'atlas.oraculo.poolRascunhos.v1.'+u:null;}
 function rascunhos(){const k=chave();if(!k)return [];try{const a=JSON.parse(g.localStorage.getItem(k)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.id==='string'&&x.data&&typeof x.data==='object').slice(0,20):[];}catch(_){return [];}}
 function guardar(a){const k=chave();if(!k)throw Error('Entre no Atlas para salvar rascunhos.');g.localStorage.setItem(k,JSON.stringify(a));}
 function evento(){try{g.dispatchEvent(new g.CustomEvent('atlas:operacao-registrada'));}catch(_){} }
 function criar(schema){
  let atual=null,reviewed=false,walletId=null,final=false,sourceId=null,owner=null;
  function limpar(){atual=null;reviewed=false;walletId=null;final=false;sourceId=null;owner=null;}
  function nome(w){return w.name;}
  function carteira(id){return g.AtlasWallets?.all().find(w=>w.id===id && !(w.type==='isolada'&&w.module!=='defi'))||null;}
  function usd(v){return v==null?'não informado':'US$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});}
  function resumo(){const x=schema.preparar(atual),d=x.data,p=x.pool;return 'Entendi uma pool '+(d.base||'token não identificado')+'/'+(d.quote||'token não identificado')+' na '+(d.protocol||'plataforma não informada')+' ('+(d.chain||'rede não informada')+'). Quantidades: '+(d.qtyBase??'não informada')+' '+(d.base||'?')+' + '+(d.qtyQuote??'não informada')+' '+(d.quote||'?')+'. Capital: '+usd(p.capital)+'. Faixa: '+(p.rangeLow??'não informada')+' a '+(p.rangeHigh??'não informada')+' '+(p.rangeDenom==='quote_por_base'?(d.quote+' por '+d.base):p.rangeDenom==='base_por_quote'?(d.base+' por '+d.quote):'(unidade não informada)')+(d.ratingPercent!=null?' (rating '+d.ratingPercent+'% por lado).':'.')+(d.openedAt?' Abertura: '+d.openedAt+'.':' Data: hoje, se confirmar.')+(x.pendencias.length?' Pendências: '+x.pendencias.join(' '):'')+(d.warnings.length?' Avisos da leitura: '+d.warnings.join(' '):'')+' Confira os tokens e valores; símbolos não comprovam o contrato do ativo.';}
  function receber(data){limpar();owner=usuario();if(!owner)return 'Entre no Atlas para revisar o print.';atual=schema.normalizar(data).data;return resumo()+' Confirma a leitura? Diga sim ou revise os dados. Para guardar com pendências, diga salvar rascunho.';}
  function corrigir(data){if(!atual)return 'Não há print em revisão.';if(usuario()!==owner){limpar();return 'Sessão mudou. Envie o print novamente.';}atual=schema.normalizar(data).data;reviewed=false;final=false;return resumo()+' Confirma os dados corrigidos? Diga sim.';}
  function concluirResumo(){const w=carteira(walletId);if(!w){final=false;return 'Qual carteira? Informe o nome da carteira.';}const p=schema.preparar(atual);if(p.pendencias.length){final=false;return resumo()+' Revise as pendências, ou diga salvar rascunho.';}if(g.AtlasDemo?.exibindo()){final=false;return 'Saia do modo demonstração antes de registrar.';}final=true;return 'Na carteira '+nome(w)+', vou registrar uma nova pool. '+resumo()+' Confirma o registro nesta carteira? Diga sim ou cancelar.';}
  function responder(text){
   const q=norm(text),resume=q.match(/^retomar rascunho ([a-z0-9_-]+)$/);
   if(resume){const d=rascunhos().find(x=>x.id===resume[1]);if(!d)return 'Rascunho não encontrado nesta conta.';const msg=receber(d.data);sourceId=d.id;walletId=d.walletId||null;return msg;}
   if(!atual)return null;
   if(usuario()!==owner){limpar();return 'Sessão mudou. Revisão cancelada; nenhuma operação registrada.';}
   if(q==='cancelar'||/\b(?:nao|nunca|evite)\b/.test(q)){limpar();return 'Revisão cancelada. Nenhuma pool foi registrada.';}
   if(q.includes('salvar rascunho')||/\bmonta (?:igual|a pool)\b/.test(q)){
    try{const a=rascunhos(),id=sourceId||('img-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));if(a.length>=20&&!a.some(x=>x.id===id))return 'Já há20rascunhos. Retome um deles antes de salvar outro; este continua em revisão.';guardar(a.filter(x=>x.id!==id).concat([{id,data:atual,walletId,createdAt:new Date().toISOString()}]));limpar();evento();return 'Rascunho salvo com pendências em Pools → Rascunhos de prints. Nenhum saldo foi alterado. Retome depois para corrigir e confirmar.';}catch(_){return 'Não consegui salvar o rascunho neste navegador. Ele continua em revisão; nenhum saldo foi alterado.';}
   }
   if(q==='sim'||q==='confirmar'){
    if(!reviewed){const x=schema.preparar(atual);if(x.pendencias.length)return resumo()+' Há pendências. Revise os dados ou salve rascunho.';reviewed=true;return walletId?concluirResumo():'Leitura confirmada. Em qual carteira devo abrir? Informe o nome, por exemplo M2R.';}
    if(!final)return concluirResumo();
    const x=schema.preparar(atual),w=carteira(walletId);if(x.pendencias.length||!w){final=false;return 'Dados mudaram. Revise novamente; nada foi registrado.';}
    if(g.AtlasDemo?.exibindo())return 'Saia do modo demonstração antes de registrar.';
    if(!g.AtlasCaixa.podeGastar(w.id,x.pool.capital).ok)return 'Caixa insuficiente na carteira '+w.name+'. Nenhum depósito ou pool foi criado.';
    if(sourceId){const anteriores=g.DeFiStore.poolsDeTodasCarteiras().concat(g.DeFiStore.closedDeTodasCarteiras());if(anteriores.some(x=>x.pool.oraculoRascunhoId===sourceId)){limpar();return 'Este rascunho já foi registrado. Nenhuma pool duplicada foi criada.';}}
    const t=new Date(),hoje=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
    const p=g.DeFiStore.addPool({...x.pool,walletId:w.id,openedAt:x.pool.openedAt||hoje,createdAt:x.pool.openedAt||hoje,updatedAt:hoje,oraculoRascunhoId:sourceId});
    if(!p)return 'Não consegui registrar a posição. Confira os dados e o caixa.';
    const id=sourceId;limpar();let resto='';if(id){try{guardar(rascunhos().filter(x=>x.id!==id));}catch(_){resto=' O rascunho permaneceu listado, mas está protegido contra registro duplicado.';}}evento();return 'Registrada no Atlas: '+p.base+'/'+p.quote+', carteira '+w.name+', capital '+usd(p.capital)+', ID '+p.id+'.'+resto;
   }
   const wallets=g.AtlasWallets.all().filter(w=>!(w.type==='isolada'&&w.module!=='defi'));
   const citadas=wallets.filter(w=>{const name=norm(w.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9])'+name+'(?=$|[^a-z0-9])').test(q);});
   if(q.includes('?'))return 'O print continua em revisão. '+resumo();
   if(citadas.length!==1)return 'Informe uma única carteira existente, ou use Revisar dados para corrigir a leitura. Nada foi registrado.';
   walletId=citadas[0].id;final=false;return reviewed?concluirResumo():'Carteira '+citadas[0].name+' selecionada. '+resumo()+' Confirma a leitura? Diga sim.';
  }
  return {receber,corrigir,responder,pendente:()=>!!atual,dados:()=>atual?JSON.parse(JSON.stringify(atual)):null};
 }
 g.AtlasOraculoImagemFluxo={criar,rascunhos,excluirRascunho:function(id){guardar(rascunhos().filter(x=>x.id!==id));evento();}};
})(window);
