/* ============================================================
   ATLAS — Módulo Analytics (Sprint 5)
   ------------------------------------------------------------
   Pós-Análise → Métricas → Oráculo aprende. Consolida os trades
   encerrados em desempenho, distribuição e aprendizados.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var mountRef = null;

  function kpi(label, value, sub, cls) {
    return '<div class="card card--hover kpi reveal"><span class="kpi__label">' + label + '</span>' +
      '<span class="kpi__value mono ' + (cls || "") + '">' + value + '</span>' +
      '<span class="kpi__sub">' + (sub || "") + '</span></div>';
  }

  function bars(items, maxAbs) {
    return '<div class="an__bars">' + items.map(function (it) {
      var w = maxAbs ? Math.max(4, Math.round(Math.abs(it.value) / maxAbs * 100)) : 4;
      return '<div class="an__bar-row"><span class="an__bar-label mono">' + ATLAS.util.escape(it.label) + '</span>' +
        '<div class="an__bar-track"><span class="an__bar-fill ' + (it.value >= 0 ? "up" : "down") + '" style="width:' + w + '%;background:' + (it.value >= 0 ? "var(--profit)" : "var(--loss)") + '"></span></div>' +
        '<span class="an__bar-val mono ' + (it.value >= 0 ? "up" : "down") + '">' + ATLAS.util.pct(it.value) + '</span></div>';
    }).join("") + '</div>';
  }

  function render(mount) {
    mountRef = mount;
    var u = ATLAS.util, app = ATLAS.app, M = ATLAS.metrics;
    var s = M.summary();

    if (!s.count) {
      mount.innerHTML = '<div class="empty reveal"><div class="empty__glyph">' + u.icon("analytics", 30) + '</div>' +
        '<span class="eyebrow">Métricas</span><h2>Sem dados ainda</h2>' +
        '<p>Encerre e faça a pós-análise de trades para o ATLAS medir seu desempenho e o Oráculo aprender com os dados.</p></div>';
      return;
    }

    var pf = s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2);
    var netCls = s.net >= 0 ? "up" : "down";

    // Curva de resultado acumulado
    var curve = s.cumulative.map(function (p) { return p.val; });
    if (curve.length === 1) curve = [0, curve[0]];
    var curveUp = curve[curve.length - 1] >= 0;

    // Por ativo
    var assetItems = Object.keys(s.byAsset).map(function (a) { return { label: a, value: s.byAsset[a].sum }; })
      .sort(function (a, b) { return b.value - a.value; });
    var maxAbs = Math.max.apply(null, assetItems.map(function (i) { return Math.abs(i.value); }).concat([1]));

    // Long vs Short
    var L = s.bySide.long || { n: 0, wins: 0, sum: 0 }, S = s.bySide.short || { n: 0, wins: 0, sum: 0 };
    var lw = L.n ? Math.round(L.wins / L.n * 100) : 0, sw = S.n ? Math.round(S.wins / S.n * 100) : 0;

    // Pendências de pós-análise
    var pend = app.tradesAwaitingReview();
    var banner = pend.length ?
      '<div class="rd__banner">' + u.icon("alert", 16) + '<span>' + pend.length +
      ' trade(s) encerrado(s) aguardando pós-análise. A avaliação alimenta as métricas.</span>' +
      '<button class="btn btn--accent" data-open="' + pend[0].id + '">Analisar</button></div>' : "";

    // Insights (Oráculo)
    var insights = M.insights().map(function (i) {
      return '<div class="an__insight an__insight--' + i.tone + '"><span class="nsum__orb"><i></i></span>' +
        '<p>' + u.escape(i.text) + '</p></div>';
    }).join("");

    // Encerrados recentes
    var recent = M.closed().slice().reverse().slice(0, 6).map(function (t) {
      var up = t.pnl >= 0;
      return '<div class="list__item" data-open="' + t.id + '" style="cursor:pointer">' +
        '<span class="list__icon ' + (up ? "up" : "down") + '">' + u.icon(up ? "arrowUp" : "arrowDown", 16) + '</span>' +
        '<div class="list__body"><b>' + u.escape(t.asset) + ' · ' + (t.side === "long" ? "Long" : "Short") + '</b>' +
        '<span>' + (t.review ? "pós-análise feita" : "sem pós-análise") + ' · ' + u.ago(t.closedAt) + '</span></div>' +
        '<div class="list__meta"><span class="mono ' + (up ? "up" : "down") + '">' + u.pct(t.pnl) + '</span></div></div>';
    }).join("");

    mount.innerHTML =
      '<div class="estudos">' +
        '<div class="est__head reveal"><div><span class="eyebrow">Desempenho e aprendizado</span><h1>Analytics</h1></div></div>' +
        banner +
        '<div class="an__kpis reveal">' +
          kpi("Winrate", s.winrate + "%", s.wins + "V · " + s.losses + "D", s.winrate >= 50 ? "up" : "down") +
          kpi("Profit factor", pf, "lucro / prejuízo", s.profitFactor >= 1.5 ? "up" : "") +
          kpi("Resultado líq.", u.pct(s.net), "acumulado", netCls) +
          kpi("Trades", String(s.count), "encerrados") +
          kpi("Tempo médio", u.dur(Math.round(s.avgHoldH)), "por trade") +
          kpi("Disciplina", s.reviewed ? s.avgDiscipline.toFixed(1) + "/5" : "—", s.reviewed + " avaliados") +
        '</div>' +

        '<div class="an__grid reveal">' +
          '<div class="card"><div class="card__head"><span class="card__title">Curva de resultado</span>' +
            '<span class="badge ' + (curveUp ? "badge--profit" : "badge--loss") + ' badge--dot">' + u.pct(s.net) + '</span></div>' +
            u.areaChart(curve, { up: curveUp }) +
            '<div class="banca__axis"><span>início</span><span>agora</span></div></div>' +
          '<div class="card"><div class="card__head"><span class="card__title">Resultado por ativo</span></div>' +
            bars(assetItems, maxAbs) + '</div>' +
        '</div>' +

        '<div class="an__grid reveal">' +
          '<div class="card"><div class="card__head"><span class="card__title">Long vs Short</span></div>' +
            '<div class="an__sides">' +
              '<div class="an__side"><span class="an__side-h">Long</span><b class="mono up">' + lw + '%</b>' +
                '<span class="kpi__sub">' + L.n + ' trades · ' + u.pct(L.sum) + '</span></div>' +
              '<div class="an__side"><span class="an__side-h">Short</span><b class="mono ' + (sw >= 50 ? "up" : "down") + '">' + sw + '%</b>' +
                '<span class="kpi__sub">' + S.n + ' trades · ' + u.pct(S.sum) + '</span></div>' +
              '<div class="an__side"><span class="an__side-h">Melhor / Pior</span><b class="mono"><span class="up">' + u.pct(s.best) + '</span> · <span class="down">' + u.pct(s.worst) + '</span></b>' +
                '<span class="kpi__sub">aderência ao plano ' + s.adherenceRate + '%</span></div>' +
            '</div></div>' +
          '<div class="card nsum"><div class="nsum__head"><span class="nsum__orb"><i></i></span><span class="eyebrow">Aprendizado do Oráculo</span></div>' +
            '<div class="an__insights">' + insights + '</div></div>' +
        '</div>' +

        '<div class="card reveal"><div class="card__head"><span class="card__title">Encerrados recentes</span>' +
          '<button class="btn btn--ghost" data-go="trades">Ver trades</button></div>' +
          '<div class="list">' + recent + '</div></div>' +
      '</div>';

    mount.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (ATLAS.trades) ATLAS.trades.openDetail(el.dataset.open);
        ATLAS.router.go("trades");
      });
    });
    mount.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { ATLAS.router.go(el.dataset.go); });
    });
  }

  ATLAS.router.register("analytics", { label: "Analytics", icon: "analytics", render: render });

  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() === "analytics" && mountRef) render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
