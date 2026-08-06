/* HOLD · pages/carteira.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;

  window.Pages = window.Pages || {};
  window.Pages.carteira = function () {
    var view = U.el("div");
    var val = S.get.portfolioValue(), cost = S.get.portfolioCost(), pnl = S.get.portfolioPnL(), pnlPct = S.get.portfolioPnLPct();

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Carteira" }), U.el("p", { text: "Posições investidas com preço médio, resultado e peso relativo." })]),
        U.button("Registrar operação", { variant: "primary", icon: "wallet", onClick: function () {
          var inv = S.state.ativos.filter(function (a) { return S.get.thesisOfAsset(a.id); });
          if (!inv.length) return U.toast("Sem ativos com tese", "Crie uma tese antes de operar.", "warning");
          F.trade(inv[0].id, "buy");
        }})
      ])
    ]));

    // summary strip
    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "wallet", label: "Valor de mercado", value: U.compact(val) }));
    strip.appendChild(U.kpi({ icon: "coins", label: "Custo investido", value: U.compact(cost) }));
    strip.appendChild(U.kpi({ icon: "trendUp", label: "Resultado", value: U.money(pnl, 0), delta: pnl, deltaText: U.pct(pnlPct) }));
    strip.appendChild(U.kpi({ icon: "layers", label: "Posições", value: String(S.get.walletPositions().length) }));
    view.appendChild(strip);

    // table
    var rows = S.get.walletPositions().slice().sort(function (a, b) { return S.get.positionValue(b) - S.get.positionValue(a); });
    var cols = [
      { head: "Ativo", render: function (p) { return U.assetCell(S.get.asset(p.ativo_id)); } },
      { head: "Qtd", right: true, render: function (p) { return U.el("span", { class: "num", text: U.qty(p.quantidade) }); } },
      { head: "Preço médio", right: true, render: function (p) { return U.el("span", { class: "num", text: U.money(p.preco_medio) }); } },
      { head: "Preço atual", right: true, render: function (p) { var a = S.get.asset(p.ativo_id); return U.el("span", { class: "num", text: U.money(a.preco_atual) }); } },
      { head: "Valor", right: true, render: function (p) { return U.el("span", { class: "num", text: U.money(S.get.positionValue(p), 0) }); } },
      { head: "PnL", right: true, render: function (p) {
          var v = S.get.positionPnL(p), pc = S.get.positionPnLPct(p);
          return U.el("span", { class: "num " + U.signClass(v) }, [U.money(v, 0) + "  (" + U.pct(pc) + ")"]);
        } },
      { head: "Peso", right: true, render: function (p) {
          var w = S.get.positionWeight(p);
          var wrap = U.el("div", { style: "display:flex;align-items:center;gap:8px;justify-content:flex-end" });
          wrap.appendChild(U.el("span", { class: "num", text: w.toFixed(0) + "%" }));
          var bar = U.el("div", { class: "mini-bar" }); bar.appendChild(U.el("i", { style: "width:" + Math.min(100, w) + "%" }));
          wrap.appendChild(bar); return wrap;
        } },
      { head: "", right: true, render: function (p) {
          var wrap = U.el("div", { class: "row-flex", style: "justify-content:flex-end;flex-wrap:nowrap" });
          wrap.appendChild(U.button("Comprar", { variant: "secondary", size: "sm", onClick: function (e) { e.stopPropagation(); F.trade(p.ativo_id, "buy"); } }));
          wrap.appendChild(U.button("Vender", { variant: "ghost", size: "sm", onClick: function (e) { e.stopPropagation(); F.trade(p.ativo_id, "sell"); } }));
          return wrap;
        } }
    ];

    var body = rows.length
      ? U.table(cols, rows, { onRow: function (p) { location.hash = "#/ativos?id=" + p.ativo_id; } })
      : U.empty("wallet", "Carteira vazia", "Registre uma compra a partir de um ativo com tese vinculada.",
          U.button("Registrar operação", { variant: "primary", icon: "plus", onClick: function () {
            var inv = S.state.ativos.filter(function (a) { return S.get.thesisOfAsset(a.id); });
            if (!inv.length) return U.toast("Sem ativos com tese", "Crie uma tese antes de operar.", "warning");
            F.trade(inv[0].id, "buy");
          }}));

    var tableCard = U.card({ eyebrow: "Posições", title: "Composição da carteira", tight: true, body: [body] });
    tableCard.classList.add("mt-16");
    view.appendChild(tableCard);

    return { title: "Carteira", crumb: "Posições investidas", node: view };
  };
})();
