/* HOLD · pages/historico.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;
  /* Fora da função de render: a página se redesenha inteira a cada
     ação, e o filtro guardado dentro dela voltaria ao padrão sempre. */
  var filt = "all", termo = "";

  window.Pages = window.Pages || {};
  window.Pages.historico = function () {
    var view = U.el("div");

    var todos = S.state.historico;

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Histórico" }),
          U.el("p", { text: "Registro imutável de decisões. Toda ação do sistema deixa rastro aqui." })
        ]),
        /* O histórico é o único lugar do módulo que registra POR QUE
           cada decisão foi tomada, e não tinha como sair daqui. Exportar
           um livro de decisões é o mínimo para poder revisá-lo fora da
           tela — ou guardá-lo quando o navegador for trocado. */
        todos.length ? U.button("Exportar CSV", { variant: "secondary", icon: "download", onClick: exportar }) : null
      ])
    ]));

    /* ------------------------------------------------------------
       CONTAGEM EM CADA FILTRO

       "Conversões" foi removido na auditoria por não ter lastro. O que
       ficou tinha o mesmo problema mais discreto: quatro botões sem
       dizer quanto há atrás de cada um, então filtrar era tentativa e
       erro. Agora o número vem junto, e o filtro vazio se anuncia
       antes do clique.
       ------------------------------------------------------------ */
    var contagem = { all: todos.length };
    todos.forEach(function (h) { contagem[h.tipo_acao] = (contagem[h.tipo_acao] || 0) + 1; });

    var seg = U.el("div", { class: "segmented" });
    [["all", "Tudo"], ["TRADE_EXECUTED", "Operações"], ["THESIS_CREATED", "Teses"],
     ["THESIS_UPDATED", "Revisões"], ["POSITION_UPDATED", "Preços"]].forEach(function (o) {
      var b = U.el("button", { class: filt === o[0] ? "on" : "" });
      b.appendChild(document.createTextNode(o[1]));
      b.appendChild(U.el("span", { class: "seg-count", text: String(contagem[o[0]] || 0) }));
      b.addEventListener("click", function () { filt = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });

    var busca = U.el("div", { class: "search" });
    busca.innerHTML = U.icon("search");
    var campo = U.input({ placeholder: "Buscar por ativo ou justificativa…", value: termo });
    busca.appendChild(campo);

    view.appendChild(U.el("div", { class: "between", style: "margin-bottom:18px" }, [seg, busca]));

    var alvo = U.el("div");
    view.appendChild(alvo);

    function render(t) {
      termo = t || "";
      var q = termo.toLowerCase();
      var lista = todos.filter(function (h) {
        if (filt !== "all" && h.tipo_acao !== filt) return false;
        if (!q) return true;
        var a = S.get.asset(h.ativo_id);
        return (a && (a.ticker + " " + a.nome).toLowerCase().indexOf(q) >= 0) ||
               String(h.impacto || "").toLowerCase().indexOf(q) >= 0 ||
               String(h.justificativa || "").toLowerCase().indexOf(q) >= 0;
      });

      alvo.innerHTML = "";
      if (!lista.length) {
        alvo.appendChild(U.card({ pad: true, body: [
          termo
            ? U.empty("search", "Nada encontrado para “" + termo + "”",
                "Nenhum registro com esse ativo ou justificativa neste filtro.",
                U.button("Limpar busca", { variant: "secondary", icon: "x",
                  onClick: function () { campo.value = ""; render(""); } }))
            : todos.length
              ? U.empty("history", "Sem registros neste filtro", "Há histórico, mas nenhum deste tipo.",
                  U.button("Ver tudo", { variant: "secondary", icon: "history",
                    onClick: function () { filt = "all"; window.Router.rerender(); } }))
              : U.empty("history", "Sem histórico ainda",
                  "Cadastrar um ativo, comprar, vender, escrever uma tese — tudo deixa rastro aqui, com a justificativa que você escreveu.")
        ] }));
        return;
      }

      /* ------------------------------------------------------------
         AGRUPADO POR DIA

         Era uma linha do tempo corrida, com a data repetida em cada
         item e nenhuma noção de "o que aconteceu naquele dia". Num
         livro de decisões, o dia é a unidade de leitura: revisar é
         perguntar "o que eu fiz na segunda?", não percorrer 200 linhas.
         ------------------------------------------------------------ */
      var porDia = [], indice = {};
      lista.forEach(function (h) {
        var d = String(h.data || "").slice(0, 10);
        if (!indice[d]) { indice[d] = { dia: d, itens: [] }; porDia.push(indice[d]); }
        indice[d].itens.push(h);
      });

      porDia.forEach(function (g) {
        var cab = U.el("div", { class: "dia-cab" }, [
          U.el("span", { class: "dc-data", text: rotuloDia(g.dia) }),
          U.el("span", { class: "dc-linha" }),
          U.el("span", { class: "dc-qtd", text: g.itens.length + (g.itens.length === 1 ? " registro" : " registros") })
        ]);
        var tl = U.el("div", { class: "timeline" });
        g.itens.forEach(function (h) { tl.appendChild(fullItem(h)); });
        alvo.appendChild(U.card({ pad: true, body: [cab, tl] }));
        alvo.lastChild.classList.add("mt-16");
      });
    }

    campo.addEventListener("input", function () { render(campo.value); });
    render(termo);

    return { title: "Histórico", crumb: "Registro de decisões", node: view };
  };

  /* "Hoje" e "Ontem" por extenso: numa lista de dias, a data absoluta
     obriga a fazer a conta de cabeça para saber se foi agora. */
  function rotuloDia(iso) {
    var hoje = new Date(), d = new Date(iso + "T12:00:00");
    function chave(x) { return x.getFullYear() + "-" + x.getMonth() + "-" + x.getDate(); }
    var ontem = new Date(hoje.getTime() - 86400000);
    if (chave(d) === chave(hoje)) return "Hoje";
    if (chave(d) === chave(ontem)) return "Ontem";
    try {
      return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    } catch (e) { return iso; }
  }

  function exportar() {
    if (!window.AtlasExport) return U.toast("Exportar", "Camada de exportação não carregada.", "warning");
    var linhas = [["Data", "Ação", "Ativo", "Impacto", "Justificativa"]];
    S.state.historico.forEach(function (h) {
      var a = S.get.asset(h.ativo_id);
      linhas.push([
        h.data || "",
        window.Pages._labelAction(h.tipo_acao),
        a ? a.ticker : "",
        h.impacto || "",
        h.justificativa || ""
      ]);
    });
    AtlasExport.csv("atlas-hold-historico", null, linhas);
    U.toast("Exportado", "CSV com " + (linhas.length - 1) + " registros.", "success");
  }

  function fullItem(h) {
    var a = S.get.asset(h.ativo_id);
    var kind = h.subtipo === "buy" ? "buy" : h.subtipo === "sell" ? "sell" : h.subtipo === "thesis" ? "thesis" : h.subtipo === "study" ? "study" : "";
    var item = U.el("div", { class: "tl-item " + kind });
    item.innerHTML = '<div class="tl-dot">' + U.icon(h.subtipo === "buy" ? "arrowUp" : h.subtipo === "sell" ? "arrowDown" : h.subtipo === "thesis" ? "doc" : "check") + '</div>';
    var head = U.el("div", { class: "tl-head" });
    head.appendChild(U.el("span", { class: "tl-title", text: window.Pages._labelAction(h.tipo_acao) }));
    /* O ativo vira atalho quando ainda existe. Exclusão não apaga o
       histórico — a linha continua, e o selo deixa de ser clicável em
       vez de sumir. */
    if (a) {
      var selo = U.el("button", { class: "badge plain link", type: "button", title: "Abrir " + a.ticker, text: a.ticker });
      selo.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.id; });
      head.appendChild(selo);
    } else if (h.ativo_id) {
      head.appendChild(U.el("span", { class: "badge plain", text: "ativo removido" }));
    }
    head.appendChild(U.el("span", { class: "tl-time", text: hora(h.data) }));
    item.appendChild(head);
    if (h.impacto) item.appendChild(U.el("div", { class: "tl-body", text: h.impacto }));
    if (h.justificativa) item.appendChild(U.el("div", { class: "tl-body", style: "color:var(--text-dim);font-style:italic", text: "“" + h.justificativa + "”" }));
    return item;
  }

  /* Dentro de um grupo do dia, a data inteira é redundante — a hora não. */
  function hora(iso) {
    try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return U.dateTime(iso); }
  }
})();
