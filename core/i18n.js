/* ============================================================
   ATLAS · core/i18n.js
   ------------------------------------------------------------
   Internacionalização — MOTOR PRONTO, DORMENTE POR DECISÃO.

   ⚠ ESTADO ATUAL: o ATLAS é um sistema em PORTUGUÊS.

   O seletor de idioma foi retirado das Configurações e "en" saiu de
   ALLOWED.lang em core/settings.js. Não foi desistência nem descuido:
   o motor abaixo funciona, mas a COBERTURA nunca existiu. O dicionário
   alcança a navegação e alguns rótulos, enquanto o conteúdo dos
   módulos — milhares de textos escritos direto no código — segue em
   português. Oferecer "English" entregava uma tela metade traduzida,
   que é pior do que não oferecer: promete o que não cumpre.

   Este arquivo NÃO é código morto, e não deve ser apagado:

     · continua servindo t() e formatação a quem já chama;
     · guarda as traduções que já foram escritas;
     · o observador de DOM se desliga sozinho enquanto houver um idioma
       só (ver multiIdioma(), no fim do arquivo) — custo zero.

   PARA LIGAR UM IDIOMA: acrescente o código em ALLOWED.lang
   (core/settings.js), devolva a linha "Idioma" em configuracoes.html e
   complete o dicionário. O motor volta a trabalhar sozinho, inclusive
   o observador. Nada aqui precisa ser reescrito.

   ------------------------------------------------------------
   O desafio real
   --------------
   O ATLAS tem ~18 mil linhas com texto em português cravado no
   código. Trocar tudo por chaves (t("nav.dashboard")) de uma vez
   quebraria o sistema inteiro. Então o motor trabalha em duas
   frentes, e as duas convivem:

     1. CHAVES        t("nav.dashboard")       → uso novo, ideal
     2. TEXTO-CHAVE   t("Painel")              → o próprio texto em
                                                 pt-BR vira a chave

   A frente 2 permite internacionalizar o sistema existente sem
   reescrevê-lo. Código novo deve preferir a frente 1.

   Varredura de DOM
   ----------------
   window.AtlasI18n.sweep(root) traduz a tela já renderizada quando o
   idioma é "en". Para não corromper dados do usuário, a varredura
   é DELIBERADAMENTE conservadora:

     - só entra em elementos de interface (nav, botões, rótulos,
       cabeçalhos, th, .eyebrow...) — nunca em áreas de conteúdo;
     - nunca toca em input/textarea/select/code/pre;
     - ignora qualquer subárvore marcada com data-no-i18n;
     - só substitui quando existe tradução EXATA no dicionário;
     - é idempotente (marca o nó traduzido).

   API
   ---
     window.AtlasI18n.t(key, vars)      -> string traduzida
     window.AtlasI18n.lang()            -> "pt-BR" | "en"
     window.AtlasI18n.has(key)          -> boolean
     window.AtlasI18n.add(lang, dict)   -> estende o dicionário
     window.AtlasI18n.sweep(root)       -> traduz DOM já pronto
     window.AtlasI18n.bind(root)        -> aplica [data-i18n] e derivados
     window.AtlasI18n.refresh()         -> bind + sweep no documento todo
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasI18n) return;

  /* ============================================================
     DICIONÁRIO — chave em português (ou chave técnica) → inglês
     ============================================================ */
  var EN = {
    /* ---------- Cobertura de telas (Etapa 2) ---------- */
    "SISTEMA OPERACIONAL FINANCEIRO": "FINANCIAL OPERATING SYSTEM",
    "Evolução Patrimonial": "Net worth evolution",
    "Evolução dos Lucros": "Profit evolution",
    "Distribuição por Categoria": "Distribution by category",
    "Distribuição por Blockchain": "Distribution by blockchain",
    "Distribuição": "Distribution",
    "Distribuições": "Distributions",
    "Categoria": "Category",
    "Protocolo": "Protocol",
    "Por protocolo": "By protocol",
    "Fechar posição": "Close position",
    "Editar posição": "Edit position",
    "Posições de staking": "Staking positions",
    "Posições de lending": "Lending positions",
    "Valor atual": "Current value",
    "Motivo do encerramento": "Reason for closing",
    "APR Realizado por Posição": "Realized APR by position",
    "Nova Pool": "New pool",
    "+ Nova tese": "+ New thesis",
    "Objetivo": "Goal",
    "Escolha a blockchain": "Choose the blockchain",
    "Escolha o protocolo": "Choose the protocol",
    "Token base": "Base token",
    "Token par": "Pair token",
    "Capital inicial": "Initial capital",
    /* boot / login / configurações de módulo */
    "Ligando sistema…": "Booting system…",
    "pular boot ›": "skip boot ›",
    "Entrar na sua conta": "Sign in to your account",
    "Senha": "Password",
    "Esqueceu sua senha?": "Forgot your password?",
    "Entrar": "Sign in",
    "Cadastre-se": "Sign up",
    "Aparência & idioma": "Appearance & language",
    "Dados": "Data",
    "Fazer backup": "Back up",
    "Restaurar": "Restore",

    /* ---------- Navegação e módulos ---------- */
    "Painel": "Dashboard",
    "Dashboard": "Dashboard",
    "Ativos": "Assets",
    "Teses": "Theses",
    "Tese": "Thesis",
    "Relatórios": "Reports",
    "Relatório": "Report",
    "Configurações": "Settings",
    "Carteira": "Wallet",
    "Carteiras": "Wallets",
    "Carteira Local": "Local Wallet",
    "Watchlist": "Watchlist",
    "Métricas": "Metrics",
    "Histórico": "History",
    "Analytics": "Analytics",
    "Pools": "Pools",
    "Staking": "Staking",
    "Lending": "Lending",
    "Portfolio": "Portfolio",
    "Macro": "Macro",
    "Journal": "Journal",
    "Academy": "Academy",
    "Oráculo": "Oracle",
    "Voltar ao Atlas": "Back to Atlas",
    "Operação": "Operations",
    "Terminal": "Terminal",
    "Trades": "Trades",
    "Registro de Decisão": "Decision Record",

    /* ---------- Ações ---------- */
    "Salvar": "Save",
    "Salvar perfil": "Save profile",
    "Cancelar": "Cancel",
    "Excluir": "Delete",
    "Remover": "Remove",
    "Editar": "Edit",
    "Adicionar": "Add",
    "Novo": "New",
    "Nova": "New",
    "Criar": "Create",
    "Confirmar": "Confirm",
    "Fechar": "Close",
    "Buscar": "Search",
    "Pesquisar": "Search",
    "Filtrar": "Filter",
    "Exportar": "Export",
    "Importar": "Import",
    "Atualizar": "Refresh",
    "Ver todas": "View all",
    "Ver todos": "View all",
    "Ver detalhes": "View details",
    "Voltar": "Back",
    "Aplicar": "Apply",
    "Limpar": "Clear",
    "Concluir": "Complete",
    "Arquivar": "Archive",
    "Reabrir": "Reopen",
    "Duplicar": "Duplicate",
    "Imprimir / PDF": "Print / PDF",
    "Exportar JSON": "Export JSON",
    "Exportar PDF": "Export PDF",
    "Exportar Excel": "Export Excel",
    "Nova carteira": "New wallet",
    "Nova carteira Local": "New local wallet",

    /* ---------- Finanças ---------- */
    "Patrimônio": "Net worth",
    "Patrimônio total": "Total net worth",
    "Patrimônio inicial": "Opening balance",
    "Patrimônio final": "Closing balance",
    "Patrimônio DeFi": "DeFi net worth",
    "Evolução patrimonial": "Net worth evolution",
    "Valor de mercado": "Market value",
    "Custo investido": "Invested cost",
    "Preço": "Price",
    "Preço médio": "Average price",
    "Preço atual": "Current price",
    "Quantidade": "Quantity",
    "Aporte": "Deposit",
    "Aportes": "Deposits",
    "Retirada": "Withdrawal",
    "Retiradas": "Withdrawals",
    "Movimentações": "Transactions",
    "Lucro": "Profit",
    "Prejuízo": "Loss",
    "Lucro/Prejuízo": "Profit/Loss",
    "Resultado": "Result",
    "Rentabilidade": "Return",
    "Alocação": "Allocation",
    "Posição": "Position",
    "Posições": "Positions",
    "Posições ativas": "Open positions",
    "Saldo": "Balance",
    "Total": "Total",
    "Moeda": "Currency",
    "Moeda de referência": "Reference currency",
    "Taxa": "Fee",
    "Taxas": "Fees",
    "Rendimento": "Yield",
    "Alavancagem": "Leverage",
    "Liquidação": "Liquidation",
    "Entrada": "Entry",
    "Saída": "Exit",
    "Alvo": "Target",
    "Stop": "Stop",
    "Risco": "Risk",

    /* ---------- Estados ---------- */
    "Ativo": "Active",
    "Ativa": "Active",
    "Inativo": "Inactive",
    "Planejada": "Planned",
    "Em andamento": "In progress",
    "Concluída": "Completed",
    "Concluído": "Completed",
    "Arquivada": "Archived",
    "Pendente": "Pending",
    "Aberta": "Open",
    "Aberto": "Open",
    "Fechada": "Closed",
    "Fechado": "Closed",
    "Em revisão": "Under review",
    "Sistema ativo": "System online",
    "Carregando…": "Loading…",
    "Carregando...": "Loading...",
    "Sem dados": "No data",
    "Nenhum resultado": "No results",

    /* ---------- Tempo ---------- */
    "Hoje": "Today",
    "Ontem": "Yesterday",
    "Data": "Date",
    "Período": "Period",
    "Mês": "Month",
    "Ano": "Year",
    "Bom dia": "Good morning",
    "Boa tarde": "Good afternoon",
    "Boa noite": "Good evening",
    "Janeiro": "January", "Fevereiro": "February", "Março": "March",
    "Abril": "April", "Maio": "May", "Junho": "June",
    "Julho": "July", "Agosto": "August", "Setembro": "September",
    "Outubro": "October", "Novembro": "November", "Dezembro": "December",

    /* ---------- Configurações ---------- */
    "Aparência": "Appearance",
    "Tema": "Theme",
    "Tema escuro": "Dark theme",
    "Tema claro": "Light theme",
    "Escuro": "Dark",
    "Claro": "Light",
    "Idioma": "Language",
    "Português (Brasil)": "Portuguese (Brazil)",
    "Inglês": "English",
    "Preferências": "Preferences",
    "Formato de data": "Date format",
    "Formato numérico": "Number format",
    "Moeda padrão": "Default currency",
    "Idioma padrão": "Default language",
    "Tema padrão": "Default theme",
    "Animações": "Animations",
    "Ativar animações": "Enable animations",
    "Dados locais": "Local data",
    "Perfil": "Profile",
    "Nome do gestor": "Manager name",
    "Restaurar padrões": "Restore defaults",

    /* ---------- Chaves técnicas (uso novo, preferir estas) ---------- */
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    "settings.currency": "Currency",
    "settings.preferences": "Preferences",
    "report.title": "Reports",
    "report.month": "Month",
    "report.opening": "Opening balance",
    "report.closing": "Closing balance",
    "report.pnl": "Profit / Loss",
    "oracle.placeholder": "Ask the Oracle…",
    "oracle.title": "Oracle",
    "wallet.local": "Local wallet",
    "wallet.global": "Global wallet",
    "common.empty": "Nothing here yet"
  };

  var DICTS = { "pt-BR": {}, "en": EN };

  /* ============================================================
     Núcleo
     ============================================================ */

  function lang() {
    return (window.AtlasSettings && window.AtlasSettings.get("lang")) || "pt-BR";
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return (k in vars) ? String(vars[k]) : m;
    });
  }

  function t(key, vars) {
    if (key == null) return "";
    var l = lang();
    var dict = DICTS[l] || {};
    var out = dict[key];
    if (out == null) out = key;           // pt-BR ou chave sem tradução
    return interpolate(String(out), vars);
  }

  /* ============================================================
     Aplicação declarativa: [data-i18n] e derivados
     ============================================================ */

  function bind(root) {
    root = root || document;
    if (!root.querySelectorAll) return;

    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
  }

  /* ============================================================
     Varredura conservadora do DOM existente
     ============================================================ */

  // Onde é seguro traduzir: superfícies de interface, não de conteúdo.
  var UI_SELECTOR = [
    "nav", "header", "th", "label", "button",
    ".nav-item", ".nav__item", ".nav-link", ".nav-back", ".side-back", ".nav__back",
    ".btn", ".tab", ".tab-btn", ".eyebrow", ".label", ".field-label",
    ".page-title", ".card-title", ".kpi-label", ".stat-label",
    "h1", "h2", "h3", ".empty h3", ".empty p"
  ].join(",");

  var BLOCKED_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1 };

  function isBlocked(el) {
    while (el && el !== document.documentElement) {
      if (BLOCKED_TAGS[el.tagName]) return true;
      if (el.hasAttribute && el.hasAttribute("data-no-i18n")) return true;
      if (el.hasAttribute && el.hasAttribute("data-i18n")) return true; // já tratado por bind()
      el = el.parentElement;
    }
    return false;
  }

  function translateTextNodes(host, dict) {
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null, false);
    var node, pending = [];
    while ((node = walker.nextNode())) {
      var raw = node.nodeValue;
      if (!raw) continue;
      var trimmed = raw.trim();
      if (!trimmed || trimmed.length > 80) continue;
      if (!(trimmed in dict)) continue;
      if (isBlocked(node.parentElement)) continue;
      pending.push([node, raw.replace(trimmed, dict[trimmed])]);
    }
    pending.forEach(function (p) { p[0].nodeValue = p[1]; });
    return pending.length;
  }

  function sweep(root) {
    var l = lang();
    if (l === "pt-BR") return 0;          // pt-BR é o texto nativo
    var dict = DICTS[l];
    if (!dict) return 0;

    root = root || document.body;
    if (!root || !root.querySelectorAll) return 0;

    var count = 0;
    var hosts = root.querySelectorAll(UI_SELECTOR);
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].getAttribute("data-i18n-done") === l) continue;
      count += translateTextNodes(hosts[i], dict);
      hosts[i].setAttribute("data-i18n-done", l);
    }
    // title/placeholder soltos
    root.querySelectorAll("[title],[placeholder]").forEach(function (el) {
      var ti = el.getAttribute("title");
      if (ti && dict[ti.trim()]) el.setAttribute("title", dict[ti.trim()]);
      var ph = el.getAttribute("placeholder");
      if (ph && dict[ph.trim()]) el.setAttribute("placeholder", dict[ph.trim()]);
    });
    return count;
  }

  function refresh() {
    bind(document);
    sweep(document.body);
  }

  /* ============================================================
     Observador: telas renderizadas por JS também são traduzidas
     ============================================================ */
  var observer = null;
  var pendingSweep = null;

  /* Existe mais de um idioma para o sistema oferecer?
     Enquanto houver só português, o observador abaixo não tem o que
     fazer — e ele custa: a callback dispara a CADA mutação do DOM, em
     toda a subárvore. Hold, Trade e RWA re-renderizam a view inteira a
     cada troca de rota e a cada mudança de estado, então era uma
     chamada por render, o dia inteiro, para sair na primeira linha.

     Ler de AtlasSettings.options("lang") amarra isto à mesma lista que
     governa a tela de Configurações: acrescentar um idioma lá religa o
     observador sozinho, sem ninguém precisar lembrar deste arquivo. */
  function multiIdioma() {
    if (!window.AtlasSettings || !AtlasSettings.options) return true;
    try { return AtlasSettings.options("lang").length > 1; }
    catch (e) { return true; }
  }

  function watch() {
    if (observer || !window.MutationObserver || !document.body) return;
    if (!multiIdioma()) return;
    observer = new MutationObserver(function (muts) {
      if (lang() === "pt-BR") return;
      var relevant = muts.some(function (m) { return m.addedNodes && m.addedNodes.length; });
      if (!relevant) return;
      clearTimeout(pendingSweep);
      pendingSweep = setTimeout(function () { sweep(document.body); }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
     API
     ============================================================ */
  window.AtlasI18n = {
    t: t,
    lang: lang,
    has: function (key) { return !!(DICTS[lang()] || {})[key]; },
    dict: function (l) { return DICTS[l || lang()] || {}; },
    add: function (l, obj) {
      DICTS[l] = DICTS[l] || {};
      Object.keys(obj || {}).forEach(function (k) { DICTS[l][k] = obj[k]; });
    },
    bind: bind,
    sweep: sweep,
    refresh: refresh,
    watch: watch
  };

  // Atalho global — encurta o uso no código dos módulos
  if (!window.t) window.t = t;

  // Trocar o idioma redesenha os textos na hora
  if (window.AtlasSettings) {
    window.AtlasSettings.on(function (changed) {
      if (changed.indexOf("lang") === -1) return;
      if (lang() === "pt-BR") {
        // voltar ao português exige repintar as views
        location.reload();
        return;
      }
      document.querySelectorAll("[data-i18n-done]").forEach(function (el) {
        el.removeAttribute("data-i18n-done");
      });
      refresh();
      watch();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { refresh(); watch(); });
  } else {
    refresh(); watch();
  }
})();
