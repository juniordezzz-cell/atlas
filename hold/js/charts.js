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

  /* ---- pizza 3D sólida (Painel: por token e por setor) ----
     Opção A aprovada pelo dono em 16/10/2026, no lugar da primeira
     versão, reprovada como "infantil". O que dá o ar de objeto real:
       · topo com véu vertical (luz vinda de cima);
       · parede só na metade da frente (sen θ > 0 — o SVG cresce para
         baixo), escurecida nas pontas por um degradê horizontal, como
         um cilindro iluminado de frente;
       · sombra suave no chão;
       · separação fina na cor do cartão, sem contorno nem brilho.
     Nome e % ficam DENTRO da fatia; quanto cabe decide rotulo().
     Paredes da frente nunca se cruzam: paredes, depois topos, depois
     rótulos. Spec: docs/superpowers/specs/2026-10-16-painel-pizzas-3d-design.md */
  function pie3d(lista, opts) {
    opts = opts || {};
    var W = 300, H = 215, cx = 150, cy = 92, RX = 128, RY = 64, D = 24;
    var TAU = Math.PI * 2;
    var claro = document.documentElement.getAttribute("data-theme") === "light";
    var calmo = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var s = svg(W, H);
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    s.setAttribute("role", "img");
    if (opts.ariaLabel) s.setAttribute("aria-label", opts.ariaLabel);
    s.classList.add("pie3d");
    s.style.display = "block"; s.style.margin = "0 auto"; s.style.maxWidth = "340px";

    var uid = "p3" + Math.random().toString(36).slice(2, 8);
    var defs = node("defs");
    function grad(tipo, id, attrs, stops) {
      var g = node(tipo, Object.assign({ id: uid + id }, attrs));
      stops.forEach(function (st) {
        g.appendChild(node("stop", { offset: st[0], "stop-color": st[1], "stop-opacity": st[2] }));
      });
      defs.appendChild(g);
      return "url(#" + uid + id + ")";
    }
    var PAREDE = grad("linearGradient", "w", { gradientUnits: "userSpaceOnUse", x1: cx - RX, y1: 0, x2: cx + RX, y2: 0 },
      [[0, "#000", 0.62], [0.42, "#000", 0.12], [0.6, "#000", 0.18], [1, "#000", 0.66]]);
    var VEU = grad("linearGradient", "t", { x1: 0, y1: 0, x2: 0, y2: 1 },
      [[0, "#fff", 0.2], [0.55, "#fff", 0], [1, "#000", 0.12]]);
    var CHAO = grad("radialGradient", "g", {}, [[0, "#000", claro ? 0.22 : 0.55], [1, "#000", 0]]);
    s.appendChild(defs);
    s.appendChild(node("ellipse", { cx: cx, cy: cy + D + 10, rx: RX * 1.05, ry: RY * 0.85, fill: CHAO }));

    function P(t, dy) {
      return (cx + RX * Math.cos(t)).toFixed(1) + " " + (cy + RY * Math.sin(t) + (dy || 0)).toFixed(1);
    }
    function parede(a0, a1) {
      return "M" + P(a0) + " A" + RX + " " + RY + " 0 0 1 " + P(a1) + " L" + P(a1, D) +
             " A" + RX + " " + RY + " 0 0 0 " + P(a0, D) + "Z";
    }
    function texto(x, y, txt, attrs, pai) {
      var t = node("text", Object.assign({ x: x.toFixed(1), y: y.toFixed(1), fill: "#fff", "text-anchor": "middle",
        style: "paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:2.5px;pointer-events:none" }, attrs));
      t.textContent = txt; pai.appendChild(t); return t;
    }
    function pct(f) { return (f * 100).toFixed(1).replace(".", ",") + "%"; }
    function dinheiro(v) { return window.UI && window.UI.money ? window.UI.money(v, 0) : "US$ " + Math.round(v); }

    var paredes = node("g"), topos = node("g"), rotulos = node("g");
    s.appendChild(paredes); s.appendChild(topos); s.appendChild(rotulos);

    if (!lista || !lista.length) {
      var cinza = cssVar("--surface-alt") || "#1c2533";
      paredes.appendChild(node("path", { d: parede(0, Math.PI), fill: cinza }));
      paredes.appendChild(node("path", { d: parede(0, Math.PI), fill: PAREDE }));
      topos.appendChild(node("ellipse", { cx: cx, cy: cy, rx: RX, ry: RY, fill: cinza }));
      topos.appendChild(node("ellipse", { cx: cx, cy: cy, rx: RX, ry: RY, fill: VEU }));
      texto(cx, cy + 4, opts.vazio || "sem posições", { fill: cssVar("--text-dim") || "#8b97a8", style: "", "font-size": 12 }, rotulos);
      return s;
    }

    var sep = cssVar("--surface") || "#0d131e";
    var grupos = [];
    var a = -Math.PI / 2;
    lista.forEach(function (f, i) {
      var a0 = a, a1 = a + f.frac * TAU; a = a1;
      var meio = (a0 + a1) / 2, cheia = f.frac > 0.9999;
      var gw = node("g"), gt = node("g", { class: "fatia", "data-i": i }), gr = node("g");
      if (!calmo) gw.style.transition = gt.style.transition = gr.style.transition = "transform .18s ease";
      for (var k = -1; k <= 1; k++) {
        var ini = Math.max(a0, k * TAU), fim = Math.min(a1, k * TAU + Math.PI);
        if (fim - ini > 1e-4) {
          gw.appendChild(node("path", { d: parede(ini, fim), fill: f.color }));
          gw.appendChild(node("path", { d: parede(ini, fim), fill: PAREDE }));
        }
      }
      var forma = cheia
        ? "M" + (cx - RX) + " " + cy + " A" + RX + " " + RY + " 0 1 1 " + (cx + RX) + " " + cy +
          " A" + RX + " " + RY + " 0 1 1 " + (cx - RX) + " " + cy + "Z"
        : "M" + cx + " " + cy + " L" + P(a0) + " A" + RX + " " + RY + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + P(a1) + "Z";
      var topo = node("path", { d: forma, fill: f.color, stroke: sep, "stroke-width": lista.length > 1 ? 1.2 : 0, "stroke-linejoin": "round" });
      var dica = node("title"); dica.textContent = f.label + " · " + dinheiro(f.value) + " · " + pct(f.frac);
      topo.appendChild(dica);
      gt.appendChild(topo);
      var veu = node("path", { d: forma, fill: VEU }); veu.style.pointerEvents = "none";
      gt.appendChild(veu);
      if (f.onClick) { gt.style.cursor = "pointer"; gt.addEventListener("click", f.onClick); }

      var r = rotulo(f.frac, f.label);
      var x = cheia ? cx : cx + 0.6 * RX * Math.cos(meio), y = cheia ? cy : cy + 0.6 * RY * Math.sin(meio);
      if (r.modo === "nome") {
        texto(x, y - 1, f.label, { "font-size": r.fonte, "font-weight": 500 }, gr);
        texto(x, y + 12, r.texto, { "font-size": 11, "fill-opacity": 0.85 }, gr);
      } else if (r.modo === "pct") {
        texto(x, y + 4, r.texto, { "font-size": 11, "font-weight": 500 }, gr);
      }
      paredes.appendChild(gw); topos.appendChild(gt); rotulos.appendChild(gr);
      var dx = Math.cos(meio) * 8, dy = Math.sin(meio) * 4;
      grupos.push({ els: [gw, gt, gr], d: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)" });
      gt.addEventListener("mouseenter", function () { destacar(i); });
      gt.addEventListener("mouseleave", function () { destacar(-1); });
    });

    function destacar(i) {
      grupos.forEach(function (g, j) {
        var t = j === i && lista.length > 1 ? g.d : "";
        g.els.forEach(function (e) { e.style.transform = t; });
      });
    }
    s.destacar = destacar;
    return s;
  }

  /* ---- dados das pizzas (puro: testado em hold/testes/pizza.test.js) ----
     Ordem de valor, no máximo `max` fatias contando o "Outros", que é
     um só — o resto agrupado mais o que já chegou com esse nome (setor
     não classificado) — e fica sempre por último. Valor ≤ 0 é posição
     sem preço: sai da pizza e volta em `semPreco`. O % é sobre a soma
     das fatias, para a pizza fechar 100% e bater com a legenda. */
  function fatias(itens, opts) {
    var max = (opts && opts.max) || 7;
    var semPreco = [], vivos = [], outros = null;
    (itens || []).forEach(function (it) {
      if (!(it.value > 0)) { semPreco.push(it.label); return; }
      if (it.label === "Outros") {
        outros = outros || { label: "Outros", value: 0, partes: [], ids: [] };
        outros.value += it.value;
        if (it.sub) outros.partes.push(it.sub);
        return;
      }
      vivos.push(it);
    });
    vivos.sort(function (a, b) { return b.value - a.value; });
    var lugares = outros || vivos.length > max ? max - 1 : max;
    var ficam = vivos.slice(0, lugares), sobra = vivos.slice(lugares);
    if (sobra.length) {
      outros = outros || { label: "Outros", value: 0, partes: [], ids: [] };
      sobra.forEach(function (it) {
        outros.value += it.value; outros.partes.push(it.label);
        if (it.id) outros.ids.push(it.id);
      });
    }
    var lista = ficam.map(function (it) {
      return { label: it.label, value: it.value, sub: it.sub || "", id: it.id || null, ids: it.id ? [it.id] : [] };
    });
    if (outros) lista.push({ label: "Outros", value: outros.value, sub: outros.partes.join(", "), id: null, ids: outros.ids });
    var total = lista.reduce(function (t, f) { return t + f.value; }, 0);
    lista.forEach(function (f) { f.frac = total ? f.value / total : 0; });
    return { fatias: lista, semPreco: semPreco, total: total };
  }

  /* O que cabe escrito dentro da fatia. O nome só entra se a largura
     estimada dele (0,56 em por letra) couber na corda da fatia no raio
     do rótulo (60% de 128 px) — contar letras deixava "Reserva de
     valor" vazar de uma fatia de 20%. */
  function rotulo(frac, label) {
    var n = String(label || "").length, fonte = n > 9 ? 10.5 : 12;
    var corda = 2 * 0.6 * 128 * Math.sin(Math.min(frac * Math.PI, Math.PI / 2));
    if (frac >= 0.09 && n * fonte * 0.56 <= corda) {
      return { modo: "nome", texto: (frac * 100).toFixed(1).replace(".", ",") + "%", fonte: fonte };
    }
    if (frac >= 0.045) return { modo: "pct", texto: Math.round(frac * 100) + "%", fonte: 11 };
    return { modo: "nenhum", texto: "", fonte: 0 };
  }

  var PALETTE = ["--primary", "--secondary", "--accent", "--success", "--warning", "--danger"];
  /* Da sétima cor em diante a paleta do tema acaba: matizes espaçados,
     com a mesma luminosidade média, para fatia nenhuma repetir a vizinha. */
  function color(i) {
    if (i < PALETTE.length) return serie(cssVar(PALETTE[i]));
    return "hsl(" + ((i * 53 + 20) % 360) + " 52% 58%)";
  }

  /* Pizza pede vizinhas bem diferentes: a paleta do tema tem três
     cianos seguidos (secondary, accent, success), que lado a lado numa
     pizza viram uma fatia só. Matizes espaçados, todos de tom médio,
     legíveis no tema escuro e no claro; "Outros" é sempre cinza. */
  /* sete cores: com 7 posições e nenhum "Outros", a 7ª encosta na 1ª */
  var PIE = ["#4C7BD9", "#2FA58F", "#D4A23A", "#8A6AD1", "#C2566F", "#3E9BC0", "#B07A4F"];
  function pieColor(i, label) {
    if (label === "Outros") return serie("#66707F");
    return serie(PIE[i % PIE.length]);
  }

  window.Charts = { sparkline: sparkline, lineChart: lineChart, donut: donut, pie3d: pie3d, color: color, pieColor: pieColor,
    fatias: fatias, rotulo: rotulo, tom: serie };
})();
