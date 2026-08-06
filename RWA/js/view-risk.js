/* ============================================================
   ATLAS · RWA — view-risk.js
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  function heatColor(pct) {
    // 0% -> azul calmo ; 50%+ -> vermelho
    var t = Math.max(0, Math.min(1, pct / 50));
    var r = Math.round(79 + (239 - 79) * t);
    var g = Math.round(140 + (68 - 140) * t);
    var b = Math.round(255 + (68 - 255) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  window.Views.risk = function () {
    var app = U.qs("#app");
    var R = S.riskEngine();
    var riskColor = R.totalRisk >= 66 ? "#EF4444" : R.totalRisk >= 40 ? "#F59E0B" : "#22C55E";
    var riskWord = R.totalRisk >= 66 ? "Elevado" : R.totalRisk >= 40 ? "Moderado" : "Controlado";

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Gestão de risco</div><h1 class="view-title">Risk Engine</h1>' +
        '<div class="view-sub">Concentração, exposição e alertas — visão de mesa institucional.</div></div></div>' +

      '<div class="grid g-3 section">' +
        '<div class="panel panel-pad">' +
          '<div class="eyebrow">Risco total</div>' +
          '<div class="mono" style="font-size:38px;font-weight:600;color:' + riskColor + ';line-height:1.1;margin:6px 0">' + R.totalRisk + '<span style="font-size:15px;color:var(--text-3)"> /100</span></div>' +
          '<div class="m-track" style="height:8px"><i style="left:0;width:' + R.totalRisk + '%;background:' + riskColor + '"></i></div>' +
          '<div class="m-foot" style="margin-top:9px">Nível <b style="color:' + riskColor + '">' + riskWord + '</b> — combina concentração e qualidade média dos ativos.</div>' +
        '</div>' +
        '<div class="panel panel-pad">' +
          '<div class="eyebrow">Maior concentração</div>' +
          '<div style="font-size:20px;font-weight:700;margin:8px 0 2px">' + R.topSector.label + '</div>' +
          '<div class="mono" style="font-size:15px;color:var(--warn)">' + U.pct(R.topSector.pct) + ' do portfólio</div>' +
          '<div class="m-foot" style="margin-top:9px">Limite de referência: 40% por setor.</div>' +
        '</div>' +
        '<div class="panel panel-pad">' +
          '<div class="eyebrow">Ativos monitorados</div>' +
          '<div class="mono" style="font-size:38px;font-weight:600;line-height:1.1;margin:6px 0">' + R.byAsset.length + '</div>' +
          '<div class="m-foot">' + R.byAsset.filter(function (a) { return a.pct > 15; }).length + ' com peso acima de 15%.</div>' +
        '</div>' +
      '</div>' +

      /* Heatmap por setor */
      '<div class="section">' + UI.panel("Concentração por setor", '<div class="heat-grid" id="heatSector" style="grid-template-columns:repeat(3,1fr)"></div>', '', "Heatmap") + '</div>' +

      /* Concentração por ativo */
      '<div class="grid g-2 section">' +
        UI.panel("Concentração por ativo", '<div class="chart-box h-lg"><canvas id="chartConc"></canvas></div>', '', "Exposição") +
        UI.panel("Alertas", '<div id="alerts" style="display:flex;flex-direction:column;gap:10px"></div>', '', "Overexposure") +
      '</div>';

    // heatmap setor
    U.qs("#heatSector").innerHTML = R.bySector.map(function (s) {
      var c = heatColor(s.pct);
      return '<div class="heat-cell" style="border-color:' + c + '55">' +
        '<div style="position:absolute;inset:0;background:' + c + ';opacity:' + (0.06 + Math.min(0.22, s.pct / 220)) + '"></div>' +
        '<div class="hc-k">' + s.label + '</div>' +
        '<div class="hc-v" style="color:' + c + '">' + U.pct(s.pct) + '</div>' +
        '<div class="hc-sub">' + U.money0(s.value) + '</div>' +
      '</div>';
    }).join("");

    // barras por ativo
    Charts.bar(U.qs("#chartConc"),
      R.byAsset.map(function (a) { return a.label; }),
      R.byAsset.map(function (a) { return +a.pct.toFixed(1); }),
      R.byAsset.map(function (a) { return heatColor(a.pct); }),
      { horizontal: true, pct: true });

    // alertas
    U.qs("#alerts").innerHTML = R.alerts.map(function (al) {
      var icon = al.level === "ok" ? "check" : "alert";
      return '<div class="alert ' + al.level + '">' + U.icon(icon) + '<span class="a-txt">' + al.text + '</span></div>';
    }).join("");
  };
})();
