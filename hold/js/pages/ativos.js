/* HOLD · pages/ativos.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;
  var filterState = "all";

  window.Pages = window.Pages || {};
  window.Pages.ativos = function (ctx) {
    var id = ctx && ctx.query && ctx.query.id;
    if (id && S.get.asset(id)) return detailView(id);
    return listView();
  };

  function listView() {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Ativos" }), U.el("p", { text: "Universo completo de ativos do sistema, de watchlist a investidos." })]),
        U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: F.newAsset })
      ])
    ]));

    var seg = U.el("div", { class: "segmented" });
    [["all", "Todos"], ["invested", "Investidos"], ["watchlist", "Watchlist"], ["sold", "Vendidos"]].forEach(function (o) {
      var b = U.el("button", { class: filterState === o[0] ? "on" : "", text: o[1] });
      b.addEventListener("click", function () { filterState = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });

    var searchWrap = U.el("div", { class: "search" });
    searchWrap.innerHTML = U.icon("search");
    var searchInput = U.input({ placeholder: "Buscar ativo…" });
    searchWrap.appendChild(searchInput);

    var toolbar = U.el("div", { class: "between mt-8", style: "margin-bottom:16px" }, [seg, searchWrap]);
    view.appendChild(toolbar);

    var tableHolder = U.el("div");
    view.appendChild(tableHolder);

    function render(term) {
      term = (term || "").toLowerCase();
      var list = S.state.ativos.filter(function (a) {
        return (filterState === "all" || a.status === filterState) &&
          (!term || a.nome.toLowerCase().indexOf(term) >= 0 || a.ticker.toLowerCase().indexOf(term) >= 0);
      });
      var cols = [
        { head: "Ativo", render: function (a) { return U.assetCell(a); } },
        { head: "Setor", render: function (a) { return U.el("span", { class: "dim", text: a.setor || "—" }); } },
        { head: "Preço", right: true, render: function (a) { return U.el("span", { class: "num", text: U.money(a.preco_atual) }); } },
        { head: "Market cap", right: true, render: function (a) { return U.el("span", { class: "num", text: U.compact(a.market_cap) }); } },
        { head: "Convicção", render: function (a) { return U.convictionMini(a.conviccao); } },
        { head: "Tese", render: function (a) { return S.get.thesisOfAsset(a.id) ? U.badge("active", "Documentada") : U.el("span", { class: "badge plain", text: "Pendente" }); } },
        { head: "Status", render: function (a) { return U.badge(a.status); } }
      ];
      tableHolder.innerHTML = "";
      var body = list.length
        ? U.table(cols, list, { onRow: function (a) { location.hash = "#/ativos?id=" + a.id; } })
        : U.empty("layers", "Nenhum ativo", "Ajuste o filtro ou adicione um novo ativo.");
      tableHolder.appendChild(U.card({ tight: true, body: [body] }));
    }
    searchInput.addEventListener("input", function () { render(searchInput.value); });
    render("");

    return { title: "Ativos", crumb: "Universo de ativos", node: view };
  }

  function detailView(id) {
    var a = S.get.asset(id), t = S.get.thesisOfAsset(id), pos = S.get.positionOf(id);
    var view = U.el("div");

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.button("Voltar", { variant: "ghost", icon: "chevron", onClick: function () { location.hash = "#/ativos"; } }),
        U.el("div", { class: "grow" }),
        t ? U.button("Revisar tese", { variant: "secondary", icon: "edit", onClick: function () { F.editThesis(t.id); } }) : U.button("Criar tese", { variant: "secondary", icon: "doc", onClick: function () { F.newThesis(id); } }),
        U.button("Comprar", { variant: "primary", icon: "arrowUp", onClick: function () { F.trade(id, "buy"); } }),
        pos ? U.button("Vender", { variant: "danger", icon: "arrowDown", onClick: function () { F.trade(id, "sell"); } }) : null
      ])
    ]));

    // header card
    var header = U.el("div", { class: "card pad" });
    var hrow = U.el("div", { class: "between" });
    var left = U.el("div", { class: "asset-cell" });
    left.appendChild(U.el("div", { class: "ticker-badge", style: "width:48px;height:48px;font-size:15px", text: a.ticker.slice(0, 4) }));
    left.appendChild(U.el("div", {}, [
      U.el("h2", { text: a.nome }),
      U.el("div", { class: "dim small", text: a.ticker + " · " + a.tipo + " · " + (a.setor || "—") })
    ]));
    hrow.appendChild(left);
    hrow.appendChild(U.badge(a.status));
    header.appendChild(hrow);

    var stats = U.el("div", { class: "grid g-4 mt-16" });
    stats.appendChild(miniStat("Preço atual", U.money(a.preco_atual)));
    stats.appendChild(miniStat("Market cap", U.compact(a.market_cap)));
    stats.appendChild(miniStat("Categoria", a.categoria || "—"));
    var convWrap = U.el("div"); convWrap.appendChild(U.conviction(a.conviccao));
    stats.appendChild(miniStatNode("Convicção", convWrap));
    header.appendChild(stats);
    view.appendChild(header);

    // position card
    if (pos) {
      var pv = S.get.positionValue(pos), pl = S.get.positionPnL(pos), plp = S.get.positionPnLPct(pos);
      var posGrid = U.el("div", { class: "grid g-4" });
      posGrid.appendChild(miniStat("Quantidade", U.qty(pos.quantidade)));
      posGrid.appendChild(miniStat("Preço médio", U.money(pos.preco_medio)));
      posGrid.appendChild(miniStat("Valor", U.money(pv, 0)));
      var plNode = U.el("span", { class: "num " + U.signClass(pl), text: U.money(pl, 0) + " (" + U.pct(plp) + ")" });
      posGrid.appendChild(miniStatNode("Resultado", plNode));
      var posCard = U.card({ eyebrow: "Carteira", title: "Posição atual", body: [posGrid] });
      posCard.classList.add("mt-16");
      view.appendChild(posCard);
    }

    // thesis card
    var thesisCard = U.card({ eyebrow: "Fundamento", title: "Tese de investimento",
      action: t ? U.badge(t.status) : null,
      body: [t ? thesisContent(t) : U.empty("doc", "Sem tese", "Nenhum ativo é investido sem tese. Documente a tese para habilitar a operação.",
        U.button("Criar tese", { variant: "primary", icon: "plus", onClick: function () { F.newThesis(id); } }))] });
    thesisCard.classList.add("mt-16");
    view.appendChild(thesisCard);

    // history for this asset
    var hs = S.state.historico.filter(function (h) { return h.ativo_id === id; });
    var tl = U.el("div", { class: "timeline" });
    if (hs.length) hs.slice(0, 8).forEach(function (h) { tl.appendChild(window.Pages._historyItem(h)); });
    else tl = U.empty("history", "Sem histórico", "As decisões deste ativo aparecerão aqui.");
    var histCard = U.card({ eyebrow: "Registro", title: "Histórico do ativo", body: [tl] });
    histCard.classList.add("mt-16");
    view.appendChild(histCard);

    return { title: a.nome, crumb: "Ativos · " + a.ticker, node: view };
  }

  function thesisContent(t) {
    var wrap = U.el("div");
    wrap.appendChild(U.el("p", { style: "line-height:1.65", text: t.narrativa }));

    wrap.appendChild(U.el("div", { class: "eyebrow mt-24", text: "Cenários", style: "margin-bottom:10px" }));
    var sc = U.el("div", { class: "scenarios" });
    [["bull", "Bull"], ["base", "Base"], ["bear", "Bear"]].forEach(function (o) {
      sc.appendChild(U.el("div", { class: "scenario " + o[0] }, [
        U.el("h4", { text: o[1] }), U.el("p", { text: t.cenarios[o[0]] || "—" })
      ]));
    });
    wrap.appendChild(sc);

    var two = U.el("div", { class: "grid g-2 mt-24" });
    two.appendChild(chipBlock("Riscos", t.riscos, "risk"));
    two.appendChild(chipBlock("Catalisadores", t.catalisadores, "cat"));
    wrap.appendChild(two);

    wrap.appendChild(U.el("div", { class: "eyebrow mt-24", text: "Critérios de invalidação", style: "margin-bottom:6px" }));
    wrap.appendChild(U.el("p", { class: "dim", text: t.criterios_invalidacao || "—" }));

    var conv = U.el("div", { class: "row-flex mt-24" });
    conv.appendChild(U.el("span", { class: "eyebrow", text: "Convicção" }));
    conv.appendChild(U.conviction(t.conviccao));
    wrap.appendChild(conv);
    return wrap;
  }
  function chipBlock(title, items, cls) {
    var b = U.el("div");
    b.appendChild(U.el("div", { class: "eyebrow", text: title, style: "margin-bottom:8px" }));
    var chips = U.el("div", { class: "chips" });
    (items && items.length ? items : ["—"]).forEach(function (i) { chips.appendChild(U.el("span", { class: "chip " + cls, text: i })); });
    b.appendChild(chips);
    return b;
  }
  function miniStat(label, value) { return miniStatNode(label, U.el("span", { class: "num", text: value })); }
  function miniStatNode(label, node) {
    var d = U.el("div", { class: "stack" });
    d.appendChild(U.el("span", { class: "small dim", text: label }));
    d.appendChild(node);
    return d;
  }
})();
