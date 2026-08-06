/* ============================================================
   ATLAS · js/atlas-fx.js
   Motor visual compartilhado do boot e das boas-vindas.

   - Starfield: 2 camadas de estrelas com parallax + cintilação
   - Partículas: orbitando / subindo / desvanecendo (1 canvas só)
   - HUD vivo: CPU · MEM · NET · LATENCY · SYNC · CLOCK simulados
     com interpolação suave (nunca "pula" de valor)
   - Boot engine: progresso por etapas com easing (nunca passos fixos)

   Performance:
   - um único requestAnimationFrame para tudo
   - pausa quando a aba fica oculta (document.hidden)
   - contagem de partículas reduzida em telas pequenas
   - respeita prefers-reduced-motion (fundo estático, sem partículas)
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasFX) return;

  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------------- utilidades ---------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ============================================================
     CÉU: estrelas (parallax) + partículas — um canvas cada
     ============================================================ */
  function makeSky(starsCanvas, dustCanvas) {
    var W = 0, H = 0, stars = [], dust = [];
    var small = Math.min(window.innerWidth, window.innerHeight) < 640;
    var N_STARS = reduced ? 0 : (small ? 70 : 140);
    var N_DUST  = reduced ? 0 : (small ? 26 : 54);

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      [starsCanvas, dustCanvas].forEach(function (c) {
        if (!c) return;
        c.width = W * DPR; c.height = H * DPR;
        c.style.width = W + "px"; c.style.height = H + "px";
      });
    }

    function seedStars() {
      stars = [];
      for (var i = 0; i < N_STARS; i++) {
        var depth = Math.random() < 0.5 ? 0.35 : 1; // 2 camadas de parallax
        stars.push({
          x: Math.random() * 1, y: Math.random() * 1, depth: depth,
          r: depth < 1 ? rand(0.4, 0.9) : rand(0.7, 1.5),
          tw: rand(0.0008, 0.0026),           // velocidade de cintilação
          ph: rand(0, Math.PI * 2),           // fase
          hue: Math.random() < 0.22 ? "180,220,255" : (Math.random() < 0.08 ? "255,214,160" : "230,240,255")
        });
      }
    }
    function seedDust() {
      dust = [];
      for (var i = 0; i < N_DUST; i++) dust.push(newDust(true));
    }
    function newDust(anywhere) {
      var kind = Math.random();
      if (kind < 0.34) { // orbitando o centro
        return { t: "orbit", a: rand(0, Math.PI * 2), rad: rand(0.16, 0.46), sp: rand(0.00006, 0.00018) * (Math.random() < 0.5 ? 1 : -1), r: rand(0.6, 1.4), o: rand(0.12, 0.4) };
      }
      if (kind < 0.72) { // subindo devagar
        return { t: "rise", x: Math.random(), y: anywhere ? Math.random() : 1.04, vy: rand(0.00002, 0.00007), drift: rand(-0.00002, 0.00002), r: rand(0.5, 1.2), o: rand(0.1, 0.32) };
      }
      // aparecendo e desvanecendo no lugar
      return { t: "fade", x: Math.random(), y: Math.random(), life: 0, max: rand(3000, 7000), r: rand(0.6, 1.6), o: rand(0.18, 0.42) };
    }

    function draw(now, dt) {
      if (!starsCanvas || !starsCanvas.getContext) return;
      var sctx = starsCanvas.getContext("2d");
      if (!sctx) return;
      sctx.clearRect(0, 0, W * DPR, H * DPR);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var glow = 0.55 + 0.45 * Math.sin(now * s.tw + s.ph);
        sctx.beginPath();
        sctx.fillStyle = "rgba(" + s.hue + "," + (glow * (s.depth < 1 ? 0.4 : 0.75)).toFixed(3) + ")";
        sctx.arc(s.x * W * DPR, s.y * H * DPR, s.r * DPR, 0, 6.2832);
        sctx.fill();
      }
      if (!dustCanvas || !dustCanvas.getContext) return;
      var dctx = dustCanvas.getContext("2d");
      if (!dctx) return;
      dctx.clearRect(0, 0, W * DPR, H * DPR);
      var cx = 0.5 * W * DPR, cy = 0.44 * H * DPR, base = Math.min(W, H) * DPR;
      for (var j = 0; j < dust.length; j++) {
        var p = dust[j], x, y, alpha = p.o;
        if (p.t === "orbit") {
          p.a += p.sp * dt;
          x = cx + Math.cos(p.a) * p.rad * base;
          y = cy + Math.sin(p.a) * p.rad * base * 0.62; // órbita elíptica (perspectiva)
        } else if (p.t === "rise") {
          p.y -= p.vy * dt; p.x += p.drift * dt;
          if (p.y < -0.04) dust[j] = p = newDust(false);
          x = p.x * W * DPR; y = p.y * H * DPR;
        } else {
          p.life += dt;
          if (p.life > p.max) dust[j] = p = newDust(true);
          var ph2 = Math.sin((p.life / p.max) * Math.PI); // nasce e some
          alpha = p.o * ph2;
          x = p.x * W * DPR; y = p.y * H * DPR;
        }
        dctx.beginPath();
        dctx.fillStyle = "rgba(140,200,255," + alpha.toFixed(3) + ")";
        dctx.arc(x, y, p.r * DPR, 0, 6.2832);
        dctx.fill();
      }
    }

    resize(); seedStars(); seedDust();
    window.addEventListener("resize", function () { resize(); });
    return { draw: draw };
  }

  /* ============================================================
     HUD VIVO — valores deslizam suavemente até novos alvos
     ============================================================ */
  function makeHud(map) {
    /* map: { cpu, mem, net, lat, sync, clock } → elementos (ou null) */
    var v = { cpu: 22, mem: 41, net: 12, lat: 34 };
    var tgt = { cpu: 22, mem: 41, net: 12, lat: 34 };
    var lastPick = 0, syncVal = 0;

    function tick(now, dt) {
      if (now - lastPick > 1400) { // novos alvos periódicos
        lastPick = now;
        tgt.cpu = rand(14, 46); tgt.mem = rand(36, 58);
        tgt.net = rand(6, 88);  tgt.lat = rand(18, 62);
      }
      var k = Math.min(1, dt * 0.0022); // suavização
      v.cpu = lerp(v.cpu, tgt.cpu, k); v.mem = lerp(v.mem, tgt.mem, k);
      v.net = lerp(v.net, tgt.net, k); v.lat = lerp(v.lat, tgt.lat, k);

      if (map.cpu) map.cpu.textContent = Math.round(v.cpu) + "%";
      if (map.mem) map.mem.textContent = Math.round(v.mem) + "%";
      if (map.net) map.net.textContent = v.net.toFixed(1) + " MB/s";
      if (map.lat) map.lat.textContent = Math.round(v.lat) + " ms";
      if (map.sync) map.sync.textContent = Math.round(syncVal) + "%";
      if (map.clock) {
        var d = new Date();
        map.clock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
      }
    }
    return { tick: tick, setSync: function (p) { syncVal = p; } };
  }

  /* ============================================================
     BOOT ENGINE — etapas com easing, nunca passos fixos
     steps: [{ label, to, dur }]  (to = % alvo, dur = ms da etapa)
     ============================================================ */
  function makeBoot(steps, ui, onDone) {
    /* ui: { bar, percent, status } */
    var idx = -1, from = 0, to = 0, t0 = 0, dur = 1, p = 0, finished = false;

    function nextStep(now) {
      idx++;
      if (idx >= steps.length) { finished = true; if (onDone) onDone(); return; }
      var s = steps[idx];
      from = p; to = s.to; t0 = now; dur = s.dur;
      if (ui.status && s.label) {
        ui.status.classList.remove("msg-in");
        void ui.status.offsetWidth;           // reinicia a animação
        ui.status.textContent = s.label;
        ui.status.classList.add("msg-in");
      }
    }

    function tick(now) {
      if (finished) return 100;
      if (idx < 0) nextStep(now);
      var t = Math.min(1, (now - t0) / dur);
      p = lerp(from, to, easeInOutCubic(t));
      if (ui.bar) ui.bar.style.transform = "scaleX(" + (p / 100).toFixed(4) + ")";
      if (ui.percent) ui.percent.textContent = Math.round(p) + "%";
      if (t >= 1) nextStep(now);
      return p;
    }
    function skip() { finished = true; p = 100;
      if (ui.bar) ui.bar.style.transform = "scaleX(1)";
      if (ui.percent) ui.percent.textContent = "100%";
      if (onDone) onDone();
    }
    return { tick: tick, skip: skip };
  }

  /* ============================================================
     LOOP ÚNICO
     ============================================================ */
  var jobs = [];
  var last = 0, running = false;
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min(64, now - last) : 16;
    last = now;
    for (var i = 0; i < jobs.length; i++) { try { jobs[i](now, dt); } catch (e) {} }
    requestAnimationFrame(loop);
  }
  function start() {
    if (running) return; running = true; last = 0;
    requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { running = false; }
    else { start(); }
  });

  window.AtlasFX = {
    reducedMotion: reduced,
    makeSky: makeSky,
    makeHud: makeHud,
    makeBoot: makeBoot,
    add: function (fn) { jobs.push(fn); start(); },
    ease: easeInOutCubic
  };
})();
