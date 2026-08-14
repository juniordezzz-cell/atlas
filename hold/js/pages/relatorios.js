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
        U.button("Exportar CSV", { variant: "secondary", icon: "download", onClick: exportCSV }),
        U.button("Exportar JSON", { variant: "secondary", icon: "download", onClick: exportJSON }),
        U.button("Imprimir / PDF", { variant: "primary", icon: "report", onClick: imprimir })
      ])
    ]));

    // resumo executivo
    var dl = U.el("dl", { class: "def-list" });
    row(dl, "Data do relatório", U.dateShort(new Date().toISOString()));
    row(dl, "Valor de mercado", U.money(val, 0));
    row(dl, "Custo investido", U.money(cost, 0));
    row(dl, "Resultado", U.money(pnl, 0) + " (" + U.pct(pnlPct) + ")");
    row(dl, "Posições ativas", String(c.posicoes));
    /* Antes: "ativas / revisão / total" com c.teses_revisao, que NUNCA
       existiu em Store.get.counts() — o relatório imprimia literalmente
       "3 / undefined / 5". "Em revisão" também não é mais um estado do
       sistema: os status oficiais da entidade compartilhada de Teses são
       planejada, andamento, concluída e arquivada. A linha passa a
       mostrar os três números que existem de fato. */
    row(dl, "Teses (planejadas / em andamento / total)",
        c.teses_planejadas + " / " + c.teses_andamento + " / " + c.teses);
    row(dl, "Watchlist", String(c.watchlist));
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

    /* ------------------------------------------------------------
       "TESES QUE EXIGEM AÇÃO" ACUSAVA TODAS ELAS

       O filtro era `t.status !== "active"`, e "active" deixou de ser um
       status quando as Teses viraram entidade compartilhada — os
       status são planejada, andamento, concluida e arquivada. Como
       nenhuma tese é "active", TODAS caíam na lista de pendências, cada
       uma rotulada "Tese em revisão", inclusive as em andamento e as
       concluídas. Um relatório para revisão periódica abrindo com
       "estas exigem ação: todas" não é rigor, é ruído — e ruído nesse
       lugar ensina a ignorar a seção inteira.

       Exigir ação é o que os alertas do módulo já definem: tese
       PLANEJADA (parada na fila) e tese ARQUIVADA com posição viva.
       Em andamento é o estado saudável; concluída já foi para o
       Academy.
       ------------------------------------------------------------ */
    var attention = S.state.teses.filter(function (t) {
      if (t.status === "planejada") return true;
      if (t.status === "arquivada") {
        var a = S.get.asset(t.ativo_id);
        return !!(a && S.get.statusDe(a) === "invested");
      }
      return false;
    });
    var attBody;
    if (attention.length) {
      var tl = U.el("div", { class: "timeline" });
      attention.forEach(function (t) {
        var a = S.get.asset(t.ativo_id);
        var arq = t.status === "arquivada";
        var item = U.el("div", { class: "tl-item " + (arq ? "sell" : "thesis") });
        item.innerHTML = '<div class="tl-dot">' + U.icon(arq ? "alert" : "refresh") + '</div>';
        var head = U.el("div", { class: "tl-head" });
        head.appendChild(U.el("span", { class: "tl-title",
          text: (a ? a.ticker : t.titulo || "—") + " · " +
                (arq ? "Tese arquivada com posição aberta" : "Tese planejada, análise não iniciada") }));
        head.appendChild(U.badge(t.status));
        item.appendChild(head);
        item.appendChild(U.el("div", { class: "tl-body", text: t.criterios_invalidacao || t.narrativa || "—" }));
        tl.appendChild(item);
      });
      attBody = tl;
    } else attBody = U.empty("shield", "Sem pendências", "Nenhuma tese parada na fila nem posição sustentada por tese arquivada.");
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

  /* CSV das posições — para continuar o trabalho numa planilha. O JSON
     ao lado continua servindo a outro propósito: é o formato que o
     próprio ATLAS relê. Ver core/atlas-export.js. */
  function exportCSV() {
    if (!window.AtlasExport) return;
    var X = AtlasExport;
    var linhas = [["Ativo", "Ticker", "Tese", "Convicção", "Quantidade",
                   "Valor (USD)", "Custo (USD)", "PnL (USD)", "Peso (%)"]];
    S.get.walletPositions().forEach(function (p) {
      var a = S.get.asset(p.ativo_id) || {};
      var t = S.get.thesisOfAsset(p.ativo_id);
      linhas.push([
        a.nome || "", a.ticker || "",
        t ? t.status : "",
        a.conviccao != null ? a.conviccao : "",
        X.numero(p.quantidade),
        X.numero(S.get.positionValue(p)),
        X.numero(S.get.positionCost(p)),
        X.numero(S.get.positionPnL(p)),
        X.numero(S.get.positionWeight(p))
      ]);
    });
    X.csv("atlas-hold-posicoes", null, linhas);
    U.toast("Exportado", "CSV gerado com " + (linhas.length - 1) + " posições.", "success");
  }

  /* Passa pelo AtlasExport para a folha sair com cabeçalho — nome do
     gestor, data e o que é o documento. window.print() cru produzia uma
     folha anônima. */
  function imprimir() {
    if (window.AtlasExport) {
      AtlasExport.imprimir({ titulo: "Hold · Relatórios", subtitulo: "Síntese do portfólio" });
    } else { window.print(); }
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
