/* ============================================================
   ATLAS · academy/js/academy-chart.js
   Gráfico de linha em SVG puro — sem dependência externa.

   AcademyChart.line(container, points, opts)
     points: Array<[ts, price]>
     opts:   { up: bool }  (cor de alta/baixa)

   Desenha linha + área com gradiente, responsivo (redesenha no
   resize). SVG criado com createElementNS (nada de innerHTML).
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyChart) return;

  var NS = "http://www.w3.org/2000/svg";
  var uid = 0;

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function draw(container, points, opts) {
    opts = opts || {};
    while (container.firstChild) container.removeChild(container.firstChild);
    if (!points || points.length < 2) {
      var empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = "indisponível";
      container.appendChild(empty);
      return;
    }

    var w = Math.max(container.clientWidth || 600, 120);
    var h = Math.max(container.clientHeight || 220, 80);
    var padY = 10, padX = 0;

    var xs = points.map(function (p) { return p[0]; });
    var ys = points.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;

    function px(x) { return padX + (x - minX) / spanX * (w - 2 * padX); }
    function py(y) { return padY + (1 - (y - minY) / spanY) * (h - 2 * padY); }

    var up = opts.up !== false;
    var stroke = up ? "var(--academy-up, #00E28A)" : "var(--academy-down, #FF5C7A)";

    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "none",
                          width: "100%", height: "100%" });
    svg.style.display = "block";

    var gid = "acg" + (++uid);
    var defs = el("defs");
    var grad = el("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": stroke, "stop-opacity": "0.28" }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": stroke, "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var dLine = "M" + px(points[0][0]).toFixed(2) + " " + py(points[0][1]).toFixed(2);
    for (var i = 1; i < points.length; i++) {
      dLine += " L" + px(points[i][0]).toFixed(2) + " " + py(points[i][1]).toFixed(2);
    }
    var dArea = dLine + " L" + px(points[points.length - 1][0]).toFixed(2) + " " + (h - padY).toFixed(2) +
                " L" + px(points[0][0]).toFixed(2) + " " + (h - padY).toFixed(2) + " Z";

    svg.appendChild(el("path", { d: dArea, fill: "url(#" + gid + ")", stroke: "none" }));
    svg.appendChild(el("path", { d: dLine, fill: "none", stroke: stroke,
      "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round",
      "vector-effect": "non-scaling-stroke" }));

    container.appendChild(svg);
  }

  var AcademyChart = {
    line: function (container, points, opts) {
      if (!container) return;
      draw(container, points, opts);
      // redesenha em mudança de tamanho
      if (typeof ResizeObserver !== "undefined") {
        if (container.__acRO) container.__acRO.disconnect();
        var ro = new ResizeObserver(function () { draw(container, points, opts); });
        ro.observe(container);
        container.__acRO = ro;
      }
    }
  };

  window.AcademyChart = AcademyChart;
})();
