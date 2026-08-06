/* ============================================================
   ATLAS · RWA — view-asset.js  (página crítica)
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  // gerador local determinístico p/ benchmarks
  function bench(n, drift, vol, seed) {
    var out = [], v = 100, s = seed;
    for (var i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; var r = s / 233280; v = v * (1 + drift / 100 + (r - 0.5) * vol / 100); out.push(+v.toFixed(2)); }
    return out;
  }
  function rebase(arr) { var f = arr[0] || 1; return arr.map(function (x) { return +(x / f * 100).toFixed(2); }); }

  window.Views.asset = function (ctx) {
    var app = U.qs("#app");
    var a = S.asset(ctx.params.id);
    if (!a) { app.innerHTML = UI.empty({ icon: "alert", title: "Ativo não encontrado", text: "Volte ao portfolio e selecione um ativo." }); return; }

    var pcls = a.pnlPct > 0 ? "val-pos" : a.pnlPct < 0 ? "val-neg" : "val-flat";
    var cumReturn = a.history.length ? (a.history[a.history.length - 1] / a.history[0] - 1) * 100 : 0;

    app.innerHTML =
      '<a class="btn btn-ghost btn-sm" href="#/portfolio" style="margin-bottom:14px">' + U.icon("back") + 'Portfolio</a>' +

      /* BLOCO 1 — Overview */
      '<div class="panel panel-pad" style="margin-bottom:14px">' +
        '<div class="spread" style="flex-wrap:wrap;gap:16px">' +
          '<div class="row" style="gap:14px">' +
            '<span class="asset-tkn" style="width:46px;height:46px;font-size:12px;border-radius:12px;background:' + a.color + '">' + a.ticker.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() + '</span>' +
            '<div><div style="font-size:20px;font-weight:700">' + a.name + '</div>' +
              '<div class="row" style="gap:9px;margin-top:3px"><span class="asset-tick" style="font-size:12.5px">' + a.ticker + '</span><span class="dot-sep">·</span><span class="tag">' + a.type + '</span><span class="tag">' + a.sector + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="row" style="gap:24px">' +
            metric("RWA Score", U.score(a.score)) +
            metric("Status", U.status(a.status)) +
            metric("Exposição", '<span class="mono" style="font-size:16px;font-weight:600">' + U.pct(a.weight) + '</span>') +
            metric("Sensib. regime", U.sens(a.regimeSens)) +
          '</div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="grid g-4">' +
          mini("Entrada", U.money0(a.entry)) +
          mini("Valor atual", U.money0(a.current)) +
          mini("PnL", '<span class="' + pcls + '">' + U.signed(a.pnlAbs) + ' · ' + U.pct(a.pnlPct, true) + '</span>') +
          mini("Retorno acumulado", '<span class="' + (cumReturn >= 0 ? "val-pos" : "val-neg") + '">' + U.pct(cumReturn, true) + '</span>') +
        '</div>' +
      '</div>' +

      /* BLOCO 2 — Camadas de análise */
      '<div class="grid g-3" style="margin-bottom:14px">' +
        layer("lc-fund", "coins", "Fundamental", "TradFi", a.fundamental) +
        layer("lc-macro", "macro", "Macro", "Ciclo & risco", a.macro) +
        layer("lc-token", "layers", "Token Layer", "On-chain", a.token) +
      '</div>' +

      /* BLOCO 3 — Performance */
      UI.panel("Performance", '<div class="chart-box h-lg"><canvas id="chartAsset"></canvas></div>',
        '<div class="t3" style="font-size:11.5px">Rebase 100 · vs S&P 500 · vs BTC · 90d</div>', "Preço & comparação");

    function metric(k, v) { return '<div style="text-align:right"><div class="eyebrow" style="margin-bottom:5px">' + k + '</div>' + v + '</div>'; }
    function mini(k, v) { return '<div><div class="kpi-k" style="margin-bottom:4px">' + k + '</div><div class="mono" style="font-size:17px;font-weight:600">' + v + '</div></div>'; }
    function layer(cls, icon, title, sub, pairs) {
      return '<div class="panel layer-card ' + cls + '">' +
        '<div class="lc-head"><span class="lc-ic">' + U.icon(icon) + '</span><span class="lc-title">' + title + ' <span class="s">· ' + sub + '</span></span></div>' +
        '<div class="dl">' + pairs.map(function (p) { return '<div class="dl-row"><span class="k">' + p.k + '</span><span class="v">' + p.v + '</span></div>'; }).join("") + '</div>' +
      '</div>';
    }

    // chart: ativo rebased vs S&P vs BTC
    var n = a.history.length;
    var labels = a.history.map(function (_, i) { var d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().slice(0, 10); });
    Charts.multiLine(U.qs("#chartAsset"), labels, [
      { label: a.ticker, data: rebase(a.history), color: a.color === "#64748B" ? "#4F8CFF" : a.color, width: 2.4 },
      { label: "S&P 500", data: bench(n, 0.12, 1.0, 77), color: "#9CA3AF", width: 1.6 },
      { label: "BTC", data: bench(n, 0.20, 3.0, 91), color: "#F59E0B", width: 1.6, dash: [5, 4] }
    ], { plain: true });
  };
})();
