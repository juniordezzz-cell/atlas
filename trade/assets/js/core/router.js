/* ============================================================
   ATLAS — Router (hash-based, sem dependências)
   ------------------------------------------------------------
   Cada módulo se registra com um id e uma função render(mount).
   Trocar de módulo NÃO recarrega a página nem o shell — só troca
   o conteúdo de .view. É a espinha onde cada Sprint se encaixa.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var routes = {};
  var listeners = [];
  var current = null;

  var router = {
    register: function (id, def) { routes[id] = def; return router; },

    routesList: function () {
      return Object.keys(routes).map(function (id) {
        return { id: id, label: routes[id].label, icon: routes[id].icon, soon: !!routes[id].soon };
      });
    },

    onChange: function (fn) { listeners.push(fn); return router; },

    current: function () { return current; },

    go: function (id) { if (routes[id]) window.location.hash = "#/" + id; },

    _resolve: function () {
      var id = (window.location.hash || "").replace(/^#\/?/, "") || "dashboard";
      if (!routes[id]) id = "dashboard";
      current = id;
      var mount = document.querySelector(".view__inner");
      if (mount) { mount.innerHTML = ""; routes[id].render(mount); }
      listeners.forEach(function (fn) { fn(id); });
    },

    start: function () {
      window.addEventListener("hashchange", router._resolve);
      router._resolve();
    }
  };

  ATLAS.router = router;
})(window.ATLAS = window.ATLAS || {});
