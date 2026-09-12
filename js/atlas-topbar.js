/* ============================================================
   ATLAS · js/atlas-topbar.js
   ------------------------------------------------------------
   OS CONTROLES DA BARRA SUPERIOR DO SHELL DA RAIZ.

   O problema que este arquivo resolve
   -----------------------------------
   O Dashboard tinha três controles na topbar que não faziam nada:
   o ícone "Aplicativos", o ícone "Notificações" — este com a bolinha
   de não-lido ACESA permanentemente — e o avatar. Prometer interação
   e não entregar é o sinal mais rápido de produto inacabado, e ficava
   exatamente na primeira tela que o usuário vê.

   Como funciona
   -------------
   Cada controle é envolvido por um menu suspenso. O botão original
   NÃO é recriado: ele é movido para dentro do invólucro, preservando
   classes, título e SVG. Assim o CSS existente continua valendo e
   nada muda de aparência no estado fechado.

   Reaproveitamento
   ----------------
   · Fechar ao clicar fora / Escape → window.AtlasCloseMenus (o mesmo
     utilitário do seletor de carteira). Convenção idêntica:
     data-open="true|false" no elemento raiz do menu.
   · Ícones do menu "Aplicativos" → CLONADOS da própria sidebar. Não
     há SVG novo aqui: se um item mudar na sidebar, o menu acompanha
     sozinho e as duas listas nunca divergem.

   Onde vale
   ---------
   Dashboard, Relatórios e Configurações. Cada controle só é montado
   se existir na página — Relatórios e Configurações têm apenas o
   avatar, e o arquivo simplesmente não monta o resto.

   Depende de: wallets/walletMenus.js (AtlasCloseMenus).
   CSS correspondente em css/dashboard.css.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasTopbar) return;

  var ICON_CHEV =
    '<svg class="tb-menu__chev" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ============================================================
     Invólucro genérico de menu
     ------------------------------------------------------------
     Recebe o gatilho JÁ EXISTENTE na página e o envolve. Devolve o
     elemento raiz, que segue a mesma convenção do seletor de
     carteira: data-open="true|false".
     ============================================================ */
  function envolver(gatilho, opts) {
    opts = opts || {};
    if (!gatilho || !gatilho.parentNode) return null;

    var raiz = document.createElement("div");
    raiz.className = "tb-menu" + (opts.align === "left" ? " tb-menu--left" : "");
    raiz.setAttribute("data-atlas-menu", opts.id || "menu");
    raiz.setAttribute("data-open", "false");

    gatilho.parentNode.insertBefore(raiz, gatilho);
    raiz.appendChild(gatilho);

    var pop = document.createElement("div");
    pop.className = "tb-menu__pop";
    pop.setAttribute("role", "menu");
    raiz.appendChild(pop);

    /* o gatilho pode ser <div> (o avatar) — precisa virar botão de fato
       para teclado e leitor de tela */
    if (gatilho.tagName !== "BUTTON") {
      gatilho.setAttribute("role", "button");
      gatilho.setAttribute("tabindex", "0");
      gatilho.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar(); }
      });
    }
    /* Nome acessível. Sem ele o avatar era anunciado pelas iniciais —
       "GA", que não diz a ninguém que ali mora o menu de perfil. */
    if (!gatilho.getAttribute("aria-label") && opts.label) {
      gatilho.setAttribute("aria-label", opts.label);
    }
    gatilho.setAttribute("aria-haspopup", "menu");
    gatilho.setAttribute("aria-expanded", "false");

    function alternar() {
      var abrindo = raiz.getAttribute("data-open") !== "true";
      /* fecha os irmãos: dois menus abertos ao mesmo tempo na mesma
         barra é confuso e o de baixo fica inalcançável */
      document.querySelectorAll('[data-atlas-menu][data-open="true"]').forEach(function (n) {
        if (n !== raiz) {
          n.setAttribute("data-open", "false");
          var g = n.firstElementChild;
          if (g) g.setAttribute("aria-expanded", "false");
        }
      });
      raiz.setAttribute("data-open", abrindo ? "true" : "false");
      gatilho.setAttribute("aria-expanded", abrindo ? "true" : "false");
      if (abrindo && typeof opts.onOpen === "function") opts.onOpen(pop);
    }

    gatilho.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      alternar();
    });

    raiz._pop = pop;
    raiz._toggle = alternar;
    return raiz;
  }

  /* ============================================================
     1. APLICATIVOS — atalho para os módulos
     ============================================================ */

  var MODULOS = /^(hold|trade|defi|rwa|academy)\//i;

  function montarAplicativos() {
    var btn = document.querySelector('.topbar-right .icon-btn[title="Aplicativos"]');
    if (!btn) return;

    /* Os itens saem da própria sidebar: mesmo rótulo, mesmo ícone,
       mesmo destino. Zero SVG novo e zero risco de divergir. */
    var itens = [];
    document.querySelectorAll(".sidebar .nav-item").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!MODULOS.test(href)) return;
      var svg = a.querySelector("svg");
      var rotulo = a.querySelector("span");
      itens.push(
        '<a class="tb-menu__item" role="menuitem" href="' + esc(href) + '">' +
          (svg ? svg.outerHTML : "") +
          "<span>" + esc(rotulo ? rotulo.textContent : href) + "</span>" +
        "</a>"
      );
    });

    if (!itens.length) return;   // página sem sidebar: não monta

    var raiz = envolver(btn, { id: "apps" });
    if (!raiz) return;
    raiz._pop.innerHTML =
      '<div class="tb-menu__head">Módulos</div>' +
      '<div class="tb-menu__grid">' + itens.join("") + "</div>";
  }

  /* ============================================================
     2. NOTIFICAÇÕES — mudaram de casa
     ------------------------------------------------------------
     O sino saiu daqui e foi para core/ui/atlas-shell.js. O motivo é
     o mesmo do "Voltar ao Atlas" e do alternador de tema: montado
     pelo shell, ele existe em TODOS os módulos, e não só nas três
     páginas da raiz. De quebra, ganhou estado de lido e passou a ler
     AtlasNotifications, que soma os quatro módulos — a versão que
     morava aqui lia window.ATLAS_DATA, que só o Dashboard monta, e
     por isso chegava vazia em Relatórios e em Configurações.

     O shell ADOTA o botão nativo desta barra (remove e põe o dele no
     lugar), então nada some da tela.
     ============================================================ */

  /* ============================================================
     3. PERFIL (avatar)
     ------------------------------------------------------------
     Sem autenticação ainda, este menu não promete sessão: leva às
     preferências e aos relatórios. "Sair" volta à tela de entrada.
     ============================================================ */

  /* Leitor único do perfil, em core/settings.js. Esta função já foi uma
     segunda cópia da leitura de atlas.hold.state.v2 → config.nome_gestor — o
     tipo de duplicata que faz um lugar mostrar o nome novo e o outro o
     antigo. Agora só delega. */
  /* Subtítulo da conta no menu de perfil. Com login real (Firebase),
     mostra o email da sessão — a verdade sobre quem está conectado.
     Sem provedor real (modo local), mantém o aviso honesto de sempre. */
  function contaSub() {
    if (window.AtlasAuth && AtlasAuth.real && AtlasAuth.real()) {
      var u = AtlasAuth.current && AtlasAuth.current();
      if (u && u.email) return "Conectado como " + u.email;
    }
    return "Conta local · dados neste navegador";
  }

  function perfil() {
    if (window.AtlasSettings && AtlasSettings.profile) return AtlasSettings.profile();
    return { name: "Gestor ATLAS", initials: "GA" };
  }

  var IC_GEAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 12.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.4 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8"/></svg>';
  var IC_REPORT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>';
  var IC_EXIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>';

  function montarPerfil() {
    var avatar = document.querySelector(".topbar-right .avatar");
    if (!avatar) return;

    var p = perfil();
    /* As iniciais estavam escritas como "JJ" no HTML das três páginas.
       Passam a vir do nome configurado — trocar o nome nas
       Configurações agora troca o avatar em todo o shell. */
    avatar.textContent = p.initials;
    avatar.setAttribute("title", p.name);

    var raiz = envolver(avatar, { id: "perfil", label: "Perfil de " + p.name });
    if (!raiz) return;

    raiz._pop.innerHTML =
      '<div class="tb-menu__user">' +
        '<span class="tb-menu__user-av">' + esc(p.initials) + "</span>" +
        '<span class="tb-menu__user-txt">' +
          "<strong>" + esc(p.name) + "</strong>" +
          "<span>" + esc(contaSub()) + "</span>" +
        "</span>" +
      "</div>" +
      '<div class="tb-menu__list">' +
        '<a class="tb-menu__item" role="menuitem" href="configuracoes.html">' + IC_GEAR + "<span>Configurações</span></a>" +
        '<a class="tb-menu__item" role="menuitem" href="relatorios.html">' + IC_REPORT + "<span>Relatórios</span></a>" +
        /* Era um link puro para login.html: navegava e não encerrava
           nada, porque não havia sessão a encerrar. Agora chama
           AtlasAuth.signOut() e SÓ ENTÃO navega — no dia em que houver
           provedor real, o mesmo botão desloga de verdade. O href
           continua ali para quem abrir em nova aba ou estiver sem JS. */
        '<a class="tb-menu__item tb-menu__item--exit" role="menuitem" href="login.html" data-sair>' + IC_EXIT + "<span>Sair</span></a>" +
      "</div>";

    var sair = raiz._pop.querySelector("[data-sair]");
    if (sair) {
      sair.addEventListener("click", function (e) {
        if (!window.AtlasAuth) return;              // sem a camada, o href faz o trabalho
        e.preventDefault();
        AtlasAuth.signOut().then(function () {
          /* login.html vive em pages/. Este topbar roda tanto no index
             (raiz) quanto nas telas atlas (pages/); AtlasShell.raiz() dá
             o caminho certo até a raiz do projeto em cada caso. */
          var RAIZ = (window.AtlasShell && AtlasShell.raiz) ? AtlasShell.raiz() : "";
          window.location.href = RAIZ + "pages/login.html";
        });
      });
    }
  }

  /* ============================================================
     Montagem
     ============================================================ */

  function init() {
    if (!document.querySelector(".topbar-right")) return;   // shell diferente

    montarAplicativos();
    montarPerfil();

    /* instala o utilitário único de fechar-ao-clicar-fora. Idempotente:
       se o seletor de carteira já tiver chamado, não acumula nada. */
    if (window.AtlasCloseMenus) window.AtlasCloseMenus();
  }

  window.AtlasTopbar = { remount: init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
