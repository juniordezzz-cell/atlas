/* ===================================================================
   ATLAS — Donut 3D (Dashboard)
   -------------------------------------------------------------------
   Os dois donuts do Dashboard eram o doughnut chapado do Chart.js:
   um anel desenhado, sem volume. Este desenho substitui os dois por
   uma peça com corpo:

     · o anel é visto inclinado (elipse), com ESPESSURA — parede
       externa na frente e parede interna ao fundo, dentro do furo;
     · a luz vem de cima à esquerda: topo claro, paredes escurecendo
       para as bordas, brilho suave no tampo;
     · uma sombra difusa embaixo assenta a peça no cartão.

   Sem glow e sem neon — o volume vem só de luz e sombra (visual
   sereno do ATLAS). Por ora só no Dashboard; se agradar, os módulos
   podem montar o mesmo arquivo.

     AtlasDonut3D.render(canvas, { labels, valores, cores })

   Passar o mouse levanta a fatia e mostra rótulo e percentual.
   =================================================================== */
(function (global) {
  "use strict";

  var TILT = 0.58;          // achatamento da elipse (1 = visto de cima)
  var FURO = 0.56;          // raio interno ÷ raio externo
  var ERGUER = 5;           // px que a fatia sob o mouse sobe
  var INICIO = -Math.PI / 2 - 0.35; // primeira fatia começa atrás, um pouco à esquerda

  /* ---------- cor ---------- */
  function rgb(c) {
    c = String(c || "").trim();
    var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      var h = m[1].length === 3 ? m[1].replace(/(.)/g, "$1$1") : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return [120, 140, 170];
  }
  /* f < 0 escurece, f > 0 clareia (mistura com branco) */
  function tom(p, f, a) {
    var q = p.map(function (v) {
      return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
    });
    return "rgba(" + q[0] + "," + q[1] + "," + q[2] + "," + (a == null ? 1 : a) + ")";
  }

  /* ---------- geometria ---------- */
  var DOIS_PI = Math.PI * 2;

  /* pedaço de [a0,a1] que cai em [lo,hi], considerando voltas */
  function recortes(a0, a1, lo, hi) {
    var out = [];
    for (var k = -2; k <= 2; k++) {
      var l = lo + k * DOIS_PI, h = hi + k * DOIS_PI;
      var s = Math.max(a0, l), e = Math.min(a1, h);
      if (e > s + 1e-6) out.push([s, e]);
    }
    return out;
  }

  function claro() {
    return !!(global.AtlasChartTheme && global.AtlasChartTheme.claro && global.AtlasChartTheme.claro());
  }

  /* ---------- estado por canvas ---------- */
  var ESTADO = typeof WeakMap === "function" ? new WeakMap() : null;
  function estadoDe(canvas) {
    var e = ESTADO ? ESTADO.get(canvas) : canvas.__d3;
    if (!e) {
      e = { cfg: null, hover: -1, prog: 1, anim: 0, fatias: [] };
      if (ESTADO) ESTADO.set(canvas, e); else canvas.__d3 = e;
      ligar(canvas, e);
    }
    return e;
  }

  function medidas(canvas) {
    var box = canvas.parentNode;
    var w = Math.max(60, (box && box.clientWidth) || canvas.clientWidth || 130);
    var h = Math.max(60, (box && box.clientHeight) || canvas.clientHeight || 130);
    var dpr = Math.min(3, global.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    }
    /* espessura proporcional ao tamanho; o raio cabe na largura E na
       altura (elipse + parede + folga para a fatia erguida) */
    var R = Math.min(w / 2 - 3, (h - 10 - ERGUER) / (2 * TILT + 0.2));
    var esp = Math.max(8, R * 0.2);
    return { w: w, h: h, dpr: dpr, R: R, r: R * FURO, esp: esp,
             cx: w / 2, cy: (h - esp) / 2 + ERGUER / 2 };
  }

  /* ---------- desenho ---------- */
  function caminhoTopo(ctx, g, a0, a1, dy) {
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy + dy, g.R, g.R * TILT, 0, a0, a1, false);
    ctx.ellipse(g.cx, g.cy + dy, g.r, g.r * TILT, 0, a1, a0, true);
    ctx.closePath();
  }
  function caminhoParede(ctx, g, raio, a0, a1, dy) {
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy + dy, raio, raio * TILT, 0, a0, a1, false);
    ctx.ellipse(g.cx, g.cy + dy + g.esp, raio, raio * TILT, 0, a1, a0, true);
    ctx.closePath();
  }

  function desenhar(canvas) {
    var e = estadoDe(canvas);
    var cfg = e.cfg;
    var ctx = canvas.getContext("2d");
    var g = medidas(canvas);
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);

    var lista = (cfg && cfg.valores) || [];
    var tot = lista.reduce(function (a, v) { return a + (+v > 0 ? +v : 0); }, 0);
    var luz = claro();

    /* sombra de contato: elipse difusa sob a peça */
    ctx.save();
    var sy = g.cy + g.esp + g.R * TILT * 0.18;
    var sg = ctx.createRadialGradient(g.cx, sy, g.R * 0.2, g.cx, sy, g.R * 1.05);
    sg.addColorStop(0, luz ? "rgba(15,30,60,0.20)" : "rgba(0,0,0,0.55)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(g.cx, sy, g.R * 1.05, g.R * TILT * 0.72, 0, 0, DOIS_PI);
    ctx.fill();
    ctx.restore();

    /* sem dado: anel vazio, discreto */
    if (!tot) {
      var vazio = rgb(luz ? "#cbd5e1" : "#243349");
      desenharFatia(ctx, g, { a0: INICIO, a1: INICIO + DOIS_PI, cor: vazio }, 0);
      e.fatias = [];
      return;
    }

    var fim = INICIO + DOIS_PI * e.prog;
    var a = INICIO;
    e.fatias = lista.map(function (v, i) {
      var ang = (+v > 0 ? +v : 0) / tot * DOIS_PI * e.prog;
      var f = { i: i, a0: a, a1: Math.min(a + ang, fim), cor: rgb(cfg.cores[i]) };
      a += ang;
      return f;
    }).filter(function (f) { return f.a1 > f.a0 + 1e-4; });

    /* A ordem é a do pintor: primeiro o que está mais longe.
       1) paredes internas do FUNDO (visíveis pelo furo), recortadas
          pelo furo; 2) paredes externas da FRENTE; 3) tampos. Cada
          etapa varre todas as fatias antes da próxima. */
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy, g.r, g.r * TILT, 0, 0, DOIS_PI);
    ctx.clip();
    e.fatias.forEach(function (f) {
      var dy = f.i === e.hover ? -ERGUER : 0;
      recortes(f.a0, f.a1, Math.PI, DOIS_PI).forEach(function (s) {
        paredeInterna(ctx, g, f.cor, s[0], s[1], dy, luz);
      });
    });
    ctx.restore();

    /* paredes externas: as da frente, da borda para o centro, para a
       fatia erguida não ser coberta pela vizinha */
    var frente = [];
    e.fatias.forEach(function (f) {
      recortes(f.a0, f.a1, 0, Math.PI).forEach(function (s) { frente.push({ f: f, s: s }); });
    });
    frente.sort(function (x, y) {
      return Math.abs(Math.PI / 2 - (x.s[0] + x.s[1]) / 2) > Math.abs(Math.PI / 2 - (y.s[0] + y.s[1]) / 2) ? -1 : 1;
    });
    frente.forEach(function (it) {
      var dy = it.f.i === e.hover ? -ERGUER : 0;
      paredeExterna(ctx, g, it.f.cor, it.s[0], it.s[1], dy, luz);
    });

    /* tampos — a fatia erguida por último, por cima de tudo */
    var ordem = e.fatias.slice().sort(function (x, y) {
      return (x.i === e.hover) - (y.i === e.hover);
    });
    ordem.forEach(function (f) {
      var dy = f.i === e.hover ? -ERGUER : 0;
      if (f.i === e.hover) {
        /* a erguida mostra as próprias paredes inteiras */
        recortes(f.a0, f.a1, 0, Math.PI).forEach(function (s) {
          paredeExterna(ctx, g, f.cor, s[0], s[1], dy, luz);
        });
      }
      tampo(ctx, g, f, dy, luz);
    });

    /* brilho geral do tampo: luz de cima à esquerda, bem suave */
    ctx.save();
    caminhoTopo(ctx, g, 0, DOIS_PI, 0);
    ctx.clip();
    var bg = ctx.createLinearGradient(g.cx - g.R, g.cy - g.R * TILT, g.cx + g.R * 0.4, g.cy + g.R * TILT);
    bg.addColorStop(0, "rgba(255,255,255," + (luz ? 0.28 : 0.18) + ")");
    bg.addColorStop(0.45, "rgba(255,255,255,0.03)");
    bg.addColorStop(1, "rgba(0,0,0," + (luz ? 0.04 : 0.12) + ")");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, g.w, g.h);
    ctx.restore();
  }

  function desenharFatia(ctx, g, f, dy) {
    recortes(f.a0, f.a1, 0, Math.PI).forEach(function (s) {
      paredeExterna(ctx, g, f.cor, s[0], s[1], dy, claro());
    });
    tampo(ctx, g, f, dy, claro());
  }

  function paredeExterna(ctx, g, cor, a0, a1, dy, luz) {
    caminhoParede(ctx, g, g.R, a0, a1, dy);
    /* escurece para as laterais (a parede vira de lado), mais clara no meio-esquerda */
    var gr = ctx.createLinearGradient(g.cx - g.R, 0, g.cx + g.R, 0);
    gr.addColorStop(0, tom(cor, -0.62));
    gr.addColorStop(0.35, tom(cor, luz ? -0.22 : -0.30));
    gr.addColorStop(0.6, tom(cor, luz ? -0.30 : -0.40));
    gr.addColorStop(1, tom(cor, -0.68));
    ctx.fillStyle = gr;
    ctx.fill();
    /* friso de luz na quina de cima da parede */
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy + dy + 0.5, g.R, g.R * TILT, 0, a0, a1, false);
    ctx.strokeStyle = tom(cor, 0.25, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function paredeInterna(ctx, g, cor, a0, a1, dy, luz) {
    caminhoParede(ctx, g, g.r, a0, a1, dy);
    var gr = ctx.createLinearGradient(0, g.cy - g.r * TILT + dy, 0, g.cy - g.r * TILT + g.esp + dy);
    gr.addColorStop(0, tom(cor, luz ? -0.35 : -0.50));
    gr.addColorStop(1, tom(cor, -0.78));
    ctx.fillStyle = gr;
    ctx.fill();
  }

  function tampo(ctx, g, f, dy, luz) {
    caminhoTopo(ctx, g, f.a0, f.a1, dy);
    /* luz rasante: mais clara atrás-esquerda, base na frente-direita */
    var gr = ctx.createLinearGradient(g.cx - g.R, g.cy - g.R * TILT + dy, g.cx + g.R, g.cy + g.R * TILT + dy);
    gr.addColorStop(0, tom(f.cor, 0.22));
    gr.addColorStop(0.55, tom(f.cor, 0));
    gr.addColorStop(1, tom(f.cor, -0.18));
    ctx.fillStyle = gr;
    ctx.fill();
    /* junta entre fatias: um fio da cor do cartão, como um corte */
    ctx.strokeStyle = luz ? "rgba(255,255,255,0.75)" : "rgba(8,14,26,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---------- interação ---------- */
  function fatiaEm(canvas, x, y) {
    var e = estadoDe(canvas), g = medidas(canvas);
    var dx = x - g.cx, dy = (y - g.cy) / TILT;
    var d = Math.sqrt(dx * dx + dy * dy);
    /* o tampo, ou a parede da frente logo abaixo dele */
    if (d > g.R + 2) {
      var dy2 = (y - g.cy - g.esp) / TILT;
      if (!(y > g.cy && Math.sqrt(dx * dx + dy2 * dy2) <= g.R)) return -1;
    } else if (d < g.r - 2) return -1;
    var ang = Math.atan2(dy, dx);
    for (var k = 0; k < e.fatias.length; k++) {
      var f = e.fatias[k];
      for (var t = -1; t <= 1; t++) {
        var a = ang + t * DOIS_PI;
        if (a >= f.a0 && a < f.a1) return f.i;
      }
    }
    return -1;
  }

  function dica(canvas) {
    var box = canvas.parentNode;
    var el = box && box.querySelector(".d3-tip");
    if (!el && box) {
      el = document.createElement("div");
      el.className = "d3-tip";
      el.setAttribute("role", "status");
      box.appendChild(el);
    }
    return el;
  }

  function ligar(canvas, e) {
    canvas.addEventListener("mousemove", function (ev) {
      var rc = canvas.getBoundingClientRect();
      var x = ev.clientX - rc.left, y = ev.clientY - rc.top;
      var i = fatiaEm(canvas, x, y);
      var tip = dica(canvas);
      if (i !== e.hover) { e.hover = i; desenhar(canvas); }
      if (!tip) return;
      if (i < 0 || !e.cfg) { tip.hidden = true; canvas.style.cursor = ""; return; }
      tip.textContent = "";
      var b = document.createElement("b"); b.textContent = e.cfg.labels[i];
      var s = document.createElement("span");
      s.textContent = String(e.cfg.valores[i]).replace(".", ",") + "%";
      tip.appendChild(b); tip.appendChild(s);
      tip.hidden = false;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("mouseleave", function () {
      var tip = dica(canvas);
      if (tip) tip.hidden = true;
      if (e.hover !== -1) { e.hover = -1; desenhar(canvas); }
    });
    if (typeof ResizeObserver === "function" && canvas.parentNode) {
      new ResizeObserver(function () { desenhar(canvas); }).observe(canvas.parentNode);
    }
  }

  /* ---------- API ---------- */
  function render(canvas, cfg) {
    if (!canvas || !canvas.getContext) return;
    var e = estadoDe(canvas);
    var primeira = !e.cfg;
    e.cfg = cfg;
    e.hover = -1;
    var reduz = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!primeira || reduz || !global.requestAnimationFrame) { e.prog = 1; desenhar(canvas); return; }

    /* entrada: o anel se completa em ~0,7s, uma vez só */
    var t0 = null;
    e.prog = 0;
    cancelAnimationFrame(e.anim);
    function passo(t) {
      if (t0 == null) t0 = t;
      var p = Math.min(1, (t - t0) / 700);
      e.prog = 1 - Math.pow(1 - p, 3);
      desenhar(canvas);
      if (p < 1) e.anim = requestAnimationFrame(passo);
    }
    e.anim = requestAnimationFrame(passo);
  }

  global.AtlasDonut3D = { render: render, redesenhar: desenhar };
})(window);
