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
        /* ------------------------------------------------------------
           "EXPORTAR JSON" SAIU DAQUI, E NÃO É PERDA DE FUNÇÃO

           O botão gerava hold-export-AAAA-MM-DD.json e NADA no sistema
           lia esse arquivo de volta: a função de importar existia no
           store e não era chamada por tela nenhuma. Ao lado de "CSV" e
           "Imprimir", ele parecia o botão de backup — e um backup que
           não restaura é pior que nenhum, porque a pessoa confia nele.

           E restaurá-lo seria pior ainda: o arquivo levava as POSIÇÕES
           sem os eventos de caixa que as explicam. Recriaria exatamente
           o estado que esta auditoria passou inteira removendo —
           patrimônio existindo sem depósito que o justifique.

           O backup de verdade é central, cobre as chaves do Hold e
           restaura tudo junto, caixa incluído: Configurações → Dados e
           Backup. O botão abaixo leva para lá em vez de fingir.
           ------------------------------------------------------------ */
        U.button("Exportar CSV", { variant: "secondary", icon: "download", onClick: exportCSV }),
        U.button("Backup completo", { variant: "secondary", icon: "shield",
          onClick: function () { location.href = "../pages/configuracoes.html#dados"; } }),
        U.button("Imprimir / PDF", { variant: "primary", icon: "report", onClick: imprimir })
      ])
    ]));

    /* ------------------------------------------------------------
       O RESUMO PASSA A FECHAR A CONTA

       Ele listava valor, custo e resultado — e parava aí. Faltava o
       lado do dinheiro: quanto ainda há em caixa, e quanto entrou e
       saiu no período. Sem isso, "quanto vale a carteira" e "quanto eu
       tenho" eram perguntas diferentes que o relatório respondia pela
       metade, num documento cujo propósito é a revisão periódica.

       Aportes e retornos vêm do livro de caixa (wallets/walletCaixa),
       que é a fonte da verdade do dinheiro — não de uma soma paralela
       feita aqui.
       ------------------------------------------------------------ */
    var carteira = S.wallets.active();
    var caixa = (window.AtlasCaixa && carteira) ? AtlasCaixa.saldo(carteira.id) : null;
    var mov = { aporte: 0, retorno: 0 };
    if (window.AtlasCaixa && carteira) {
      AtlasCaixa.eventos(carteira.id).forEach(function (e) {
        if (e.module !== "hold") return;
        if (e.tipo === "aporte") mov.aporte += (+e.valorUSD || 0);
        if (e.tipo === "retorno") mov.retorno += (+e.valorUSD || 0);
      });
    }

    // resumo executivo
    var dl = U.el("dl", { class: "def-list" });
    row(dl, "Data do relatório", U.dateShort(new Date().toISOString()));
    row(dl, "Carteira", carteira ? carteira.name : "—");
    row(dl, "Valor de mercado", U.money(val, 0));
    row(dl, "Custo investido", U.money(cost, 0));
    row(dl, "Resultado", U.money(pnl, 0) + " (" + U.pct(pnlPct) + ")");
    row(dl, "Caixa disponível", caixa == null ? "—" : U.money(caixa, 0));
    row(dl, "Total sob gestão (carteira + caixa)",
        caixa == null ? U.money(val, 0) : U.money(val + caixa, 0));
    row(dl, "Comprado / apurado em vendas (Hold)",
        U.money(mov.aporte, 0) + " / " + U.money(mov.retorno, 0));
    row(dl, "Posições ativas", String(c.posicoes));
    row(dl, "Resultado realizado em vendas",
        U.money(S.get.realizado ? S.get.realizado() : 0, 0));
    row(dl, "Watchlist", String(c.watchlist));
    var summaryCard = U.card({ eyebrow: "Resumo executivo", title: "Panorama do portfólio", body: [dl] });
    view.appendChild(summaryCard);

    // posições detalhadas
    var posCols = [
      { head: "Ativo", render: function (p) { return U.assetCell(S.get.asset(p.ativo_id)); } },
      { head: "Valor", right: true, render: function (p) { return U.el("span", { class: "num", text: U.money(S.get.positionValue(p), 0) }); } },
      { head: "PnL", right: true, render: function (p) { var v = S.get.positionPnL(p); return U.el("span", { class: "num " + U.signClass(v), text: U.money(v, 0) }); } },
      { head: "Peso", right: true, render: function (p) { return U.el("span", { class: "num", text: S.get.positionWeight(p).toFixed(0) + "%" }); } }
    ];
    var posCard = U.card({ eyebrow: "Detalhamento", title: "Posições", tight: true,
      body: [S.get.walletPositions().length
        ? U.table(posCols, S.get.walletPositions().slice().sort(function (x, y) {
            return S.get.positionValue(y) - S.get.positionValue(x);
          }), {})
        : U.empty("wallet", "Sem posições", "Nada a reportar na carteira.",
            U.button("Ver ativos", { variant: "secondary", icon: "layers",
              onClick: function () { location.hash = "#/ativos"; } }))] });
    posCard.classList.add("mt-16");
    view.appendChild(posCard);

    /* Pontos de atenção = os alertas do módulo, a mesma regra que o
       Painel mostra (Store.get.alerts). Um relatório que inventasse o
       próprio critério passaria a discordar do Painel. */
    var alertas = S.get.alerts();
    var attBody;
    if (alertas.length) {
      var tl = U.el("div", { class: "timeline" });
      alertas.forEach(function (al) {
        var item = U.el("div", { class: "tl-item " + (al.level === "crit" ? "sell" : "") });
        item.innerHTML = '<div class="tl-dot">' + U.icon("alert") + '</div>';
        var head = U.el("div", { class: "tl-head" });
        head.appendChild(U.el("span", { class: "tl-title", text: al.title }));
        item.appendChild(head);
        item.appendChild(U.el("div", { class: "tl-body", text: al.sub }));
        tl.appendChild(item);
      });
      attBody = tl;
    } else attBody = U.empty("shield", "Sem pendências", "Nenhuma posição acima do limite de concentração.");
    var attCard = U.card({ eyebrow: "Monitoramento", title: "Pontos de atenção", body: [attBody] });
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
    var linhas = [["Ativo", "Ticker", "Quantidade",
                   "Valor (USD)", "Custo (USD)", "PnL (USD)", "Peso (%)"]];
    S.get.walletPositions().forEach(function (p) {
      var a = S.get.asset(p.ativo_id) || {};
      linhas.push([
        a.nome || "", a.ticker || "",
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


})();
