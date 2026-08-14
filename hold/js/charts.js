/* ============================================================
   HOLD SYSTEM · js/charts.js
   Gráficos SVG minimalistas. Linha PRIMARY, sem dependências.
   ============================================================ */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  function svg(w, h) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.setAttribute("preserveAspectRatio", "none");
    return s;
  }
  function node(name, attrs) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#4DA3FF";
  }

  /* Cor de SÉRIE (linha, fatia, ponto). O acento do módulo não muda com
     o tema — é cor de marca — e sobre cartão branco dá 2,4 de contraste.
     Como gráfico carrega informação, o mínimo é 3,0. serie() escurece só
     no tema claro; no escuro devolve a mesma cor de sempre.
     Ver core/ui/atlas-chart-theme.js. */
  function serie(c) { var T = window.AtlasChartTheme; return T ? T.serie(c) : c; }

  /* ---- sparkline (para KPI) ---- */
  function sparkline(data, opts) {
    opts = opts || {};
    var w = opts.w || 90, h = opts.h || 30;
    var color = serie(opts.color || cssVar("--primary"));
    /* Mesmo defeito do sparkline do Trade: com UM ponto, i/(length-1)
       vira 0/0 = NaN e o SVG sai inválido. Devolve o quadro vazio, que
       mantém o espaço no layout sem desenhar linha nenhuma. */
    if (!data || data.length < 2) {
      var vazio = svg(w, h);
      vazio.style.width = w + "px"; vazio.style.height = h + "px";
      return vazio;
    }
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var range = (max - min) || 1;
    var pts = data.map(function (v, i) {
      var x = (i / (data.length - 1)) * w;
      var y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var s = svg(w, h); s.style.width = w + "px"; s.style.height = h + "px";
    var poly = node("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" });
    s.appendChild(poly);
    var last = data[data.length - 1], lx = w, ly = h - ((last - min) / range) * (h - 4) - 2;
    s.appendChild(node("circle", { cx: lx, cy: ly, r: "2", fill: color }));
    return s;
  }

  /* ---- area line chart (grande) ---- */
  function lineChart(data, opts) {
    opts = opts || {};
    var w = 720, h = 240, padB = 26, padL = 4;
    var color = serie(opts.color || cssVar("--primary"));
    /* Mesma armadilha que o sparkline acima já tinha corrigida e esta
       função não: com UM ponto, `i / (data.length - 1)` é 0/0 = NaN, e
       todo atributo do SVG sai como "NaN" — gráfico invisível, sem
       erro no console para denunciar.

       Hoje o painel não chega aqui (ele exige duas medições antes de
       desenhar), então isto é rede de segurança, não conserto de
       sintoma: a próxima tela a usar lineChart não deveria precisar
       redescobrir a regra. Quadro vazio mantém o espaço no layout sem
       afirmar nada. */
    if (!data || data.length < 2) {
      var vazio = document.createElement("div");
      vazio.className = "chart-holder";
      vazio.appendChild(svg(w, h));
      return vazio;
    }
    var min = Math.min.apply(null, data.map(function (d) { return d.v; }));
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }));
    var range = (max - min) || 1;
    var innerH = h - padB;
    function X(i) { return padL + (i / (data.length - 1)) * (w - padL * 2); }
    function Y(v) { return innerH - ((v - min) / range) * (innerH - 12) - 6; }

    var holder = document.createElement("div"); holder.className = "chart-holder";
    var s = svg(w, h); s.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // grid lines
    for (var g = 0; g <= 3; g++) {
      var gy = 6 + (g / 3) * (innerH - 12);
      s.appendChild(node("line", { x1: padL, y1: gy, x2: w - padL, y2: gy, stroke: cssVar("--border"), "stroke-width": "1", "stroke-dasharray": "2 5", opacity: "0.6" }));
    }
    // gradient
    var defs = node("defs");
    var grad = node("linearGradient", { id: "hold-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(node("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.28" }));
    grad.appendChild(node("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
    defs.appendChild(grad); s.appendChild(defs);

    var linePts = data.map(function (d, i) { return X(i).toFixed(1) + " " + Y(d.v).toFixed(1); });
    var areaPath = "M " + X(0).toFixed(1) + " " + innerH + " L " + linePts.join(" L ") + " L " + X(data.length - 1).toFixed(1) + " " + innerH + " Z";
    s.appendChild(node("path", { d: areaPath, fill: "url(#hold-grad)", stroke: "none" }));
    s.appendChild(node("path", { d: "M " + linePts.join(" L "), fill: "none", stroke: color, "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round" }));
    // last point
    s.appendChild(node("circle", { cx: X(data.length - 1), cy: Y(data[data.length - 1].v), r: "3.4", fill: color, stroke: cssVar("--surface"), "stroke-width": "2" }));

    // x labels (first, mid, last)
    [0, Math.floor(data.length / 2), data.length - 1].forEach(function (i) {
      var tx = node("text", { x: X(i), y: h - 6, fill: cssVar("--text-dim"), "font-size": "10", "text-anchor": i === 0 ? "start" : i === data.length - 1 ? "end" : "middle", "font-family": "monospace" });
      tx.textContent = data[i].label; s.appendChild(tx);
    });
    holder.appendChild(s);
    return holder;
  }

  /* ---- donut (alocação) ---- */
  function donut(segments, opts) {
    opts = opts || {};
    var size = opts.size || 180, stroke = opts.stroke || 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
    var C = 2 * Math.PI * r;
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var s = svg(size, size); s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    s.style.maxWidth = size + "px"; s.style.margin = "0 auto";
    s.appendChild(node("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: cssVar("--surface-alt"), "stroke-width": stroke }));
    var offset = 0;
    segments.forEach(function (seg) {
      var frac = seg.value / total;
      var len = frac * C;
      var circle = node("circle", {
        cx: cx, cy: cy, r: r, fill: "none", stroke: seg.color, "stroke-width": stroke,
        "stroke-dasharray": len + " " + (C - len),
        "stroke-dashoffset": -offset,
        transform: "rotate(-90 " + cx + " " + cy + ")",
        "stroke-linecap": "butt"
      });
      s.appendChild(circle);
      offset += len;
    });
    // center label
    var t1 = node("text", { x: cx, y: cy - 2, "text-anchor": "middle", fill: cssVar("--text"), "font-size": "20", "font-weight": "600", "font-family": "monospace" });
    t1.textContent = opts.centerTop || segments.length;
    s.appendChild(t1);
    var t2 = node("text", { x: cx, y: cy + 16, "text-anchor": "middle", fill: cssVar("--text-dim"), "font-size": "10.5" });
    t2.textContent = opts.centerBottom || "posições";
    s.appendChild(t2);
    return s;
  }

  var PALETTE = ["--primary", "--secondary", "--accent", "--success", "--warning", "--danger"];
  function color(i) { return serie(cssVar(PALETTE[i % PALETTE.length])); }

  window.Charts = { sparkline: sparkline, lineChart: lineChart, donut: donut, color: color };
})();
