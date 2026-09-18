/* ============================================================
   ATLAS · core/ui/atlas-magic.js
   Efeitos portados do Magic UI (referencias/magicui, MIT). O visual
   mora em core/ui/atlas-magic.css; aqui fica o que precisa de JS.
   Carregado por core/ui/atlas-shell.js em toda tela do sistema.

   1. SPOTLIGHT (magic-card) — a luz segue o mouse nos cards.
      Um único ouvinte no documento; cada card ganha, no primeiro
      hover, uma camada .atlas-spot (e .atlas-beam nos que têm feixe).
      Card regerado por innerHTML perde a camada e ganha outra no
      próximo movimento. Só em aparelho com mouse.

   2. CONTAGEM (number-ticker) — o número sobe de 0 até o valor na
      PRIMEIRA vez que aparece na tela. Alvos: [data-atlas-flash] (os
      totais que já piscam quando mudam) e [data-atlas-count].

      Número é dado, então a contagem nunca pode mentir:
        · reescreve só os dígitos, mantendo prefixo, sufixo e o
          formato do próprio texto (US$ 12.400,50 · 3,2% · 1,234.5);
        · se o app trocar o texto no meio (cotação chegou, moeda
          mudou), a contagem ABORTA na hora e o texto do app fica;
        · anima uma vez por valor: com chave (data-atlas-flash="kpi:x")
          o bloco regerado não conta de novo;
        · valor zero/ausente não conta nem "gasta" a primeira vez;
        · enquanto conta, o elemento leva data-atlas-ticking e o
          atlas-flash.js o ignora (não pisca verde a cada quadro).
      Desligada com prefers-reduced-motion e html[data-anim="off"].
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasMagic) return;

  /* ---------------- 1. SPOTLIGHT ---------------- */

  var SPOT_SEL = ".card, .panel, .set-card, .est__card, .kpi, .wcard, .tool-card, .onboard-card";
  var BEAM_SEL = ".tool-card, [data-atlas-beam]";

  function camada(host, classe, classeFilho) {
    for (var i = 0; i < host.children.length; i++) {
      if (host.children[i].classList.contains(classe)) return host.children[i];
    }
    var el = document.createElement("span");
    el.className = classe;
    el.setAttribute("aria-hidden", "true");
    if (classeFilho) {
      var filho = document.createElement("span");
      filho.className = classeFilho;
      el.appendChild(filho);
    }
    host.appendChild(el);
    return el;
  }

  function prepararHost(host) {
    if (!host.classList.contains("atlas-spot-host")) {
      host.classList.add("atlas-spot-host");
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
    }
    camada(host, "atlas-spot");
    if (host.matches(BEAM_SEL)) camada(host, "atlas-beam", "atlas-beam__dot");
  }

  function iniciarSpot() {
    /* feixe sempre ligado: quem tem data-atlas-beam já nasce com ele */
    document.querySelectorAll("[data-atlas-beam]").forEach(prepararHost);

    if (!window.matchMedia || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var alvo = null, x = 0, y = 0, quadro = 0;
    function pintar() {
      quadro = 0;
      if (!alvo || !alvo.isConnected) return;
      var r = alvo.getBoundingClientRect();
      alvo.style.setProperty("--atlas-spot-x", (x - r.left) + "px");
      alvo.style.setProperty("--atlas-spot-y", (y - r.top) + "px");
    }
    document.addEventListener("pointermove", function (e) {
      var host = e.target && e.target.closest ? e.target.closest(SPOT_SEL) : null;
      if (!host) { alvo = null; return; }
      if (host !== alvo || !host.querySelector(":scope > .atlas-spot")) { prepararHost(host); alvo = host; }
      x = e.clientX; y = e.clientY;
      if (!quadro) quadro = requestAnimationFrame(pintar);
    }, { passive: true });
  }

  /* ---------------- 2. CONTAGEM ---------------- */

  var COUNT_SEL = "[data-atlas-flash], [data-atlas-count]";
  var DUR = 1100;
  var jaContou = {};                       // por chave
  var jaContouNo = typeof WeakSet === "function" ? new WeakSet() : null;

  function semMovimento() {
    return document.documentElement.getAttribute("data-anim") === "off" ||
      (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* Lê o formato do próprio texto: onde está o número, qual separador
     é decimal, quantas casas, qual agrupa milhar. Nada de assumir
     pt-BR — o ATLAS deixa o usuário trocar o formato numérico.
       "1.234,56" / "1,234.56"  → o último separador é o decimal
       "12,5" / "0.75"          → decimal (não são 3 dígitos depois)
       "1.234" / "1,234,567"    → só milhar (3 dígitos, um tipo só) */
  function molde(texto) {
    var m = String(texto).match(/\d(?:[\d.,]*\d)?/);
    if (!m) return null;
    var s = m[0];
    var ult = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    var dec = null, grupo = null, casas = 0;
    if (ult >= 0) {
      var sep = s.charAt(ult);
      var outro = sep === "." ? "," : ".";
      var temOutro = s.indexOf(outro) >= 0;
      if (temOutro || s.length - ult - 1 !== 3) {
        dec = sep; casas = s.length - ult - 1; grupo = temOutro ? outro : null;
      } else {
        grupo = sep;
      }
    }
    var inteiro = dec ? s.slice(0, ult) : s;
    if (grupo) inteiro = inteiro.split(grupo).join("");
    var valor = parseFloat(inteiro + (dec ? "." + s.slice(ult + 1) : ""));
    if (!isFinite(valor)) return null;
    return { antes: texto.slice(0, m.index), depois: texto.slice(m.index + s.length),
             valor: valor, dec: dec, grupo: grupo, casas: casas };
  }

  function formatar(md, v) {
    var partes = Math.abs(v).toFixed(md.casas).split(".");
    var int = partes[0];
    if (md.grupo) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, md.grupo);
    return md.antes + int + (md.dec ? md.dec + partes[1] : "") + md.depois;
  }

  function chave(el) {
    var k = el.getAttribute("data-atlas-flash") || el.getAttribute("data-atlas-count");
    return (k && k !== "true") ? k : null;
  }
  function contou(el) {
    var k = chave(el);
    return k ? !!jaContou[k] : (jaContouNo ? jaContouNo.has(el) : true);
  }
  function marcar(el) {
    var k = chave(el);
    if (k) jaContou[k] = true; else if (jaContouNo) jaContouNo.add(el);
  }

  function contar(el) {
    if (el.hasAttribute("data-atlas-ticking") || contou(el) || semMovimento()) return;
    var final = el.textContent;
    var md = molde(final);
    if (!md || md.valor === 0) return;     // zero/"—" não gasta a primeira vez
    marcar(el);

    var escrito = formatar(md, 0);
    el.setAttribute("data-atlas-ticking", "");
    el.textContent = escrito;
    var t0 = performance.now();

    function fim(textoFinal) {
      if (textoFinal != null) el.textContent = textoFinal;
      el.removeAttribute("data-atlas-ticking");
    }
    function passo(agora) {
      if (!el.isConnected) return fim(null);
      if (el.textContent !== escrito) return fim(null);   // o app reescreveu: o dele vale
      var p = Math.min(1, (agora - t0) / DUR);
      if (p >= 1) return fim(final);
      var e = 1 - Math.pow(1 - p, 4);                     // ease-out, como a mola do original
      escrito = formatar(md, md.valor * e);
      el.textContent = escrito;
      requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  /* começa quando o número entra na tela (useInView do original) */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) {
      if (en.isIntersecting) { io.unobserve(en.target); contar(en.target); }
    });
  }) : null;

  function vigiar(el) {
    if (el.hasAttribute("data-atlas-ticking") || contou(el)) return;
    if (io) { io.unobserve(el); io.observe(el); } else contar(el);
  }

  function iniciarContagem() {
    document.querySelectorAll(COUNT_SEL).forEach(vigiar);
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes || [], function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches(COUNT_SEL)) vigiar(n);
          n.querySelectorAll(COUNT_SEL).forEach(vigiar);
        });
        /* texto trocado no MESMO nó ("—" → "US$ 5.000") */
        var alvo = m.target && (m.target.nodeType === 1 ? m.target : m.target.parentNode);
        var marcado = alvo && alvo.closest ? alvo.closest(COUNT_SEL) : null;
        if (marcado) vigiar(marcado);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function iniciar() { iniciarSpot(); iniciarContagem(); }

  window.AtlasMagic = { count: contar, _molde: molde, _formatar: formatar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
