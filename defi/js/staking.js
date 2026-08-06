/* ============================================================
   ATLAS · DeFi — staking.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;
  C.mountNav("staking");

  var items = S.staking();
  var totalVal = items.reduce(function (a, i) { return a + i.value; }, 0);
  var totalRew = items.reduce(function (a, i) { return a + i.rewards; }, 0);
  var avgApr = items.length ? items.reduce(function (a, i) { return a + i.apr; }, 0) / items.length : 0;

  U.qs("#stakeKpis").innerHTML = [
    C.finCard({ label: "Total em Staking", value: U.money(totalVal), icon: "stake", accent: "violet", sub: items.length + " ativos" }),
    C.finCard({ label: "Recompensas", value: U.num(totalRew, 3), icon: "trend", accent: "green", sub: "acumuladas" }),
    C.finCard({ label: "APR Médio", value: U.pct(avgApr), icon: "gauge", accent: "cyan", sub: "ponderado" })
  ].join("");
  U.reveal("#stakeKpis .fin-card");

  var grid = U.qs("#stakeGrid");
  if (!items.length) {
    grid.outerHTML = C.empty({ icon: "stake", title: "Nenhum ativo em staking", text: "Suas posições de staking aparecerão aqui." });
    return;
  }
  grid.innerHTML = items.map(function (s) {
    return '<div class="pos-card" style="cursor:default">' +
      '<div class="pos-head"><div class="pos-pair"><div class="pair-icons">' + U.coin(s.token) + '</div>' +
      '<div><div class="pair-name">' + s.token + '</div><div class="pair-proto">' + s.protocol + '</div></div></div>' +
      U.statusDot(s.status) + '</div>' +
      '<div class="pos-tags"><span class="tag tag-chain"><span class="dot" style="background:' + S.colorOf("chain", s.chain) + '"></span>' + s.chain + '</span>' +
      '<span class="tag tag-proto">' + s.protocol + '</span></div>' +
      '<div class="pos-metrics">' +
        '<div class="pos-metric"><div class="k">Quantidade</div><div class="v">' + U.num(s.amount, 2) + '</div></div>' +
        '<div class="pos-metric"><div class="k">APR</div><div class="v">' + U.pct(s.apr) + '</div></div>' +
        '<div class="pos-metric"><div class="k">Valor</div><div class="v">' + U.money(s.value) + '</div></div>' +
        '<div class="pos-metric"><div class="k">Recompensas</div><div class="v delta up">' + U.num(s.rewards, 3) + '</div></div>' +
      '</div></div>';
  }).join("");
  U.reveal("#stakeGrid .pos-card");
})();
