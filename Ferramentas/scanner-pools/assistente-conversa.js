(function(g){
  'use strict';
  const identidade=p=>String(p.sid||'manual:'+p.id);
  function historico(messages){return messages.filter(m=>['user','assistant'].includes(m.role)).slice(-6).map(m=>({role:m.role,content:String(m.text||'').slice(0,1200)}));}
  function contextualizar(q,c,ids){
    const follow=/\b(essas?|dessas?|delas?|desses?|destas?|anteriores)\b|entre (as|os) (duas|dois)|\bessa pool\b/i.test(q);
    if(!follow||!ids.length)return c;
    const selected=new Set(ids);return {...c,pools:c.pools.filter(p=>selected.has(identidade(p)))};
  }
  function perguntaDePools(q){
    const texto=String(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(abrir|abre|fechar|fecha|registrar|registre|swap|transferir|transfere)\b/.test(texto))return false;
    return /\b(pool\w*|scanner|tvl|volume|liquidez|orca|raydium|pancake\w*|favorit\w*|oportunidad\w*|razao)\b/.test(texto);
  }
  g.ScannerConversa={historico,contextualizar,identidade,perguntaDePools};
})(window);
