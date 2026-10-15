/* ============================================================
   ATLAS · core/ui/atlas-cards3d.js
   Card em camadas 3D: inclina com o mouse/toque e cada camada
   anda numa profundidade diferente (parallax). Usa a Atropos
   (github.com/nolimits4web/atropos, MIT), copiada em
   assets/vendor/atropos-2.0.2.min.js + .css.

   Como usar: marque o card com data-atlas-3d e as camadas internas
   com data-atropos-offset (negativo = mais fundo, positivo = mais
   perto). Este script embrulha o card na estrutura que a Atropos
   exige (.atropos > .atropos-scale > .atropos-rotate > .atropos-inner),
   então o HTML da página continua simples.

   Sem brilho (highlight) e sem sombra própria: o visual do ATLAS
   não usa glow; a sombra do card vem do CSS da página.
   Registro: docs/visual-ferramentas-2026-10-15.md
   ============================================================ */
(function () {
  'use strict';

  function div(classe) {
    var el = document.createElement('div');
    el.className = classe;
    return el;
  }

  function embrulhar(card) {
    var raiz = div('atropos atlas-3d');
    var escala = div('atropos-scale');
    var giro = div('atropos-rotate');
    var miolo = div('atropos-inner');
    raiz.appendChild(escala);
    escala.appendChild(giro);
    giro.appendChild(miolo);
    card.parentNode.insertBefore(raiz, card);
    miolo.appendChild(card);
    return raiz;
  }

  // O card gira enquanto o botão está apertado: o botão desce sobre o
  // link e sobe num ponto que, com o giro, já é o embrulho da Atropos.
  // O navegador entrega o clique ao ancestral comum (fora do <a>) e a
  // ferramenta não abria. Aqui o embrulho devolve esse clique ao link,
  // respeitando Ctrl/Cmd/Shift/botão do meio (abrir em outra aba).
  function repassarClique(raiz, card) {
    if (!card.href) return;
    var apertouNoCard = false;
    raiz.addEventListener('pointerdown', function (e) {
      apertouNoCard = card.contains(e.target);
    });
    raiz.addEventListener('click', function (e) {
      var foraDoLink = !card.contains(e.target);
      if (!apertouNoCard || !foraDoLink) return;
      apertouNoCard = false;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        window.open(card.href, '_blank', 'noopener');
      } else {
        window.location.href = card.href;
      }
    });
  }

  function iniciar() {
    if (typeof window.Atropos !== 'function') return;
    // quem pediu menos movimento fica com o card parado
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.querySelectorAll('[data-atlas-3d]').forEach(function (card) {
      if (card.closest('.atropos')) return; // já embrulhado
      // Sem arraste nativo: apertar na imagem (ou no link) e mexer uns
      // pixels — natural com o card inclinando — fazia o navegador
      // "arrastar" a imagem e o clique nunca chegava (bug de 15/10/2026).
      card.setAttribute('draggable', 'false');
      card.querySelectorAll('img').forEach(function (img) {
        img.setAttribute('draggable', 'false');
      });
      var raiz = embrulhar(card);
      repassarClique(raiz, card);
      window.Atropos({
        el: raiz,
        activeOffset: 24,   // quanto o card "sobe" ao ser tocado
        rotateXMax: 9,
        rotateYMax: 9,
        shadow: false,
        highlight: false,
        rotateTouch: 'scroll-y', // no celular, rolar a página continua funcionando
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
