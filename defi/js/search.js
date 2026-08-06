/* ============================================================
   ATLAS · DeFi — search.js
   Pesquisa instantânea sobre um conjunto de campos.
   ============================================================ */
(function () {
  "use strict";

  var Search = {
    /* Retorna itens cujo texto concatenado casa com a query */
    match: function (items, query, fields) {
      var q = (query || "").trim().toLowerCase();
      if (!q) return items;
      return items.filter(function (it) {
        var hay = fields.map(function (f) { return (it[f] != null ? it[f] : ""); }).join(" ").toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    },

    /* Liga um input a um callback com debounce leve */
    bind: function (inputEl, cb) {
      if (!inputEl) return;
      var t;
      inputEl.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { cb(inputEl.value); }, 90);
      });
    }
  };

  window.Search = Search;
})();
