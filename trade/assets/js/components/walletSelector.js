/* ============================================================
   ATLAS — Seletor de carteiras (barra superior) · Trade
   ------------------------------------------------------------
   Delegado 100% ao componente compartilhado (/wallets). Este
   módulo não monta markup, não liga clique e não tem CSS de
   seletor — o componente é o mesmo do Dashboard, do Hold, do
   DeFi, do RWA e dos Relatórios, com as mesmas medidas.

   Trocar a carteira dispara ATLAS.app.setWallet(id), que notifica
   todos os assinantes — Dashboard e Oráculo se atualizam sozinhos.
   O saldo mostrado vem do LEDGER CENTRAL, alimentado aqui pelo
   equity que o Trade já calcula por carteira.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var sel = {
    mount: function (el) {
      if (!el || !window.WalletSelector || !window.AtlasWallets) return;
      var u = ATLAS.util, app = ATLAS.app;

      window.WalletSelector.render(el, {
        module: "trade", scope: "module",
        money: u.money,
        balanceModule: "trade",     // o saldo por carteira é o do Trade
        /* o Trade guarda a carteira em uso no estado dele: é por ela
           que os dados do módulo são particionados */
        getActive: app.currentWallet,
        onSelect: function (id) { app.setWallet(id); },   // emite → assinantes atualizam
        /* alimenta o ledger central com o equity de cada carteira */
        feed: function () {
          var data = (app.allWalletData ? app.allWalletData() : (app.getState().data || {}));
          return Object.keys(data).map(function (id) {
            var eq = data[id] && data[id].equity;
            var v = (eq && eq.length) ? eq[eq.length - 1] : 0;
            return { id: id, module: "trade", capital: v, saldo: v, valorAtual: v, assets: [] };
          });
        },
        afterChange: function (w, acao) { if (acao === "create") app.setWallet(w.id); }
      });
    }
  };

  ATLAS.walletSelector = sel;
})(window.ATLAS = window.ATLAS || {});
