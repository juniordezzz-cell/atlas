/* ============================================================
   ATLAS · RWA — view-journal.js
   ============================================================ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  var U = window.U, S = window.RWAStore, UI = window.UI;

  var TYPES = [
    { id: "entrada", label: "Entrada" }, { id: "tese", label: "Tese" },
    { id: "revisao", label: "Revisão" }, { id: "manutencao", label: "Manutenção" }, { id: "saida", label: "Saída" }
  ];

  window.Views.journal = function () {
    var app = U.qs("#app");
    var state = { filter: "" };
    var tickers = S.assets().map(function (a) { return a.ticker; });

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Registro de decisões</div><h1 class="view-title">Journal</h1>' +
        '<div class="view-sub">Cada decisão registrada — tese, revisão e execução. Base do histórico do Oráculo.</div></div></div>' +

      '<div class="grid g-12 section" style="align-items:start">' +
        /* composer */
        '<div class="panel panel-pad">' +
          '<div class="panel-head"><h3>Nova entrada</h3></div>' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<select class="select" id="jType" style="width:100%">' + TYPES.map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join("") + '</select>' +
            '<select class="select" id="jTicker" style="width:100%"><option value="">Ativo (opcional)</option>' + tickers.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select>' +
            '<textarea id="jText" class="select" style="width:100%;min-height:96px;line-height:1.6;cursor:text;background-image:none;padding:10px 12px" placeholder="Descreva a decisão e a tese por trás dela…"></textarea>' +
            '<button class="btn btn-primary" id="jAdd">Registrar decisão</button>' +
          '</div>' +
        '</div>' +

        /* timeline */
        '<div class="panel panel-pad">' +
          '<div class="panel-head"><h3>Linha do tempo</h3>' +
            '<select class="select" id="jFilter"><option value="">Todos os tipos</option>' + TYPES.map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join("") + '</select>' +
          '</div>' +
          '<div id="tl"></div>' +
        '</div>' +
      '</div>';

    function draw() {
      var items = S.journal();
      if (state.filter) items = items.filter(function (e) { return e.type === state.filter; });
      var tl = U.qs("#tl");
      if (!items.length) { tl.innerHTML = UI.empty({ icon: "journal", title: "Sem registros", text: "Nenhuma decisão para este filtro." }); return; }
      tl.innerHTML = '<div class="timeline">' + items.map(function (e) {
        var tl = TYPES.filter(function (t) { return t.id === e.type; })[0] || { label: e.type };
        return '<div class="tl ' + e.type + '"><div class="tl-top">' +
          '<span class="tl-type ' + e.type + '">' + tl.label + '</span>' +
          (e.ticker ? '<span class="tag">' + e.ticker + '</span>' : '') +
          '<span class="tl-date">' + U.date(e.date) + '</span></div>' +
          '<div class="tl-txt">' + e.text + '</div></div>';
      }).join("") + '</div>';
    }

    U.qs("#jFilter").addEventListener("change", function (e) { state.filter = e.target.value; draw(); });
    U.qs("#jAdd").addEventListener("click", function () {
      var text = U.qs("#jText").value.trim();
      if (!text) { U.toast("Escreva a decisão antes de registrar.", "warn"); return; }
      S.addJournal({ type: U.qs("#jType").value, ticker: U.qs("#jTicker").value, text: text });
      U.qs("#jText").value = "";
      U.toast("Decisão registrada no journal.", "ok");
      draw();
    });

    draw();
  };
})();
