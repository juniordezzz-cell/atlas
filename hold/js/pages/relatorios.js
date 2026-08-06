/* HOLD · pages/relatorios.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  window.Pages = window.Pages || {};
  window.Pages.relatorios = function () {
    var view = U.el("div");
    var val = S.get.portfolioValue(), cost = S.get.portfolioCost(), pnl = S.get.portfolioPnL(), pnlPct = S.get.portfolioPnLPct();
    var c = S.get.counts();

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Relatórios" }), U.el("p", { text: "Síntese consolidada do estado do portfólio para revisão periódica." })]),
        U.button("Exportar JSON", { variant: "secondary", icon: "download", onClick: exportJSON }),
        U.button("Imprimir / PDF", { variant: "primary", icon: "report", onClick: function () { window.print(); } })
      ])
    ]));

    // resumo executivo
    var dl = U.el("dl", { class: "def-list" });
    row(dl, "Data do relatório", U.dateShort(new Date().toISOString()));
    row(dl, "Valor de mercado", U.money(val, 0));
    row(dl, "Custo investido", U.money(cost, 0));
    row(dl, "Resultado", U.money(pnl, 0) + " (" + U.pct(pnlPct) + ")");
    row(dl, "Posições ativas", String(c.posicoes));
    row(dl, "Teses (ativas / revisão / total)", c.teses_ativas + " / " + c.teses_revisao + " / " + c.teses);
    row(dl, "Watchlist", String(c.watchlist));
    row(dl, "Teses planejadas", String(c.teses_planejadas));
    var summaryCard = U.card({ eyebrow: "Resumo executivo", title: "Panorama do portfólio", body: [dl] });
    view.appendChild(summaryCard);

    // posições detalhadas
    var posCols = [
      { head: "Ativo", render: function (p) { return U.assetCell(S.get.asset(p.ativo_id)); } },
      { head: "Tese", render: function (p) { var t = S.get.thesisOfAsset(p.ativo_id); return t ? U.badge(t.status) : U.el("span", { class: "badge plain", text: "—" }); } },
      { head: "Convicção", render: function (p) { var a = S.get.asset(p.ativo_id); return U.convictionMini(a.conviccao); } },
      { head: "Valor", right: true, render: function (p) { return U.el("span", { class: "num", text: U.money(S.get.positionValue(p), 0) }); } },
      { head: "PnL", right: true, render: function (p) { var v = S.get.positionPnL(p); return U.el("span", { class: "num " + U.signClass(v), text: U.money(v, 0) }); } },
      { head: "Peso", right: true, render: function (p) { return U.el("span", { class: "num", text: S.get.positionWeight(p).toFixed(0) + "%" }); } }
    ];
    var posCard = U.card({ eyebrow: "Detalhamento", title: "Posições e fundamentos", tight: true,
      body: [S.get.walletPositions().length ? U.table(posCols, S.get.walletPositions(), {}) : U.empty("wallet", "Sem posições", "Nada a reportar na carteira.")] });
    posCard.classList.add("mt-16");
    view.appendChild(posCard);

    // teses em atenção
    var attention = S.state.teses.filter(function (t) { return t.status !== "active"; });
    var attBody;
    if (attention.length) {
      var tl = U.el("div", { class: "timeline" });
      attention.forEach(function (t) {
        var a = S.get.asset(t.ativo_id);
        var item = U.el("div", { class: "tl-item " + (t.status === "invalid" ? "sell" : "thesis") });
        item.innerHTML = '<div class="tl-dot">' + U.icon(t.status === "invalid" ? "alert" : "refresh") + '</div>';
        var head = U.el("div", { class: "tl-head" });
        head.appendChild(U.el("span", { class: "tl-title", text: (a ? a.ticker : "—") + " · " + (t.status === "invalid" ? "Tese invalidada" : "Tese em revisão") }));
        head.appendChild(U.badge(t.status));
        item.appendChild(head);
        item.appendChild(U.el("div", { class: "tl-body", text: t.criterios_invalidacao || t.narrativa }));
        tl.appendChild(item);
      });
      attBody = tl;
    } else attBody = U.empty("shield", "Sem pendências", "Todas as teses estão ativas e saudáveis.");
    var attCard = U.card({ eyebrow: "Pontos de atenção", title: "Teses que exigem ação", body: [attBody] });
    attCard.classList.add("mt-16");
    view.appendChild(attCard);

    return { title: "Relatórios", crumb: "Síntese consolidada", node: view };
  };

  function row(dl, k, v) {
    var r = U.el("div", { class: "d-row" });
    r.appendChild(U.el("dt", { text: k }));
    r.appendChild(U.el("dd", { class: "num", text: v }));
    dl.appendChild(r);
  }

  function exportJSON() {
    var data = S.actions.exportJSON();
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "hold-export-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    U.toast("Exportado", "Arquivo JSON gerado.", "success");
  }
})();
