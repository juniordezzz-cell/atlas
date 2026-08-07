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

  /* ============================================================
     O MENU — uma definição, três páginas
     ------------------------------------------------------------
     Os oito itens estavam escritos por extenso, com o SVG inteiro de
     cada ícone, em dashboard.html, relatorios.html E configuracoes.html.
     Quarenta linhas idênticas triplicadas: acrescentar um módulo
     significava editar três arquivos e lembrar do quarto (o Academy,
     que tem shell próprio). Já havia divergido — só o Academy ganhou
     "Voltar ao ATLAS" no rodapé.

     Agora a lista mora aqui. Cada página marca a sua com
     <nav class="nav" data-atlas-nav="dashboard">.

     A CASCA continua no HTML (<aside class="sidebar">, a marca e o
     <nav> vazio): o navegador pinta a coluna com a largura certa antes
     deste script rodar, e não há salto de layout. Só os ITENS são
     gerados, que é onde estava a duplicação de verdade.
     ============================================================ */

  var MENU = [
    { id: "dashboard", label: "Dashboard", href: "dashboard.html",
      icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>' },
    { id: "hold", label: "Hold", href: "hold/index.html",
      icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3.5"/>' },
    { id: "trade", label: "Trade", href: "trade/index.html",
      icon: '<path d="M3 17l6-6 4 4 7-8"/><path d="M21 7v5M21 7h-5"/>' },
    { id: "defi", label: "DeFi", href: "defi/index.html",
      icon: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>' },
    { id: "rwa", label: "RWA", href: "RWA/index.html",
      icon: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>' },
    { id: "academy", label: "Academy", href: "academy/index.html",
      icon: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"/>' },
    { id: "relatorios", label: "Relatórios", href: "relatorios.html",
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>' },
    { id: "configuracoes", label: "Configurações", href: "configuracoes.html",
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 12.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.4 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8"/>' }
  ];

  function renderMenu() {
    var nav = document.querySelector(".sidebar nav.nav[data-atlas-nav]");
    if (!nav) return;                        // página ainda com o menu no HTML
    var atual = nav.getAttribute("data-atlas-nav");

    nav.innerHTML = MENU.map(function (m) {
      var ativo = m.id === atual;
      return '<a class="nav-item' + (ativo ? " active" : "") + '"' +
             ' href="' + m.href + '"' +
             /* a página atual não é um destino: vira marco, não link */
             (ativo ? ' aria-current="page"' : "") + ">" +
             '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
             'stroke-width="1.7" aria-hidden="true">' + m.icon + "</svg>" +
             "<span>" + m.label + "</span></a>";
    }).join("");
  }

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
    /* o menu primeiro: js/atlas-topbar.js clona estes itens para montar
       o atalho "Aplicativos", e roda logo depois deste script */
    renderMenu();
    if (!build()) return;
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
