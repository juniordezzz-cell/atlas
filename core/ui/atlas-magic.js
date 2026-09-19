/* ============================================================
   ATLAS · core/ui/atlas-magic.js
   Efeitos portados do Magic UI (referencias/magicui, MIT). O visual
   mora em core/ui/atlas-magic.css; aqui fica o que precisa de JS.
   Carregado por core/ui/atlas-shell.js em toda tela do sistema.

   O spotlight que seguia o mouse e o feixe na borda saíram no visual
   sereno (docs/superpowers/specs/2026-09-18-visual-sereno-design.md):
   foram pedidos fora, não reintroduzir.

   CONTAGEM (number-ticker) — o número sobe de 0 até o valor na
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

  /* ---------------- CONTAGEM ---------------- */

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

  function iniciar() { iniciarContagem(); }

  window.AtlasMagic = { count: contar, _molde: molde, _formatar: formatar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
