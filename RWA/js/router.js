/* ============================================================
   ATLAS · RWA — router.js
   Roteador SPA por hash (#/rota). Sem reload, funciona em file://.
   Suporta parâmetros de caminho (asset/:id) e query (?q=).
   ============================================================ */
(function () {
  "use strict";
  var routes = [];

  function parse(hash) {
    hash = (hash || "").replace(/^#\/?/, "");
    var qi = hash.indexOf("?");
    var query = {};
    if (qi !== -1) {
      hash.slice(qi + 1).split("&").forEach(function (kv) {
        var p = kv.split("="); if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
      hash = hash.slice(0, qi);
    }
    return { path: hash || "dashboard", query: query };
  }

  function match(path) {
    var segs = path.split("/");
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i], ps = r.pattern.split("/");
      if (ps.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j][0] === ":") params[ps[j].slice(1)] = decodeURIComponent(segs[j]);
        else if (ps[j] !== segs[j]) { ok = false; break; }
      }
      if (ok) return { route: r, params: params };
    }
    return null;
  }

  var Router = {
    register: function (pattern, handler, navId) { routes.push({ pattern: pattern, handler: handler, navId: navId }); return this; },
    resolve: function () {
      var p = parse(location.hash);
      var m = match(p.path) || match("dashboard");
      window.scrollTo(0, 0);
      if (window.Shell) Shell.setActive(m.route.navId || m.route.pattern.split("/")[0]);
      try { m.route.handler({ params: m.params, query: p.query }); }
      catch (e) {
        var app = document.getElementById("app");
        if (app) app.innerHTML = '<div class="empty"><div class="empty-art">' + U.icon("alert") + '</div><h3>Erro ao carregar a view</h3><p>' + (e.message || e) + '</p></div>';
        if (window.console) console.error(e);
      }
      if (window.Shell) Shell.refreshTopbar();
    },
    start: function () {
      window.addEventListener("hashchange", this.resolve.bind(this));
      if (!location.hash) {
        try { history.replaceState(null, "", "#/dashboard"); } catch (e) {}
      }
      this.resolve();
    },
    go: function (hash) {
      try { location.hash = hash; } catch (e) {
        try { history.pushState(null, "", hash); this.resolve(); } catch (e2) {}
      }
    }
  };

  window.Router = Router;
})();
