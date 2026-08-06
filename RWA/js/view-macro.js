/* ============================================================
   ATLAS · RWA — view-macro.js
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  var emptyInd = { k: "—", v: 0, unit: "", delta: 0, series: [], good: "flat" };

  window.Views.macro = function () {
    var app = U.qs("#app");
    var m = S.macro() || {};
    var reg = S.regimeMeta(m.regime);
    var roro = m.riskOnOff || 0; // -100..100
    var roroPct = (roro + 100) / 2;
    var roroWord = roro > 25 ? "Risk-On" : roro < -25 ? "Risk-Off" : "Neutro";

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Inteligência macro</div><h1 class="view-title">Macro</h1>' +
        '<div class="view-sub">Leitura institucional do ambiente global — juros, inflação, dólar e liquidez.</div></div></div>' +

      /* Regime + Risk-on/off */
      '<div class="grid g-2 section">' +
        '<div class="panel panel-pad">' +
          '<div class="panel-head"><div><div class="eyebrow">Regime atual</div><h3>Estado do mercado</h3></div></div>' +
          '<div style="display:flex;align-items:center;gap:16px;padding:6px 0">' + U.regime(m.regime) +
          '<span class="t2" style="font-size:13px">O portfólio está posicionado para um ambiente de <b style="color:var(--text)">' + reg.label + ' · ' + reg.tag + '</b>.</span></div>' +
        '</div>' +
        '<div class="panel panel-pad">' +
          '<div class="panel-head"><div><div class="eyebrow">Indicador</div><h3>Risk-On / Risk-Off</h3></div><span class="mono" style="font-weight:600;color:' + (roro > 25 ? "var(--pos)" : roro < -25 ? "var(--neg)" : "var(--text-2)") + '">' + (roro > 0 ? "+" : "") + roro + '</span></div>' +
          '<div class="roro" style="margin-top:8px"><span class="marker" style="left:' + roroPct + '%"></span></div>' +
          '<div class="roro-scale"><span>Risk-Off</span><span>Neutro</span><span>Risk-On</span></div>' +
          '<div class="m-foot" style="margin-top:10px">Viés atual: <b style="color:var(--text)">' + roroWord + '</b> — fluxo institucional favorece ativos de risco com hedge parcial.</div>' +
        '</div>' +
      '</div>' +

      /* 4 indicadores */
      '<div class="grid g-2 section">' +
        indicator("rates", m.rates, "Juros de referência global. Quedas tendem a favorecer duration e ativos de risco.") +
        indicator("inflation", m.inflation, "Inflação ao consumidor. Desaceleração abre espaço para afrouxamento monetário.") +
        indicator("dxy", m.dxy, "Força do dólar. DXY alto pressiona ativos de risco e emergentes.") +
        indicator("liquidity", m.liquidity, "Condições de liquidez global. Expansão é combustível para risco.") +
      '</div>';

    function indicator(id, d, note) {
      d = d || emptyInd;
      var dcls = d.delta > 0 ? "up" : d.delta < 0 ? "down" : "flat";
      var good = (d.good === "up" && d.delta > 0) || (d.good === "down" && d.delta < 0);
      var col = d.good === "flat" ? "var(--text-2)" : good ? "var(--pos)" : "var(--neg)";
      return '<div class="panel panel-pad">' +
        '<div class="panel-head"><div><div class="eyebrow">' + id.toUpperCase() + '</div><h3>' + d.k + '</h3></div>' +
        '<div style="text-align:right"><div class="mono" style="font-size:22px;font-weight:600">' + U.num(d.v, d.unit === "/100" ? 0 : (d.unit === "" ? 1 : 2)) + '<span style="font-size:12px;color:var(--text-3)"> ' + (d.unit || "") + '</span></div>' +
        '<div class="delta ' + dcls + '" style="color:' + col + '">' + (d.delta > 0 ? "+" : "") + U.num(d.delta, d.unit === "/100" ? 0 : 2) + (d.unit === "%" ? "pp" : "") + ' · 60d</div></div></div>' +
        '<div class="chart-box h-md"><canvas id="mc_' + id + '"></canvas></div>' +
        '<div class="m-foot" style="margin-top:10px">' + note + '</div>' +
      '</div>';
    }

    ["rates", "inflation", "dxy", "liquidity"].forEach(function (id) {
      var d = m[id]; if (!d) return;
      var col = d.good === "up" ? "#22C55E" : d.good === "down" ? "#4F8CFF" : "#9CA3AF";
      var pts = (d.series || []).map(function (v, i) { var dt = new Date(); dt.setDate(dt.getDate() - ((d.series || []).length - 1 - i)); return { date: dt.toISOString().slice(0, 10), value: v }; });
      try { Charts.line(U.qs("#mc_" + id), pts, { color: col, fill: col + "22", plain: true }); } catch (e) {}
    });
  };
})();
