/* ============================================================
   ATLAS · DeFi — staking.js
   ------------------------------------------------------------
   Entrada da tela. A implementação é compartilhada com o Lending
   (defi/js/rendimentos.js): as duas são capital que sai do caixa,
   rende e volta — só mudam APR/APY e o nome do rendimento.
   ============================================================ */
(function () {
  "use strict";
  window.C.mountNav("staking");
  window.DeFiRendimentos.montar("staking", {
    kpis: "#stakeKpis", grid: "#stakeGrid", btnNovo: "#btnNovoStake"
  });
})();
