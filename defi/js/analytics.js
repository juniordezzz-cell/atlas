/* ============================================================
   ATLAS · DeFi — analytics.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;
  C.mountNav("analytics");

  /* Evolução patrimonial */
  Charts.line(U.qs("#aEvo"), S.portfolioHistory(), { color: "#5B9BFF", fill: "rgba(59,130,246,0.18)" });
  /* Evolução dos lucros */
  Charts.line(U.qs("#aProfit"), S.profitHistory(), { color: "#34D399", fill: "rgba(52,211,153,0.16)" });

  /* APR realizado por posição (ativas + encerradas) */
  var all = S.pools().concat(S.closed()).filter(function (p) { return p.apr > 0; });
  var labels = all.map(function (p) { return p.base + "/" + p.quote; });
  var vals = all.map(function (p) { return +p.apr.toFixed(1); });
  var cols = all.map(function (p) { return S.colorOf("proto", p.protocol); });
  Charts.bar(U.qs("#aApr"), labels, vals, cols);

  /* Distribuições */
  var donut = null;
  var titleMap = { protocol: "Por protocolo", chain: "Por blockchain", token: "Por token", category: "Por categoria" };

  function drawDist(by) {
    var items = S.distribution(by);
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (donut) donut.destroy();
    donut = Charts.donut(U.qs("#aDonut"), items);
    U.qs("#dcVal").textContent = U.money(total, { dec: 0 });
    U.qs("#aLegend").innerHTML = items.map(function (i) {
      return '<div class="legend-item"><span class="lg-l"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span><span class="lg-v">' + U.pct(i.pct) + '</span></div>';
    }).join("");
    U.qs("#aBarTitle").textContent = titleMap[by];
    U.qs("#aBars").innerHTML = items.map(function (i) {
      return '<div class="dist-item"><div class="dist-top">' +
        '<span class="dist-label"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span>' +
        '<span class="dist-val">' + U.money(i.value) + '</span></div>' +
        '<div class="dist-bar"><i style="width:' + i.pct + '%;background:' + i.color + '"></i></div></div>';
    }).join("");
  }
  drawDist("protocol");

  U.qsa("#aDistToggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      U.qsa("#aDistToggle button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      drawDist(b.dataset.d);
    });
  });
})();
