/* HOLD · pages/watchlist.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;

  window.Pages = window.Pages || {};
  window.Pages.watchlist = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Watchlist" }), U.el("p", { text: "Candidatos em observação. O caminho para a carteira passa pela tese." })]),
        U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: F.newAsset })
      ])
    ]));

    var list = S.state.ativos.filter(function (a) { return a.status === "watchlist"; });
    if (!list.length) {
      view.appendChild(U.empty("eye", "Watchlist vazia", "Adicione ativos que você quer acompanhar antes de decidir investir.",
        U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: F.newAsset })));
      return { title: "Watchlist", crumb: "Em observação", node: view };
    }

    var grid = U.el("div", { class: "grid g-3" });
    list.forEach(function (a) {
      var hasThesis = !!S.get.thesisOfAsset(a.id);
      var card = U.el("div", { class: "card hoverable pad" });
      var top = U.el("div", { class: "between" });
      top.appendChild(U.assetCell(a));
      top.appendChild(U.badge("watchlist"));
      card.appendChild(top);

      var mid = U.el("div", { class: "row-flex mt-16", style: "justify-content:space-between" });
      mid.appendChild(U.el("div", { class: "stack" }, [
        U.el("span", { class: "small dim", text: "Preço" }),
        U.el("span", { class: "num", text: U.money(a.preco_atual) })
      ]));
      mid.appendChild(U.el("div", { class: "stack" }, [
        U.el("span", { class: "small dim", text: "Market cap" }),
        U.el("span", { class: "num", text: U.compact(a.market_cap) })
      ]));
      mid.appendChild(U.el("div", { class: "stack", style: "text-align:right" }, [
        U.el("span", { class: "small dim", text: "Convicção" }),
        U.convictionMini(a.conviccao)
      ]));
      card.appendChild(mid);

      card.appendChild(U.el("div", { class: "row-flex mt-16", style: "gap:6px" }, [
        U.el("span", { class: "chip", text: a.setor || "—" }),
        U.el("span", { class: "chip", text: a.categoria || "—" })
      ]));

      var actions = U.el("div", { class: "row-flex mt-16", style: "flex-wrap:nowrap" });
      actions.appendChild(U.button(hasThesis ? "Ver tese" : "Criar tese", { variant: "primary", size: "sm", block: false, icon: "doc",
        onClick: function () { hasThesis ? (location.hash = "#/teses") : F.newThesis(a.id); } }));
      actions.appendChild(U.button("Detalhes", { variant: "ghost", size: "sm", onClick: function () { location.hash = "#/ativos?id=" + a.id; } }));
      card.appendChild(actions);

      grid.appendChild(card);
    });
    view.appendChild(grid);

    return { title: "Watchlist", crumb: "Em observação", node: view };
  };
})();
