/* ============================================================
   ATLAS · core/ui/atlas-palette.js
   Ctrl+K — ir a qualquer lugar sem tirar a mão do teclado.

   POR QUE ISTO EXISTE
   -------------------
   O ATLAS tem cinco módulos, oito destinos de menu e umas trinta rotas
   internas. Chegar a "Teses do Trade" a partir do DeFi custa hoje três
   cliques e uma recarga de página. Quem usa o sistema todo dia não
   navega: ele SABE onde quer ir e só precisa de um caminho curto.

   É por isso que toda ferramenta profissional séria tem uma paleta de
   comandos. Não é enfeite — é o que separa um produto que se opera de
   um produto que se visita.

   O QUE ENTRA NA PALETA
   ---------------------
   Três origens, nesta ordem de prioridade:

     1. DESTINOS  — os oito do menu, vindos de AtlasShell.destinos().
                    Uma definição só; a paleta não tem lista própria.
     2. ROTAS     — as telas internas do módulo em que se está, lidas
                    do próprio DOM (os links #/ que o módulo desenhou).
                    Ler o DOM em vez de manter um mapa por módulo
                    significa que uma rota nova aparece aqui sozinha.
     3. AÇÕES     — o que o usuário faria com o mouse: trocar tema,
                    exportar backup, abrir os primeiros passos, criar
                    carteira. Cada uma checa se o serviço existe antes
                    de se oferecer: ação que não funciona não aparece.

   E as TESES entram como conteúdo pesquisável, porque é a única
   entidade compartilhada por todos os módulos e a que o usuário
   procura pelo nome.

   POR QUE A BUSCA É POR SUBSEQUÊNCIA
   ----------------------------------
   "cfg" acha "Configurações", "tst" acha "Teses do Trade". Quem usa
   paleta digita iniciais, não palavras inteiras — exigir prefixo exato
   faria o usuário voltar para o mouse, que é o oposto do objetivo.

   ATALHO
   ------
   Ctrl+K e Cmd+K. Não é Ctrl+P (imprimir), não é Ctrl+F (buscar na
   página): esses o navegador já usa e roubá-los irrita mais do que
   ajuda.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasPalette) return;

  var raiz = null, itens = [], filtrados = [], marcado = 0, liberarFoco = null;

  function t(s) { return (window.AtlasI18n ? AtlasI18n.t(s) : s); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function semAcento(s) {
    s = String(s || "").toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "") : s;
  }

  function base() {
    return (window.AtlasShell && AtlasShell.raiz) ? AtlasShell.raiz() : "";
  }

  /* ---------- catálogo ---------- */

  var IC = {
    ir:    '<path d="M5 12h14M13 6l6 6-6 6"/>',
    tela:  '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8"/>',
    acao:  '<path d="M13 2 4.5 12.5h6L11 22l8.5-10.5h-6z"/>',
    tese:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
  };

  /* Qual dos oito destinos é a página atual. As três telas da raiz
     compartilham data-module="atlas", então o módulo sozinho não
     distingue Dashboard de Relatórios — quem sabe é o data-atlas-nav
     que cada uma marca na própria sidebar. Nos módulos, o data-module
     já é a resposta. */
  function destinoAtual() {
    var nav = document.querySelector("[data-atlas-nav]");
    if (nav) return nav.getAttribute("data-atlas-nav");
    return (window.AtlasShell && AtlasShell.module) ? AtlasShell.module() : "";
  }

  function destinos() {
    if (!window.AtlasShell || !AtlasShell.destinos) return [];
    var b = base();
    var aqui = destinoAtual();
    return AtlasShell.destinos().map(function (m) {
      return {
        grupo: "Ir para",
        titulo: m.label,
        /* O módulo em que já se está não some da lista — some do
           destino. Marcar "atual" é mais honesto do que esconder: o
           usuário procurou por ele e precisa saber que já chegou. */
        nota: (m.id === aqui) ? t("você está aqui") : "",
        icone: m.icon,
        rodar: function () { if (m.id !== aqui) location.href = b + m.href; }
      };
    });
  }

  /* As rotas internas saem do próprio menu do módulo. Nenhum mapa por
     módulo para manter desatualizado: se o Hold ganhar uma tela, ela
     aparece aqui no mesmo dia. */
  /* Onde um módulo guarda a própria navegação. Restringir a estes
     contêineres é o que impede a paleta de engolir todo link da tela —
     um cartão de pool também é um <a>, e ele não é uma "tela". */
  var NAV_SELECTORS = [
    ".topnav .nav-links", ".topnav-inner .nav-links", ".sidebar nav", ".sidebar", "nav.nav", ".nav"
  ];

  function containersDeNav() {
    var out = [];
    NAV_SELECTORS.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (n) {
        if (out.indexOf(n) < 0) out.push(n);
      });
    });
    return out;
  }

  function rotas() {
    var out = [], vistos = {};
    var grupo = (window.AtlasShell && AtlasShell.label) ? AtlasShell.label() : "Módulo";
    var aquiArquivo = location.pathname.split("/").pop() || "index.html";

    function registrar(href, texto, ir) {
      texto = (texto || "").replace(/\s+/g, " ").trim();
      if (!texto || texto.length > 40 || vistos[href]) return;
      vistos[href] = 1;
      out.push({ grupo: grupo, titulo: texto, icone: IC.tela, rodar: ir });
    }

    /* SPA de hash: Hold, Trade, RWA, Academy. */
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#/"]'), function (a) {
      var href = a.getAttribute("href");
      registrar(href, a.textContent, function () { location.hash = href; });
    });

    /* MPA: o DeFi tem sete telas em arquivos separados, e sem isto a
       paleta chegava ao módulo mas não a nenhuma tela dentro dele.
       Só links de navegação, só do mesmo diretório, e a página atual
       fica de fora — ela não é destino. */

    /* A sidebar do shell da raiz também casa com os seletores de
       navegação, e os oito destinos dela JÁ estão no grupo "Ir para" —
       sem esta lista, Relatórios e Configurações apareciam duas vezes
       na mesma paleta. */
    var jaSaoDestino = {};
    if (window.AtlasShell && AtlasShell.destinos) {
      AtlasShell.destinos().forEach(function (d) {
        jaSaoDestino[d.href] = 1;
        jaSaoDestino[d.href.split("/").pop()] = 1;
      });
    }

    containersDeNav().forEach(function (nav) {
      Array.prototype.forEach.call(nav.querySelectorAll("a[href]"), function (a) {
        var href = a.getAttribute("href");
        if (!href || !/\.html$/.test(href)) return;
        if (href.indexOf("/") >= 0 || href.indexOf(":") >= 0) return;   // outro módulo ou externo
        if (href === aquiArquivo || jaSaoDestino[href]) return;
        registrar(href, a.textContent, function () { location.href = href; });
      });
    });

    return out;
  }

  function acoes() {
    var b = base(), out = [];

    function add(titulo, nota, rodar, condicao) {
      if (condicao === false) return;
      out.push({ grupo: "Ação", titulo: titulo, nota: nota || "", icone: IC.acao, rodar: rodar });
    }

    add(t("Alternar tema claro/escuro"), "",
        function () { AtlasSettings.toggleTheme(); },
        !!(window.AtlasSettings && AtlasSettings.toggleTheme));

    ["BRL", "USD", "EUR"].forEach(function (c) {
      add(t("Moeda") + ": " + c, "",
          function () { AtlasSettings.set("currency", c); },
          !!(window.AtlasSettings && AtlasSettings.set));
    });

    add(t("Exportar backup"), t("todos os módulos, em .json"),
        function () { AtlasBackup.download(); },
        !!(window.AtlasBackup && AtlasBackup.download));

    add(t("Nova carteira global"), t("soma no patrimônio total"),
        function () { AtlasWalletDialog.open({ mode: "create", type: "global" }); },
        !!(window.AtlasWalletDialog && AtlasWalletDialog.open));

    add(t("Marcar alertas como lidos"), "",
        function () { AtlasNotifications.markAllRead(); },
        !!(window.AtlasNotifications && AtlasNotifications.markAllRead));

    add(t("Primeiros passos"), t("nome, moeda e carteira"),
        function () { AtlasOnboarding.start(); },
        !!(window.AtlasOnboarding && AtlasOnboarding.start));

    add(t("Imprimir / salvar em PDF"), "",
        function () { AtlasExport.imprimir({ titulo: document.title }); },
        !!(window.AtlasExport && AtlasExport.imprimir));

    return out;
  }

  /* Teses são a única entidade que atravessa os cinco módulos, e a
     única que o usuário procura pelo NOME. Vinte é o teto: a paleta
     serve para chegar rápido, não para listar o acervo. */
  function teses() {
    if (!window.AtlasTheses || !AtlasTheses.all) return [];
    var b = base();
    return (AtlasTheses.all() || []).slice(0, 20).map(function (x) {
      var destino = { hold: "hold/index.html", trade: "trade/index.html",
                      defi: "defi/teses.html", rwa: "RWA/index.html" }[x.module] || "academy/index.html";
      return {
        grupo: "Tese",
        titulo: x.title || t("Sem título"),
        nota: (AtlasTheses.moduleLabel ? AtlasTheses.moduleLabel(x.module) : x.module) + " · " +
              (AtlasTheses.statusLabel ? AtlasTheses.statusLabel(x.status) : x.status),
        icone: IC.tese,
        rodar: function () { location.href = b + destino; }
      };
    });
  }

  function catalogo() {
    return destinos().concat(rotas(), acoes(), teses());
  }

  /* ---------- busca por subsequência ---------- */

  /* Devolve null quando não casa, ou a pontuação (menor = melhor).
     Casar em sequência mais junta vale mais: "cfg" prefere
     "Configurações" a "Carteira · fluxo · global". */
  function pontuar(alvo, termo) {
    var a = semAcento(alvo), q = semAcento(termo);
    if (!q) return 0;
    var i = 0, j = 0, primeiro = -1, ultimo = -1;
    while (i < a.length && j < q.length) {
      if (a[i] === q[j]) {
        if (primeiro < 0) primeiro = i;
        ultimo = i;
        j++;
      }
      i++;
    }
    if (j < q.length) return null;
    /* dispersão + quão tarde começou: os dois empurram para baixo */
    return (ultimo - primeiro) + primeiro * 0.5;
  }

  function filtrar(termo) {
    if (!termo) {
      filtrados = itens.slice(0, 40);
      return;
    }
    var pontuados = [];
    itens.forEach(function (it) {
      var p = pontuar(it.titulo + " " + it.grupo, termo);
      if (p !== null) pontuados.push({ it: it, p: p });
    });
    pontuados.sort(function (x, y) { return x.p - y.p; });
    filtrados = pontuados.slice(0, 40).map(function (x) { return x.it; });
  }

  /* ---------- tela ---------- */

  function pintarLista() {
    var host = raiz.querySelector(".apal__list");
    if (!filtrados.length) {
      host.innerHTML = '<div class="apal__vazio">' + esc(t("Nada encontrado.")) + "</div>";
      return;
    }
    var grupoAtual = null;
    host.innerHTML = filtrados.map(function (it, i) {
      var cabeca = "";
      if (it.grupo !== grupoAtual) {
        grupoAtual = it.grupo;
        cabeca = '<div class="apal__grupo">' + esc(it.grupo) + "</div>";
      }
      return cabeca +
        '<div class="apal__item' + (i === marcado ? " is-on" : "") + '" role="option" ' +
        'aria-selected="' + (i === marcado ? "true" : "false") + '" data-i="' + i + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it.icone + "</svg>" +
          '<span class="apal__titulo">' + esc(it.titulo) + "</span>" +
          (it.nota ? '<span class="apal__nota">' + esc(it.nota) + "</span>" : "") +
        "</div>";
    }).join("");

    var ativo = host.querySelector(".apal__item.is-on");
    if (ativo && ativo.scrollIntoView) ativo.scrollIntoView({ block: "nearest" });
  }

  function mover(passo) {
    if (!filtrados.length) return;
    marcado = (marcado + passo + filtrados.length) % filtrados.length;
    pintarLista();
  }

  function executar() {
    var it = filtrados[marcado];
    if (!it) return;
    fechar();
    /* Fecha ANTES de rodar: várias ações abrem outro diálogo, e dois
       modais empilhados brigam pelo foco. */
    setTimeout(function () { try { it.rodar(); } catch (e) {} }, 10);
  }

  function fechar() {
    if (!raiz) return;
    if (liberarFoco) { try { liberarFoco(); } catch (e) {} liberarFoco = null; }
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
    raiz = null;
  }

  function abrir() {
    if (raiz) { fechar(); return; }

    itens = catalogo();
    marcado = 0;
    filtrar("");

    raiz = document.createElement("div");
    raiz.className = "apal";
    raiz.setAttribute("data-atlas-ui", "palette");
    raiz.innerHTML =
      '<div class="apal__scrim"></div>' +
      '<div class="apal__box" role="dialog" aria-modal="true" aria-label="' + esc(t("Comandos")) + '">' +
        '<div class="apal__campo">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="' + esc(t("Ir para, buscar ou executar…")) + '" ' +
          'role="combobox" aria-expanded="true" aria-controls="apalList">' +
          '<kbd>esc</kbd>' +
        "</div>" +
        '<div class="apal__list" id="apalList" role="listbox"></div>' +
        '<div class="apal__pe">' +
          "<span><kbd>↑</kbd><kbd>↓</kbd> " + esc(t("navegar")) + "</span>" +
          "<span><kbd>enter</kbd> " + esc(t("abrir")) + "</span>" +
        "</div>" +
      "</div>";
    document.body.appendChild(raiz);
    pintarLista();

    var input = raiz.querySelector(".apal__campo input");
    input.addEventListener("input", function () {
      marcado = 0;
      filtrar(input.value);
      pintarLista();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
      else if (e.key === "Enter") { e.preventDefault(); executar(); }
      else if (e.key === "Escape") { e.preventDefault(); fechar(); }
    });

    raiz.querySelector(".apal__list").addEventListener("click", function (e) {
      var alvo = e.target.closest ? e.target.closest(".apal__item") : null;
      if (!alvo) return;
      marcado = +alvo.getAttribute("data-i");
      executar();
    });
    raiz.querySelector(".apal__scrim").addEventListener("click", fechar);

    setTimeout(function () { try { input.focus(); } catch (e) {} }, 20);
    if (window.AtlasUI && AtlasUI.trapFocus) {
      liberarFoco = AtlasUI.trapFocus(raiz.querySelector(".apal__box"));
    }
  }

  /* ---------- atalho ---------- */

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      abrir();
    }
  });

  window.AtlasPalette = { open: abrir, close: fechar, toggle: abrir };
})();
