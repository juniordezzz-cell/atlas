/* Ponte do Scanner para sua Edge Function. Nunca recebe chave OpenRouter. */
(function(g){
  'use strict';
  const MAX=30;
  function endpoint(){const url=g.ATLAS_SUPABASE&&g.ATLAS_SUPABASE.url;return url?url.replace(/\/$/,'')+'/functions/v1/scanner-chat':null;}
  function normas(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
  function elegiveis(c,q){
    const seen=new Set(),pending=/pendent|analise|meme/.test(normas(q).toLowerCase());
    return (c.pools||[]).filter(p=>{
      const tvl=Number(p.tvl),vol=Number(p.vol24h),trilho=c.trilho(p);
      if(p.migrada||p.arquivada||!Number.isFinite(tvl)||tvl<100000||!Number.isFinite(vol)||vol/tvl<=.5||trilho==='oculta'||(trilho!=='solida'&&!pending))return false;
      if(p.trilho==='barrada'||(p.sinais?.memecoin?.detectada&&vol/tvl<=2))return false;
      if((g.ScannerConsultas?.memeExcluida(q)||(c.preferencias?.evitarMemes&&!g.ScannerConsultas?.memePermitida(q)))&&p.sinais?.memecoin?.detectada)return false;
      const nets=['solana','base','arbitrum','ethereum','bnb chain','polygon','optimism','avalanche','sui','hyperevm','robinhood'];
      if(c.preferencias?.redes?.length&&!nets.some(v=>new RegExp('\\b'+v+'\\b','i').test(q))&&!c.preferencias.redes.some(v=>normas(v)===normas(p.network)))return false;
      const id=String(p.sid||'manual:'+p.id);if(seen.has(id))return false;seen.add(id);return true;
    });
  }
  function contexto(q,c,r){
    const ps=elegiveis(c,q),ids=new Set((r.items||[]).map(x=>x.pool?.sid||x.pool?.id||x.id).map(String));
    // Nas consultas calculadas, só o resultado aprovado pelos filtros locais pode virar candidata da IA.
    const candidatas=r.tipo==='ajuda'?ps:(r.items||[]).map(x=>x.pool).filter(Boolean);
    const words=normas(q).match(/\b[A-Z][A-Z0-9]{1,9}\b/g)||[];
    const relevant=p=>words.some(w=>normas(p.pool).split(/[^A-Z0-9]+/).includes(w));
    const favorite=/favorit/i.test(q);
    const ordered=candidatas.slice().sort((a,b)=>{
      const score=p=>Number(ids.has(String(p.sid||p.id)))*10000+Number(relevant(p))*1000+Number(favorite&&p.fav)*500+(Number(p.nota)||0);
      return score(b)-score(a)||Number(b.tvl)-Number(a.tvl);
    });
    return {question:q,localAnswer:r.tipo==='ajuda'?'':String(r.texto||'').slice(0,7000),
      pools:ordered.slice(0,MAX).map(p=>({id:String(p.sid||'manual:'+p.id),par:p.pool,rede:p.network,dex:p.platform,tvl:p.tvl,
        volume24h:p.vol24h,feePercent:p.fee,nota:p.nota,categoria:p.sinais?.memecoin?.detectada?'memecoin detectada':'não confirmada',
        favorita:!!p.fav,atualizadoEm:p.updatedAt?new Date(p.updatedAt).toISOString():null})),
      totalElegiveis:candidatas.length,dadosEmCache:!!c.status?.doCache,historicoInsuficiente:!!r.indisponiveis};
  }
  async function status(){
    const url=endpoint();if(!url)return {enabled:false};
    try{const res=await g.fetch(url,{method:'GET',headers:{apikey:g.ATLAS_SUPABASE.publishableKey}});return res.ok?await res.json():{enabled:false};}catch(_e){return {enabled:false};}
  }
  async function chamada(body){
    const url=endpoint(),user=g.firebase?.auth?.().currentUser;
    if(!url||!user?.getIdToken)throw Error('Entre no Atlas para usar a memória e a IA.');
    const token=await user.getIdToken();
    const res=await g.fetch(url,{method:'POST',headers:{apikey:g.ATLAS_SUPABASE.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    let data={};try{data=await res.json();}catch(_e){}
    if(!res.ok){const error=new Error(data.error||'IA indisponível.');error.status=res.status;throw error;}
    return data;
  }
  async function responder(q,c,r,history=[]){
    if(!endpoint()||!g.firebase?.auth?.().currentUser?.getIdToken)return {disponivel:false};
    const data=await chamada({...contexto(q,c,r),history});
    if(/content-safety/i.test(String(data.model||''))||/^\s*(?:user|assistant)\s+safety\s*:\s*(?:safe|unsafe)\b/i.test(String(data.answer||'').replace(/[*`_]/g,'')))throw Error('Resposta inválida da IA. Resultado local preservado.');
    return {disponivel:true,answer:String(data.answer||''),truncated:!!data.truncated,model:data.model||'não informado',usage:data.usage};
  }
  g.ScannerIA={status,responder,contexto,memoria:()=>chamada({operation:'memory.get'}),salvarMemoria:preferences=>chamada({operation:'memory.set',preferences}),avaliar:feedback=>chamada({operation:'feedback',feedback}),apagarAvaliacoes:()=>chamada({operation:'feedback.clear'})};
})(window);
