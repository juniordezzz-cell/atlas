/* Carrega o motor e as fontes reais somente quando há comando de operação. */
(function(g){
  'use strict';
  const carregando=new Map();let sessao=null;
  function script(src,global){
    if(g[global])return Promise.resolve();
    if(carregando.has(src))return carregando.get(src);
    const p=new Promise((resolve,reject)=>{
      const el=document.createElement('script');el.src=src;
      el.onload=()=>g[global]?resolve():reject(Error('Fonte de dados não inicializada.'));
      el.onerror=()=>{el.remove();reject(Error('Não foi possível carregar os dados.'));};
      document.head.appendChild(el);
    });carregando.set(src,p);p.catch(()=>carregando.delete(src));return p;
  }
  async function responder(q,raiz){
    if(!sessao&&!/\b(?:registra|registre|abrir|abre|abra|abri|fecha|feche|fechar|fechei|encerra|encerre|encerrei|swap|troquei|troque|troca|transferi|transfere|transferir|transfira|confirmar|cancelar)\b/i.test(q))return null;
    try{
      await script(raiz+'core/atlas-oraculo-operacoes.js','AtlasOraculoOperacoes');
      if(!sessao)sessao=g.AtlasOraculoOperacoes.criar();
      if(!g.AtlasOraculoOperacoes.reconhece(q)&&!sessao.pendente())return null;
      for(const [path,key] of [['wallets/walletStore.js','AtlasWalletStore'],['wallets/walletTypes.js','AtlasWalletTypes'],['wallets/walletLedger.js','AtlasWalletLedger'],['wallets/walletCaixa.js','AtlasCaixa'],['wallets/walletManager.js','AtlasWallets'],['defi/js/data.js','DeFiStore']])await script(raiz+path,key);
      return sessao.responder(q);
    }catch(_e){return 'Não consegui carregar o motor de operações. Nenhum registro foi feito; tente novamente.';}
  }
  g.AtlasOraculoAcoes={responder};
})(window);
