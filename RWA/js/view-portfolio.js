/* ============================================================
   ATLAS · RWA — view-portfolio.js
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  window.Views.portfolio = function (ctx) {
    var app = U.qs("#app");
    var state = { q: (ctx.query && ctx.query.q) || "", cls: "", score: "", sort: "weight", dir: "desc" };

    var classes = uniq(S.assets().map(function (a) { return a.type; }));

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Carteira</div><h1 class="view-title">Portfolio</h1>' +
        '<div class="view-sub">Ativos do mundo real tokenizados — clique para abrir a análise completa.</div></div></div>' +
      '<div class="filters">' +
        '<select class="select" id="fClass"><option value="">Todas as classes</option>' + classes.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("") + '</select>' +
        '<select class="select" id="fScore"><option value="">Qualquer score</option><option value="85">Score ≥ 85</option><option value="70">Score ≥ 70</option><option value="50">Score ≥ 50</option></select>' +
        '<select class="select" id="fSort"><option value="weight">Ordenar: Peso</option><option value="pnlPct">Ordenar: PnL %</option><option value="score">Ordenar: Score</option><option value="current">Ordenar: Valor</option></select>' +
        '<div class="grow"></div>' +
        (state.q ? '<span class="tag tag-accent">busca: "' + state.q + '" <button class="btn-ghost btn-sm" id="clearQ" style="padding:0 4px">✕</button></span>' : '') +
      '</div>' +
      '<div class="panel"><div class="table-wrap"><table class="dtable"><thead><tr>' +
        '<th>Asset</th><th>Type</th><th class="num">Entry</th><th class="num">Current</th>' +
        '<th class="num sortable" data-s="pnlPct">PnL <span class="arr" id="arrPnl"></span></th>' +
        '<th class="num sortable" data-s="weight">Weight <span class="arr" id="arrW"></span></th>' +
        '<th class="num">Score</th><th>Regime Sens.</th>' +
      '</tr></thead><tbody id="tbody"></tbody></table></div></div>';

    function draw() {
      var items = S.assets();
      if (state.q) { var q = state.q.toLowerCase(); items = items.filter(function (a) { return (a.name + " " + a.ticker + " " + a.type + " " + a.sector).toLowerCase().indexOf(q) !== -1; }); }
      if (state.cls) items = items.filter(function (a) { return a.type === state.cls; });
      if (state.score) items = items.filter(function (a) { return a.score >= +state.score; });
      items.sort(function (a, b) { var d = b[state.sort] - a[state.sort]; return state.dir === "asc" ? -d : d; });

      var tb = U.qs("#tbody");
      if (!items.length) { tb.innerHTML = '<tr><td colspan="8">' + UI.empty({ icon: "search", title: "Nenhum ativo", text: "Ajuste os filtros ou a busca." }) + '</td></tr>'; return; }
      tb.innerHTML = items.map(function (a) {
        var pcls = a.pnlPct > 0 ? "val-pos" : a.pnlPct < 0 ? "val-neg" : "val-flat";
        return '<tr data-id="' + a.id + '">' +
          '<td><div class="asset-cell">' + U.tkn(a) + '<div><div class="asset-name">' + a.name + '</div><div class="asset-tick">' + a.ticker + '</div></div></div></td>' +
          '<td><span class="tag">' + a.type + '</span></td>' +
          '<td class="num t2">' + U.money0(a.entry) + '</td>' +
          '<td class="num">' + U.money0(a.current) + '</td>' +
          '<td class="num ' + pcls + '">' + U.pct(a.pnlPct, true) + '<div style="font-size:10.5px;font-weight:400" class="t3">' + U.signed(a.pnlAbs) + '</div></td>' +
          '<td class="num">' + U.pct(a.weight) + '</td>' +
          '<td class="num">' + U.score(a.score) + '</td>' +
          '<td>' + U.sens(a.regimeSens) + '</td>' +
        '</tr>';
      }).join("");
      U.qsa("#tbody tr[data-id]").forEach(function (tr) { tr.addEventListener("click", function () { location.hash = "#/asset/" + tr.dataset.id; }); });
      updateArrows();
    }

    function updateArrows() {
      var a = state.dir === "desc" ? "▼" : "▲";
      U.qs("#arrPnl").textContent = state.sort === "pnlPct" ? a : "";
      U.qs("#arrW").textContent = state.sort === "weight" ? a : "";
    }

    U.qs("#fClass").addEventListener("change", function (e) { state.cls = e.target.value; draw(); });
    U.qs("#fScore").addEventListener("change", function (e) { state.score = e.target.value; draw(); });
    U.qs("#fSort").value = state.sort;
    U.qs("#fSort").addEventListener("change", function (e) { state.sort = e.target.value; state.dir = "desc"; draw(); });
    U.qsa(".dtable th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var s = th.dataset.s;
        if (state.sort === s) state.dir = state.dir === "desc" ? "asc" : "desc"; else { state.sort = s; state.dir = "desc"; }
        U.qs("#fSort").value = ["weight", "pnlPct", "score", "current"].indexOf(s) !== -1 ? s : U.qs("#fSort").value;
        draw();
      });
    });
    var cq = U.qs("#clearQ"); if (cq) cq.addEventListener("click", function () { location.hash = "#/portfolio"; });

    draw();
  };

  function uniq(arr) { var s = {}, o = []; arr.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o.sort(); }
})();
