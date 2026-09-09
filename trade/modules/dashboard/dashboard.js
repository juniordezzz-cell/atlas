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

  /* ------------------------------------------------------------
     A BANCA — três números que existem, e nenhum gráfico inventado

     Este cartão mostrava a "Banca" a partir do array `equity` [0,0],
     que ninguém escrevia: US$ 0 com dinheiro na carteira, e um
     percentual que era (0 − 0) / 0 = NaN. O gráfico de área desenhava
     esse mesmo array — dois zeros — e o eixo dizia "US$ 0 → agora".

     Agora a banca é caixa mais capital em operação, e o percentual é
     resultado REALIZADO sobre o depositado. O gráfico saiu: o Trade
     não mede uma série ao longo do tempo, e desenhar uma linha sem
     medição é a mentira mais convincente que uma tela pode contar.
     ------------------------------------------------------------ */
  function bancaCard() {
    var u = ATLAS.util, app = ATLAS.app;
    var w = app.currentWallet();
    var caixa = window.AtlasCaixa ? AtlasCaixa.saldo(w.id) : 0;
    var emPos = app.valorEmPosicoes(w.id);
    var chg = app.changePct(), up = chg >= 0;
    var res = app.resultadoRealizado(w.id);

    return '<div class="card reveal" style="animation-delay:.06s">' +
      '<div class="card__head"><span class="eyebrow">Patrimônio · ' + u.escape(w.name) + '</span>' +
        (res ? '<span class="badge ' + (up ? 'badge--profit' : 'badge--loss') + ' badge--dot">' +
               (up ? 'Ganho' : 'Perda') + '</span>' : '') +
      '</div>' +
      '<div class="banca__value mono">' + u.money(app.balance(w.id)) + '</div>' +
      '<div class="banca__delta">' +
        (res
          ? '<span class="' + u.signClass(chg) + ' mono">' + u.money(res) + '</span>' +
            '<span style="color:var(--text-faint)">realizado · ' + u.pct(chg) + ' do depositado</span>'
          : '<span style="color:var(--text-faint)">Nenhuma operação encerrada ainda.</span>') +
      '</div>' +
      '<div class="banca__axis" style="margin-top:14px">' +
        '<span>' + u.money(caixa) + ' em caixa</span>' +
        '<span>' + u.money(emPos) + ' em operação</span>' +
      '</div>' +
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

  /* ------------------------------------------------------------
     OS KPIs, CALCULADOS DAS OPERAÇÕES

     Vinham de walletData().kpis — { winrate: 0, trades: 0, avgHold:
     "—", profitFactor: 0 }, escrito na semente e nunca atualizado.
     Quem tinha dez operações lucrativas via winrate 0% e profit
     factor 0,00.

     E as faíscas eram desenho: a do Winrate era `equity.map(v, i =>
     v + Math.sin(i) * 50)` — uma SENOIDE, exibida com a mesma
     aparência de um gráfico de dados. As três saíram; o Trade não
     tem série medida para desenhar, e a ausência é a informação.
     ------------------------------------------------------------ */
  function kpisBlock() {
    var k = ATLAS.app.kpisReais();
    var pf = k.profitFactor === Infinity ? "∞"
           : (k.profitFactor ? k.profitFactor.toFixed(2) : "—");
    var sub = k.medidos
      ? k.medidos + (k.medidos === 1 ? " operação encerrada" : " operações encerradas")
      : "sem operação encerrada";
    return '<div class="dash__kpis">' +
      kpiCard("Winrate", k.medidos ? k.winrate + "%" : "—", sub, null, k.winrate >= 55, 0.10) +
      kpiCard("Profit factor", pf, "lucro / prejuízo", null, k.profitFactor >= 1.5, 0.14) +
      kpiCard("Encerradas", String(k.trades), "com resultado em dólar", null, true, 0.18) +
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
      '<button class="btn btn--ghost" data-go="academy">Ver no Academy</button></div>' +
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
        out.push({ level: "warn", text: "Tese de " + s.asset + " aberta há " + u.dur(app.studyOpenHours(s)) + " (limite 72h).", ref: "Academy", go: "academy" });
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
      b.addEventListener("click", function () {
        if (b.dataset.go === "academy") {
          location.href = "../academy/index.html#/andamento";
          return;
        }
        ATLAS.router.go(b.dataset.go);
      });
    });
    mount.querySelectorAll("[data-oraculo]").forEach(function (b) {
      b.addEventListener("click", function () { ATLAS.oraculo.setOpen(true); });
    });
    mount.querySelectorAll("[data-study]").forEach(function (row) {
      row.addEventListener("click", function () {
        location.href = "../academy/index.html#/detail/" + row.dataset.study;
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
