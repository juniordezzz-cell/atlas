/* ============================================================
   ATLAS — Seed (estado inicial LIMPO)
   ------------------------------------------------------------
   Sem dados de demonstração. O sistema nasce zerado:
   apenas a carteira "Principal", sem estudos, RDs ou trades.
   Bump de version força reset de localStorage antigo.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function emptyWallet() {
    return {
      /* `equity: [0, 0]` saiu: array escrito na criação e lido por
         ninguém. Ver o comentário em core/state.js → emptyWalletData. */
      kpis: { winrate: 0, trades: 0, avgHold: "—", profitFactor: 0 },
      studies: [], rds: [], trades: [], alerts: [],
      archive: { studies: [], trades: [] }
    };
  }

  ATLAS.seed = {
    version: 6,
    currentWallet: "principal",
    wallets: [
      { id: "principal", name: "Principal", tag: "Base", color: "#4C9AFF" }
    ],
    data: {
      principal: emptyWallet()
    }
  };
})(window.ATLAS = window.ATLAS || {});
