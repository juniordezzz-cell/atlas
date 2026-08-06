/* HOLD · pages/dashboard.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, C = window.Charts, F = window.Forms;

  function perfSeries() {
    // série sintética determinística: custo -> valor atual em 12 pontos
    var cost = S.get.portfolioCost() || 1, val = S.get.portfolioValue() || cost;
    var pts = [], months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (var i = 0; i < 12; i++) {
      var t = i / 11;
      var wobble = Math.sin(i * 1.3) * 0.05 + Math.sin(i * 0.6) * 0.03;
      var v = cost + (val - cost) * t + (val - cost) * wobble;
      pts.push({ label: months[i], v: Math.max(0, v) });
    }
    pts[11].v = val;
    return pts;
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = function () {
    var c = S.get.counts();
    var val = S.get.portfolioValue(), pnl = S.get.portfolioPnL(), pnlPct = S.get.portfolioPnLPct();
    var invested = S.state.ativos.filter(function (a) { return a.status === "invested"; });
    var avgConv = invested.length ? invested.reduce(function (s, a) { return s + a.conviccao; }, 0) / invested.length : 0;

    var view = U.el("div");

    /* head */
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Painel" }),
          U.el("p", { text: "Visão consolidada da carteira, teses e decisões de longo prazo." })
        ]),
        U.button("Nova tese", { variant: "secondary", icon: "doc", onClick: function () { F.newThesis(); } }),
        U.button("Registrar operação", { variant: "primary", icon: "wallet", onClick: function () {
          var inv = S.state.ativos.filter(function (a) { return S.get.thesisOfAsset(a.id); });
          if (!inv.length) return U.toast("Sem ativos com tese", "Crie uma tese antes de operar.", "warning");
          F.trade(inv[0].id, "buy");
        }})
      ])
    ]));

    /* KPIs */
    var kpis = U.el("div", { class: "grid g-3" });
    kpis.appendChild(U.kpi({ icon: "wallet", label: "Valor da carteira", value: U.compact(val), sub: c.posicoes + " posições",
      spark: C.sparkline(perfSeries().map(function (p) { return p.v; }), { w: 84, h: 26 }) }));
    kpis.appendChild(U.kpi({ icon: "trendUp", label: "Resultado (PnL)", value: U.money(pnl, 0),
      delta: pnl, deltaText: U.pct(pnlPct) }));
    kpis.appendChild(U.kpi({ icon: "target", label: "Convicção média", value: avgConv.toFixed(1) + " / 10", sub: c.teses_ativas + " teses ativas" }));
    view.appendChild(kpis);

    /* performance + allocation */
    var mid = U.el("div", { class: "grid g-12 mt-16" });

    var perfCard = U.card({ eyebrow: "Evolução", title: "Performance da carteira",
      action: U.el("span", { class: "badge " + (pnl >= 0 ? "invested" : "invalid") }, [U.pct(pnlPct)]),
      body: [C.lineChart(perfSeries())] });
    perfCard.classList.add("col-8");
    mid.appendChild(perfCard);

    // allocation donut
    var segs = S.get.walletPositions().map(function (p, i) {
      var a = S.get.asset(p.ativo_id);
      return { label: a ? a.ticker : "?", value: S.get.positionValue(p), color: C.color(i) };
    }).sort(function (x, y) { return y.value - x.value; });
    var allocBody = U.el("div");
    if (segs.length) {
      allocBody.appendChild(C.donut(segs, { centerTop: segs.length, centerBottom: "ativos" }));
      var legend = U.el("div", { class: "legend" });
      segs.forEach(function (s) {
        var li = U.el("div", { class: "li" });
        li.appendChild(U.el("span", { class: "sw", style: "background:" + s.color }));
        li.appendChild(document.createTextNode(s.label + " · " + ((s.value / (val || 1)) * 100).toFixed(0) + "%"));
        legend.appendChild(li);
      });
      allocBody.appendChild(legend);
    } else {
      allocBody.appendChild(U.empty("wallet", "Sem alocação", "Registre uma compra para ver a distribuição."));
    }
    var allocCard = U.card({ eyebrow: "Distribuição", title: "Alocação", body: [allocBody] });
    allocCard.classList.add("col-4");
    mid.appendChild(allocCard);
    view.appendChild(mid);

    /* alerts + recent */
    var bottom = U.el("div", { class: "grid g-12 mt-16" });

    // alerts
    var al = S.get.alerts();
    var alertBody = U.el("div");
    if (al.length) {
      al.slice(0, 5).forEach(function (a) {
        var row = U.el("div", { class: "alert-row " + (a.level === "crit" ? "crit" : a.level === "warn" ? "warn" : "info") });
        row.innerHTML = '<div class="ai">' + U.icon(a.level === "info" ? "target" : "alert") + '</div>';
        var col = U.el("div");
        col.appendChild(U.el("div", { class: "a-t", text: a.title }));
        col.appendChild(U.el("div", { class: "a-s", text: a.sub }));
        row.appendChild(col);
        alertBody.appendChild(row);
      });
    } else {
      alertBody.appendChild(U.empty("shield", "Tudo em ordem", "Nenhum alerta de tese ou concentração no momento."));
    }
    var alertCard = U.card({ eyebrow: "Monitoramento", title: "Alertas", body: [alertBody] });
    alertCard.classList.add("col-4");
    bottom.appendChild(alertCard);

    // recent history timeline
    var tl = U.el("div", { class: "timeline" });
    var recent = S.state.historico.slice(0, 5);
    if (recent.length) {
      recent.forEach(function (h) { tl.appendChild(historyItem(h)); });
    } else {
      tl = U.empty("history", "Sem histórico", "As decisões aparecem aqui conforme forem registradas.");
    }
    var histCard = U.card({ eyebrow: "Registro", title: "Atividade recente",
      action: U.button("Ver histórico", { variant: "ghost", size: "sm", onClick: function () { location.hash = "#/historico"; } }),
      body: [tl] });
    histCard.classList.add("col-8");
    bottom.appendChild(histCard);
    view.appendChild(bottom);

    return { title: "Painel", crumb: "Visão geral", node: view };
  };

  function historyItem(h) {
    var a = S.get.asset(h.ativo_id);
    var kind = h.subtipo === "buy" ? "buy" : h.subtipo === "sell" ? "sell" : h.subtipo === "thesis" ? "thesis" : h.subtipo === "study" ? "study" : "";
    var item = U.el("div", { class: "tl-item " + kind });
    item.innerHTML = '<div class="tl-dot">' + U.icon(h.subtipo === "buy" ? "arrowUp" : h.subtipo === "sell" ? "arrowDown" : h.subtipo === "thesis" ? "doc" : "check") + '</div>';
    var head = U.el("div", { class: "tl-head" });
    head.appendChild(U.el("span", { class: "tl-title", text: (a ? a.ticker + " · " : "") + labelAction(h.tipo_acao) }));
    head.appendChild(U.el("span", { class: "tl-time", text: U.dateTime(h.data) }));
    item.appendChild(head);
    item.appendChild(U.el("div", { class: "tl-body", text: h.impacto || h.justificativa }));
    return item;
  }
  function labelAction(t) {
    return {
      TRADE_EXECUTED: "Operação executada", THESIS_CREATED: "Tese criada", THESIS_UPDATED: "Tese revisada",
      ASSET_CREATED: "Ativo adicionado", STUDY_CREATED: "Estudo criado", STUDY_CONVERTED: "Estudo convertido",
      POSITION_UPDATED: "Posição atualizada"
    }[t] || t;
  }
  window.Pages._historyItem = historyItem;
  window.Pages._labelAction = labelAction;
})();
