/* ============================================================
   ATLAS — Módulo Dashboard (tela inicial dinâmica)
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var mountRef = null;

  function stateLabel(s) {
    return { andamento: "Em andamento", futuro: "Futuro", concluido: "Concluído" }[s] || s;
  }
  function stateBadge(s) {
    if (s === "concluido") return "badge--profit";
    if (s === "futuro") return "badge--azure";
    return "badge--warn";
  }

  function oraculoSummaryCard() {
    var t = ATLAS.oraculo.summaryText();
    return '<div class="card nsum reveal" style="animation-delay:.02s">' +
      '<div class="nsum__head"><span class="nsum__orb"><i></i></span>' +
      '<span class="eyebrow">Resumo do Oráculo</span></div>' +
      '<p class="nsum__text">' + ATLAS.util.escape(t) + '</p>' +
      '<div class="card__foot"><button class="btn btn--ghost" data-oraculo>Abrir Oráculo →</button></div>' +
      '</div>';
  }

  function bancaCard() {
    var u = ATLAS.util, app = ATLAS.app;
    var eq = app.walletData().equity, chg = app.changePct(), up = chg >= 0;
    var w = app.currentWallet();
    return '<div class="card reveal" style="animation-delay:.06s">' +
      '<div class="card__head"><span class="eyebrow">Patrimônio · ' + u.escape(w.name) + '</span>' +
        '<span class="badge ' + (up ? 'badge--profit' : 'badge--loss') + ' badge--dot">' + (up ? 'Alta' : 'Baixa') + '</span></div>' +
      '<div class="banca__value mono">' + u.money(app.balance()) + '</div>' +
      '<div class="banca__delta"><span class="' + u.signClass(chg) + ' mono">' + u.pct(chg) + '</span>' +
        '<span style="color:var(--text-faint)">nos últimos 30 pontos</span></div>' +
      u.areaChart(eq, { up: up }) +
      '<div class="banca__axis"><span>' + u.money(eq[0]) + '</span><span>agora</span></div>' +
      '</div>';
  }

  function kpiCard(label, value, sub, series, up, delay) {
    return '<div class="card card--hover kpi reveal" style="animation-delay:' + delay + 's">' +
      '<span class="kpi__label">' + label + '</span>' +
      '<span class="kpi__value mono">' + value + '</span>' +
      '<span class="kpi__sub">' + sub + '</span>' +
      '<div class="kpi__spark">' + (series ? ATLAS.util.sparkline(series, up) : '') + '</div>' +
      '</div>';
  }

  function kpisBlock() {
    var k = ATLAS.app.walletData().kpis, eq = ATLAS.app.walletData().equity;
    var half = eq.slice(Math.floor(eq.length / 2));
    return '<div class="dash__kpis">' +
      kpiCard("Winrate", k.winrate + "%", "acertos", eq.map(function (v, i) { return v + Math.sin(i) * 50; }), k.winrate >= 55, 0.10) +
      kpiCard("Profit factor", k.profitFactor.toFixed(2), "lucro / prejuízo", half, k.profitFactor >= 1.5, 0.14) +
      kpiCard("Trades", String(k.trades), "no período", eq, true, 0.18) +
      kpiCard("Tempo médio", k.avgHold, "por operação", null, true, 0.22) +
      '</div>';
  }

  function studiesCard() {
    var u = ATLAS.util, app = ATLAS.app, list = app.studies();
    var body = list.length ? list.map(function (s) {
      var open = app.studyOpenHours(s);
      var over = s.state === "andamento" && open > (app.pref("studyLimitH") || 72);
      return '<div class="list__item" data-study="' + s.id + '" style="cursor:pointer">' +
        '<span class="list__icon" style="color:var(--azure)">' + u.icon("flask", 17) + '</span>' +
        '<div class="list__body"><b>' + u.escape(s.asset) + ' · ' + u.escape(s.title) + '</b>' +
        '<span>' + u.escape(s.thesis || "") + '</span></div>' +
        '<div class="list__meta"><span class="badge ' + stateBadge(s.state) + '">' + stateLabel(s.state) + '</span>' +
        (s.state === "andamento" ? '<span class="mono ' + (over ? 'down' : '') + '" style="font-size:.7rem;color:var(--text-faint)">' + u.dur(open) + '</span>' : '') +
        '</div></div>';
    }).join("") : '<div class="list__item"><span style="color:var(--text-mut)">Sem teses abertas.</span></div>';

    return '<div class="card reveal" style="animation-delay:.26s"><div class="card__head">' +
      '<span class="card__title">Teses pendentes</span>' +
      '<button class="btn btn--ghost" data-go="teses">Ver todos</button></div>' +
      '<div class="list">' + body + '</div></div>';
  }

  function tradesCard() {
    var u = ATLAS.util, app = ATLAS.app;
    var list = app.trades().filter(function (t) { return t.status === "aberto"; });
    var body = list.length ? list.map(function (t) {
      var up = t.pnl >= 0, age = app.tradeAgeHours(t);
      return '<div class="list__item" data-trade="' + t.id + '" style="cursor:pointer"><span class="list__icon ' + (up ? 'up' : 'down') + '">' +
        u.icon(up ? "arrowUp" : "arrowDown", 17) + '</span>' +
        '<div class="list__body"><b>' + u.escape(t.asset) + ' · ' + (t.side === "long" ? "Long" : "Short") + (t.leverage ? ' ' + u.escape(t.leverage) : '') + '</b>' +
        '<span>entrada ' + u.escape(String(num0(t.entry))) + ' · há ' + u.dur(age) + '</span></div>' +
        '<div class="list__meta"><span class="mono ' + (up ? 'up' : 'down') + '">' + u.pct(t.pnl) + '</span></div></div>';
    }).join("") : '<div class="list__item"><span style="color:var(--text-mut)">Nenhum trade aberto.</span></div>';

    return '<div class="card reveal" style="animation-delay:.30s"><div class="card__head">' +
      '<span class="card__title">Trades abertos</span>' +
      '<button class="btn btn--ghost" data-go="trades">Ver todos</button></div>' +
      '<div class="list">' + body + '</div></div>';
  }
  function num0(v) { return v == null ? "—" : v; }

  function deriveAlerts() {
    var app = ATLAS.app, u = ATLAS.util, out = [];
    app.studies().forEach(function (s) {
      if (s.state === "andamento" && app.studyOpenHours(s) > (app.pref("studyLimitH") || 72))
        out.push({ level: "warn", text: "Tese de " + s.asset + " aberta há " + u.dur(app.studyOpenHours(s)) + " (limite 72h).", ref: "Teses", go: "teses" });
    });
    app.tradesToReview(app.pref("tradeReviewH") || 24).forEach(function (t) {
      out.push({ level: "warn", text: "Trade de " + t.asset + " aberto há " + u.dur(app.tradeAgeHours(t)) + " sem revisão.", ref: "Trades", go: "trades" });
    });
    var awaiting = app.studiesAwaitingRd();
    if (awaiting.length)
      out.push({ level: "azure", text: awaiting.length + " tese(s) concluída(s) aguardando Registro de Decisão.", ref: "RD", go: "rd" });
    var pendRev = app.tradesAwaitingReview();
    if (pendRev.length)
      out.push({ level: "azure", text: pendRev.length + " trade(s) encerrado(s) aguardando pós-análise.", ref: "Analytics", go: "analytics" });
    return out.concat(app.walletData().alerts || []);
  }

  function alertsCard() {
    var u = ATLAS.util, list = deriveAlerts();
    var body = list.length ? list.map(function (a) {
      var color = a.level === "warn" ? "var(--warn)" : (a.level === "loss" ? "var(--loss)" : "var(--azure)");
      return '<div class="list__item"' + (a.go ? ' data-go="' + a.go + '" style="cursor:pointer"' : '') + '>' +
        '<span class="list__icon" style="color:' + color + '">' + u.icon("alert", 16) + '</span>' +
        '<div class="list__body"><b style="white-space:normal">' + u.escape(a.text) + '</b>' +
        '<span>' + u.escape(a.ref) + '</span></div></div>';
    }).join("") : '<div class="list__item"><span style="color:var(--profit)">Tudo em ordem. Nenhum alerta.</span></div>';

    return '<div class="card reveal" style="animation-delay:.34s"><div class="card__head">' +
      '<span class="card__title">Alertas</span>' + ATLAS.util.icon("bell", 18) + '</div>' +
      '<div class="list">' + body + '</div></div>';
  }

  function render(mount) {
    mountRef = mount;
    mount.innerHTML =
      '<div class="dash">' +
        '<div class="dash__hero reveal">' +
          '<div><span class="eyebrow">Visão geral da operação</span>' +
          '<h1>Estado atual</h1></div>' +
          '<button class="btn" data-oraculo>' + ATLAS.util.icon("spark", 16) + ' Perguntar ao Oráculo</button>' +
        '</div>' +
        oraculoSummaryCard() +
        '<div class="dash__top">' + bancaCard() + kpisBlock() + '</div>' +
        '<div class="dash__row">' + studiesCard() + tradesCard() + alertsCard() + '</div>' +
      '</div>';

    // Ações
    mount.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { ATLAS.router.go(b.dataset.go); });
    });
    mount.querySelectorAll("[data-oraculo]").forEach(function (b) {
      b.addEventListener("click", function () { ATLAS.oraculo.setOpen(true); });
    });
    mount.querySelectorAll("[data-study]").forEach(function (row) {
      row.addEventListener("click", function () {
        if (ATLAS.estudos) ATLAS.estudos.request(row.dataset.study);
        ATLAS.router.go("teses");
      });
    });
    mount.querySelectorAll("[data-trade]").forEach(function (row) {
      row.addEventListener("click", function () {
        if (ATLAS.trades) ATLAS.trades.openDetail(row.dataset.trade);
        ATLAS.router.go("trades");
      });
    });
  }

  ATLAS.router.register("dashboard", { label: "Dashboard", icon: "dashboard", render: render });

  // Re-renderiza a home quando a carteira muda (se estiver visível)
  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() === "dashboard" && mountRef) render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
