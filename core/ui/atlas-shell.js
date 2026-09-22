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

  // Profundidade da página → caminho correto para a raiz do projeto.
  // Agora TODAS as telas com shell vivem um nível abaixo da raiz: os
  // módulos em hold/ trade/ defi/ RWA/ academy/, e as telas atlas em
  // pages/. Só index.html está na própria raiz. Em vez de adivinhar pelo
  // módulo, o shell se autolocaliza pelo caminho do PRÓPRIO <script>:
  // o que vier antes de "core/ui/atlas-shell.js" é o caminho até a raiz
  // ("" na raiz, "../" um nível abaixo). À prova de onde a página mora.
  var RAIZ = (function () {
    var el = document.currentScript ||
             document.querySelector('script[src*="core/ui/atlas-shell.js"]');
    var src = (el && el.getAttribute) ? (el.getAttribute("src") || "") : "";
    var i = src.indexOf("core/ui/atlas-shell.js");
    if (i >= 0) return src.slice(0, i);
    return (MODULE === "atlas") ? "" : "../";   // rede de segurança
  })();
  // O Dashboard mora em pages/ agora; daqui até ele é RAIZ + "pages/…".
  var BACK_HREF  = RAIZ + "pages/dashboard.html";
  var ORACULO_AVATAR = RAIZ + "assets/atena.webp";

  // Efeitos do Magic UI (contagem dos totais, fita de cotações) —
  // core/ui/atlas-magic.*. Spotlight e feixe saíram no visual sereno. O shell roda em toda tela, então
  // carregar daqui liga os efeitos no sistema inteiro sem tocar em cada HTML.
  (function carregarMagic() {
    if (document.querySelector('script[src*="core/ui/atlas-magic.js"]')) return;
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = RAIZ + "core/ui/atlas-magic.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = RAIZ + "core/ui/atlas-magic.js";
    document.head.appendChild(js);
  })();

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
      "O que preciso revisar?": "What do I need to review?",
      "Quanto eu tenho?": "How much do I have?",
      "Quanto tenho em caixa?": "How much cash do I have?",
      "Qual meu resultado?": "What's my result?",
      "O que precisa da minha atenção?": "What needs my attention?",
      "Como estão minhas carteiras?": "How are my wallets?",
      "Qual meu fluxo de movimentos?": "What's my movement flow?",
      "Por que não consigo abrir posição?": "Why can't I open a position?",
      "Como é calculada a rentabilidade?": "How is the return calculated?",
      "E no mês passado?": "And last month?",
      "E neste mês?": "And this month?",
      "Como é calculado o resultado?": "How is the result calculated?",
      "Como é calculado o patrimônio?": "How is net worth calculated?"
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
    { id: "dashboard", label: "Dashboard", href: "pages/dashboard.html",
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
    { id: "carteiras", label: "Carteiras", href: "pages/carteiras.html",
      icon: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 8.5h15"/><circle cx="17" cy="13.5" r="1.4"/>' },
    { id: "academy", label: "Academy", href: "academy/index.html",
      icon: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"/>' },
    /* Ferramentas: a bancada do ATLAS. Não é módulo de patrimônio nem
       leitura como Academy/Relatórios — é onde vivem utilidades que
       rodam ao lado do sistema (cada uma na sua pasta em Ferramentas/).
       Entra depois do Academy e antes de Relatórios: fecha o bloco de
       "operar + aprender" e abre o de "usar o que está pronto". */
    { id: "ferramentas", label: "Ferramentas", href: "pages/ferramentas.html",
      icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    { id: "relatorios", label: "Relatórios", href: "pages/relatorios.html",
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>' },
    { id: "configuracoes", label: "Configurações", href: "pages/configuracoes.html",
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
    var side = findSidebar();
    var atual = document.querySelector('[data-atlas-ui="backfoot"]');
    if (atual) {
      /* Nasceu solto porque a sidebar do módulo ainda não existia: o Hold
         monta a dele DEPOIS do shell. Sem esta mudança de casa o botão
         ficava flutuando sobre o conteúdo para sempre — no celular, com
         o rótulo inteiro por cima da tela. Quando a sidebar aparece, ele
         vai para o rodapé dela, como no Trade e no RWA. */
      if (side && atual.classList.contains("atlas-backfoot--solto")) {
        atual.classList.remove("atlas-backfoot--solto");
        side.setAttribute("data-atlas-sidebar", "on");
        side.appendChild(atual);
      }
      return;
    }
    var el = buildBackFoot();
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

  /* ------------------------------------------------------------
     MODO DEMONSTRAÇÃO — o Oráculo lê o que a tela mostra

     Com o ATLAS vazio, o Dashboard exibe números de exemplo
     (core/atlas-demo.js) e o Oráculo lia os stores reais: a tela dizia
     US$ 48.320 e ele respondia "Patrimônio zerado". Duas verdades na
     mesma tela. Agora, só ali e só enquanto a demonstração está à
     vista, ele lê o mesmo exemplo — e toda resposta feita com esses
     números leva o aviso, para exemplo nunca passar por dado.
     ------------------------------------------------------------ */
  function demoNaTela() {
    if (MODULE !== "atlas" || !window.AtlasDemo || !AtlasDemo.exibindo) return false;
    try { return AtlasDemo.exibindo() && /dashboard\.html$/.test(location.pathname); }
    catch (e) { return false; }
  }

  var NL = "\n";

  var AVISO_DEMO = function () {
    return L(" Números de exemplo da demonstração — limpe-a para usar os seus.",
             " Demo sample numbers — clear the demo to use your own.");
  };

  /* ------------------------------------------------------------
     PERGUNTA FILTRADA NA DEMONSTRAÇÃO

     "quanto rendeu minha pool?" na demonstração recebia "Nenhum
     resultado realizado em DeFi" — verdade sobre os dados reais (que
     estão vazios; é por isso que a demonstração aparece), mas dita ao
     lado de quatro pools de exemplo na tela. A resposta certa é dizer
     que não há o registro e o caminho até ele.

     Vale para pergunta que depende de um registro específico (módulo,
     período, carteira). A pergunta geral ("quanto eu tenho?") continua
     respondida com o exemplo marcado: ali ela é sobre a tela.
     ------------------------------------------------------------ */
  var DEMO_O_QUE = {
    defi:  { item: "nenhuma pool de liquidez", ond: "no DeFi",  cad: "a pool",   ela: "ela" },
    hold:  { item: "nenhum ativo no Hold",      ond: "no Hold",  cad: "o ativo",  ela: "ele" },
    trade: { item: "nenhuma operação no Trade", ond: "no Trade", cad: "a operação", ela: "ela" },
    rwa:   { item: "nenhum ativo tokenizado",   ond: "no RWA",   cad: "o ativo",  ela: "ele" }
  };

  function respostaDemoFiltrada(Q) {
    Q = Q || {};
    var o = DEMO_O_QUE[Q.modulo] || { item: "nenhum dado seu", ond: "em Carteiras & Movimentações ou num módulo",
                                      cad: "um depósito ou uma posição", ela: "isso" };
    var pergunta = {
      resultado:  "quanto " + o.ela + " rendeu",
      taxas:      "quanto " + o.ela + " rendeu de taxa",
      movimentos: "os movimentos " + (o.ela === "isso" ? "" : (o.ela === "ela" ? "dela" : "dele")),
      posicoes:   "quanto está alocado",
      caixa:      "o caixa",
      patrimonio: "quanto vale"
    }[Q.metrica] || "responder isso";
    if (!DEMO_O_QUE[Q.modulo] && Q.metrica === "resultado") pergunta = "quanto rendeu";
    return L("Você ainda não cadastrou " + o.item + " — o que aparece na tela é exemplo da demonstração. " +
             "Para eu dizer " + pergunta.trim() + ": limpe a demonstração (botão na faixa do topo do Dashboard), " +
             "cadastre " + o.cad + " " + o.ond + " e pergunte de novo. Limpar tira só os exemplos; nada seu é apagado.",
             "You haven't registered any data for this yet — what's on screen is demo sample data. " +
             "Clear the demo (button on the Dashboard banner), add it, and ask again. Clearing only removes the samples.");
  }

  function snapshotDemo() {
    var s = AtlasDemo.snapshot(30);
    var d = AtlasDemo.dados();
    var caixa = 0, byModule = [];
    (AtlasDemo.composicao ? AtlasDemo.composicao() : []).forEach(function (p) {
      if (/caixa/i.test(p.label)) caixa = p.value; else byModule.push(p);
    });
    return {
      total: s.total, caixa: caixa, investido: s.total - caixa,
      pnl: s.pnl, pnlPct: s.pnlPct, passiveIncome: AtlasDemo.rendaPassiva || 0,
      byModule: byModule, alertas: d.alertas || [], demo: true
    };
  }

  /* Com centavos: é o formato de quem MOSTRA a conta. dinheiro() tira
     as casas, e aí a divisão exibida não fecha com o percentual. */
  function dinheiroExato(v) {
    if (window.AtlasCurrency && AtlasCurrency.format) return AtlasCurrency.format(v || 0, { decimals: 2 });
    return "US$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pctExato(p) {
    return (p > 0 ? "+" : "") + Number(p).toLocaleString(L("pt-BR", "en-US"),
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }

  function consolidado() {
    if (demoNaTela()) { try { return snapshotDemo(); } catch (e) { /* cai no real */ } }
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
  /* A MESMA RÉGUA DA TELA

     AtlasCaixa.saldo() é o CUSTO (quanto foi depositado); header,
     Dashboard e Carteiras mostram o caixa A MERCADO
     (AtlasConsolidation.caixaMercadoDe). Com SOL ou ETH parados, o
     Oráculo dizia um número e a tela outro. Agora ele lê o mesmo; sem
     a consolidação na página, cai no custo, que é o que existe. */
  function caixaDe(id) {
    if (window.AtlasConsolidation && AtlasConsolidation.caixaMercadoDe) {
      return AtlasConsolidation.caixaMercadoDe(id) || 0;
    }
    return AtlasCaixa.saldo(id) || 0;
  }

  function caixaGlobal() {
    if (!window.AtlasCaixa) return 0;
    var W = window.AtlasWallets;
    try {
      if (W && W.globals) {
        return W.globals().reduce(function (a, w) { return a + caixaDe(w.id); }, 0);
      }
      return AtlasCaixa.caixaGlobal ? (AtlasCaixa.caixaGlobal() || 0) : 0;
    } catch (e) { return 0; }
  }

  function caixaPorCarteira() {
    var W = window.AtlasWallets;
    if (!window.AtlasCaixa || !W || !W.globals) return [];
    try {
      return W.globals().map(function (w) {
        return { nome: w.name, id: w.id, saldo: caixaDe(w.id) };
      }).filter(function (x) { return Math.abs(x.saldo) > 1e-9; });
    } catch (e) { return []; }
  }

  function alertasAbertos() {
    if (window.AtlasNotifications && AtlasNotifications.list) {
      try { return AtlasNotifications.list() || []; } catch (e) { return []; }
    }
    return [];
  }

  /* " (+15,9%)", ou nada. pnlPct vem NULL quando não há base para
     afirmar rentabilidade, e null.toFixed() derrubava a resposta
     inteira: o Oráculo recebia a pergunta e ficava mudo. */
  function pctEntre(p) {
    if (p == null || !isFinite(p)) return "";
    return " (" + (p >= 0 ? "+" : "") + p.toFixed(1).replace(".", L(",", ".")) + "%)";
  }

  /* Uma forma só de ler a pergunta: minúscula e sem acento. As regex
     tinham "n.o consigo" e "sa.da" para aguentar o til — e qualquer
     palavra nova esquecia disso. */
  function normalizar(s) {
    s = String(s == null ? "" : s).toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s;
  }

  /* ------------------------------------------------------------
     O MÍNIMO DE EDUCAÇÃO

     O Oráculo é raciocínio, não conversa — e continua sendo. Mas
     "bom dia" caía em "Ainda não sei responder isso", que é a frase
     de quem não ouviu. A regra é curta e fixa: cumprimenta pelo
     horário REAL (não repete o que ouviu), reconhece o agradecimento
     com uma palavra e volta ao dado. Sem emoji, sem exclamação.
     ------------------------------------------------------------ */
  function saudacaoAgora() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return L("Bom dia", "Good morning");
    if (h >= 12 && h < 18) return L("Boa tarde", "Good afternoon");
    return L("Boa noite", "Good evening");
  }

  function nomeUsuario() {
    var n = "";
    try { n = (window.AtlasSettings && AtlasSettings.profile) ? (AtlasSettings.profile().name || "") : ""; }
    catch (e) { n = ""; }
    n = String(n).trim();
    /* O nome-padrão não é nome de ninguém: "Boa tarde, Gestor ATLAS"
       soa pior do que não chamar. */
    return (!n || n === "Gestor ATLAS") ? "" : n;
  }

  function saudacaoComNome() {
    var n = nomeUsuario();
    return saudacaoAgora() + (n ? ", " + n : "") + ".";
  }

  /* Uma linha com o que importa: patrimônio e alertas. É o que vem
     depois de um cumprimento — o Oráculo responde "bom dia" com o
     estado, não com conversa. */
  function estadoCurto() {
    var s = consolidado();
    var partes = [];
    if (s && s.total) partes.push(L("Patrimônio ", "Net worth ") + dinheiro(s.total));
    var n = alertasAbertos().length;
    partes.push(n ? L(n + (n === 1 ? " alerta ativo" : " alertas ativos"),
                      n + (n === 1 ? " active alert" : " active alerts"))
                  : L("sem alertas", "no alerts"));
    if (s && s.demo) {
      /* Os alertas do exemplo estão no card; os reais (nenhum) no sino. */
      partes[partes.length - 1] = L(s.alertas.length + " alertas de exemplo", s.alertas.length + " sample alerts");
    }
    var txt = partes.join(", ");
    return txt.charAt(0).toUpperCase() + txt.slice(1) + "." + (s && s.demo ? AVISO_DEMO() : "");
  }

  var RX_SAUDACAO = /^(oi+|ola|opa|e ai|eai|salve|bom dia|boa tarde|boa noite|hello|hi|hey|good (morning|afternoon|evening))\b[\s,.!?;:-]*/;
  var RX_AGRADECE = /\b(obrigad[oa]s?|brigad[oa]|valeu|vlw|agradec\w*|thanks|thank you|thx)\b[\s,.!]*/g;
  var RX_DESPEDE  = /\b(tchau|ate mais|ate logo|ate depois|falou|flw|bye|goodbye)\b[\s,.!]*/g;
  var RX_ENCHIMENTO = /\b(por favor|pfv|pf|please|ai|entao)\b/g;

  /* Separa a parte social da pergunta. "boa tarde, quanto tenho?"
     vira { saudou: true, resto: "quanto tenho?" } — o resto segue
     para o raciocínio de sempre, e a saudação só enfeita a resposta. */
  function cortesia(q) {
    var n = normalizar(q).trim();
    var r = { saudou: false, agradeceu: false, despediu: false, resto: n };
    var m = n.match(RX_SAUDACAO);
    if (m) { r.saudou = true; n = n.slice(m[0].length); }
    if (RX_AGRADECE.test(n)) { r.agradeceu = true; }
    RX_AGRADECE.lastIndex = 0;
    n = n.replace(RX_AGRADECE, " ");
    if (RX_DESPEDE.test(n)) { r.despediu = true; }
    RX_DESPEDE.lastIndex = 0;
    n = n.replace(RX_DESPEDE, " ");
    /* Sobrou pergunta? "por favor" sozinho não é pergunta. */
    var semEnchimento = n.replace(RX_ENCHIMENTO, " ").replace(/[\s,.!?;:-]+/g, " ").trim();
    r.resto = semEnchimento.length >= 3 ? n.trim() : "";
    return r;
  }

  var SUGESTOES_PADRAO = [
    "Quanto eu tenho?", "Quanto tenho em caixa?", "Qual meu resultado?",
    "O que precisa da minha atenção?", "Quais teses estão em aberto?",
    "Como estão minhas carteiras?", "Qual meu fluxo de movimentos?"
  ];

  /* O passo natural depois de cada pergunta. As chaves são testadas na
     pergunta normalizada (sem acento); os rótulos são perguntas que o
     próprio cérebro sabe responder — sugestão que cai em "não entendi"
     é pior do que sugestão nenhuma. */
  var SEGUIMENTOS = [
    { rx: /quanto eu tenho|patrim|net worth/, prox: ["Quanto tenho em caixa?", "Qual meu resultado?"] },
    { rx: /caixa|dispon|cash/, prox: ["Como estão minhas carteiras?", "Qual meu fluxo de movimentos?"] },
    /* Depois de ver o número, a pergunta seguinte natural é de onde
       ele vem. */
    /* Resultado, taxas e movimentos aceitam período: a continuação
       natural é o mesmo número em outra janela (ver criarConversa). */
    { rx: /^(?!.*calcul).*(resultado|lucr|\brend|taxa|movimento|fluxo|extrato)/, prox: ["E no mês passado?"] },
    { rx: /mes passado/, prox: ["E neste mês?"] },
    { rx: /resultado|lucr|rentab/, prox: ["Como é calculada a rentabilidade?", "Quanto eu tenho?"] },
    { rx: /calcul|explic|por ?que (?!nao)/, prox: ["Como é calculado o resultado?", "Como é calculado o patrimônio?"] },
    { rx: /tese/, prox: ["O que preciso revisar?"] },
    { rx: /carteira/, prox: ["Quanto tenho em caixa?", "Qual meu fluxo de movimentos?"] },
    { rx: /abrir posi|nao consigo/, prox: ["Quanto tenho em caixa?", "Como estão minhas carteiras?"] }
  ];

  /* ------------------------------------------------------------
     O ROTEAMENTO, SEPARADO DA RESPOSTA

     Qual é o assunto da pergunta? Antes isto vivia misturado com a
     montagem do texto, numa cadeia de if (/regex/) — e só dava para
     testar perguntando e lendo a frase, que muda com os dados. Agora
     é uma tabela: pages/testes-oraculo.html confere dezenas de
     perguntas contra o assunto esperado sem depender de número
     nenhum.

     A ORDEM IMPORTA: o padrão mais específico vem primeiro. "quanto
     tenho em teses" é teses, não patrimônio; "qual meu saldo" é
     caixa, não patrimônio.

     Palavras soltas demais saíram, porque capturavam o assunto
     errado: "aberto" mandava "posições abertas" para teses, "vale"
     pegava "vale a pena", "conta" pegava "me conta", "real" pegava
     "na real". \b na frente de "revis" impede que case dentro de
     "pREVISao".
     ------------------------------------------------------------ */
  var ROTAS = [
    /* "o que mudou desde ontem?" — antes de tudo: contém "ontem", que
       o vocabulário leria como período de outra métrica */
    { id: "mudancas",   rx: /o que mudou|mudou desde|mudou algo|mudanca|novidade|desde a (minha |sua )?ultima|desde ontem|what changed|since (my )?last/ },
    /* revisão antes de teses: "tem tese atrasada?" é sobre o prazo,
       não a lista de teses */
    { id: "revisao",    rx: /\brevis|\breview|\batrasad|overdue|\bparad[ao]s? ha|stalled/ },
    { id: "teses",      rx: /tese|thesis|estud|pendent|pending|andamento|progress/ },
    { id: "atencao",    rx: /aten|attention|alerta|alert|risco|risk|problema|urgent/ },
    /* caixa antes de patrimônio: "saldo" e "disponível" são caixa.
       "saldo" chegou a estar só na regex de patrimônio — o comentário
       dizia uma coisa e a tabela fazia outra. */
    { id: "caixa",      rx: /caixa|saldo|dispon|livre|parado|cash|free|deposit|dep.sit|sacar|saque|withdraw|transfer/ },
    /* resultado antes de patrimônio: "quanto lucrei?" começa com
       "quanto" e é pergunta de resultado */
    { id: "resultado",  rx: /lucr|resultado|pnl|rentab|\brend|performance|ganho|preju|profit/ },
    { id: "patrimonio", rx: /quanto|how much|patrim|total|net worth|worth/ },
    { id: "trava",      rx: /nao consigo|por que n|why can|bloque|recus|insuficien|abrir posi/ },
    { id: "carteiras",  rx: /carteira|wallet|\bcontas\b/ },
    { id: "fluxo",      rx: /movimento|fluxo|flow|entrada|saida|aporte|retirada|extrato/ },
    { id: "resumo",     rx: /modul|module|resum|summary|status|como est|how is/ },
    { id: "moeda",      rx: /moeda|currency|dolar|dollar|\breais\b|\bbrl\b|cambio|exchange/ },
    { id: "backup",     rx: /backup|export|salvar|perder (os |meus )?dados|perder tudo|guardar/ }
  ];

  /* ------------------------------------------------------------
     "POR QUE 15,98%?" — EXPLICAR A CONTA

     O pedido de explicação vem antes de tudo: "como é calculado o
     patrimônio?" contém "patrim" e cairia na resposta do patrimônio,
     que dá o número, não a conta. "por que não consigo…" fica de fora
     de propósito — é a trava de posição, não um pedido de conta.
     ------------------------------------------------------------ */
  var RX_EXPLICAR = /\bexplic|\bcalcul|\bformula|\bconta d[aoe]|de onde (vem|vieram|veio|sai|saiu)|\bpor ?que (?!nao)|\bpq (?!nao)|\bwhy (?!can)|\bhow (is|was|do you) .*(calc|comput)/;

  var ASSUNTOS_EXPLICAR = [
    { id: "renda",         rx: /renda|passiv|passive/ },
    { id: "rentabilidade", rx: /rentab|%|percent|por cento|retorno|return/ },
    { id: "resultado",     rx: /lucr|resultado|pnl|ganho|preju|profit/ },
    { id: "caixa",         rx: /caixa|saldo|dispon|cash/ },
    { id: "patrimonio",    rx: /patrim|total|net worth|quanto (eu )?tenho/ }
  ];

  /* "de onde vem 321?" — o número diz de qual conta se fala. Compara
     com a precisão que a pessoa digitou: "15,98" casa com 15,9812, e
     "16" também, mas "15" não. */
  function numerosDe(q) {
    var out = [];
    q.replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/g, function (_, inteiro, dec) {
      dec = dec || "";
      out.push({ v: parseFloat(inteiro.replace(/\./g, "") + (dec ? "." + dec : "")), casas: dec.length });
      return _;
    });
    return out;
  }

  function assuntoPeloNumero(q) {
    var nums = numerosDe(q);
    if (!nums.length) return null;
    var s = consolidado();
    if (!s) return null;
    var soPct = q.indexOf("%") >= 0;
    var candidatos = [["rentabilidade", s.pnlPct]];
    if (!soPct) {
      candidatos.push(["patrimonio", s.total], ["resultado", s.pnl],
                      ["caixa", s.caixa], ["renda", s.passiveIncome]);
    }
    for (var i = 0; i < nums.length; i++) {
      var tol = 0.5 * Math.pow(10, -nums[i].casas) + 1e-9;
      for (var j = 0; j < candidatos.length; j++) {
        var alvo = candidatos[j][1];
        if (alvo != null && isFinite(alvo) && Math.abs(Math.abs(alvo) - nums[i].v) <= tol) return candidatos[j][0];
      }
    }
    return null;
  }

  function assuntoExplicar(q) {
    q = normalizar(q);
    if (!RX_EXPLICAR.test(q)) return null;
    for (var i = 0; i < ASSUNTOS_EXPLICAR.length; i++) {
      if (ASSUNTOS_EXPLICAR[i].rx.test(q)) return ASSUNTOS_EXPLICAR[i].id;
    }
    return assuntoPeloNumero(q);
  }

  function intencao(q) {
    q = normalizar(q);

    if (ROTAS[0].rx.test(q)) return ROTAS[0].id;      /* mudanças */
    if (assuntoExplicar(q)) return "explicar";

    /* O VOCABULÁRIO TENTA PRIMEIRO. core/atlas-vocabulario.js decompõe
       a pergunta em métrica × módulo × período × carteira — o que
       permite "quanto rendi em pool no mês passado na Principal", que
       nenhuma regex de uma dimensão alcança. Só assume quando a
       pergunta trouxe um FILTRO (carteira, módulo, período), ou pede
       taxas, que a tabela não cobre. Para a pergunta seca a resposta
       da tabela é mais rica.

       "movimentos" saiu da lista: sozinho, ele fazia "como faço um
       depósito?" e "mostra o extrato" receberem um seco "Nenhum
       movimento." em vez da resposta de caixa ou de fluxo. */
    if (window.AtlasVocabulario) {
      try {
        var Q = AtlasVocabulario.interpretar(q);
        var especifica = Q.carteira || Q.modulo || Q.periodo || Q.comparar || Q.metrica === "taxas";
        if (especifica && AtlasVocabulario.responder(q)) return "vocabulario";
      } catch (e) { /* segue para a tabela */ }
    }

    for (var i = 0; i < ROTAS.length; i++) {
      if (ROTAS[i].rx.test(q)) return ROTAS[i].id;
    }
    return null;
  }

  /* ------------------------------------------------------------
     CONTINUAR O ASSUNTO — "e no mês passado?"

     Cada pergunta era respondida sozinha: depois de "quanto rendi em
     pool?", "e no mês passado?" caía em "não entendi", porque não tem
     métrica nem módulo. Agora a conversa guarda a CONSULTA da última
     resposta (métrica × módulo × período × carteira, do vocabulário) e
     a continuação troca só o que trouxe de novo:

       "quanto rendi em pool?"   → resultado · DeFi
       "e no mês passado?"       → resultado · DeFi · mês passado
       "e na Reserva?"           → resultado · DeFi · mês passado · Reserva
       "e o caixa?"              → caixa     · DeFi · mês passado · Reserva

     É continuação quando começa com "e …" (ou "and", "what about"), ou
     quando só traz filtro, sem assunto ("no mês passado?"). Pergunta
     com assunto próprio começa uma consulta nova.

     O que NÃO faz: adivinhar. Se o assunto anterior não aceita filtro
     (alertas, teses sem métrica), diz isso em vez de responder outra
     coisa com o filtro pendurado.
     ------------------------------------------------------------ */
  var RX_CONTINUA = /^(e quanto a|e sobre|e|and|what about|how about)\s+/;

  function temFiltro(Q) { return !!(Q && (Q.modulo || Q.periodo || Q.carteira)); }

  function assuntoPorPalavra(q) {
    for (var i = 0; i < ASSUNTOS_EXPLICAR.length; i++) {
      if (ASSUNTOS_EXPLICAR[i].rx.test(q)) return ASSUNTOS_EXPLICAR[i].id;
    }
    return null;
  }

  function descreverFiltro(Q) {
    var V = window.AtlasVocabulario, p = [];
    if (Q.modulo) p.push((V && V.NOME_MODULO && V.NOME_MODULO[Q.modulo]) || Q.modulo);
    if (Q.periodo) p.push(Q.periodo.rotulo);
    if (Q.carteira) p.push(L("a carteira ", "wallet ") + Q.carteira.nome);
    return p.join(", ");
  }

  function criarConversa() {
    var ctx = null;          /* { rota, Q } da última resposta que valeu */

    function responder(resto, brain) {
      var V = window.AtlasVocabulario;
      var n = normalizar(resto).trim();
      var lead = n.match(RX_CONTINUA);
      var F = lead ? n.slice(lead[0].length) : n;
      var Qf = V ? V.interpretar(F) : null;
      var trazAlgo = !!(Qf && (Qf.metrica || temFiltro(Qf)));
      /* "na M1P?" sozinho: o vocabulário supõe patrimônio para carteira
         sem assunto (metricaPadrao), mas numa conversa o assunto é o da
         pergunta anterior */
      var rotaF = intencao(F);
      var soFiltro = !!(Qf && (!Qf.metrica || Qf.metricaPadrao) && temFiltro(Qf) &&
                        (!rotaF || rotaF === "vocabulario"));

      if (ctx && ((lead && trazAlgo) || soFiltro || (lead && ctx.rota === "explicar"))) {
        /* "por que 15,98%?" → "e o patrimônio?" explica o patrimônio */
        if (ctx.rota === "explicar") {
          var as = assuntoPorPalavra(F);
          var ex = as ? baseBrain.explicar(as) : null;
          if (ex) { ctx = { rota: "explicar", Q: ctx.Q }; return ex; }
        }
        if (V && V.responderQ && ctx.Q && Qf) {
          var Qm = {
            metrica:  (Qf.metrica && !Qf.metricaPadrao) ? Qf.metrica : (ctx.Q.metrica || Qf.metrica),
            modulo:   Qf.modulo   || ctx.Q.modulo,
            periodo:  Qf.periodo  || ctx.Q.periodo,
            carteira: Qf.carteira || ctx.Q.carteira,
            carteiras: (Qf.carteiras && Qf.carteiras.length) ? Qf.carteiras : (ctx.Q.carteiras || []),
            /* "compara a M4P e a M1P" → "e no DeFi?" continua comparando;
               citar UMA carteira nova encerra a comparação */
            comparar: Qf.comparar || (!Qf.carteira && !!ctx.Q.comparar)
          };
          if (Qm.metrica && temFiltro(Qm)) {
            if (demoNaTela()) { ctx = { rota: "vocabulario", Q: Qm }; return respostaDemoFiltrada(Qm); }
            var rv = null;
            try { rv = V.responderQ(Qm); } catch (e) { rv = null; }
            if (rv) { ctx = { rota: "vocabulario", Q: Qm }; return rv; }
          }
        }
        if (soFiltro) {
          return L("Esse filtro (" + descreverFiltro(Qf) + ") não se aplica à pergunta anterior. " +
                   "Módulo, período e carteira valem para resultado, taxas, movimentos, " +
                   "caixa, patrimônio e posições.",
                   "That filter (" + descreverFiltro(Qf) + ") doesn't apply to the previous question.");
        }
        /* "e o lucro?" sem filtro nenhum para herdar: é pergunta nova */
        n = F;
      }

      var r = brain.answer(n);
      var naoEntendeu = r && typeof r === "object" && r.sugestoes;
      if (!naoEntendeu) ctx = { rota: intencao(n), Q: V ? V.interpretar(n) : null };
      return r;
    }

    return {
      responder: responder,
      estado: function () { return ctx; },
      reset: function () { ctx = null; }
    };
  }

  /* ------------------------------------------------------------
     O QUE MUDOU DESDE A ÚLTIMA VISITA

     O Oráculo abria sempre com a mesma fotografia de agora. Quem volta
     depois de dois dias quer saber o que ANDOU: quanto o patrimônio
     mudou, se entrou movimento, se nasceu alerta.

     Guarda-se uma fotografia pequena por visita — total, resultado,
     caixa, e os ids de alertas e movimentos — em atlas.oraculo.visita.v1.
     Não é uma segunda fonte de valor (o valor continua vindo da
     consolidação): é só o ponto de comparação, como o estado de "lido"
     das notificações.

     VISITA é um intervalo de 4h sem abrir o ATLAS. Dentro da mesma
     visita, trocar de tela não conta como visita nova — senão "desde a
     última visita" viraria "desde dois minutos atrás". A fotografia
     `ultimo` se atualiza a cada tela e ao sair; quando uma visita nova
     começa, ela vira a `base` da comparação.

     Movimento novo é contado por id, não por data: a data do movimento
     é a que a pessoa digitou e pode ser retroativa.
     ------------------------------------------------------------ */
  var KEY_VISITA = "atlas.oraculo.visita.v1";
  var VISITA_NOVA = 4 * 3600 * 1000;
  var LIMITE_IDS = 2000;
  var visita = null;           /* { base, ultimo } desta página */

  function fotografia() {
    if (!window.AtlasConsolidation || !AtlasConsolidation.snapshot) return null;
    var s;
    try { s = AtlasConsolidation.snapshot(); } catch (e) { return null; }
    if (!s) return null;
    var movs = [];
    try {
      movs = (window.AtlasMovements && AtlasMovements.list) ? (AtlasMovements.list({}) || []) : [];
    } catch (e) { movs = []; }
    return {
      ts: Date.now(),
      total: s.total || 0, pnl: s.pnl || 0, caixa: s.caixa || 0,
      alertas: alertasAbertos().map(function (a) { return a.id; }).slice(0, LIMITE_IDS),
      movs: movs.map(function (m) { return m.id; }).filter(Boolean).slice(-LIMITE_IDS)
    };
  }

  function lerVisita() {
    try { var o = JSON.parse(localStorage.getItem(KEY_VISITA) || "null"); return (o && o.ultimo) ? o : null; }
    catch (e) { return null; }
  }
  function gravarVisita(o) {
    try { localStorage.setItem(KEY_VISITA, JSON.stringify(o)); } catch (e) {}
  }

  function iniciarVisita() {
    var agora = fotografia();
    if (!agora) return;
    var rec = lerVisita();
    if (!rec) rec = { base: null, ultimo: agora };
    else if (agora.ts - (rec.ultimo.ts || 0) > VISITA_NOVA) rec = { base: rec.ultimo, ultimo: agora };
    else rec.ultimo = agora;
    gravarVisita(rec);
    visita = rec;
  }

  /* O último estado da visita é o de quando a pessoa SAI — posição
     aberta nesta tela entra na comparação da próxima visita. */
  function atualizarUltimo() {
    var agora = fotografia();
    if (!agora) return;
    var rec = lerVisita() || { base: null };
    rec.ultimo = agora;
    gravarVisita(rec);
    if (visita) visita.ultimo = agora;
  }

  function quandoFoi(ts, agora) {
    agora = agora || Date.now();
    var min = Math.round((agora - ts) / 60000);
    if (min < 60) return L("há " + Math.max(1, min) + " min", Math.max(1, min) + " min ago");
    var d = new Date(ts), h = new Date(agora);
    var hora = d.getHours() + "h";
    var ontem = new Date(h); ontem.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return L("hoje, " + hora, "today, " + hora);
    if (d.toDateString() === ontem.toDateString()) return L("ontem, " + hora, "yesterday, " + hora);
    var dias = Math.round((agora - ts) / 86400000);
    if (dias < 7) return L("há " + dias + " dias", dias + " days ago");
    return d.toLocaleDateString(L("pt-BR", "en-US"), { day: "2-digit", month: "2-digit" });
  }

  /* Pura: base × agora → linhas. `alertasAgora` e `movsAgora` são as
     listas completas de hoje (com texto e valor), para dizer QUAIS são
     os novos. Devolve null quando não há o que comparar. */
  function descreverMudancas(base, agora, alertasAgora, movsAgora, opts) {
    opts = opts || {};
    if (!base || !agora) return null;
    var ex = dinheiroExato, linhas = [];
    function sinal(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + ex(Math.abs(v)); }

    var dT = agora.total - base.total;
    if (Math.abs(dT) >= 0.01) {
      linhas.push(L("• Patrimônio ", "• Net worth ") + sinal(dT) +
                  " (" + ex(base.total) + " → " + ex(agora.total) + ").");
    }
    var dP = agora.pnl - base.pnl;
    if (Math.abs(dP) >= 0.01) linhas.push(L("• Resultado ", "• Result ") + sinal(dP) + ".");

    var vistos = {};
    (base.movs || []).forEach(function (id) { vistos[id] = 1; });
    var novos = (movsAgora || []).filter(function (m) { return m && m.id && !vistos[m.id]; });
    if (novos.length) {
      var ent = 0, sai = 0;
      novos.forEach(function (m) { if (m.tipo === "entrada") ent += m.valorUSD || 0; else sai += m.valorUSD || 0; });
      linhas.push(L("• " + novos.length + (novos.length === 1 ? " movimento novo" : " movimentos novos") +
                    ": entradas " + ex(ent) + ", saídas " + ex(sai) + ".",
                    "• " + novos.length + " new movement(s): in " + ex(ent) + ", out " + ex(sai) + "."));
    }

    if (!opts.semAlertas) {
      var antes = {};
      (base.alertas || []).forEach(function (id) { antes[id] = 1; });
      var alNovos = (alertasAgora || []).filter(function (a) { return a && a.id && !antes[a.id]; });
      alNovos.slice(0, 2).forEach(function (a) {
        linhas.push(L("• Alerta novo: ", "• New alert: ") + a.texto);
      });
      if (alNovos.length > 2) linhas.push(L("• +" + (alNovos.length - 2) + " alertas novos no sino.",
                                            "• +" + (alNovos.length - 2) + " new alerts in the bell."));
    }

    var cab = L("Desde a sua última visita (" + quandoFoi(base.ts, agora.ts) + ")",
                "Since your last visit (" + quandoFoi(base.ts, agora.ts) + ")");
    if (!linhas.length) return { mudou: false, texto: L("Nada mudou ", "Nothing changed ") + cab.charAt(0).toLowerCase() + cab.slice(1) + "." };
    return { mudou: true, texto: cab + ":" + NL + linhas.join(NL) };
  }

  function mudancasAgora(opts) {
    if (demoNaTela()) {
      return L("Na demonstração não há visita anterior para comparar — os números são de exemplo.",
               "The demo has no previous visit to compare.");
    }
    if (!visita || !visita.base) {
      return L("Ainda não há uma visita anterior registrada para comparar. A comparação começa na próxima vez que você abrir o ATLAS.",
               "There is no previous visit recorded yet.");
    }
    var agora = fotografia();
    var movs = [];
    try { movs = (window.AtlasMovements && AtlasMovements.list) ? (AtlasMovements.list({}) || []) : []; } catch (e) { movs = []; }
    var d = descreverMudancas(visita.base, agora, alertasAbertos(), movs, opts);
    return d ? d.texto : null;
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
      /* snapshot().total JÁ É o patrimônio com caixa (ver
         js/atlas-consolidation.js, "o caixa não entrava no patrimônio").
         Somar caixaGlobal() por cima contava o caixa duas vezes — e
         ainda pelo valor depositado, não a mercado como o Dashboard. */
      var caixa = s.caixa || 0;
      var total = s.total;
      var alocado = (s.investido != null) ? s.investido : (total - caixa);

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
               " em caixa e " + dinheiro(alocado) + " alocado. Resultado acumulado " +
               sinal + dinheiro(s.pnl) + pctEntre(s.pnlPct) + ". " +
               "Distribuição: " + partes.join(", ") + "." + (s.demo ? AVISO_DEMO() : ""),
               "Total net worth: " + dinheiro(total) + " — " + dinheiro(caixa) +
               " in cash and " + dinheiro(alocado) + " allocated. Accumulated result " +
               sinal + dinheiro(s.pnl) + pctEntre(s.pnlPct) + ". " +
               "Split: " + partes.join(", ") + "." + (s.demo ? AVISO_DEMO() : ""));
    },

    /* ------------------------------------------------------------
       CAIXA — a pergunta que o sistema passou a permitir

       "Quanto tenho disponível?" caía na regex de patrimônio e recebia
       o número das posições: a resposta exata do contrário do que foi
       perguntado. E o caixa é agora o que decide se dá para abrir
       posição, então é a pergunta mais operacional do ATLAS.
       ------------------------------------------------------------ */
    caixa: function () {
      var sd = demoNaTela() ? consolidado() : null;
      if (sd && sd.demo) {
        return L("Caixa disponível: " + dinheiro(sd.caixa) + "." + AVISO_DEMO(),
                 "Available cash: " + dinheiro(sd.caixa) + "." + AVISO_DEMO());
      }
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

    /* ------------------------------------------------------------
       EXPLICAR A CONTA — com as parcelas que a própria conta usou

       Cada número sai do snapshot da consolidação, que por sua vez sai
       de core/atlas-contabilidade.js. Nada é recalculado aqui: se a
       explicação refizesse a conta por fora, poderia fechar num número
       diferente do que a tela mostra — e a explicação existiria para
       desmenti-la. Os centavos aparecem porque "US$ 18 ÷ US$ 115"
       não dá 15,98%; "US$ 18,41 ÷ US$ 115,21" dá.
       ------------------------------------------------------------ */
    explicar: function (assunto) {
      var s = consolidado();
      if (!s) return L("Não consigo ler os números a partir desta tela.",
                       "I can't read the numbers from this screen.");

      if (s.demo) {
        return L("Na demonstração os números são ilustrativos e não saem da conta real. " +
                 "No seu ATLAS: patrimônio = caixa + valor de mercado das posições; " +
                 "resultado = posições abertas (valor − custo) + operações encerradas; " +
                 "rentabilidade = resultado ÷ capital investido, acumulada desde a entrada." +
                 AVISO_DEMO(),
                 "Demo numbers are illustrative and don't come from the real calculation." + AVISO_DEMO());
      }

      var ex = dinheiroExato;
      var temRealizado = Math.abs(s.pnlRealizado || 0) > 0.005;

      if (assunto === "rentabilidade") {
        if (s.pnlPct == null) {
          return s.pnlBaseIncompleta
            ? L("Sem rentabilidade: há resultado de operação encerrada sem o capital que o produziu. " +
                "Dividir por outra base daria um percentual que não corresponde a nada, então o ATLAS não mostra.",
                "No return: there is closed-trade result without the capital that produced it.")
            : L("Sem rentabilidade: não há capital investido para servir de base. " +
                "Caixa parado não entra na conta — rentabilidade mede o que foi aplicado.",
                "No return: there is no invested capital to use as the base.");
        }
        var linhas = [
          L("Rentabilidade = resultado ÷ capital investido.", "Return = result ÷ invested capital."),
          L("Resultado: ", "Result: ") + ex(s.pnl) + (temRealizado
            ? L(" (" + ex(s.pnlAberto) + " em posições abertas + " + ex(s.pnlRealizado) + " em operações encerradas)",
                " (" + ex(s.pnlAberto) + " open + " + ex(s.pnlRealizado) + " closed)")
            : "") + ".",
          L("Capital investido: ", "Invested capital: ") + ex(s.base) + (temRealizado
            ? L(" — o custo das posições abertas mais o capital das operações encerradas.",
                " — cost of open positions plus capital of closed trades.")
            : L(" — o que foi pago pelas posições abertas.", " — what was paid for open positions.")),
          ex(s.pnl) + " ÷ " + ex(s.base) + " = " + pctExato(s.pnlPct) + ".",
          L("É acumulada desde a entrada em cada posição, não de um período. Caixa parado não entra na base.",
            "Accumulated since each position was opened, not over a period. Idle cash is not in the base.")
        ];
        return linhas.join(NL);
      }

      if (assunto === "resultado") {
        return [
          L("Resultado = posições abertas + operações encerradas.", "Result = open positions + closed trades."),
          L("Abertas: valor de mercado − custo, somando a taxa já coletada das pools, que saiu da posição para o caixa: ",
            "Open: market value − cost, plus pool fees already collected: ") + ex(s.pnlAberto) + ".",
          L("Encerradas (Trade): ", "Closed (Trade): ") + ex(s.pnlRealizado || 0) + ".",
          ex(s.pnlAberto) + " + " + ex(s.pnlRealizado || 0) + " = " + ex(s.pnl) + "."
        ].join(NL);
      }

      if (assunto === "patrimonio") {
        var investido = (s.investido != null) ? s.investido : (s.total - (s.caixa || 0));
        return [
          L("Patrimônio = caixa + valor de mercado das posições.", "Net worth = cash + market value of positions."),
          ex(s.caixa || 0) + L(" em caixa + ", " cash + ") + ex(investido) + L(" em posições = ", " positions = ") + ex(s.total) + ".",
          L("Só carteiras globais entram; as isoladas ficam dentro do módulo. Comprar ou vender troca " +
            "caixa por posição sem mudar o total — ele muda com depósito, saque e resultado.",
            "Only global wallets count. Buying or selling swaps cash for a position without changing the total.")
        ].join(NL);
      }

      if (assunto === "caixa") {
        return [
          L("Caixa = cada ativo parado nas carteiras globais × preço de mercado agora.",
            "Cash = each idle asset in global wallets × current market price."),
          L("Ativo sem cotação entra pelo valor depositado, para nunca sumir da conta.",
            "An asset without a quote counts at its deposited value."),
          L("Total: ", "Total: ") + ex(s.caixa || 0) + "."
        ].join(NL);
      }

      if (assunto === "renda") {
        return [
          L("Renda passiva estimada = (valor × APR de cada staking + valor × APY de cada lending) ÷ 12.",
            "Estimated passive income = (value × APR of each staking + value × APY of each lending) ÷ 12."),
          L("Hoje: ", "Now: ") + ex(s.passiveIncome || 0) + L(" por mês.", " per month."),
          L("Pools não entram nesta estimativa.", "Pools are not part of this estimate.")
        ].join(NL);
      }

      return null;
    },

    atencao: function () {
      var sd = demoNaTela() ? consolidado() : null;
      if (sd && sd.demo && sd.alertas.length) {
        return L(sd.alertas.length + " alertas de exemplo:" + NL + sd.alertas.map(function (a) {
                   return "• " + String(a.module || "").toUpperCase() + ": " + a.texto;
                 }).join(NL) + NL + AVISO_DEMO().trim(),
                 sd.alertas.length + " sample alerts." + AVISO_DEMO());
      }
      var todos = alertasAbertos();
      if (!todos.length) {
        return L("Nada pedindo atenção agora — sem alerta em nenhum dos quatro módulos.",
                 "Nothing needs attention right now.");
      }
      /* No máximo três: resposta de dez linhas é resposta que ninguém lê
         até o fim, e o sino guarda a lista inteira. */
      var tres = todos.slice(0, 3);
      var texto = tres.map(function (a) {
        return "• " + (a.module ? String(a.module).toUpperCase() + ": " : "") + a.texto +
               (a.detalhe ? " " + a.detalhe : "");
      }).join("\n");
      var resto = todos.length > 3
        ? L("\n(+" + (todos.length - 3) + " no sino)", "\n(+" + (todos.length - 3) + " in the bell)")
        : "";
      /* Alerta que aponta para uma posição vem com o caminho até ela:
         dizer "a pool saiu da faixa" e deixar a pessoa procurar qual é
         a pool na lista é metade do trabalho. */
      var acoes = [];
      tres.forEach(function (a) {
        if (!a.href || acoes.length >= 3) return;
        var rotulo = a.module === "defi" ? L("Abrir pool", "Open pool") : L("Abrir", "Open");
        var nome = (String(a.texto).match(/^Pool (\S+)/) || [])[1];
        acoes.push({ rotulo: rotulo + (nome && tres.length > 1 ? " " + nome : ""), href: a.href });
      });
      return {
        texto: L((todos.length === 1 ? "1 ponto de atenção." : todos.length + " pontos de atenção.") + "\n" + texto + resto,
                 todos.length + " item(s) need attention.\n" + texto + resto),
        acoes: acoes
      };
    },

    carteiras: function () {
      var W = window.AtlasWallets;
      if (!W || !W.all) return L("Não consigo ler as carteiras daqui.", "Can't read wallets from here.");
      var todas = W.all() || [];
      var globais = todas.filter(function (w) { return w.type !== "isolada"; });
      var locais = todas.length - globais.length;
      var ativa = (W.activeGlobal ? W.activeGlobal() : null);
      /* A contagem sozinha não responde "como estão minhas carteiras?":
         entra o saldo de cada uma, pela mesma comparação do vocabulário. */
      var lista = null;
      try {
        lista = (window.AtlasVocabulario && AtlasVocabulario.RESOLVE && AtlasVocabulario.RESOLVE.comparar)
          ? AtlasVocabulario.RESOLVE.comparar({ metrica: "patrimonio", carteiras: [] }) : null;
      } catch (e) { lista = null; }
      return L(todas.length + (todas.length === 1 ? " carteira" : " carteiras") + ": " +
               globais.length + " global(is), que somam no patrimônio total, e " + locais +
               " local(is), que ficam dentro do módulo." +
               (ativa ? " Ativa agora: " + ativa.name + "." : "") +
               (lista ? NL + lista : ""),
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
      q = normalizar(q);

      /* O assunto sai de intencao() — a tabela ROTAS e o vocabulário. */
      var rota = intencao(q);

      if (rota === "vocabulario") {
        if (demoNaTela()) return respostaDemoFiltrada(AtlasVocabulario.interpretar(q));
        try { return AtlasVocabulario.responder(q); } catch (e) { /* cai na tabela */ }
      }

      if (rota === "mudancas") {
        return mudancasAgora() || L("Não consigo comparar a partir desta tela.",
                                    "I can't compare from this screen.");
      }

      if (rota === "explicar") {
        var exp = baseBrain.explicar(assuntoExplicar(q));
        if (exp) return exp;
      }

      if (rota === "teses") {
        var p = baseBrain.pending();
        if (!p.length) return L("Nenhuma tese em aberto no " + LABEL + ". Fluxo em dia.",
                                "No open theses in " + LABEL + ". All caught up.");
        var untitled = L("sem título", "untitled");
        var listStr = p.map(function (x) { return (x.asset ? x.asset + " — " : "") + (x.title || untitled); }).join("; ");
        return L(p.length + " tese(s) em aberto: " + listStr + ".",
                 p.length + " open thesis(es): " + listStr + ".");
      }

      if (rota === "revisao") {
        var old = baseBrain.pending().filter(function (x) {
          if (!x.createdAt) return false;
          return (Date.now() - new Date(x.createdAt).getTime()) > 72 * 3600 * 1000;
        });
        if (!old.length) return L("Nada além do prazo de 72h. Processo em dia.",
                                  "Nothing past the 72h mark. Process is on track.");
        return L(old.length + " tese(s) abertas há mais de 72h — vale concluir ou arquivar.",
                 old.length + " thesis(es) open for over 72h — worth completing or archiving.");
      }

      if (rota === "atencao") return baseBrain.atencao();
      if (rota === "caixa") return baseBrain.caixa();
      if (rota === "patrimonio") return baseBrain.patrimonio();

      /* "por que não consigo abrir?" é a dúvida que a trava do caixa
         cria, e o Oráculo é onde a pessoa pergunta antes de procurar
         documentação. */
      if (rota === "trava") {
        var c = caixaGlobal();
        return L("Toda posição sai do caixa de uma carteira, e carteira sem caixa não abre " +
                 "posição — em módulo nenhum. Você tem " + dinheiro(c) + " disponível. " +
                 "Se faltar, registre um Depósito em Carteiras & Movimentações; se o dinheiro " +
                 "estiver em outra carteira, use Transferência.",
                 "Every position comes out of a wallet's cash, and a wallet with no cash " +
                 "can't open one. You have " + dinheiro(c) + " available.");
      }

      if (rota === "carteiras") return baseBrain.carteiras();
      if (rota === "fluxo") return baseBrain.fluxo();

      if (rota === "resultado") {
        var s = consolidado();
        if (!s || !s.total) return baseBrain.patrimonio();
        var sinal = s.pnl >= 0 ? "+" : "";
        return L("Resultado acumulado: " + sinal + dinheiro(s.pnl) + pctEntre(s.pnlPct) +
                 " sobre o capital investido. " +
                 "Renda passiva estimada: " + dinheiro(s.passiveIncome) + "." + (s.demo ? AVISO_DEMO() : ""),
                 "Accumulated result: " + sinal + dinheiro(s.pnl) + pctEntre(s.pnlPct) +
                 ". Estimated passive income: " +
                 dinheiro(s.passiveIncome) + "." + (s.demo ? AVISO_DEMO() : ""));
      }

      if (rota === "resumo") return baseBrain.summary();

      if (rota === "moeda" && window.AtlasCurrency) {
        return L("Exibindo em " + AtlasCurrency.code() + ". Os dados continuam " +
                 "armazenados em USD — a moeda é só a camada de leitura.",
                 "Showing in " + AtlasCurrency.code() + ". Data is still stored " +
                 "in USD — currency is only the display layer.");
      }

      if (rota === "backup") {
        return L("Seus dados vivem no armazenamento deste navegador — trocar de máquina " +
                 "ou limpar os dados de navegação apaga tudo. Exporte em Configurações → " +
                 "Dados e Backup, ou pelo Ctrl+K.",
                 "Your data lives in this browser's storage. Export it in " +
                 "Settings → Data and Backup, or via Ctrl+K.");
      }

      /* Não saber é aceitável; deixar o usuário no escuro não é. A
         resposta padrão ENSINA o que dá para perguntar. */
      /* Devolve as perguntas como BOTÕES: uma lista de assuntos em
         texto corrido obriga a pessoa a redigitar o que o Oráculo
         acabou de dizer que sabe. */
      return {
        texto: L("Não entendi a pergunta. Posso responder sobre:",
                 "I didn't understand the question. I can answer about:"),
        sugestoes: SUGESTOES_PADRAO
      };
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
          /* O mesmo avatar do botão flutuante: o painel se identifica
             com o rosto que a pessoa clicou para abri-lo. A bolinha fica
             só como reserva, se a imagem não carregar. */
          '<span class="atlas-oraculo__badge">' +
            '<img class="atlas-oraculo__badge-img" src="' + esc(ORACULO_AVATAR) + '" alt="" ' +
                 'onerror="this.parentNode.classList.add(&quot;atlas-oraculo__badge--fallback&quot;);this.remove()">' +
            '<i></i>' +
          '</span>' +
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

    /* A resposta pode ser texto ou { texto, sugestoes } — o segundo
       formato vira botões que perguntam de novo com um clique. */
    function push(resp, who) {
      var texto = (resp && typeof resp === "object") ? resp.texto : resp;
      var m = document.createElement("div");
      m.className = "atlas-oraculo__msg atlas-oraculo__msg--" + who;
      m.textContent = texto == null ? "" : String(texto);
      if (resp && typeof resp === "object" && resp.sugestoes && resp.sugestoes.length) {
        var box = document.createElement("div");
        box.className = "atlas-oraculo__sugs";
        resp.sugestoes.forEach(function (s) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "atlas-oraculo__chip";
          b.textContent = t(s);
          b.addEventListener("click", function () { ask(s); });
          box.appendChild(b);
        });
        m.appendChild(box);
      }
      if (resp && typeof resp === "object" && resp.acoes && resp.acoes.length) {
        var bar = document.createElement("div");
        bar.className = "atlas-oraculo__sugs";
        resp.acoes.forEach(function (a) {
          var lk = document.createElement("a");
          lk.className = "atlas-oraculo__chip atlas-oraculo__chip--acao";
          lk.href = RAIZ + a.href;
          lk.textContent = a.rotulo;
          bar.appendChild(lk);
        });
        m.appendChild(bar);
      }
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    }

    var conversa = criarConversa();
    var ultimoEstado = null;    /* a linha de estado que o painel já mostrou */

    function responder(q) {
      var c = cortesia(q);
      var r = null;
      if (c.resto) {
        try { r = conversa.responder(c.resto, brain); } catch (e) { r = null; }
        if (r == null || r === "") {
          r = L("Não consegui calcular isso agora.", "I couldn't compute that right now.");
        }
      }
      if (c.saudou) {
        /* Cumprimento sozinho → cumprimento + estado. Cumprimento com
           pergunta → cumprimento antes da resposta, nada além. */
        var pre = saudacaoComNome() + " ";
        /* O estado só volta se mudou: responder "boa tarde" logo após a
           abertura repetia a abertura palavra por palavra. */
        if (!r) {
          var est = estadoCurto();
          if (est === ultimoEstado) return pre.trim();
          ultimoEstado = est;
          return pre + est;
        }
        if (typeof r === "object") return { texto: pre + r.texto, sugestoes: r.sugestoes, acoes: r.acoes };
        return pre + r;
      }
      if (c.despediu) {
        setTimeout(function () { setOpen(false); }, 900);
        return r || L("Até mais.", "See you.");
      }
      if (c.agradeceu && !r) return L("Disponha.", "You're welcome.");
      /* "por favor" sozinho: não há pergunta, mas silêncio é pior. */
      return r || { texto: L("Qual é a pergunta? Posso responder sobre:",
                             "What's the question? I can answer about:"),
                    sugestoes: SUGESTOES_PADRAO };
    }

    /* ------------------------------------------------------------
       SUGESTÕES QUE ACOMPANHAM A CONVERSA

       Os chips eram montados uma vez. Depois de ler o alerta, "O que
       precisa da minha atenção?" continuava lá; depois de perguntar
       o patrimônio, a sugestão seguinte era o próprio patrimônio. A
       cada resposta eles se refazem: primeiro o passo natural depois
       do que foi perguntado, depois o que o estado pede, e nunca o
       que já foi perguntado nesta conversa.
       ------------------------------------------------------------ */
    var perguntadas = {};
    var chipsBox = wrap.querySelector(".atlas-oraculo__chips");

    function renderChips(ultima) {
      var lista = [];
      var u = normalizar(ultima || "");
      SEGUIMENTOS.forEach(function (s) { if (u && s.rx.test(u)) lista = lista.concat(s.prox); });
      var doEstado = [];
      try { doEstado = resolveBrain().chips || []; } catch (e) { doEstado = []; }
      lista = lista.concat(doEstado, SUGESTOES_PADRAO);
      var vistos = {}, saida = [];
      lista.forEach(function (c) {
        var k = normalizar(c);
        if (vistos[k] || perguntadas[k] || saida.length >= 4) return;
        vistos[k] = 1;
        saida.push(c);
      });
      while (chipsBox.firstChild) chipsBox.removeChild(chipsBox.firstChild);
      saida.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "atlas-oraculo__chip";
        b.setAttribute("data-q", c);
        b.textContent = t(c);
        b.addEventListener("click", function () { ask(c); });
        chipsBox.appendChild(b);
      });
    }

    function ask(q) {
      if (!q) return;
      setOpen(true);
      push(q, "user");
      perguntadas[normalizar(q)] = 1;
      setTimeout(function () { push(responder(q), "bot"); renderChips(q); }, 240);
    }
    /* ------------------------------------------------------------
       ABRIR O ORÁCULO É LER O ALERTA

       O selo amarelo contava alertas não lidos, mas só o sino marcava
       como lido. Quem abria o Oráculo por causa do "1" lia, fechava e
       continuava vendo o "1" — o selo pedia uma ação que já tinha sido
       feita. Agora, ao abrir com alerta pendente, o Oráculo diz qual é
       o alerta (senão o selo apontaria para algo que o painel não
       mostra) e o marca como lido, o que apaga o selo e o sino juntos.
       ------------------------------------------------------------ */
    /* Na primeira abertura do Dashboard, o que andou desde a visita
       anterior — antes do alerta, e sem repetir o alerta que vem logo
       a seguir. Só quando mudou algo: "nada mudou" a cada abertura é
       ruído; quem quiser pergunta. Abrir o painel, e não montá-lo, é o
       momento certo: até lá as cotações do caixa e do DeFi chegaram, e
       a comparação não acusa diferença de preço que ainda não carregou. */
    var contouMudancas = false;
    function mudancasNaAbertura(temAlerta) {
      if (contouMudancas || MODULE !== "atlas" || !/dashboard\.html$/.test(location.pathname)) return;
      contouMudancas = true;
      if (demoNaTela() || !visita || !visita.base) return;
      var movs = [];
      try { movs = (window.AtlasMovements && AtlasMovements.list) ? (AtlasMovements.list({}) || []) : []; } catch (e) {}
      var d = descreverMudancas(visita.base, fotografia(), alertasAbertos(), movs, { semAlertas: temAlerta });
      if (d && d.mudou) push(d.texto, "bot");
    }

    function setOpen(v) {
      var abrindo = v && wrap.getAttribute("data-open") !== "true";
      wrap.setAttribute("data-open", v ? "true" : "false");
      if (abrindo) { try { mudancasNaAbertura(brain.alerts() > 0); } catch (e) {} }
      if (!abrindo || !window.AtlasNotifications) return;
      if (brain.alerts() > 0) {
        push(baseBrain.atencao(), "bot");
        try { AtlasNotifications.markAllRead(); } catch (e) {}
        renderChips();
      }
      pintarPinOraculo();
    }

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
    /* A abertura cumprimenta uma vez, pelo horário, e vai ao estado.
       No Dashboard o resumo vira a linha curta (patrimônio + alertas);
       nos módulos continua o resumo de teses de cada um. */
    var resumo = "";
    try { resumo = brain.summary() || ""; } catch (e) { resumo = ""; }
    if (MODULE === "atlas") ultimoEstado = estadoCurto();
    push(saudacaoComNome() + " " + (MODULE === "atlas" ? ultimoEstado : resumo), "bot");

    wrap._ask = ask;
    wrap._responder = responder;
    wrap._setOpen = setOpen;
    wrap._alerts = brain.alerts;
    pintarPinOraculo(wrap);
    return wrap;
  }

  /* O selo era pintado uma vez, na montagem, e nunca mais: marcar como
     lido pelo sino ou pelo próprio Oráculo não o apagava até recarregar
     a página. Agora ele segue AtlasNotifications como o sino segue.
     Procura o elemento a cada pintura porque registerBrain() refaz o
     componente — um ouvinte preso ao elemento antigo pintaria um nó
     que já saiu da página. */
  function pintarPinOraculo(el) {
    el = el || document.querySelector('[data-atlas-ui="oraculo"]');
    if (!el || !el._alerts) return;
    var pin = el.querySelector(".atlas-oraculo__pin");
    if (!pin) return;
    var n = 0;
    try { n = el._alerts() || 0; } catch (e) { n = 0; }
    pin.hidden = !(n > 0);
    pin.textContent = n > 9 ? "9+" : (n > 0 ? String(n) : "");
  }

  if (window.AtlasNotifications && AtlasNotifications.onChange) {
    AtlasNotifications.onChange(function () { pintarPinOraculo(); });
  }
  document.addEventListener("atlas:movement", function () { pintarPinOraculo(); });
  document.addEventListener("atlas:theses", function () { pintarPinOraculo(); });
  document.addEventListener("atlas:alertas", function () { pintarPinOraculo(); });

  /* Esc fecha o Oráculo. Um ouvinte só, aqui fora: dentro de
     buildOraculo() cada registerBrain() — que refaz o componente —
     somava mais um, preso a um painel que já tinha saído da página. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var el = document.querySelector('[data-atlas-ui="oraculo"]');
    if (el && el._setOpen) el._setOpen(false);
  });

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
     3b. A BARRA SUPERIOR DE CADA MÓDULO
     ------------------------------------------------------------
     Onde o shell encaixa o sino e a dica do Ctrl+K: o agrupamento à
     direita da barra de cada módulo e, se não achar, a própria barra.
     Página sem barra simplesmente não recebe nada — nada quebra.

     O alternador de tema que morava aqui SAIU (decisão do dono,
     2026-09-22): o tema claro fica em Configurações → Aparência, e
     pela paleta (Ctrl+K). A barra guarda o que se usa todo dia.
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
          (a.detalhe ? '<div class="atlas-bell__det">' + esc(a.detalhe) + '</div>' : "") +
          '<div class="atlas-bell__meta">' +
            (a.module ? '<span class="atlas-bell__mod">' + esc(a.module) + "</span>" : "") +
            "<span>" + esc(a.quando) + "</span>" +
            (a.href ? '<a class="atlas-bell__go" href="' + esc(RAIZ + a.href) + '">' +
                      esc(a.module === "defi" ? t("Abrir pool") : t("Abrir")) + "</a>" : "") +
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

    barra.appendChild(raiz);

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
    document.addEventListener("atlas:alertas", function () { pintarSino(raiz); });
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

  function mount() {
    if (!document.body) return;

    mountSkipLink();
    mountPaletteHint();
    mountBell();

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
    },
    /* Para pages/testes-oraculo.html: o raciocínio sem a interface.
       responder() passa pela cortesia e pelos cérebros de módulo, como
       uma pergunta digitada, mas não mexe no painel. */
    teste: {
      normalizar: normalizar,
      intencao: intencao,
      cortesia: cortesia,
      saudacaoAgora: saudacaoAgora,
      descreverMudancas: descreverMudancas,
      respostaDemoFiltrada: respostaDemoFiltrada,
      /* Uma conversa nova, isolada da do painel: a bateria encadeia
         perguntas sem herdar o que a pessoa perguntou antes. */
      conversa: function () {
        var c = criarConversa(), brain = resolveBrain();
        return {
          perguntar: function (q) { return c.responder(cortesia(q).resto || normalizar(q), brain); },
          estado: c.estado
        };
      },
      responder: function (q) {
        var el = document.querySelector('[data-atlas-ui="oraculo"]');
        return (el && el._responder) ? el._responder(q) : null;
      }
    }
  };

  /* Visita: começa quando a página termina de carregar (os módulos
     carregam com defer, e a consolidação precisa deles) e fecha a
     fotografia ao sair. visibilitychange cobre o celular, onde
     pagehide nem sempre dispara ao trocar de app. */
  function ligarVisita() {
    /* página de testes: só lê, não conta como visita */
    if (document.documentElement.hasAttribute("data-atlas-sem-visita")) return;
    try { iniciarVisita(); } catch (e) {}
    window.addEventListener("pagehide", function () { try { atualizarUltimo(); } catch (e) {} });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { try { atualizarUltimo(); } catch (e) {} }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); watch(); watchPin(); ligarVisita(); });
  } else {
    mount(); watch(); watchPin(); ligarVisita();
  }
})();
