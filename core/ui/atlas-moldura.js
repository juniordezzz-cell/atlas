/* ============================================================
   ATLAS · core/ui/atlas-moldura.js — a moldura única (15/11/2026)
   ------------------------------------------------------------
   Modelo A, escolhido pelo dono no protótipo de navegação:

     · um TRILHO à esquerda, igual em todo o site: fechado mostra só
       os ícones (68 px); aberto mostra os nomes (236 px) e empurra a
       página. O estado fica lembrado neste navegador.
     · Mercado no topo (página principal) e os destinos em grupos
       que abrem e fecham pela setinha: Investimentos (Dashboard, Hold,
       Trade, DeFi, RWA, Carteiras), Academy e Ferramentas. Relatórios
       fica nas Configurações. (Organização de 17/11/2026.)
     · o SUBMENU de cada módulo no centro da barra de topo.

   Por que espelhar em vez de reescrever os módulos
   ------------------------------------------------
   Cada módulo tem roteamento próprio (Hold/Trade/RWA por #hash,
   DeFi e Finanças por páginas, Mercado/Academy/Ferramentas por
   abas em JS). O submenu aqui é um ESPELHO: cada botão clica no
   item original, que continua no DOM (só escondido). Assim nenhum
   roteador muda, e a marcação "ativo" vem do próprio módulo.

   O que esta peça NÃO faz: não toca em fundo nenhum (cenário das
   Ferramentas, efeitos do Academy, fundos dos módulos). Ela só
   acrescenta o trilho e reorganiza a navegação.

   CSS: bloco "MOLDURA" em core/ui/atlas-shell.css, que todas as
   páginas carregam no <head>. As regras só valem com
   html.atlas-moldura, que este arquivo põe.
   Registro: docs/moldura-2026-11-15.md
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasMoldura) return;
  if (!window.AtlasShell) return;

  var html = document.documentElement;
  var MODULE = AtlasShell.module();
  var RAIZ = AtlasShell.raiz();
  var CAMINHO = location.pathname.toLowerCase();

  /* Páginas sem moldura: entrada, login, testes. */
  if (/\/(index|login|landing|boas-vindas|offline|testes[^/]*)\.html$/.test(CAMINHO) &&
      !/\/(hold|trade|defi|rwa|mercado|academy|ferramentas)\//.test(CAMINHO)) return;
  if (/\/$/.test(CAMINHO) && MODULE === "atlas") return;

  var CHAVE_ABERTA = "atlas.moldura.aberta";
  var CHAVE_GRUPOS = "atlas.moldura.grupos";
  var CELULAR = 860;

  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function svg(path, cls) {
    return '<svg class="' + (cls || "atm-ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
  }
  var IC_SETA = '<path d="m6 9 6 6 6-6"/>';
  var IC_MENU = '<path d="M4 7h16M4 12h16M4 17h16"/>';
  var IC_RECOLHER = '<path d="M15 6l-6 6 6 6"/><path d="M4 4v16"/>';
  var IC_BUSCA = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';

  /* ---------- destinos e grupos ---------- */
  var DEST = {};
  AtlasShell.destinos().forEach(function (d) { DEST[d.id] = d; });
  /* Organização de 17/11/2026 (pedido do dono): o Mercado é a página
     principal e abre o trilho; o Dashboard entra em Investimentos;
     Academy e Ferramentas são grupos próprios (o nome leva à página,
     a setinha abre a lista de dentro); Relatórios mora nas
     Configurações (fica marcada quando a página aberta é Relatórios). */
  var MENU = [
    { item: "mercado" },
    { grupo: "investimentos", nome: "Investimentos", itens: ["dashboard", "hold", "trade", "defi", "rwa", "carteiras"] },
    { grupo: "academy", nome: "Academy", destino: "academy", hub: "academy/index.html#inicio", rotuloHub: "Início do Academy" },
    { grupo: "ferramentas", nome: "Ferramentas", destino: "ferramentas", hub: "pages/ferramentas.html#todas", rotuloHub: "Todas as ferramentas" }
  ];

  /* Academy: as abas da página (academy/js/academy-hub.js lê o #hash). */
  var ACADEMY = [
    { slug: "cursos", nome: "Cursos", href: "academy/index.html#cursos",
      icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>' },
    { slug: "artigos", nome: "Artigos", href: "academy/index.html#artigos",
      icon: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>' },
    { slug: "papers", nome: "Papers", href: "academy/index.html#papers",
      icon: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/>' },
    { slug: "links", nome: "Links", href: "academy/index.html#links",
      icon: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>' }
  ];

  /* Ferramentas (17/11/2026): grupo próprio no trilho. O nome leva ao hub
     (todas as ferramentas); a setinha abre e fecha a lista. Trilho fechado
     no PC: um ícone só, que leva ao hub. Ordem = abas da página. */
  var FERRAMENTAS = [
    { slug: "entradas-saidas", nome: "Finanças", href: "Ferramentas/entradas-saidas/financas/index.html",
      icon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>' },
    { slug: "conversor", nome: "Conversor e Câmbio", href: "Ferramentas/conversor/index.html",
      icon: '<path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/>' },
    { slug: "escada-dca", nome: "Escada · DCA", href: "Ferramentas/escada-dca/index.html",
      icon: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>' },
    { slug: "lucro-cripto", nome: "Lucro Cripto", href: "Ferramentas/lucro-cripto/index.html",
      icon: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
    { slug: "simulador-de-trade", nome: "Simulador de Trade", href: "Ferramentas/simulador-de-trade/index.html",
      icon: '<path d="M8 3v18M16 3v18"/><rect x="6" y="7" width="4" height="8" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>' },
    { slug: "scanner-pools", nome: "Scanner de Pools", href: "Ferramentas/scanner-pools/index.html",
      icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 6-6"/>' },
    { slug: "estrategia-de-pool", nome: "Estratégias de Pools", href: "Ferramentas/estrategia-de-pool/index.html",
      icon: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>' },
    { slug: "staking", nome: "Staking", href: "Ferramentas/staking/index.html",
      icon: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>' },
    { slug: "juros-compostos", nome: "Juros Compostos", href: "Ferramentas/juros-compostos/index.html",
      icon: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>' },
    { slug: "calculadora-market-cap", nome: "Market Cap", href: "Ferramentas/calculadora-market-cap/index.html",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>' },
    { slug: "comparador-de-ativos", nome: "Comparador de Ativos", href: "Ferramentas/comparador-de-ativos/index.html",
      icon: '<path d="M12 4v16M5 8h14"/><path d="m5 8-3 6h6zM19 8l-3 6h6z"/>' }
  ];
  var FERR_ATUAL = (function () {
    var m = CAMINHO.match(/\/ferramentas\/([a-z0-9-]+)\//);
    return m ? m[1] : "";
  })();

  /* qual destino é a página atual */
  function atual() {
    if (MODULE === "tools") return "ferramentas";
    if (/\/pages\/relatorios\.html$/.test(CAMINHO)) return "configuracoes";
    if (MODULE !== "atlas") return MODULE;
    var m = CAMINHO.match(/\/pages\/([a-z-]+)\.html$/);
    return m ? m[1] : "dashboard";
  }
  var ATUAL = atual();

  /* ---------- trilho ---------- */
  var trilho, veu, botaoCel;

  function linkDestino(id) {
    var d = DEST[id];
    if (!d) return "";
    var on = id === ATUAL;
    return '<a class="atm-item' + (on ? " is-on" : "") + '" href="' + esc(RAIZ + d.href) + '"' +
      (on ? ' aria-current="page"' : "") + ' title="' + esc(d.label) + '">' +
      svg(d.icon) + '<span class="atm-rot">' + esc(d.label) + "</span></a>";
  }

  function lerGrupos() {
    var g = {};
    try { g = JSON.parse(ler(CHAVE_GRUPOS) || "{}") || {}; } catch (e) { g = {}; }
    return g;
  }

  /* qual item de dentro do grupo é a página atual ("" = a página do grupo) */
  function chaveAtual(bloco) {
    if (bloco.destino === "ferramentas") return FERR_ATUAL;
    if (bloco.destino === "academy") {
      if (/\/academy\/nivel-/.test(CAMINHO)) return "cursos";
      var h = location.hash.slice(1);
      return ACADEMY.some(function (a) { return a.slug === h; }) ? h : "";
    }
    return "";
  }
  function listaDo(bloco) { return bloco.destino === "academy" ? ACADEMY : FERRAMENTAS; }

  /* grupo com página própria: nome = link para a página; setinha = abre a lista */
  function grupoHub(bloco, grupos) {
    var temAtual = ATUAL === bloco.destino;
    var chave = temAtual ? chaveAtual(bloco) : null;
    var noHub = temAtual && !chave;
    /* fechado por padrão; aberto quando a página é dele */
    var aberto = (bloco.grupo in grupos) ? !!grupos[bloco.grupo] : false;
    if (temAtual) aberto = true;
    var hub = esc(RAIZ + bloco.hub);
    var d = DEST[bloco.destino];
    var itens = listaDo(bloco).map(function (f) {
      var on = f.slug === chave;
      return '<a class="atm-item atm-item--sub' + (on ? " is-on" : "") + '" data-chave="' + f.slug + '" href="' + esc(RAIZ + f.href) + '"' +
        (on ? ' aria-current="page"' : "") + ' title="' + esc(f.nome) + '">' +
        svg(f.icon) + '<span class="atm-rot">' + esc(f.nome) + "</span></a>";
    }).join("");
    return '<div class="atm-grupo atm-grupo--hub' + (aberto ? " is-aberto" : "") + '" data-grupo="' + bloco.grupo + '" data-destino="' + bloco.destino + '">' +
      '<div class="atm-grupo__cab atm-grupo__cab--hub">' +
        '<a class="atm-grupo__link' + (noHub ? " is-on" : "") + '" href="' + hub + '"' + (noHub ? ' aria-current="page"' : "") +
          ' title="' + esc(bloco.rotuloHub) + '"><span class="atm-rot">' + esc(bloco.nome) + "</span></a>" +
        '<button type="button" class="atm-grupo__seta" aria-expanded="' + aberto + '" aria-controls="atm-g-' + bloco.grupo + '"' +
          ' aria-label="Mostrar ou esconder a lista de ' + esc(bloco.nome) + '">' + svg(IC_SETA, "atm-seta") + "</button>" +
      "</div>" +
      /* só aparece com o trilho fechado no PC */
      '<a class="atm-item atm-hub-ic' + (temAtual ? " is-on" : "") + '" href="' + hub + '" title="' + esc(bloco.nome) + '">' +
        svg(d ? d.icon : IC_MENU) + '<span class="atm-rot">' + esc(bloco.nome) + "</span></a>" +
      '<div class="atm-grupo__itens" id="atm-g-' + bloco.grupo + '">' + itens + "</div></div>";
  }

  /* Academy troca de aba pelo #hash sem recarregar: acompanha no trilho */
  function marcarGrupos() {
    if (!trilho) return;
    Array.prototype.forEach.call(trilho.querySelectorAll(".atm-grupo--hub"), function (g) {
      var bloco = MENU.filter(function (b) { return b.grupo === g.getAttribute("data-grupo"); })[0];
      if (!bloco || ATUAL !== bloco.destino) return;
      var chave = chaveAtual(bloco);
      Array.prototype.forEach.call(g.querySelectorAll(".atm-item--sub"), function (a) {
        var on = a.getAttribute("data-chave") === chave;
        classe(a, "is-on", on);
        if (on) { if (a.getAttribute("aria-current") !== "page") a.setAttribute("aria-current", "page"); }
        else if (a.hasAttribute("aria-current")) a.removeAttribute("aria-current");
      });
      var link = g.querySelector(".atm-grupo__link");
      classe(link, "is-on", !chave);
      if (!chave) { if (link.getAttribute("aria-current") !== "page") link.setAttribute("aria-current", "page"); }
      else if (link.hasAttribute("aria-current")) link.removeAttribute("aria-current");
    });
  }

  function montarTrilho() {
    var grupos = lerGrupos();
    var partes = MENU.map(function (bloco) {
      if (bloco.item) return linkDestino(bloco.item);
      if (bloco.hub) return grupoHub(bloco, grupos);
      var temAtual = bloco.itens.indexOf(ATUAL) !== -1;
      var aberto = (bloco.grupo in grupos) ? !!grupos[bloco.grupo] : true;
      if (temAtual) aberto = true;
      return '<div class="atm-grupo' + (aberto ? " is-aberto" : "") + '" data-grupo="' + bloco.grupo + '">' +
        '<button type="button" class="atm-grupo__cab" aria-expanded="' + aberto + '" aria-controls="atm-g-' + bloco.grupo + '">' +
        '<span class="atm-rot">' + esc(bloco.nome) + "</span>" + svg(IC_SETA, "atm-seta") + "</button>" +
        '<div class="atm-grupo__itens" id="atm-g-' + bloco.grupo + '">' + bloco.itens.map(linkDestino).join("") + "</div></div>";
    }).join("");

    trilho = document.createElement("aside");
    trilho.className = "atm-trilho";
    trilho.id = "atlasMoldura";
    trilho.setAttribute("aria-label", "Menu do ATLAS");
    trilho.setAttribute("data-atlas-ui", "moldura");
    trilho.innerHTML =
      '<div class="atm-topo">' +
        '<a class="atm-marca" href="' + esc(RAIZ + "mercado/index.html") + '" title="ATLAS · Mercado">' +
          '<img src="' + esc(RAIZ + "assets/iconeatlas.png") + '" alt="" width="44" height="44">' +
          '<span class="atm-rot atm-marca__txt"><b>ATLAS</b><small>seu mapa de investimentos</small></span></a>' +
        '<button type="button" class="atm-alternar" aria-controls="atlasMoldura">' + svg(IC_RECOLHER) + "</button>" +
      "</div>" +
      '<nav class="atm-nav">' + partes + "</nav>" +
      '<div class="atm-pe">' +
        '<button type="button" class="atm-item atm-busca" title="Buscar (Ctrl+K)">' + svg(IC_BUSCA) +
          '<span class="atm-rot">Buscar</span><kbd class="atm-rot">Ctrl K</kbd></button>' +
        linkDestino("configuracoes") +
      "</div>";
    document.body.insertBefore(trilho, document.body.firstChild);

    veu = document.createElement("div");
    veu.className = "atm-veu";
    document.body.appendChild(veu);

    trilho.querySelector(".atm-alternar").addEventListener("click", function () { alternar(); });
    trilho.querySelector(".atm-busca").addEventListener("click", function () {
      if (window.AtlasPalette && AtlasPalette.open) AtlasPalette.open();
    });
    trilho.addEventListener("click", function (ev) {
      var cab = ev.target.closest("button.atm-grupo__cab, .atm-grupo__seta");
      if (!cab) return;
      /* com o trilho fechado no PC, a setinha abre o trilho primeiro */
      if (!aberto() && !celular()) { definir(true); return; }
      var g = cab.closest(".atm-grupo");
      var abrir = !g.classList.contains("is-aberto");
      g.classList.toggle("is-aberto", abrir);
      cab.setAttribute("aria-expanded", abrir ? "true" : "false");
      var mapa = lerGrupos();
      mapa[g.getAttribute("data-grupo")] = abrir;
      gravar(CHAVE_GRUPOS, JSON.stringify(mapa));
    });
    veu.addEventListener("click", function () { definir(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && celular() && aberto()) definir(false);
    });
  }

  /* só mexe na classe se ela muda: o observador abaixo reage a
     atributos, e um add/remove "à toa" o faria rodar sem parar */
  function classe(el, nome, ligar) {
    if (el.classList.contains(nome) !== ligar) el.classList.toggle(nome, ligar);
  }

  function celular() { return window.innerWidth <= CELULAR; }
  function aberto() { return html.getAttribute("data-moldura") === "aberta"; }
  function definir(abrir) {
    html.setAttribute("data-moldura", abrir ? "aberta" : "fechada");
    var rot = abrir ? "Recolher menu" : "Abrir menu";
    var b = trilho.querySelector(".atm-alternar");
    b.setAttribute("aria-label", rot);
    b.setAttribute("aria-expanded", abrir ? "true" : "false");
    b.title = rot;
    if (botaoCel) botaoCel.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (!celular()) gravar(CHAVE_ABERTA, abrir ? "1" : "0");
  }
  function alternar() { definir(!aberto()); }

  /* ============================================================
     SUBMENU — espelho do menu de cada módulo
     ------------------------------------------------------------
     itens:   onde estão os links/abas originais do módulo
     esconde: o que sai da tela (o original continua no DOM)
     topo:    a barra onde o submenu entra
     ============================================================ */
  var ADAPTA = {
    hold:    { itens: "#app > aside.sidebar nav a.nav-item", topo: "#topbar" },
    trade:   { itens: ".app nav.nav a.nav__item:not(.nav__back):not(.atlas-backfoot)", topo: ".app > header.topbar" },
    rwa:     { itens: "#sidebar a.nav-item", topo: "#shell .main > header.topbar" },
    defi:    { itens: null, topo: "header.topnav .topnav-inner" },
    mercado: { itens: ".cc-tabs .cc-tab", topo: ".main > header.topbar" },
    academy: { itens: ".ac-tabs .ac-tab", topo: ".main > header.topbar" },
    atlas:   { itens: ".tools-tabs .tools-tab, .cx-guias .cx-guia", topo: ".main > header.topbar" },
    tools:   { itens: ".fx-subnav .fx-pill", topo: ".fx-topbar, .wrap > header.topbar, .wrap > header.top" }
  };
  var CONF = ADAPTA[MODULE] || ADAPTA.atlas;
  var sub = null, assinatura = "";

  function ativo(el) {
    return el.matches(".active, .is-active, .on, [aria-selected='true'], [aria-current='page'], [aria-current='true']");
  }

  function originais() {
    if (!CONF.itens) return [];
    return Array.prototype.slice.call(document.querySelectorAll(CONF.itens));
  }

  function rotulo(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll("svg, img, .sr-only"), function (n) { n.remove(); });
    var spans = c.querySelectorAll("span");
    /* contador (ex.: "Gerir o dinheiro 2") vira um selo discreto */
    if (spans.length > 1) {
      var nome = spans[0].textContent.trim();
      var resto = Array.prototype.slice.call(spans, 1).map(function (s) { return s.textContent.trim(); }).join(" ");
      return esc(nome) + (resto ? ' <span class="atm-sub__n">' + esc(resto) + "</span>" : "");
    }
    return esc(c.textContent.replace(/\s+/g, " ").trim());
  }

  function lugarDoSub() {
    var topo = CONF.topo ? document.querySelector(CONF.topo) : null;
    return topo;
  }

  function sincronizar() {
    var lista = originais();
    if (!lista.length) {
      if (sub) { sub.remove(); sub = null; assinatura = ""; }
      if (html.hasAttribute("data-moldura-sub")) html.removeAttribute("data-moldura-sub");
      return;
    }
    if (!html.hasAttribute("data-moldura-sub")) html.setAttribute("data-moldura-sub", "on");
    var assin = lista.map(function (el) { return el.textContent.trim(); }).join("|");
    var topo = lugarDoSub();

    if (!sub || assin !== assinatura) {
      assinatura = assin;
      if (!sub) {
        sub = document.createElement("nav");
        sub.className = "atm-sub";
        sub.setAttribute("aria-label", "Seções desta página");
        sub.addEventListener("click", function (ev) {
          var b = ev.target.closest(".atm-sub__item");
          if (!b) return;
          ev.preventDefault();
          var alvo = originais()[+b.getAttribute("data-i")];
          if (alvo) alvo.click();
          requestAnimationFrame(marcar);
        });
      }
      sub.innerHTML = lista.map(function (el, i) {
        return '<button type="button" class="atm-sub__item" data-i="' + i + '">' + rotulo(el) + "</button>";
      }).join("");
    }

    /* põe no lugar certo: dentro da barra de topo no PC, logo abaixo
       dela no celular (no topo não há largura para as abas) */
    if (topo) {
      if (celular()) {
        if (sub.parentNode !== topo.parentNode || sub.previousElementSibling !== topo) {
          topo.parentNode.insertBefore(sub, topo.nextSibling);
        }
        classe(sub, "atm-sub--faixa", true);
      } else {
        if (sub.parentNode !== topo) {
          var depois = topo.firstElementChild;
          /* entra depois do primeiro item VISÍVEL da barra (o título ou
             a marca); botões escondidos, como o menu antigo, não contam */
          while (depois && (/atm-menu-cel/.test(depois.className) || getComputedStyle(depois).display === "none")) {
            depois = depois.nextElementSibling;
          }
          topo.insertBefore(sub, depois ? depois.nextSibling : null);
        }
        classe(sub, "atm-sub--faixa", false);
      }
    } else if (sub.parentNode !== document.body) {
      document.body.insertBefore(sub, trilho.nextSibling);
      classe(sub, "atm-sub--faixa", true);
    }
    marcar();
  }

  function marcar() {
    if (!sub) return;
    var lista = originais();
    Array.prototype.forEach.call(sub.children, function (b, i) {
      var v = (lista[i] && ativo(lista[i])) ? "page" : "false";
      if (b.getAttribute("aria-current") !== v) b.setAttribute("aria-current", v);
    });
  }

  /* botão de menu no celular: entra no começo da barra de topo */
  function montarBotaoCel() {
    botaoCel = document.createElement("button");
    botaoCel.type = "button";
    botaoCel.className = "atm-menu-cel";
    botaoCel.setAttribute("aria-label", "Abrir menu");
    botaoCel.setAttribute("aria-controls", "atlasMoldura");
    botaoCel.setAttribute("aria-expanded", "false");
    botaoCel.innerHTML = svg(IC_MENU);
    botaoCel.addEventListener("click", function () { alternar(); });
    posicionarBotaoCel();
  }
  function posicionarBotaoCel() {
    var topo = document.querySelector(".atm-topo-alvo") || (CONF.topo ? document.querySelector(CONF.topo) : null);
    if (topo) {
      if (botaoCel.parentNode !== topo) topo.insertBefore(botaoCel, topo.firstChild);
      classe(botaoCel, "atm-menu-cel--solto", false);
    } else if (botaoCel.parentNode !== document.body) {
      document.body.appendChild(botaoCel);
      classe(botaoCel, "atm-menu-cel--solto", true);
    }
  }

  /* ---------- liga tudo ---------- */
  function iniciar() {
    if (document.querySelector('[data-atlas-ui="moldura"]')) return;
    html.classList.add("atlas-moldura");
    /* o estilo mora em atlas-shell.css; com uma cópia antiga dele em
       cache (o GitHub Pages guarda 10 min), o trilho apareceria cru.
       Sem o estilo, a moldura não liga e o menu antigo fica. */
    if (!getComputedStyle(html).getPropertyValue("--atm-fechado").trim()) {
      html.classList.remove("atlas-moldura");
      return;
    }
    html.setAttribute("data-moldura-mod", MODULE);
    montarTrilho();
    montarBotaoCel();
    definir(celular() ? false : ler(CHAVE_ABERTA) === "1");
    sincronizar();

    /* módulos que redesenham o próprio topo ou as abas (Trade, Mercado)
       tiram o submenu do lugar: um observador o devolve */
    var pendente = false;
    new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () {
        pendente = false;
        posicionarBotaoCel();
        sincronizar();
        /* o Academy troca de aba com replaceState, que não dispara
           hashchange: a mudança de aria-selected chega por aqui */
        marcarGrupos();
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "aria-current"] });

    window.addEventListener("hashchange", function () { requestAnimationFrame(function () { marcar(); marcarGrupos(); }); });
    var eraCel = celular();
    window.addEventListener("resize", function () {
      var agora = celular();
      if (agora === eraCel) return;
      eraCel = agora;
      definir(agora ? false : ler(CHAVE_ABERTA) === "1");
      sincronizar();
    }, { passive: true });
    trilho.addEventListener("click", function (ev) {
      if (celular() && ev.target.closest("a.atm-item, a.atm-grupo__link")) definir(false);
    });
  }

  window.AtlasMoldura = {
    abrir: function () { definir(true); },
    fechar: function () { definir(false); },
    alternar: alternar,
    sincronizar: sincronizar
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
