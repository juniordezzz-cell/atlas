/* ============================================================
   ATLAS · core/ui/atlas-shell.js
   ------------------------------------------------------------
   Itens 1 e 2 do briefing, resolvidos de uma vez nos quatro
   módulos — mesmo eles tendo arquiteturas diferentes.

   O problema
   ----------
   O botão "Voltar ao Atlas" existia em quatro lugares distintos:
     Hold  → dentro da sidebar, abaixo da marca
     Trade → topo da sidebar, acima da navegação
     DeFi  → ponta direita da barra superior
     RWA   → rodapé da sidebar
   E o Oráculo só existia no Trade e no Dashboard.

   A solução
   ---------
   Em vez de reescrever quatro shells (o que quebraria tudo), o
   ATLAS injeta uma faixa própria acima de qualquer layout e
   neutraliza os botões antigos por CSS. Um só componente, um só
   comportamento, uma só posição — funciona em SPA e em MPA.

   O Oráculo segue o mesmo caminho: um componente central com um
   cérebro genérico (baseado na entidade compartilhada de Teses)
   que cada módulo pode enriquecer:

     AtlasOraculo.registerBrain(function (ctx) {
       return { chips: [...], answer: function (q) { ... } };
     });
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasShell) return;

  var MODULE = (window.AtlasBoot && AtlasBoot.module()) ||
               document.documentElement.getAttribute("data-module") || "atlas";

  // A FAIXA superior (item 2) é só para os MÓDULOS — o Dashboard raiz
  // tem sidebar/topbar próprios. O ORÁCULO (item 1), porém, é onipresente:
  // existe em TODOS os módulos E no Dashboard, sempre o mesmo componente.
  var STRIP_ENABLED   = ["hold", "trade", "defi", "rwa", "academy"];
  var ORACULO_ENABLED = ["atlas", "hold", "trade", "defi", "rwa", "academy"];
  if (ORACULO_ENABLED.indexOf(MODULE) === -1) return;

  var WANT_STRIP = STRIP_ENABLED.indexOf(MODULE) !== -1;

  var LABEL = {
    atlas: "ATLAS",
    hold: "HOLD", trade: "TRADE", defi: "DEFI",
    rwa: "RWA", academy: "ACADEMY"
  }[MODULE] || MODULE.toUpperCase();

  // Profundidade da página → caminho correto para o dashboard e para os assets.
  // Módulos vivem um nível abaixo da raiz (hold/, trade/, defi/, RWA/, academy/);
  // o Dashboard raiz está na própria raiz.
  var RAIZ       = (MODULE === "atlas") ? "" : "../";
  var BACK_HREF  = RAIZ + "dashboard.html";
  var ORACULO_AVATAR = RAIZ + "assets/atena.webp";

  function t(s) { return (window.AtlasI18n ? AtlasI18n.t(s) : s); }
  // Escolhe a frase pronta conforme o idioma ativo (respostas dinâmicas do Oráculo)
  function L(pt, en) { return (window.AtlasI18n && AtlasI18n.lang() === "en") ? en : pt; }

  // Strings próprias do shell — para a varredura EN cobrir o Oráculo.
  if (window.AtlasI18n) {
    AtlasI18n.add("en", {
      "Pergunte ao Oráculo…": "Ask the Oracle…",
      "Abrir Oráculo": "Open Oracle",
      "Enviar": "Send",
      "Mensagem": "Message",
      "Como está o módulo?": "How is the module?",
      "Quais teses estão em aberto?": "Which theses are open?",
      "O que preciso revisar?": "What do I need to review?"
    });
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var ICON_BACK =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  /* ============================================================
     1. FAIXA SUPERIOR
     ============================================================ */

  // Onde fica o rodapé "Voltar ao Atlas": cada módulo montou a sidebar do
  // seu jeito, então tentamos os seletores em ordem. O primeiro que existir
  // recebe o botão como ÚLTIMO filho.
  //   hold/academy → .sidebar    ·  RWA → #sidebar    ·  trade → nav.nav
  // O DeFi usa barra horizontal no topo, não tem sidebar: nesse caso o
  // botão nativo dele continua valendo (ver CSS).

  /* ============================================================
     OS DESTINOS DO ATLAS — uma definição, quinze páginas
     ------------------------------------------------------------
     Estes oito itens já estiveram escritos por extenso em três HTMLs
     (com o SVG inteiro de cada ícone), depois viveram em
     js/atlas-nav.js, que só as páginas da raiz carregam. A paleta de
     comandos precisa deles em TODO módulo, e o shell é a única camada
     que roda em todo lugar — então é aqui que a lista mora.

     js/atlas-nav.js consome daqui para desenhar a sidebar.
     ============================================================ */

  var DESTINOS = [
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
    /* Carteiras & Movimentações entra ABAIXO de RWA e ACIMA do
       Academy: os cinco primeiros itens são onde o dinheiro está, e
       esta tela é a que responde onde ele está no total. Academy e
       Relatórios são leitura, não operação. */
    { id: "carteiras", label: "Carteiras", href: "carteiras.html",
      icon: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 8.5h15"/><circle cx="17" cy="13.5" r="1.4"/>' },
    { id: "academy", label: "Academy", href: "academy/index.html",
      icon: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"/>' },
    { id: "relatorios", label: "Relatórios", href: "relatorios.html",
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>' },
    { id: "configuracoes", label: "Configurações", href: "configuracoes.html",
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 12.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.4 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8"/>' }
  ];

  var SIDEBAR_SELECTORS = [
    "#sidebar", ".sidebar", "aside.side", ".rail", "nav.nav", ".nav"
  ];

  function findSidebar() {
    for (var i = 0; i < SIDEBAR_SELECTORS.length; i++) {
      var el = document.querySelector(SIDEBAR_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  function buildBackFoot() {
    var a = document.createElement("a");
    a.className = "atlas-backfoot";
    a.setAttribute("data-atlas-ui", "backfoot");
    a.href = BACK_HREF;
    a.innerHTML = ICON_BACK + "<span>" + esc(t("Voltar ao Atlas")) + "</span>";
    return a;
  }

  /* ------------------------------------------------------------
     O DeFi não tem sidebar — e ficava com o botão fora do padrão

     Hold, Trade, RWA e Academy recebem o "Voltar ao Atlas" no RODAPÉ
     da sidebar: canto inferior esquerdo, o mesmo lugar em todos. O
     DeFi, por ser o único de barra horizontal, ficava sem substituto e
     mantinha o botão nativo na PONTA DIREITA DO TOPO — a única tela do
     sistema com a saída num canto diferente, que é exatamente a
     inconsistência que este componente existe para eliminar.

     Sem sidebar onde encaixar, o botão vira uma âncora fixa no canto
     inferior esquerdo: mesma posição relativa, mesmo desenho, mesmo
     rótulo. A ancoragem é a mesma ideia do Oráculo, do outro lado.
     ------------------------------------------------------------ */
  function mountBackFoot() {
    if (document.querySelector('[data-atlas-ui="backfoot"]')) return;
    var el = buildBackFoot();
    var side = findSidebar();
    if (side) {
      side.setAttribute("data-atlas-sidebar", "on");
      side.appendChild(el);
    } else {
      el.classList.add("atlas-backfoot--solto");
      document.body.appendChild(el);
    }
    // Só agora é seguro esconder os botões nativos: existe um substituto.
    document.documentElement.setAttribute("data-atlas-backfoot", "on");
  }

  /* ============================================================
     2. CÉREBRO DO ORÁCULO
     ------------------------------------------------------------
     Base genérica: a entidade compartilhada de Teses. Qualquer
     módulo pode registrar um cérebro adicional.
     ============================================================ */

  var extraBrains = [];

  /* Dentro de um módulo, as teses DELE. No shell da raiz (Dashboard,
     Relatórios, Configurações), TODAS — a raiz é a visão consolidada e
     não tem teses próprias, então filtrar por module="atlas" devolvia
     sempre lista vazia e o Oráculo respondia "nenhuma tese em aberto"
     com quatro teses abertas no sistema. */
  function theses() {
    if (!window.AtlasTheses) return [];
    try {
      if (MODULE === "atlas" || MODULE === "academy") {
        return (AtlasTheses.all ? AtlasTheses.all() : []) || [];
      }
      return (AtlasTheses.byModule ? AtlasTheses.byModule(MODULE) : []) || [];
    } catch (e) { return []; }
  }

  function countBy(list, status) {
    return list.filter(function (x) { return x && x.status === status; }).length;
  }

  /* ============================================================
     O CÉREBRO DO ORÁCULO
     ------------------------------------------------------------
     Ele nasceu sabendo uma coisa só: teses do módulo atual. Era
     honesto e era pouco — perguntar "quanto eu tenho?" devolvia
     "ainda não sei responder isso" numa tela que mostrava o número
     dois centímetros acima.

     O que mudou não foi o Oráculo: foi o resto do sistema. Hoje
     existem AtlasConsolidation (soma os quatro módulos),
     AtlasNotifications (alertas com estado de lido), AtlasMovements
     (o livro-razão), AtlasWallets e AtlasCurrency — e todos são
     carregados em toda página. O cérebro passa a ler tudo isso.

     O QUE ELE NÃO É
     ---------------
     Não é um chat genérico e não inventa. Cada resposta sai de um
     número que está no armazenamento do usuário; quando não sabe,
     diz o que sabe em vez de improvisar. É a diferença entre um
     assistente e um gerador de texto — e num sistema financeiro é a
     única diferença que importa.
     ============================================================ */

  function dinheiro(v) {
    if (window.AtlasCurrency && AtlasCurrency.format) return AtlasCurrency.format(v, { decimals: 0 });
    return "US$ " + Math.round(v || 0).toLocaleString("pt-BR");
  }

  function consolidado() {
    if (!window.AtlasConsolidation || !AtlasConsolidation.snapshot) return null;
    try { return AtlasConsolidation.snapshot(); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------
     O CAIXA — o que o Oráculo não sabia que existia

     Ele respondia "quanto eu tenho?" com AtlasConsolidation.snapshot(),
     que soma só POSIÇÕES. Depois que o livro de caixa passou a existir,
     metade do dinheiro pode estar parado — e a resposta ficava menor
     que a verdade sem nada indicando.

     Medido: US$ 700 em caixa e US$ 600 em posições, e o Oráculo dizia
     "Patrimônio total: US$ 600". Cinquenta e quatro por cento do
     dinheiro fora da resposta, na pergunta mais direta que existe.
     ------------------------------------------------------------ */
  function caixaGlobal() {
    if (!window.AtlasCaixa || !AtlasCaixa.caixaGlobal) return 0;
    try { return AtlasCaixa.caixaGlobal() || 0; } catch (e) { return 0; }
  }

  function caixaPorCarteira() {
    var W = window.AtlasWallets;
    if (!window.AtlasCaixa || !W || !W.globals) return [];
    try {
      return W.globals().map(function (w) {
        return { nome: w.name, id: w.id, saldo: AtlasCaixa.saldo(w.id) };
      }).filter(function (x) { return x.saldo !== 0; });
    } catch (e) { return []; }
  }

  function alertasAbertos() {
    if (window.AtlasNotifications && AtlasNotifications.list) {
      try { return AtlasNotifications.list() || []; } catch (e) { return []; }
    }
    return [];
  }

  var baseBrain = {
    /* As sugestões mudam com o estado. Oferecer "o que precisa da minha
       atenção" quando não há alerta nenhum é fazer o usuário gastar um
       clique para ouvir "nada". */
    chips: function () {
      var c = [];
      if (alertasAbertos().filter(function (a) { return !a.lido; }).length) {
        c.push("O que precisa da minha atenção?");
      }
      c.push("Quanto eu tenho?");
      /* O caixa decide se dá para abrir posição, então ele é a segunda
         pergunta mais útil — e quando está zerado, é a PRIMEIRA: sem
         ele o sistema inteiro fica travado, e o usuário merece saber
         disso antes de tentar. */
      if (window.AtlasCaixa) {
        c.push(caixaGlobal() ? "Quanto tenho em caixa?" : "Por que não consigo abrir posição?");
      }
      c.push("Quais teses estão em aberto?");
      c.push("Como está o módulo?");
      return c.slice(0, 4);
    },

    summary: function () {
      var list = theses();
      if (!list.length) {
        return L("Módulo " + LABEL + " sem teses registradas ainda. " +
                 "Toda decisão do ATLAS deveria nascer de uma tese — comece por aí.",
                 "Module " + LABEL + " has no theses yet. " +
                 "Every ATLAS decision should start from a thesis — begin there.");
      }
      var andamento = countBy(list, "andamento");
      var planejada = countBy(list, "planejada");
      var concluida = countBy(list, "concluida");
      return L("Módulo " + LABEL + ": " + list.length + " tese(s) — " +
               andamento + " em andamento, " + planejada + " planejada(s), " +
               concluida + " concluída(s).",
               "Module " + LABEL + ": " + list.length + " thesis(es) — " +
               andamento + " in progress, " + planejada + " planned, " +
               concluida + " completed.");
    },

    pending: function () {
      return theses().filter(function (x) {
        return x && x.status !== "concluida" && x.status !== "arquivada";
      });
    },

    /* ---- o que ele passou a saber ---- */

    /* Patrimônio = CAIXA + POSIÇÕES. Ver caixaGlobal() acima sobre o
       que esta função respondia antes. */
    patrimonio: function () {
      var s = consolidado();
      if (!s) return L("Não consigo somar os módulos a partir desta tela.",
                       "I can't consolidate the modules from this screen.");
      var caixa = caixaGlobal();
      var total = s.total + caixa;

      if (!total) {
        return L("Patrimônio zerado — nada registrado ainda. O dinheiro entra no ATLAS " +
                 "por um Depósito em Carteiras & Movimentações; a partir dele você abre " +
                 "posição em Hold, Trade, DeFi ou RWA.",
                 "Net worth is zero. Money enters ATLAS through a Deposit in Wallets.");
      }

      var partes = s.byModule.map(function (m) {
        return m.label + " " + dinheiro(m.value) + " (" + Math.round((m.value / total) * 100) + "%)";
      });
      if (caixa) {
        partes.unshift(L("caixa livre ", "free cash ") + dinheiro(caixa) +
                       " (" + Math.round((caixa / total) * 100) + "%)");
      }
      var sinal = s.pnl >= 0 ? "+" : "";
      return L("Patrimônio total: " + dinheiro(total) + " — " + dinheiro(caixa) +
               " em caixa e " + dinheiro(s.total) + " alocado. Resultado acumulado " +
               sinal + dinheiro(s.pnl) + " (" + sinal + s.pnlPct.toFixed(1) + "%). " +
               "Distribuição: " + partes.join(", ") + ".",
               "Total net worth: " + dinheiro(total) + " — " + dinheiro(caixa) +
               " in cash and " + dinheiro(s.total) + " allocated. Accumulated result " +
               sinal + dinheiro(s.pnl) + " (" + sinal + s.pnlPct.toFixed(1) + "%). " +
               "Split: " + partes.join(", ") + ".");
    },

    /* ------------------------------------------------------------
       CAIXA — a pergunta que o sistema passou a permitir

       "Quanto tenho disponível?" caía na regex de patrimônio e recebia
       o número das posições: a resposta exata do contrário do que foi
       perguntado. E o caixa é agora o que decide se dá para abrir
       posição, então é a pergunta mais operacional do ATLAS.
       ------------------------------------------------------------ */
    caixa: function () {
      if (!window.AtlasCaixa) {
        return L("O livro de caixa não está disponível nesta tela.",
                 "The cash ledger isn't available on this screen.");
      }
      var total = caixaGlobal();
      var porCarteira = caixaPorCarteira();

      if (!total && !porCarteira.length) {
        return L("Nenhum caixa disponível. Nenhuma posição pode ser aberta até entrar " +
                 "dinheiro: registre um Depósito em Carteiras & Movimentações.",
                 "No cash available. No position can be opened until money comes in.");
      }
      var det = porCarteira.map(function (c) {
        return c.nome + " " + dinheiro(c.saldo);
      }).join(", ");
      var negativa = porCarteira.filter(function (c) { return c.saldo < 0; });

      return L("Caixa disponível: " + dinheiro(total) +
               (det ? " — " + det + "." : ".") +
               " É daqui que sai o capital de qualquer posição nova." +
               (negativa.length
                 ? " ⚠ " + negativa.length + " carteira(s) com caixa negativo — há posição " +
                   "aberta sem depósito que a cubra."
                 : ""),
               "Available cash: " + dinheiro(total) + (det ? " — " + det + "." : "."));
    },

    atencao: function () {
      var todos = alertasAbertos();
      if (!todos.length) {
        return L("Nada pedindo atenção agora — sem alerta em nenhum dos quatro módulos.",
                 "Nothing needs attention right now.");
      }
      /* No máximo três: resposta de dez linhas é resposta que ninguém lê
         até o fim, e o sino guarda a lista inteira. */
      var texto = todos.slice(0, 3).map(function (a) {
        return "• " + (a.module ? String(a.module).toUpperCase() + ": " : "") + a.texto;
      }).join(" ");
      var resto = todos.length > 3
        ? L(" (+" + (todos.length - 3) + " no sino)", " (+" + (todos.length - 3) + " in the bell)")
        : "";
      return L(todos.length + " ponto(s) de atenção. " + texto + resto,
               todos.length + " item(s) need attention. " + texto + resto);
    },

    carteiras: function () {
      var W = window.AtlasWallets;
      if (!W || !W.all) return L("Não consigo ler as carteiras daqui.", "Can't read wallets from here.");
      var todas = W.all() || [];
      var globais = todas.filter(function (w) { return w.type !== "isolada"; });
      var locais = todas.length - globais.length;
      var ativa = (W.activeGlobal ? W.activeGlobal() : null);
      return L(todas.length + " carteira(s): " + globais.length + " global(is), que somam no " +
               "patrimônio total, e " + locais + " isolada(s), que ficam dentro do módulo. " +
               (ativa ? "Ativa agora: " + ativa.name + "." : ""),
               todas.length + " wallet(s): " + globais.length + " global, " + locais + " isolated. " +
               (ativa ? "Active: " + ativa.name + "." : ""));
    },

    fluxo: function () {
      var M = window.AtlasMovements;
      if (!M || !M.list) return L("O livro-razão não está disponível nesta tela.",
                                  "The ledger isn't available on this screen.");
      /* Sem walletId, list() soma TODAS as carteiras — e a pessoa está
         olhando uma. O extrato da tela de Relatórios é por carteira;
         responder o consolidado aqui seria outro número com o mesmo
         nome. */
      var W = window.AtlasWallets;
      var ativa = (W && W.activeGlobal) ? W.activeGlobal() : null;
      var lista = M.list(ativa ? { walletId: ativa.id } : {});
      if (!lista.length) {
        return L("Nenhum movimento registrado ainda. Entradas, saídas e resultados " +
                 "aparecem em Relatórios assim que existirem.",
                 "No movements recorded yet.");
      }
      var r = M.summarize(lista);
      var onde = ativa ? L(" em " + ativa.name, " in " + ativa.name) : "";
      return L(r.count + " movimento(s)" + onde + ": entradas " + dinheiro(r.entrada) + ", saídas " +
               dinheiro(r.saida) + ", resultado " + dinheiro(r.resultado) +
               ". Fluxo líquido " + dinheiro(r.net) + ".",
               r.count + " movement(s): inflows " + dinheiro(r.entrada) + ", outflows " +
               dinheiro(r.saida) + ", result " + dinheiro(r.resultado) +
               ". Net flow " + dinheiro(r.net) + ".");
    },

    answer: function (q) {
      q = (q || "").toLowerCase();

      /* A ordem importa: "quanto tenho em teses abertas" é pergunta
         sobre teses, não sobre patrimônio. O padrão mais específico
         vem primeiro. */

      if (/tese|thesis|estud|aberto|open|pendent|pending|andamento|progress/.test(q)) {
        var p = baseBrain.pending();
        if (!p.length) return L("Nenhuma tese em aberto no " + LABEL + ". Fluxo em dia.",
                                "No open theses in " + LABEL + ". All caught up.");
        var untitled = L("sem título", "untitled");
        var listStr = p.map(function (x) { return (x.asset ? x.asset + " — " : "") + (x.title || untitled); }).join("; ");
        return L(p.length + " tese(s) em aberto: " + listStr + ".",
                 p.length + " open thesis(es): " + listStr + ".");
      }

      if (/revis|review|atras|overdue|parad|stalled/.test(q)) {
        var old = baseBrain.pending().filter(function (x) {
          if (!x.createdAt) return false;
          return (Date.now() - new Date(x.createdAt).getTime()) > 72 * 3600 * 1000;
        });
        if (!old.length) return L("Nada além do prazo de 72h. Processo em dia.",
                                  "Nothing past the 72h mark. Process is on track.");
        return L(old.length + " tese(s) abertas há mais de 72h — vale concluir ou arquivar.",
                 old.length + " thesis(es) open for over 72h — worth completing or archiving.");
      }

      if (/aten|alerta|alert|risco|risk|problema|urgent/.test(q)) return baseBrain.atencao();

      /* ------------------------------------------------------------
         CAIXA VEM ANTES DE PATRIMÔNIO

         "saldo" estava na regex de patrimônio, então "qual é o meu
         saldo?" respondia com o valor das POSIÇÕES — o número que
         justamente não é saldo. O padrão mais específico tem de vir
         primeiro, mesma regra que já vale para "tese" acima.
         ------------------------------------------------------------ */
      if (/caixa|dispon|livre|parado|cash|free|deposit|dep.sit|sacar|saque|withdraw|transfer/.test(q)) {
        return baseBrain.caixa();
      }

      if (/quanto|patrim|total|net worth|saldo|worth|vale/.test(q)) return baseBrain.patrimonio();

      /* "por que não consigo abrir?" é a dúvida que a trava do caixa
         cria, e o Oráculo é onde a pessoa pergunta antes de procurar
         documentação. */
      if (/n.o consigo|nao consigo|por que n|why can|bloque|recus|insuficien|abrir posi/.test(q)) {
        var c = caixaGlobal();
        return L("Toda posição sai do caixa de uma carteira, e carteira sem caixa não abre " +
                 "posição — em módulo nenhum. Você tem " + dinheiro(c) + " disponível. " +
                 "Se faltar, registre um Depósito em Carteiras & Movimentações; se o dinheiro " +
                 "estiver em outra carteira, use Transferência.",
                 "Every position comes out of a wallet's cash, and a wallet with no cash " +
                 "can't open one. You have " + dinheiro(c) + " available.");
      }

      if (/carteira|wallet|conta/.test(q)) return baseBrain.carteiras();

      if (/movimento|fluxo|flow|entrada|sa.da|aporte|retirada|extrato/.test(q)) return baseBrain.fluxo();

      if (/lucro|resultado|pnl|rentab|performance|ganho|preju/.test(q)) {
        var s = consolidado();
        if (!s || !s.total) return baseBrain.patrimonio();
        var sinal = s.pnl >= 0 ? "+" : "";
        return L("Resultado acumulado: " + sinal + dinheiro(s.pnl) + " (" + sinal +
                 s.pnlPct.toFixed(1) + "%) sobre o capital investido. " +
                 "Renda passiva estimada: " + dinheiro(s.passiveIncome) + ".",
                 "Accumulated result: " + sinal + dinheiro(s.pnl) + " (" + sinal +
                 s.pnlPct.toFixed(1) + "%). Estimated passive income: " +
                 dinheiro(s.passiveIncome) + ".");
      }

      if (/modul|module|resum|summary|status|como est|how is/.test(q)) return baseBrain.summary();

      if (/moeda|currency|dolar|dollar|dólar|real|câmbio|cambio|exchange/.test(q) && window.AtlasCurrency) {
        return L("Exibindo em " + AtlasCurrency.code() + ". Os dados continuam " +
                 "armazenados em USD — a moeda é só a camada de leitura.",
                 "Showing in " + AtlasCurrency.code() + ". Data is still stored " +
                 "in USD — currency is only the display layer.");
      }

      if (/backup|export|salvar|perder|guardar/.test(q)) {
        return L("Seus dados vivem no armazenamento deste navegador — trocar de máquina " +
                 "ou limpar os dados de navegação apaga tudo. Exporte em Configurações → " +
                 "Dados e Backup, ou pelo Ctrl+K.",
                 "Your data lives in this browser's storage. Export it in " +
                 "Settings → Data and Backup, or via Ctrl+K.");
      }

      /* Não saber é aceitável; deixar o usuário no escuro não é. A
         resposta padrão ENSINA o que dá para perguntar. */
      return L("Ainda não sei responder isso. Sei falar de patrimônio, caixa disponível, " +
               "resultado, teses, pendências, carteiras, movimentos e moeda — sempre a " +
               "partir dos seus próprios dados, nunca de um chat genérico. " +
               "Ctrl+K abre a paleta, se você quiser ir direto a uma tela.",
               "I can't answer that yet. I can talk about net worth, result, theses, " +
               "pending items, wallets, movements and currency — always from your own " +
               "data. Ctrl+K opens the command palette.");
    },

    /* ------------------------------------------------------------
       O SELO CONTA ALERTA, E SÓ ALERTA

       Era `naoLidos || pending().length`: sem nenhum alerta, o número
       no selo virava a quantidade de TESES ABERTAS. Duas grandezas
       diferentes no mesmo lugar — o usuário via "3" e não tinha como
       saber se eram três problemas ou três teses em andamento, que é
       estado normal e saudável.
       ------------------------------------------------------------ */
    alerts: function () {
      return alertasAbertos().filter(function (a) { return !a.lido; }).length;
    }
  };

  function resolveBrain() {
    var brain = {
      /* chips virou FUNÇÃO no cérebro base porque as sugestões mudam com
         o estado (ter ou não alerta). Aqui vira lista de novo, avaliada
         na hora de montar — os cérebros de módulo continuam podendo
         entregar um array simples, como sempre entregaram. */
      chips: (typeof baseBrain.chips === "function") ? baseBrain.chips() : baseBrain.chips.slice(),
      answer: baseBrain.answer,
      summary: baseBrain.summary,
      alerts: baseBrain.alerts
    };
    extraBrains.forEach(function (factory) {
      var ext;
      try { ext = factory({ module: MODULE, theses: theses }); }
      catch (e) { return; }
      if (!ext) return;
      if (ext.chips) brain.chips = ext.chips.concat(brain.chips).slice(0, 4);
      if (ext.answer) {
        var prev = brain.answer;
        brain.answer = function (q) {
          var r;
          try { r = ext.answer(q); } catch (e) { r = null; }
          return (r == null || r === "") ? prev(q) : r;
        };
      }
      if (ext.summary) brain.summary = ext.summary;
      if (ext.alerts) brain.alerts = ext.alerts;
    });
    return brain;
  }

  /* ============================================================
     3. ORÁCULO — componente
     ============================================================ */

  var oraculoEl = null;

  function buildOraculo() {
    var brain = resolveBrain();

    var wrap = document.createElement("div");
    wrap.className = "atlas-oraculo";
    wrap.setAttribute("data-atlas-ui", "oraculo");
    wrap.setAttribute("data-open", "false");
    wrap.innerHTML =
      '<div class="atlas-oraculo__panel" role="dialog" aria-label="Oráculo">' +
        '<div class="atlas-oraculo__head">' +
          '<span class="atlas-oraculo__badge"><i></i></span>' +
          '<div><h3>' + esc(t("Oráculo")) + '</h3>' +
          '<p>' + esc(LABEL) + '</p></div>' +
          '<button class="atlas-oraculo__close" aria-label="' + esc(t("Fechar")) + '">' + ICON_CLOSE + '</button>' +
        '</div>' +
        '<div class="atlas-oraculo__log"></div>' +
        '<div class="atlas-oraculo__chips">' +
          brain.chips.map(function (c) {
            return '<button class="atlas-oraculo__chip" data-q="' + esc(c) + '">' + esc(t(c)) + '</button>';
          }).join("") +
        '</div>' +
        '<div class="atlas-oraculo__composer">' +
          '<input class="atlas-oraculo__input" placeholder="' + esc(t("Pergunte ao Oráculo…")) + '" aria-label="' + esc(t("Mensagem")) + '">' +
          '<button class="atlas-oraculo__send" aria-label="' + esc(t("Enviar")) + '">' + ICON_SEND + '</button>' +
        '</div>' +
      '</div>' +
      // Gatilho = avatar do Oráculo (idêntico ao do Dashboard). Se a imagem
      // falhar, o botão cai para um núcleo luminoso (sem quebrar / sem vazio).
      '<button class="atlas-oraculo__orb" aria-label="' + esc(t("Abrir Oráculo")) + '" title="' + esc(t("Oráculo")) + '">' +
        '<img class="atlas-oraculo__avatar" src="' + esc(ORACULO_AVATAR) + '" alt="' + esc(t("Oráculo")) + '" ' +
             'onerror="this.style.display=&quot;none&quot;;this.parentNode.classList.add(&quot;atlas-oraculo__orb--fallback&quot;)">' +
        '<span class="atlas-oraculo__aura"></span>' +
        '<span class="atlas-oraculo__pin" hidden></span>' +
      '</button>';

    var log = wrap.querySelector(".atlas-oraculo__log");
    var input = wrap.querySelector(".atlas-oraculo__input");

    function push(text, who) {
      var m = document.createElement("div");
      m.className = "atlas-oraculo__msg atlas-oraculo__msg--" + who;
      m.textContent = text;
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    }
    function ask(q) {
      if (!q) return;
      setOpen(true);
      push(q, "user");
      setTimeout(function () { push(brain.answer(q), "bot"); }, 240);
    }
    function setOpen(v) { wrap.setAttribute("data-open", v ? "true" : "false"); }

    wrap.querySelector(".atlas-oraculo__orb").addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(wrap.getAttribute("data-open") !== "true");
    });
    wrap.querySelector(".atlas-oraculo__close").addEventListener("click", function () { setOpen(false); });
    wrap.querySelector(".atlas-oraculo__send").addEventListener("click", function () {
      var v = input.value.trim(); input.value = ""; ask(v);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var v = input.value.trim(); input.value = ""; ask(v); }
    });
    wrap.querySelectorAll(".atlas-oraculo__chip").forEach(function (c) {
      c.addEventListener("click", function () { ask(c.getAttribute("data-q")); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    push(brain.summary(), "bot");

    var n = brain.alerts();
    var pin = wrap.querySelector(".atlas-oraculo__pin");
    if (n > 0) { pin.hidden = false; pin.textContent = n; }

    wrap._ask = ask;
    wrap._setOpen = setOpen;
    return wrap;
  }

  /* ============================================================
     4. Montagem resistente
     ------------------------------------------------------------
     O Hold faz document.body.innerHTML = "" ao construir o shell.
     Por isso a montagem observa o body e se reinjeta quando some.
     ============================================================ */

  /* ============================================================
     ATALHO "PULAR PARA O CONTEÚDO"
     ------------------------------------------------------------
     Toda página do ATLAS abre com uma barra lateral de oito itens.
     Quem navega por teclado tinha de passar por todos eles em CADA
     troca de tela antes de chegar ao conteúdo — e não havia nenhum
     skip link nas 19 páginas.

     O link fica invisível até receber foco, que é o comportamento
     esperado: aparece para quem usa Tab e não ocupa espaço para
     quem usa mouse.
     ============================================================ */

  var ALVOS_CONTEUDO = [
    "main.main", "main.view", "main.app", "#app", ".view__inner", ".view", "main"
  ];

  function mountSkipLink() {
    if (document.querySelector('[data-atlas-ui="skip"]')) return;

    var alvo = null;
    for (var i = 0; i < ALVOS_CONTEUDO.length && !alvo; i++) {
      alvo = document.querySelector(ALVOS_CONTEUDO[i]);
    }
    if (!alvo) return;                       // página sem área de conteúdo definida

    if (!alvo.id) alvo.id = "atlasConteudo";
    /* tabindex -1 para o alvo poder RECEBER o foco ao pular; sem isso
       o link move só a rolagem e o teclado continua na navegação */
    if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");

    var a = document.createElement("a");
    a.className = "atlas-skip";
    a.setAttribute("data-atlas-ui", "skip");
    a.href = "#" + alvo.id;
    a.textContent = t("Pular para o conteúdo");
    a.addEventListener("click", function () {
      try { alvo.focus(); } catch (e) {}
    });
    document.body.insertBefore(a, document.body.firstChild);
  }


  /* ============================================================
     3b. ALTERNADOR DE TEMA NA BARRA SUPERIOR
     ------------------------------------------------------------
     O tema claro existia desde sempre, mas só se chegava a ele
     por Configurações → Aparência. Um tema que custa três cliques
     é um tema que ninguém experimenta — e, por consequência, um
     tema que ninguém reporta quando quebra.

     O botão entra pelo shell, e não por cada módulo, pela mesma
     razão do "Voltar ao Atlas": um lugar só, um comportamento só.
     Ele procura o agrupamento à direita da barra de cada módulo e,
     se não achar, a própria barra. Página sem barra simplesmente
     não recebe o botão — nada quebra.
     ============================================================ */

  var TOPBAR_SELECTORS = [
    ".topbar-right", ".topnav-inner", ".tb-actions",
    "header.topbar", "header.topnav", ".topbar", ".topnav"
  ];

  function findTopbar() {
    for (var i = 0; i < TOPBAR_SELECTORS.length; i++) {
      var el = document.querySelector(TOPBAR_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  function icone(nome) {
    if (window.AtlasIcons) return AtlasIcons.get(nome, { size: 18 });
    return "";
  }

  function pintarBotaoTema(btn) {
    var claro = document.documentElement.getAttribute("data-theme") === "light";
    /* Mostra o DESTINO, não o estado atual: no claro exibe a lua, que é
       para onde o clique leva. É a convenção que o usuário já conhece de
       outros produtos, e evita a dúvida "isto indica ou executa?". */
    btn.innerHTML = icone(claro ? "moon" : "sun");
    btn.setAttribute("aria-label", claro ? t("Ativar tema escuro") : t("Ativar tema claro"));
    btn.setAttribute("title", btn.getAttribute("aria-label"));
    btn.setAttribute("aria-pressed", claro ? "true" : "false");
  }


  /* ============================================================
     3c. O SINO — central de alertas, em todos os módulos
     ------------------------------------------------------------
     O sino existia só no shell da raiz, lia uma lista que só o
     Dashboard montava, e não tinha estado de lido: a bolinha
     acendia enquanto o alerta existisse. Um alerta permanente
     deixava a bolinha acesa para sempre, e bolinha que nunca
     apaga é bolinha que ninguém olha.

     Agora ele nasce aqui, como o "Voltar ao Atlas" e o alternador
     de tema: um lugar, um comportamento. Se a página já tem um
     botão de notificações (o shell da raiz tem), ele é ADOTADO em
     vez de duplicado. Os dados vêm de AtlasNotifications, que soma
     os quatro módulos e funciona em qualquer página.
     ============================================================ */

  var IC_SINO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>' +
    '<path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

  function notificacoes() { return window.AtlasNotifications; }

  function pintarSino(raiz) {
    var N = notificacoes();
    var lista = N ? N.list() : [];
    var naoLidos = lista.filter(function (a) { return !a.lido; }).length;

    var btn = raiz.querySelector(".atlas-bell__btn");
    btn.setAttribute("aria-label",
      naoLidos ? (naoLidos + " " + t(naoLidos === 1 ? "alerta não lido" : "alertas não lidos"))
               : t("Alertas"));
    /* A contagem entra no próprio selo, não numa bolinha muda: "3" diz
       mais do que um ponto aceso, e some quando não há nada. */
    var selo = raiz.querySelector(".atlas-bell__n");
    selo.textContent = naoLidos > 9 ? "9+" : String(naoLidos || "");
    selo.hidden = !naoLidos;

    var pop = raiz.querySelector(".atlas-bell__pop");
    var corpo;
    if (lista.length) {
      corpo = '<div class="atlas-bell__list" role="list">' + lista.map(function (a) {
        return '<div class="atlas-bell__item' + (a.lido ? "" : " is-new") +
                 ' atlas-bell__item--' + esc(a.level) + '" role="listitem">' +
          '<span class="atlas-bell__dot" aria-hidden="true"></span>' +
          '<div class="atlas-bell__txt">' + esc(a.texto) + '</div>' +
          '<div class="atlas-bell__meta">' +
            (a.module ? '<span class="atlas-bell__mod">' + esc(a.module) + "</span>" : "") +
            "<span>" + esc(a.quando) + "</span>" +
          "</div>" +
        "</div>";
      }).join("") + "</div>" +
      (naoLidos ? '<button type="button" class="atlas-bell__all" data-lidas>' +
                    esc(t("Marcar todas como lidas")) + "</button>" : "");
    } else {
      corpo = '<div class="atlas-bell__empty">' +
        "<strong>" + esc(t("Nenhum alerta")) + "</strong>" +
        "<span>" + esc(t("Os alertas aparecem quando uma posição ou tese pedir atenção.")) + "</span>" +
      "</div>";
    }
    pop.innerHTML = '<div class="atlas-bell__head">' + esc(t("Alertas")) + "</div>" + corpo;

    var todas = pop.querySelector("[data-lidas]");
    if (todas) {
      todas.addEventListener("click", function (e) {
        e.stopPropagation();
        if (notificacoes()) AtlasNotifications.markAllRead();
      });
    }
  }

  function mountBell() {
    if (!notificacoes()) return;                 // sem serviço, sem sino
    if (document.querySelector('[data-atlas-ui="bell"]')) return;
    var barra = findTopbar();
    if (!barra) return;

    var raiz = document.createElement("div");
    raiz.className = "atlas-bell";
    raiz.setAttribute("data-atlas-ui", "bell");
    raiz.innerHTML =
      '<button type="button" class="atlas-bell__btn">' + IC_SINO +
        '<span class="atlas-bell__n" hidden></span>' +
      "</button>" +
      '<div class="atlas-bell__pop" role="dialog" aria-label="' + esc(t("Alertas")) + '"></div>';

    /* Adota o botão nativo do shell da raiz em vez de somar um segundo
       sino ao lado dele. */
    var nativo = document.querySelector('.icon-btn[title="Notificações"], .icon-btn[aria-label="Notificações"]');
    if (nativo && nativo.parentNode) nativo.parentNode.removeChild(nativo);

    /* Antes do alternador de tema, se ele já estiver montado: alerta é
       conteúdo, tema é preferência — conteúdo vem primeiro. */
    var tema = barra.querySelector('[data-atlas-ui="theme"]');
    if (tema) barra.insertBefore(raiz, tema); else barra.appendChild(raiz);

    pintarSino(raiz);

    var btn = raiz.querySelector(".atlas-bell__btn");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var abrindo = !raiz.hasAttribute("data-open");
      fecharSinos();
      if (abrindo) {
        raiz.setAttribute("data-open", "");
        /* Abrir É ler. Marcar ao fechar faria a bolinha continuar acesa
           enquanto o usuário lê, e apagar só depois — confuso. */
        if (notificacoes()) AtlasNotifications.markAllRead();
      }
    });
    document.addEventListener("click", function (ev) {
      if (!raiz.contains(ev.target)) raiz.removeAttribute("data-open");
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") raiz.removeAttribute("data-open");
    });

    if (notificacoes()) {
      AtlasNotifications.onChange(function () { pintarSino(raiz); });
    }
    /* Alertas mudam quando um movimento entra ou uma tese muda de
       estado. Repintar nesses eventos evita um sino que só acerta
       depois de recarregar a página. */
    document.addEventListener("atlas:movement", function () { pintarSino(raiz); });
    document.addEventListener("atlas:theses", function () { pintarSino(raiz); });
  }

  function fecharSinos() {
    var abertos = document.querySelectorAll('[data-atlas-ui="bell"][data-open]');
    Array.prototype.forEach.call(abertos, function (n) { n.removeAttribute("data-open"); });
  }


  /* ============================================================
     3d. A DICA DO Ctrl+K
     ------------------------------------------------------------
     Atalho que ninguém descobre é atalho que não existe. Um botão
     discreto na barra abre a mesma paleta e, de quebra, ENSINA a
     tecla — que é o trabalho de verdade dele. Some no celular,
     onde não há teclado para o atalho.
     ============================================================ */

  function mountPaletteHint() {
    if (!window.AtlasPalette) return;
    if (document.querySelector('[data-atlas-ui="palettehint"]')) return;
    var barra = findTopbar();
    if (!barra) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "atlas-cmdk";
    btn.setAttribute("data-atlas-ui", "palettehint");
    btn.setAttribute("aria-label", t("Abrir comandos"));
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      "<kbd>Ctrl</kbd><kbd>K</kbd>";
    btn.addEventListener("click", function () { AtlasPalette.open(); });

    var sino = barra.querySelector('[data-atlas-ui="bell"]');
    if (sino) barra.insertBefore(btn, sino); else barra.appendChild(btn);
  }

  function mountThemeToggle() {
    if (!window.AtlasSettings) return;              // sem estado, sem botão
    if (document.querySelector('[data-atlas-ui="theme"]')) return;
    var barra = findTopbar();
    if (!barra) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "atlas-theme-toggle";
    btn.setAttribute("data-atlas-ui", "theme");
    pintarBotaoTema(btn);
    btn.addEventListener("click", function () {
      AtlasSettings.toggleTheme();
      pintarBotaoTema(btn);
    });
    barra.appendChild(btn);

    /* Quem trocar o tema por outro caminho (Configurações, outra aba)
       tem de ver o ícone acompanhar. AtlasSettings avisa. */
    if (AtlasSettings.on) {
      AtlasSettings.on(function (changed) {
        if (!changed || changed.indexOf("theme") >= 0) pintarBotaoTema(btn);
      });
    }
  }

  function mount() {
    if (!document.body) return;

    mountSkipLink();
    mountPaletteHint();
    mountBell();
    mountThemeToggle();

    // A faixa escura no topo foi REMOVIDA (item 6). No lugar dela, cada
    // módulo recebe um "Voltar ao Atlas" no rodapé da própria sidebar.
    if (WANT_STRIP) {
      document.documentElement.setAttribute("data-atlas-shell", "on");
      mountBackFoot();
      // resquício de versões anteriores: se a faixa ainda existir, remove
      var velha = document.querySelector('[data-atlas-ui="topstrip"]');
      if (velha && velha.parentNode) velha.parentNode.removeChild(velha);
    } else {
      // Marca leve (não dispara as regras de módulo) — útil p/ escopo de CSS.
      document.documentElement.setAttribute("data-atlas-oraculo", "on");
    }

    // Oráculo: onipresente, mesmo componente em todo lugar.
    var existing = document.querySelector('[data-atlas-ui="oraculo"]');
    if (!existing) {
      oraculoEl = buildOraculo();
      document.body.appendChild(oraculoEl);
    } else {
      anchorGuard(existing);
    }
  }

  /* ============================================================
     GUARD DE ANCORAGEM

     "position: fixed" para de valer se QUALQUER ancestral tiver
     transform, filter, perspective, backdrop-filter, will-change
     ou contain. Nesse caso o botão passa a rolar junto com a
     página — foi exatamente o sintoma relatado.

     O CSS não tem como se defender disso. Então aqui a gente
     checa em tempo real: se o botão não for filho direto do
     <body>, ou se algum ancestral criar um bloco de contenção,
     reancoramos no <body>.
     ============================================================ */

  function breaksFixed(el) {
    if (!window.getComputedStyle) return false;
    var s = getComputedStyle(el);
    return (s.transform && s.transform !== "none") ||
           (s.filter && s.filter !== "none") ||
           (s.perspective && s.perspective !== "none") ||
           (s.backdropFilter && s.backdropFilter !== "none") ||
           (s.willChange && /transform|filter|perspective/.test(s.willChange)) ||
           (s.contain && /paint|layout|strict|content/.test(s.contain));
  }

  function anchorGuard(el) {
    if (!el) return;

    // 1. precisa ser filho direto do <body>
    if (el.parentNode !== document.body) {
      document.body.appendChild(el);
      return;
    }

    // 2. nenhum ancestral pode capturar o "fixed"
    var p = el.parentElement, culpado = null;
    while (p && p !== document.documentElement) {
      if (breaksFixed(p)) { culpado = p; break; }
      p = p.parentElement;
    }
    if (culpado && window.console) {
      console.warn(
        "[AtlasShell] O botão do Oráculo está preso num elemento que quebra " +
        "position:fixed (transform/filter/contain). Elemento:", culpado
      );
    }
  }

  /* ============================================================
     TRAVA DE POSIÇÃO (à prova de causa desconhecida)

     O CSS diz position:fixed, o elemento é filho do <body> e mesmo
     assim ele rolava junto com a página. Em vez de continuar
     caçando qual regra faz isso, medimos o resultado.

     A cada scroll, comparamos onde o botão ESTÁ com onde ele
     DEVERIA estar (canto inferior direito da janela). Se a
     diferença passar de 2px, o "fixed" não está valendo — então
     assumimos o controle e posicionamos em coordenadas de página,
     acompanhando o scroll na mão.

     Custo: uma medição por frame de scroll, só enquanto houver
     desvio. Se o fixed funcionar, isso nunca liga.
     ============================================================ */

  var PIN_GAP = 24;          // mesma folga do CSS (--atlas-sp-6)
  var pinned = false;
  var pinTick = null;

  // Medições seguidas em que o fixed se comportou. Passando de
  // CLEAN_ENOUGH, largamos os listeners de scroll: não há motivo para
  // medir a cada frame de rolagem pelo resto da sessão.
  var cleanChecks = 0;
  var CLEAN_ENOUGH = 8;

  function viewportGap() {
    return window.innerWidth <= 720 ? 16 : PIN_GAP;
  }

  /* O retângulo contra o qual o position:fixed realmente resolve: o
     viewport SEM as barras de rolagem. window.innerWidth/innerHeight
     INCLUEM a barra — era essa a origem do falso positivo. Em toda
     página com scroll vertical, innerWidth vinha ~10-17px maior que a
     área onde o "right: 24px" pousa o botão, o desvio estourava os 2px
     de tolerância e a trava ligava à toa. */
  function viewportBox() {
    var doc = document.documentElement;
    return { w: doc.clientWidth, h: doc.clientHeight };
  }

  /* Folga real, lida do próprio CSS, em vez de repetir aqui o
     breakpoint e os tokens do tema. Cai no padrão se vier "auto"
     (é o que acontece depois que a trava assume, com position:absolute). */
  function cssGap(el) {
    var fb = viewportGap();
    var cs = window.getComputedStyle ? getComputedStyle(el) : null;
    var right  = cs ? parseFloat(cs.right)  : NaN;
    var bottom = cs ? parseFloat(cs.bottom) : NaN;
    return {
      right:  isFinite(right)  ? right  : fb,
      bottom: isFinite(bottom) ? bottom : fb
    };
  }

  function checkPin() {
    var el = document.querySelector('[data-atlas-ui="oraculo"]');
    if (!el || !el.getBoundingClientRect) return;

    var vp = viewportBox();
    var r  = el.getBoundingClientRect();

    if (!pinned) {
      var gap = cssGap(el);
      var desvioBaixo = Math.abs((vp.h - r.bottom) - gap.bottom);
      var desvioDir   = Math.abs((vp.w - r.right)  - gap.right);

      if (desvioBaixo <= 2 && desvioDir <= 2) {
        // fixed está valendo: nada a fazer
        if (++cleanChecks >= CLEAN_ENOUGH) unwatchScrollPin();
        return;
      }

      // fixed não está valendo → assume o controle
      pinned = true;
      if (window.console) {
        console.warn("[AtlasShell] position:fixed não está sendo respeitado " +
                     "no botão do Oráculo. Ativando trava por JS.");
      }
    }

    var g = viewportGap();
    el.style.position = "absolute";
    el.style.top  = (window.pageYOffset + vp.h - r.height - g) + "px";
    el.style.left = (window.pageXOffset + vp.w - r.width  - g) + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function schedulePin() {
    if (pinTick) return;
    pinTick = requestAnimationFrame(function () {
      pinTick = null;
      checkPin();
    });
  }

  function unwatchScrollPin() {
    window.removeEventListener("scroll", schedulePin, { passive: true });
    document.removeEventListener("scroll", schedulePin, { passive: true, capture: true });
  }

  function watchPin() {
    if (!window.requestAnimationFrame) return;
    window.addEventListener("scroll", schedulePin, { passive: true });
    // alguns módulos rolam um container interno, não a janela
    document.addEventListener("scroll", schedulePin, { passive: true, capture: true });
    // resize continua ouvido: mudar a largura pode fazer a barra de
    // rolagem aparecer/sumir e trocar o breakpoint da folga.
    window.addEventListener("resize", schedulePin, { passive: true });
    setTimeout(checkPin, 300);   // primeira medição depois da pintura
  }

  function watch() {
    if (!window.MutationObserver || !document.body) return;
    var pending = null;
    new MutationObserver(function () {
      // Se o botão de voltar sumiu, recoloca AGORA. Sem isso, o Trade
      // re-renderiza a sidebar em sequência e fica reiniciando o debounce,
      // deixando o rodapé vazio por meio segundo (flicker visível).
      if (WANT_STRIP && !document.querySelector('[data-atlas-ui="backfoot"]')) {
        try { mountBackFoot(); } catch (e) {}
      }
      clearTimeout(pending);
      pending = setTimeout(mount, 40);
    }).observe(document.body, { childList: true, subtree: true });
    // subtree é obrigatório: o Trade monta a sidebar com innerHTML DEPOIS do
    // shell, apagando o botão de rodapé. Sem subtree, a remontagem nunca
    // era disparada e o Trade ficava sem "Voltar ao Atlas".
  }

  /* ============================================================
     5. API
     ============================================================ */

  window.AtlasShell = {
    module: function () { return MODULE; },
    label: function () { return LABEL; },
    remount: mount,
    /* Cópia, não a lista viva: quem consome não tem como alterar o
       menu de todo mundo por descuido. */
    destinos: function () { return DESTINOS.slice(); },
    /* Caminho relativo daqui para a raiz do ATLAS. Dentro de um módulo
       é "../", na raiz é "". A paleta precisa disto para montar links
       que funcionem dos dois lugares. */
    raiz: function () { return RAIZ; }
  };

  window.AtlasOraculo = {
    registerBrain: function (factory) {
      if (typeof factory === "function") {
        extraBrains.push(factory);
        // já montado? refaz para absorver o novo cérebro
        var old = document.querySelector('[data-atlas-ui="oraculo"]');
        if (old && old.parentNode) { old.parentNode.removeChild(old); mount(); }
      }
    },
    ask: function (q) {
      var el = document.querySelector('[data-atlas-ui="oraculo"]');
      if (el && el._ask) el._ask(q);
    },
    open: function () {
      var el = document.querySelector('[data-atlas-ui="oraculo"]');
      if (el && el._setOpen) el._setOpen(true);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); watch(); watchPin(); });
  } else {
    mount(); watch(); watchPin();
  }
})();
