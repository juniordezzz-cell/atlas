/* ============================================================
   ATLAS · js/init.js — orquestração do BOOT
   Sequência: Ligar → Kernel → IA → Módulos → Segurança →
   Sincronizar → Finalizar → boas-vindas.html
   Progresso com easing por etapa (AtlasFX.makeBoot) — nunca
   passos fixos. HUD vivo e céu animado no mesmo rAF.
   ============================================================ */
(function () {
  "use strict";
  var FX = window.AtlasFX;

  /* Fallback de segurança: se o motor visual não carregar,
     o boot nunca prende o usuário — segue em 2s. */
  if (!FX) {
    setTimeout(function () { window.location.href = "boas-vindas.html"; }, 2000);
    return;
  }

  /* céu (estrelas + partículas) */
  var sky = FX.makeSky(
    document.getElementById("fxStars"),
    document.getElementById("fxDust")
  );

  /* HUD vivo */
  var hud = FX.makeHud({
    cpu: document.getElementById("hudCpu"),
    mem: document.getElementById("hudMem"),
    net: document.getElementById("hudNet"),
    lat: document.getElementById("hudLat"),
    sync: document.getElementById("hudSync"),
    clock: document.getElementById("hudClock")
  });

  /* etapas do boot (label · % alvo · duração) — total ≈ 7s */
  var STEPS = [
    { label: "Ligando sistema…",                      to: 8,   dur: 600 },
    { label: "Inicializando Kernel…",                 to: 22,  dur: 950 },
    { label: "Carregando Inteligência Artificial…",   to: 41,  dur: 1150 },
    { label: "Carregando módulos… Hold · Trade · DeFi · RWA", to: 58, dur: 1000 },
    { label: "Inicializando Segurança…",              to: 71,  dur: 800 },
    { label: "Sincronizando Mercado…",                to: 86,  dur: 1000 },
    { label: "Conectando APIs…",                      to: 95,  dur: 700 },
    { label: "Finalizando Sistema…",                  to: 100, dur: 600 }
  ];

  var done = false;
  function goNext() {
    if (done) return; done = true;
    document.getElementById("stage").classList.add("leaving");
    setTimeout(function () { window.location.href = "boas-vindas.html"; }, 560);
  }

  var boot = FX.makeBoot(STEPS, {
    bar: document.getElementById("bar"),
    percent: document.getElementById("percent"),
    status: document.getElementById("bootMsg")
  }, function () { setTimeout(goNext, 350); });

  /* loop único: céu + HUD + boot */
  FX.add(function (now, dt) {
    sky.draw(now, dt);
    var p = boot.tick(now);
    hud.setSync(p);        // SYNC do HUD acompanha o boot
    hud.tick(now, dt);
  });

  document.getElementById("skip").addEventListener("click", function () {
    boot.skip();
  });

  /* acessibilidade: com reduced-motion, boot direto e rápido */
  if (FX.reducedMotion) {
    setTimeout(function () { boot.skip(); }, 900);
  }
})();
