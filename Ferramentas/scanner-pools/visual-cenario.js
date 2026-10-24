/* ============================================================
   Scanner Pools · visual-cenario.js
   Marca a tabela com .rola quando ela é mais larga que a área e rola
   de lado. Só então a coluna de ações fica presa na borda direita
   (visual-cenario.css); com a tabela cabendo, ela é uma coluna comum,
   sem o bloco escuro que destoava do painel.
   Registro: docs/visual-ferramentas-2026-10-15.md
   ============================================================ */
(function () {
  'use strict';

  function medir(caixa) {
    caixa.classList.toggle('rola', caixa.scrollWidth > caixa.clientWidth + 1);
  }

  function vigiar(caixa) {
    if (caixa.__rolaVigiada) return;
    caixa.__rolaVigiada = true;
    medir(caixa);
    // muda de largura quando a janela muda ou a aba aparece
    if (window.ResizeObserver) new ResizeObserver(function () { medir(caixa); }).observe(caixa);
    // muda de conteúdo quando a lista é redesenhada (filtros, página)
    new MutationObserver(function () { medir(caixa); }).observe(caixa, { childList: true, subtree: true });
  }

  function iniciar() {
    document.querySelectorAll('.tablewrap').forEach(vigiar);
    // tabelas criadas depois (outras abas); várias mudanças seguidas
    // viram uma busca só, no próximo quadro
    var agendado = false;
    new MutationObserver(function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () {
        agendado = false;
        document.querySelectorAll('.tablewrap').forEach(vigiar);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
