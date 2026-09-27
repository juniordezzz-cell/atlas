(function(g){
  'use strict';
  const identidade=p=>String(p.sid||'manual:'+p.id);
  function historico(messages){return messages.filter(m=>['user','assistant'].includes(m.role)).slice(-6).map(m=>({role:m.role,content:String(m.text||'').slice(0,1200)}));}
  function contextualizar(q,c,ids){
    const follow=/\b(essas?|dessas?|delas?|desses?|destas?|anteriores)\b|entre (as|os) (duas|dois)|\bessa pool\b/i.test(q);
    if(!follow||!ids.length)return c;
    const selected=new Set(ids);return {...c,pools:c.pools.filter(p=>selected.has(identidade(p)))};
  }
  g.ScannerConversa={historico,contextualizar,identidade};
})(window);
