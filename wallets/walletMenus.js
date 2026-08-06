/* ============================================================
   ATLAS · /wallets/walletMenus.js
   ------------------------------------------------------------
   FECHAMENTO DE MENUS SUSPENSOS — utilitário único.

   Os seletores de carteira (Dashboard, Hold, DeFi, Trade, RWA)
   tinham cada um sua lógica de "fechar ao clicar fora", registrada
   DENTRO da função de render. Como o render roda a cada mudança de
   estado, acumulavam um listener por render, presos a nós já
   removidos da tela — por isso o menu às vezes não fechava.

   Aqui é UM listener só, registrado uma vez por página.

   Fase de CAPTURA (o "true" no fim): na borbulha, qualquer elemento
   no caminho pode chamar stopPropagation() e o clique nunca chega ao
   document. Na captura, o evento desce da janela até o alvo, então
   este listener SEMPRE roda primeiro. É imune a stopPropagation de
   terceiros — e é por isso que ele basta sozinho.

   HISTÓRICO — por que NÃO existe mais uma "folha" (scrim)
   -------------------------------------------------------
   Existia aqui uma segunda camada: quando um menu abria, uma folha
   transparente (.atlas-menu-scrim, position:fixed, z-index:1000) era
   colocada sobre a tela para receber o clique de fora. A ideia era
   que o menu ficasse ACIMA dela, via ".wsel.open{z-index:1001}".

   Essa disputa de z-index só funciona quando os dois estão no MESMO
   contexto de empilhamento. No Dashboard estavam — a .topbar dele é
   um flex comum — e por isso lá tudo funcionava. Nos módulos, não: a
   topbar do Hold/DeFi/Trade/RWA é `position:sticky` com `z-index:30`
   e `backdrop-filter`, e qualquer um desses três sozinho já cria um
   contexto de empilhamento. O z-index:1001 do seletor passava a valer
   só DENTRO da topbar; contra a folha, o que competia era o 30 da
   topbar — que perde para 1000. Resultado: a folha cobria o menu
   inteiro. Todo clique dentro do menu (inclusive o "Nova carteira")
   acertava a folha, que fechava o menu e engolia o clique.

   A folha era supérflua e quebrava o que o listener de captura já
   resolve sem depender de pintura, de z-index ou de contexto de
   empilhamento. Foi removida. Não readicionar.

   Exposto em: window.AtlasCloseMenus()
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasCloseMenus) return;

  /* Uma convenção só: data-open="true|false" no elemento raiz do menu.
     Antes eram duas (classe .open no Hold/DeFi/Dashboard, atributo
     data-open no Trade/RWA) porque cada módulo tinha a sua pele.
     Com um componente só, existe um estado só.

     A lista cobre o seletor de carteira (.awsel) e os menus da barra
     superior do shell da raiz ([data-atlas-menu] — aplicativos,
     notificações e perfil, em js/atlas-topbar.js). Menu novo que
     adote a mesma convenção entra aqui e ganha fechar-ao-clicar-fora
     de graça, sem um segundo mecanismo concorrente na página. */
  var SELETOR = '.awsel[data-open="true"], [data-atlas-menu][data-open="true"]';

  function fecharNo(n) {
    n.setAttribute("data-open", "false");
    /* o gatilho anuncia o próprio estado ao leitor de tela; só mexe
       se ele já declara o atributo, para não inventar semântica em
       componente que não pediu */
    var g = n.firstElementChild;
    if (g && g.hasAttribute("aria-expanded")) g.setAttribute("aria-expanded", "false");
  }

  window.AtlasCloseMenus = function () {
    /* idempotente: pode ser chamado a cada render sem acumular nada */
    if (document.documentElement.hasAttribute("data-atlas-menuclose")) return;
    document.documentElement.setAttribute("data-atlas-menuclose", "on");

    function fechar(e) {
      var abertos = document.querySelectorAll(SELETOR);
      if (!abertos.length) return;
      Array.prototype.forEach.call(abertos, function (n) {
        if (!n.contains(e.target)) fecharNo(n);
      });
    }

    document.addEventListener("click", fechar, true);
    document.addEventListener("touchstart", fechar, true);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      Array.prototype.forEach.call(document.querySelectorAll(SELETOR), fecharNo);
    }, true);

    /* Sinaliza para o resto do app (ex.: o orb do Oráculo, que é fixo e
       flutua por cima de tudo) que existe um menu aberto. Enquanto
       estiver "on", o orb fechado desliga o próprio clique para não
       roubar o toque de um menu que passe por baixo dele. */
    function sincronizar() {
      var aberto = !!document.querySelector(SELETOR);
      document.documentElement.setAttribute("data-atlas-menu-open", aberto ? "on" : "off");
    }

    if (window.MutationObserver) {
      /* attributeFilter NÃO inclui data-atlas-menu-open de propósito:
         senão o próprio setAttribute acima re-dispararia o observer. */
      new MutationObserver(sincronizar).observe(document.documentElement, {
        attributes: true, attributeFilter: ["data-open"], subtree: true, childList: true
      });
    }
    sincronizar();
  };
})();
