/* ============================================================
   ATLAS · academy/js/academy-globe.js
   Globo central do command center — Canvas 2D puro, sem dependência.

   AcademyGlobe.mount(container, opts) -> { stop() }

   Uma esfera de pontos girando (rede global) com arcos de "ponte"
   brilhantes e pulsos viajando por eles. É AMBIENTE: simula o tráfego
   cross-chain, não são transações reais (as fontes gratuitas não dão
   stream de transações). Os NÚMEROS ao redor do globo é que são reais.

   Respeita prefers-reduced-motion (desenha um quadro estático).
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyGlobe) return;

  var TAU = Math.PI * 2;

  // esfera de Fibonacci: N pontos ~uniformes na superfície
  function fibSphere(n) {
    var pts = [], off = 2 / n, inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = i * off - 1 + off / 2;
      var r = Math.sqrt(1 - y * y);
      var phi = i * inc;
      pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
    }
    return pts;
  }

  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
  }
  function rotX(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }

  window.AcademyGlobe = {
    mount: function (container, opts) {
      opts = opts || {};
      var reduce = false;
      try { reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

      var canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
      var ctx = canvas.getContext("2d");

      var pts = fibSphere(460);
      var tilt = -0.42; // inclinação do eixo
      var arcs = [];
      function newArc() {
        var a = pts[(Math.random() * pts.length) | 0];
        var b = pts[(Math.random() * pts.length) | 0];
        return { a: a, b: b, t: Math.random(), speed: 0.004 + Math.random() * 0.006,
                 hue: Math.random() < 0.5 ? "0,240,255" : "255,215,0" };
      }
      for (var k = 0; k < 9; k++) arcs.push(newArc());

      var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
      function resize() {
        var w = container.clientWidth || 380, h = container.clientHeight || 380;
        W = w; H = h; R = Math.min(w, h) * 0.42; cx = w / 2; cy = h / 2;
        canvas.width = w * dpr; canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      var ro = null;
      if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(container); }

      var ang = 0, raf = null, running = true;

      function project(p) {
        // rotação Y (spin) + inclinação X fixa; projeção ortográfica
        var q = rotX(rotY(p, ang), tilt);
        return { x: cx + q[0] * R, y: cy - q[1] * R, z: q[2] };
      }
      function projRaw(p) { var q = rotX(rotY(p, ang), tilt); return [q[0] * R, -q[1] * R, q[2]]; }

      function frame() {
        if (!running) return;
        ctx.clearRect(0, 0, W, H);

        // halo do núcleo
        var g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.25);
        g.addColorStop(0, "rgba(0,191,255,0.16)");
        g.addColorStop(0.5, "rgba(0,191,255,0.05)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, TAU); ctx.fill();

        // pontos da esfera (profundidade -> opacidade/tamanho)
        for (var i = 0; i < pts.length; i++) {
          var s = project(pts[i]);
          var depth = (s.z + 1) / 2; // 0 atrás, 1 frente
          if (s.z < -0.15) continue; // esconde a metade de trás (mais que o horizonte)
          var alpha = 0.15 + depth * 0.6;
          var rad = 0.6 + depth * 1.5;
          ctx.fillStyle = "rgba(120,210,255," + alpha.toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, TAU); ctx.fill();
        }

        // anel do equador (sutil)
        ctx.strokeStyle = "rgba(0,240,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var e = 0; e <= 64; e++) {
          var a = e / 64 * TAU;
          var pr = projRaw([Math.cos(a), 0, Math.sin(a)]);
          var X = cx + pr[0], Y = cy + pr[1];
          if (e === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.stroke();

        // arcos de ponte + pulso viajando
        for (var j = 0; j < arcs.length; j++) {
          var arc = arcs[j];
          var pa = project(arc.a), pb = project(arc.b);
          // ponto de controle: eleva o meio para fora da esfera
          var mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
          var dx = mx - cx, dy = my - cy;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var lift = R * 0.5;
          var ctrlx = mx + dx / dist * lift, ctrly = my + dy / dist * lift;
          var frontish = (arc.a[2] + arc.b[2]) / 2; // visível se voltado pra frente-ish
          var vis = Math.max(0.05, (frontish + 1) / 2);

          ctx.strokeStyle = "rgba(" + arc.hue + "," + (0.12 * vis).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(ctrlx, ctrly, pb.x, pb.y); ctx.stroke();

          // pulso: ponto brilhante ao longo da curva de Bézier quadrática
          var t = arc.t;
          var it = 1 - t;
          var px = it * it * pa.x + 2 * it * t * ctrlx + t * t * pb.x;
          var py = it * it * pa.y + 2 * it * t * ctrly + t * t * pb.y;
          ctx.fillStyle = "rgba(" + arc.hue + "," + (0.9 * vis).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(px, py, 2.1, 0, TAU); ctx.fill();
          // brilho do pulso
          var pg = ctx.createRadialGradient(px, py, 0, px, py, 7);
          pg.addColorStop(0, "rgba(" + arc.hue + "," + (0.5 * vis).toFixed(3) + ")");
          pg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();

          if (!reduce) {
            arc.t += arc.speed;
            if (arc.t >= 1) arcs[j] = newArc();
          }
        }

        // núcleo central brilhante (a "logo" em destaque)
        var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.34);
        core.addColorStop(0, "rgba(0,240,255,0.9)");
        core.addColorStop(0.25, "rgba(0,191,255,0.35)");
        core.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.34, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(230,248,255,0.95)";
        ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill();

        if (!reduce) ang += 0.0016;
        raf = requestAnimationFrame(frame);
      }
      frame();

      return {
        stop: function () {
          running = false;
          if (raf) cancelAnimationFrame(raf);
          if (ro) ro.disconnect();
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
      };
    }
  };
})();
