/* ============================================================
   ATLAS — Sidebar / navegação de módulos
   ============================================================ */
(function (ATLAS) {
  "use strict";

  /* Busca compartilhada (.atlas-side-search) construída via DOM — abre a
     paleta Ctrl+K. Fica no topo da navegação, logo abaixo da marca, como
     no shell da raiz ("entre a logo e o menu"). */
  function buildSearch() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "11"); c.setAttribute("cy", "11"); c.setAttribute("r", "7");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "m20 20-3.5-3.5");
    svg.appendChild(c); svg.appendChild(p);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "atlas-side-search";
    btn.setAttribute("aria-label", "Buscar (Ctrl+K)");
    btn.appendChild(svg);
    var lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = "Buscar…";
    var k1 = document.createElement("kbd"); k1.textContent = "Ctrl";
    var k2 = document.createElement("kbd"); k2.textContent = "K";
    btn.appendChild(lbl); btn.appendChild(k1); btn.appendChild(k2);
    btn.addEventListener("click", function () {
      if (window.AtlasPalette && AtlasPalette.open) AtlasPalette.open();
    });
    return btn;
  }

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
        '<a class="nav__item nav__back" href="../pages/dashboard.html">' +
          '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 18l-6-6 6-6"/></svg>' +
          '<span class="label">Voltar ao Atlas</span>' +
        '</a>' +
        '<div class="nav__group-label eyebrow">Operação</div>' + items;

      el.insertBefore(buildSearch(), el.firstChild);

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
