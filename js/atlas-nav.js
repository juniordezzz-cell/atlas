/* ============================================================
   ATLAS · js/atlas-nav.js
   ------------------------------------------------------------
   NAVEGAÇÃO MÓVEL DO SHELL DA RAIZ.

   O problema que este arquivo resolve
   -----------------------------------
   css/dashboard.css sempre teve, abaixo de 860px:

       .sidebar { position: fixed; transform: translateX(-100%); }

   ...prevendo um botão de menu que nunca foi implementado. Resultado:
   no celular a sidebar saía da tela e NÃO HAVIA COMO TRAZÊ-LA DE
   VOLTA. Dashboard, Relatórios e Configurações ficavam sem navegação
   nenhuma — o usuário entrava e não conseguia sair para módulo algum.

   Por que em JS e não no HTML das três páginas
   --------------------------------------------
   O markup da sidebar já está duplicado em dashboard.html,
   relatorios.html e configuracoes.html. Acrescentar botão + folha nos
   três seria uma quarta e quinta duplicata. Aqui o componente é
   injetado uma vez e vale para as três — e para qualquer página nova
   que use o mesmo shell.

   (A unificação do markup da sidebar em si é outra etapa do roadmap.
   Este arquivo NÃO reescreve a sidebar: só acrescenta o que faltava.)

   O que é injetado
   ----------------
     · botão hambúrguer, no início da .topbar (só aparece ≤860px)
     · folha (scrim) escurecida, filha direta do <body>

   Acessibilidade
   --------------
     · aria-expanded / aria-controls no botão
     · foco vai para o primeiro item ao abrir e VOLTA para o botão ao
       fechar — sem isso quem usa teclado perde a posição
     · Escape fecha
     · clique na folha ou em qualquer item de navegação fecha
     · rolagem do fundo travada enquanto aberto

   Depende de: nada. CSS correspondente em css/dashboard.css.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasNav) return;               // idempotente

  var BREAKPOINT = 860;                      // igual ao @media de css/dashboard.css

  var ICON_MENU =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var sidebar = null, toggle = null, scrim = null, aberto = false;

  function isMobile() { return window.innerWidth <= BREAKPOINT; }

  /* ---------- construção ---------- */

  function build() {
    sidebar = document.querySelector(".app > .sidebar");
    var topbar = document.querySelector(".main > .topbar");
    if (!sidebar || !topbar) return false;    // página não usa este shell

    if (!sidebar.id) sidebar.id = "atlasSidebar";

    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.id = "atlasNavToggle";
    toggle.setAttribute("aria-label", "Abrir menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", sidebar.id);
    toggle.innerHTML = ICON_MENU;
    topbar.insertBefore(toggle, topbar.firstChild);

    /* A folha é filha DIRETA do <body> de propósito: position:fixed
       deixa de valer dentro de qualquer ancestral com transform, e a
       .sidebar tem transform justamente quando a folha precisa existir. */
    scrim = document.createElement("div");
    scrim.className = "nav-scrim";
    scrim.id = "atlasNavScrim";
    scrim.hidden = true;
    document.body.appendChild(scrim);

    return true;
  }

  /* ---------- abrir / fechar ---------- */

  function abrir() {
    if (aberto) return;
    aberto = true;
    sidebar.classList.add("is-open");
    scrim.hidden = false;
    toggle.innerHTML = ICON_CLOSE;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu");
    document.documentElement.classList.add("nav-locked");

    /* leva o foco para dentro do menu — senão o teclado continua no
       fundo, "por baixo" da folha */
    var primeiro = sidebar.querySelector(".nav-item");
    if (primeiro) { try { primeiro.focus(); } catch (e) {} }
  }

  function fechar(devolverFoco) {
    if (!aberto) return;
    aberto = false;
    sidebar.classList.remove("is-open");
    scrim.hidden = true;
    toggle.innerHTML = ICON_MENU;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
    document.documentElement.classList.remove("nav-locked");
    if (devolverFoco) { try { toggle.focus(); } catch (e) {} }
  }

  function alternar() { aberto ? fechar(true) : abrir(); }

  /* ---------- ligações ---------- */

  function wire() {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      alternar();
    });

    scrim.addEventListener("click", function () { fechar(false); });

    /* navegar fecha o menu: as três páginas são documentos separados,
       mas o clique acontece antes da troca e sem isto o menu fica
       aberto por um instante visível durante a saída */
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".nav-item")) fechar(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && aberto) { e.preventDefault(); fechar(true); }
    });

    /* voltar para o desktop com o menu aberto deixaria a folha por cima
       do conteúdo e o <html> travado para rolagem */
    window.addEventListener("resize", function () {
      if (!isMobile() && aberto) fechar(false);
    }, { passive: true });
  }

  /* ---------- API ---------- */

  window.AtlasNav = {
    open: function () { abrir(); },
    close: function () { fechar(false); },
    toggle: alternar,
    isOpen: function () { return aberto; }
  };

  function init() {
    if (!build()) return;
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
