/* ============================================================
   ATLAS · RWA — view-dashboard.js
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  window.Views.dashboard = function () {
    var app = U.qs("#app");
    var k = S.kpis();
    var reg = S.regimeMeta(k.regime);
    var byClass = S.allocationByClass();
    var bySector = S.allocationBySector();
    var risk = S.riskEngine();
    var macro = S.macro();

    var riskColor = risk.totalRisk >= 66 ? "#EF4444" : risk.totalRisk >= 40 ? "#F59E0B" : "#22C55E";
    var riskWord = risk.totalRisk >= 66 ? "Elevado" : risk.totalRisk >= 40 ? "Moderado" : "Controlado";

    var emptyM = { k: "—", v: 0, unit: "", delta: 0, series: [], good: "flat" };
    function macroCell(id, m) {
      m = m || emptyM;
      var dcls = m.delta > 0 ? "up" : m.delta < 0 ? "down" : "flat";
      var goodColor = (m.good === "up" && m.delta > 0) || (m.good === "down" && m.delta < 0) ? "var(--pos)" : (m.good === "flat" ? "var(--text-2)" : "var(--neg)");
      return '<div class="panel panel-pad" style="padding:14px 16px">' +
        '<div class="spread"><span class="m-k" style="font-size:12px;color:var(--text-2)">' + m.k + '</span>' +
        '<span class="delta ' + dcls + '" style="color:' + goodColor + '">' + (m.delta > 0 ? "+" : "") + U.num(m.delta, m.unit === "/100" ? 0 : 2) + (m.unit === "%" ? "pp" : "") + '</span></div>' +
        '<div class="mono" style="font-size:21px;font-weight:600;margin:6px 0 8px">' + U.num(m.v, m.unit === "/100" ? 0 : (m.unit === "" ? 1 : 2)) + '<span style="font-size:12px;color:var(--text-3)"> ' + (m.unit || "") + '</span></div>' +
        '<div class="chart-box h-xs"><canvas id="spark_' + id + '"></canvas></div></div>';
    }

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Terminal</div><h1 class="view-title">Dashboard</h1>' +
        '<div class="view-sub">Leitura macro + TradFi + fluxo global do seu patrimônio RWA.</div></div>' +
        '<div>' + U.regime(k.regime) + '</div>' +
      '</div>' +

      /* Row 1 — KPIs */
      '<div class="grid g-4" id="kpis">' +
        UI.kpi({ k: "Total Portfolio Value", v: U.money0(k.total), icon: "wallet", foot: U.delta(k.pnlPct) + '<span class="sub">retorno total</span>' }) +
        UI.kpi({ k: "PnL", v: U.signed(k.pnlAbs), icon: "trend", accent: k.pnlAbs >= 0 ? "apos" : "", foot: '<span class="sub">custo vs. atual</span>' }) +
        UI.kpi({ k: "Risk Score", v: k.riskScore + '<span style="font-size:14px;color:var(--text-3)"> /100</span>', icon: "shield", accent: "awarn", foot: '<span style="color:' + riskColor + '">' + riskWord + '</span>' }) +
        UI.kpi({ k: "Macro Regime", v: '<span style="font-size:17px">' + reg.label + '</span>', icon: "pulse", accent: "a2", foot: '<span class="sub">' + reg.tag + '</span>' }) +
      '</div>' +

      /* Row 2 — Alocações */
      '<div class="grid g-2 section">' +
        UI.panel("Alocação por classe", '<div class="donut-flex"><div class="chart-box donut-hold" style="height:160px"><canvas id="chartClass"></canvas><div class="donut-center"><div class="dc-v">' + byClass.length + '</div><div class="dc-k">classes</div></div></div>' + UI.legend(byClass) + '</div>', '', "Asset Class") +
        UI.panel("Alocação por setor", '<div class="donut-flex"><div class="chart-box donut-hold" style="height:160px"><canvas id="chartSector"></canvas><div class="donut-center"><div class="dc-v">' + bySector.length + '</div><div class="dc-k">setores</div></div></div>' + UI.legend(bySector) + '</div>', '', "Sector") +
      '</div>' +

      /* Row 3 — Equity curve */
      '<div class="section">' +
        UI.panel("Equity Curve", '<div class="chart-box h-lg"><canvas id="chartEquity"></canvas></div>',
          '<div class="t3" style="font-size:11.5px">RWA · HOLD · TOTAL ATLAS · 90d</div>', "Performance") +
      '</div>' +

      /* Row 4 — Macro snapshot */
      '<div class="section">' +
        '<div class="panel panel-pad"><div class="panel-head"><div><div class="eyebrow">Macro</div><h3>Macro Snapshot</h3></div>' + U.regime(macro.regime || k.regime, true) + '</div>' +
        '<div class="grid g-4" id="macroSnap">' +
          macroCell("rates", macro.rates) + macroCell("inflation", macro.inflation) +
          macroCell("dxy", macro.dxy) + macroCell("liquidity", macro.liquidity) +
        '</div></div>' +
      '</div>';

    // charts (todos com guardas — Chart.js pode ainda não ter carregado)
    try { Charts.donut(U.qs("#chartClass"), byClass); } catch (e) {}
    try { Charts.donut(U.qs("#chartSector"), bySector); } catch (e) {}
    var ec = S.equityCurves();
    var ecTotal = Array.isArray(ec.total) ? ec.total : [];
    var ecRwa = Array.isArray(ec.rwa) ? ec.rwa : [];
    var ecHold = Array.isArray(ec.hold) ? ec.hold : [];
    try {
      if (ecTotal.length) Charts.multiLine(U.qs("#chartEquity"), ecTotal.map(function (p) { return p.date; }), [
        { label: "RWA", data: ecRwa.map(function (p) { return p.value; }), color: "#4F8CFF", width: 2.4 },
        { label: "HOLD", data: ecHold.map(function (p) { return p.value; }), color: "#8B5CF6", width: 1.8 },
        { label: "TOTAL ATLAS", data: ecTotal.map(function (p) { return p.value; }), color: "#22C55E", width: 1.8, dash: [5, 4] }
      ]);
    } catch (e) {}
    ["rates", "inflation", "dxy", "liquidity"].forEach(function (id) {
      var m = macro[id]; if (!m) return;
      var col = (m.good === "up") ? "#22C55E" : (m.good === "down") ? "#4F8CFF" : "#9CA3AF";
      try { Charts.spark(U.qs("#spark_" + id), m.series || [], col); } catch (e) {}
    });

    U.reveal("#kpis .kpi");
  };
})();
