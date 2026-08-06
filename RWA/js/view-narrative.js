/* ============================================================
   ATLAS · RWA — view-narrative.js  (diferencial do sistema)
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  window.Views.narrative = function () {
    var app = U.qs("#app");
    var n = S.narrative() || {};
    var emptyCycle = { v: "—", dir: "up" };
    n.current = n.current || "—";
    n.impact = n.impact || "—";
    n.confidence = n.confidence || 0;
    n.liquidityCycle = n.liquidityCycle || emptyCycle;
    n.hedgeCycle = n.hedgeCycle || emptyCycle;
    n.cryptoRotation = n.cryptoRotation || emptyCycle;
    n.institutionalInflows = n.institutionalInflows || emptyCycle;

    function dir(o) {
      o = o || emptyCycle;
      var up = o.dir === "up";
      return '<span class="cy-dir" style="color:' + (up ? "var(--pos)" : "var(--neg)") + '">' + U.icon(up ? "up" : "down") + (up ? "Fortalecendo" : "Enfraquecendo") + '</span>';
    }
    function cycle(k, o, icon, accent) {
      return '<div class="panel cycle">' +
        '<div class="row" style="justify-content:space-between"><span class="cy-k">' + k + '</span><span class="lc-ic ' + accent + '" style="width:26px;height:26px;border-radius:7px;display:grid;place-items:center">' + U.icon(icon) + '</span></div>' +
        '<div class="cy-v">' + o.v + '</div>' + dir(o) +
      '</div>';
    }

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Leitura de mercado</div><h1 class="view-title">Narrative Engine</h1>' +
        '<div class="view-sub">A tese macro dominante que orienta o posicionamento do portfólio.</div></div></div>' +

      /* Hero */
      '<div class="narrative-hero section">' +
        '<div class="nh-label">Current Narrative</div>' +
        '<div class="nh-title">' + n.current + '</div>' +
        '<div class="nh-impact">Impacto: <b style="color:var(--text)">' + n.impact + '</b></div>' +
        '<div class="nh-conf">' + UI.meter({ k: "Confiança", v: n.confidence + "%", pct: n.confidence, color: n.confidence >= 70 ? "#22C55E" : n.confidence >= 50 ? "#4F8CFF" : "#F59E0B", foot: "Convicção do modelo sobre a narrativa vigente." }) + '</div>' +
      '</div>' +

      /* Ciclos */
      '<div class="grid g-4 section" id="cycles">' +
        cycle("Liquidity Cycle", n.liquidityCycle, "drop", "lc-fund") +
        cycle("Hedge Cycle", n.hedgeCycle, "shield", "lc-token") +
        cycle("Crypto Rotation", n.cryptoRotation, "coins", "lc-macro") +
        cycle("Institutional Inflows", n.institutionalInflows, "bank", "lc-fund") +
      '</div>' +

      /* Nota Oráculo */
      '<div class="section"><div class="alert ok" style="border-color:var(--border-accent);background:var(--accent-soft);color:var(--accent)">' + U.icon("info") +
        '<span class="a-txt">Esta leitura é descritiva — organiza sinais macro e de fluxo. Futuramente o <b>Oráculo</b> vai cruzar esta narrativa com suas posições para sugerir leituras, sem jamais fazer previsões de mercado.</span></div></div>';

    U.reveal("#cycles .cycle");
  };
})();
