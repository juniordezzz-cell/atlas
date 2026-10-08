/* Conversas do Oráculo do Scanner (08/10/2026).

   Várias conversas salvas neste navegador, cada uma com título (a primeira
   pergunta) e data; e a conversa TEMPORÁRIA, que some sozinha 24 h depois de
   criada. Fica no localStorage, como as decisões do Scanner — não vai para o
   servidor e não aparece em outro aparelho.

   As pools das respostas são guardadas enxutas (só o que o cartão e o link
   usam): uma resposta trazia o objeto inteiro de cada pool, com histórico. */
(function(g){
  'use strict';
  const CHAVE='atlas.scanner.oraculo.conversas.v1';
  const MAX_CONVERSAS=50, MAX_MSGS=80, DIA=24*60*60*1000;
  const agoraMs=a=>a!=null?Number(a):Date.now();
  function uid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

  function ler(){
    try{const v=JSON.parse(g.localStorage.getItem(CHAVE)||'[]');return Array.isArray(v)?v:[];}catch(_e){return [];}
  }
  function gravar(lista){
    try{g.localStorage.setItem(CHAVE,JSON.stringify(lista));return true;}catch(_e){return false;}
  }
  /* tira as vencidas (temporárias com mais de 24 h) e as vazias */
  function podar(lista,agora){
    const t=agoraMs(agora);
    return lista.filter(c=>c&&Array.isArray(c.mensagens)&&c.mensagens.length&&!(c.temporaria&&t>=c.expiraEm));
  }
  function carregar(agora){
    const lista=podar(ler(),agora);
    gravar(lista);
    return lista.sort((a,b)=>b.atualizadaEm-a.atualizadaEm);
  }
  function nova(opcoes,agora){
    const t=agoraMs(agora),temp=!!(opcoes&&opcoes.temporaria);
    return {id:uid(),titulo:'',criadaEm:t,atualizadaEm:t,temporaria:temp,expiraEm:temp?t+DIA:null,mensagens:[]};
  }
  function titulo(c){
    const q=(c.mensagens||[]).find(m=>m.role==='user');
    const t=String((q&&q.text)||'Conversa').replace(/\s+/g,' ').trim();
    return t.length>60?t.slice(0,57)+'…':t;
  }
  /* só o que o cartão e o link da pool usam */
  function compactarPool(p){
    if(!p)return null;
    const s=p.sinais||{};
    return {id:p.id,sid:p.sid,servidor:!!p.servidor,pool:p.pool,platform:p.platform,network:p.network,
      tvl:p.tvl,vol24h:p.vol24h,fee:p.fee,nota:p.nota,fav:!!p.fav,tokens:p.tokens||null,
      sinais:{memecoin:{detectada:!!(s.memecoin&&s.memecoin.detectada)},categoria:s.categoria||null,emissor:s.emissor||null,
        endereco_pool:s.endereco_pool||null,conferencia:s.conferencia&&s.conferencia.endereco?{endereco:s.conferencia.endereco}:null}};
  }
  function compactarMensagem(m){
    const out={role:m.role,text:String(m.text||'')};
    ['local','tipo','question','aviso','feedbackStatus'].forEach(k=>{if(m[k]!=null&&m[k]!=='')out[k]=m[k];});
    if(m.ia)out.ia=true;
    if(Array.isArray(m.items)&&m.items.length)out.items=m.items.slice(0,10).map(x=>({
      pool:compactarPool(x.pool),estimativa:x.estimativa,delta:x.delta,pct:x.pct,base:x.base})).filter(x=>x.pool);
    return out;
  }
  /* grava (ou atualiza) uma conversa na lista e devolve a lista nova */
  function salvar(lista,c,agora){
    if(!c||!c.mensagens.length)return lista;
    c.atualizadaEm=agoraMs(agora);
    if(!c.titulo)c.titulo=titulo(c);
    const guardada=Object.assign({},c,{mensagens:c.mensagens.slice(-MAX_MSGS).map(compactarMensagem)});
    const resto=lista.filter(x=>x.id!==c.id);
    const nova=[guardada,...resto].slice(0,MAX_CONVERSAS);
    gravar(podar(nova,agora));
    return nova;
  }
  function apagar(lista,id){const nova=lista.filter(x=>x.id!==id);gravar(nova);return nova;}
  /* "expira em 23 h" / "expira em 40 min" */
  function restante(c,agora){
    if(!c||!c.temporaria)return '';
    const ms=Math.max(0,c.expiraEm-agoraMs(agora));
    return ms>=3600000?'expira em '+Math.ceil(ms/3600000)+' h':'expira em '+Math.max(1,Math.ceil(ms/60000))+' min';
  }
  g.ScannerConversas={CHAVE,carregar,nova,salvar,apagar,podar,titulo,restante,compactarMensagem};
})(window);
