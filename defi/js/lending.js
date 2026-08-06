/* ============================================================
   ATLAS · DeFi — lending.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;
  C.mountNav("lending");

  var items = S.lending();
  var totalVal = items.reduce(function (a, i) { return a + i.value; }, 0);
  var totalEarn = items.reduce(function (a, i) { return a + i.earned; }, 0);
  var avgApy = items.length ? items.reduce(function (a, i) { return a + i.apy; }, 0) / items.length : 0;

  U.qs("#lendKpis").innerHTML = [
    C.finCard({ label: "Total Fornecido", value: U.money(totalVal), icon: "lend", accent: "cyan", sub: items.length + " posições" }),
    C.finCard({ label: "Rendimento", value: U.signedMoney(totalEarn), icon: "trend", accent: "green", sub: "acumulado" }),
    C.finCard({ label: "APY Médio", value: U.pct(avgApy), icon: "gauge", accent: "", sub: "ponderado" })
  ].join("");
  U.reveal("#lendKpis .fin-card");

  function healthMeta(h) {
    if (h >= 2.5) return { cls: "up", label: "Saudável" };
    if (h >= 1.5) return { cls: "flat", label: "Moderada" };
    return { cls: "down", label: "Atenção" };
  }

  var grid = U.qs("#lendGrid");
  if (!items.length) {
    grid.outerHTML = C.empty({ icon: "lend", title: "Nenhuma posição de lending", text: "Suas posições de empréstimo aparecerão aqui." });
    return;
  }
  grid.innerHTML = items.map(function (l) {
    var hm = healthMeta(l.health);
    return '<div class="pos-card" style="cursor:default">' +
      '<div class="pos-head"><div class="pos-pair"><div class="pair-icons">' + U.coin(l.token) + '</div>' +
      '<div><div class="pair-name">' + l.token + '</div><div class="pair-proto">' + l.protocol + '</div></div></div>' +
      U.statusDot(l.status) + '</div>' +
      '<div class="pos-tags"><span class="tag tag-chain"><span class="dot" style="background:' + S.colorOf("chain", l.chain) + '"></span>' + l.chain + '</span>' +
      '<span class="tag tag-proto">' + l.protocol + '</span></div>' +
      '<div class="pos-metrics">' +
        '<div class="pos-metric"><div class="k">Fornecido</div><div class="v">' + U.money(l.supplied) + '</div></div>' +
        '<div class="pos-metric"><div class="k">APY</div><div class="v">' + U.pct(l.apy) + '</div></div>' +
        '<div class="pos-metric"><div class="k">Rendimento</div><div class="v delta up">' + U.signedMoney(l.earned) + '</div></div>' +
        '<div class="pos-metric"><div class="k">Saúde <span class="tip"><span class="tip-icon" style="width:13px;height:13px;font-size:9px">?</span><span class="tip-body">Fator de saúde: quanto maior, mais distante da liquidação.</span></span></div><div class="v delta ' + hm.cls + '">' + U.num(l.health, 1) + '</div></div>' +
      '</div></div>';
  }).join("");
  U.reveal("#lendGrid .pos-card");
})();
