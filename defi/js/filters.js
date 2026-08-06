/* ============================================================
   ATLAS · DeFi — filters.js
   Motor de filtros reutilizável (blockchain, protocolo, categoria,
   status, token). Popula selects a partir dos dados e aplica filtros.
   ============================================================ */
(function () {
  "use strict";

  var Filters = {
    /* Popula um <select> com valores únicos de um campo */
    populate: function (selectEl, items, field, placeholder) {
      if (!selectEl) return;
      var seen = {};
      var vals = items.map(function (i) { return i[field]; }).filter(function (v) {
        if (!v || seen[v]) return false; seen[v] = 1; return true;
      }).sort();
      selectEl.innerHTML = '<option value="">' + placeholder + '</option>' +
        vals.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join("");
    },

    /* Aplica um objeto de filtros { field: value } a um array */
    apply: function (items, criteria) {
      return items.filter(function (it) {
        for (var f in criteria) {
          if (!criteria[f]) continue;
          if (f === "token") {
            var t = criteria[f].toLowerCase();
            var pool = ((it.base || "") + " " + (it.quote || "") + " " + (it.token || "")).toLowerCase();
            if (pool.indexOf(t) === -1) return false;
          } else if (String(it[f]) !== String(criteria[f])) {
            return false;
          }
        }
        return true;
      });
    }
  };

  window.Filters = Filters;
})();
