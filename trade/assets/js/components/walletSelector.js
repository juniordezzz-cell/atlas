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

      /* Totais do Trade numa carteira qualquer: o último ponto da curva
         de equity. Única regra de cálculo do módulo — alimenta o cache
         (feed) e responde à leitura ao vivo (registerLive), então as
         duas não podem divergir. */
      function totaisDe(walletId) {
        var data = (app.allWalletData ? app.allWalletData() : (app.getState().data || {}));
        var eq = data[walletId] && data[walletId].equity;
        var v = (eq && eq.length) ? Number(eq[eq.length - 1]) || 0 : 0;
        return { id: walletId, module: "trade", capital: v, saldo: v, valorAtual: v, assets: [] };
      }

      if (window.AtlasWallets.registerLive) {
        window.AtlasWallets.registerLive("trade", totaisDe);
      }

      window.WalletSelector.render(el, {
        module: "trade", scope: "module",
        money: u.money,
        balanceModule: "trade",     // o saldo por carteira é o do Trade
        /* o Trade guarda a carteira em uso no estado dele: é por ela
           que os dados do módulo são particionados */
        getActive: app.currentWallet,
        onSelect: function (id) { app.setWallet(id); },   // emite → assinantes atualizam
        feed: function () {
          var data = (app.allWalletData ? app.allWalletData() : (app.getState().data || {}));
          return Object.keys(data).map(totaisDe);
        },
        afterChange: function (w, acao) { if (acao === "create") app.setWallet(w.id); }
      });
    }
  };

  ATLAS.walletSelector = sel;
})(window.ATLAS = window.ATLAS || {});
