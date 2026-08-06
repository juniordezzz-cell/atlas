/* ============================================================
   ATLAS — Sidebar / navegação de módulos
   ============================================================ */
(function (ATLAS) {
  "use strict";

  ATLAS.sidebar = {
    mount: function (el) {
      var u = ATLAS.util;
      var items = ATLAS.router.routesList().map(function (r) {
        return '<a class="nav__item" href="#/' + r.id + '" data-id="' + r.id + '">' +
          u.icon(r.icon, 19) +
          '<span class="label">' + r.label + '</span>' +
          (r.soon ? '<span class="nav__soon">em breve</span>' : '') +
          '</a>';
      }).join("");

      el.innerHTML =
        '<a class="nav__item nav__back" href="../dashboard.html">' +
          '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 18l-6-6 6-6"/></svg>' +
          '<span class="label">Voltar ao Atlas</span>' +
        '</a>' +
        '<div class="nav__group-label eyebrow">Operação</div>' + items;

      function sync(id) {
        el.querySelectorAll(".nav__item").forEach(function (a) {
          a.setAttribute("aria-current", a.dataset.id === id);
        });
      }
      ATLAS.router.onChange(sync);
      sync(ATLAS.router.current());
    }
  };
})(window.ATLAS = window.ATLAS || {});
