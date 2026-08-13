/* ============================================================
   ATLAS · DeFi — lending.js
   ------------------------------------------------------------
   Entrada da tela. Ver defi/js/rendimentos.js — a mecânica do
   dinheiro é a mesma do Staking; o que muda é vocabulário.
   ============================================================ */
(function () {
  "use strict";
  window.C.mountNav("lending");
  window.DeFiRendimentos.montar("lending", {
    kpis: "#lendKpis", grid: "#lendGrid", btnNovo: "#btnNovoLend"
  });
})();
