/* ============================================================
   ATLAS · core/ui/atlas-icons.js
   ------------------------------------------------------------
   A BIBLIOTECA DE ÍCONES — uma só, com UMA assinatura.

   O problema
   ----------
   Existiam QUATRO tabelas de ícone, com TRÊS assinaturas diferentes
   para a mesma função:

     defi/js/utils.js            icon(nome)
     RWA/js/utils.js             icon(nome)
     hold/js/components.js       icon(nome, CLASSE)
     trade/.../core/util.js      icon(nome, TAMANHO)

   O segundo argumento significava coisas diferentes em módulos
   diferentes. Isso não é hipótese: o próprio código do projeto
   documenta o estrago em wallets/walletSelector.js — U.icon("plus", 13)
   no Hold virava class="ico 13", o SVG saía sem width/height, esticava,
   e transformava o botão "Nova carteira" num bloco de 226x220px.

   Eram 106 entradas para 73 nomes distintos: 33 desenhos repetidos, e
   19 nomes desenhados de formas DIFERENTES em módulos diferentes — o
   mesmo conceito com traço distinto dependendo da tela.

   A solução
   ---------
   Um registro só. E uma assinatura que aceita as três convenções
   antigas, para nenhum chamador precisar mudar e nenhum confundir
   tamanho com classe nunca mais:

     AtlasIcons.get("plus")                    padrão
     AtlasIcons.get("plus", 14)                número  -> tamanho
     AtlasIcons.get("plus", "ico")             string  -> classe
     AtlasIcons.get("plus", { size: 14, class: "ico", strokeWidth: 2 })

   Devolve "" para nome desconhecido — assim quem chama sabe cair na
   própria tabela em vez de exibir um quadrado vazio.

   ARQUIVO GERADO a partir das quatro tabelas que existiam. Quando o
   mesmo nome tinha desenhos diferentes, venceu o que aparecia em mais
   módulos, para a mudança de aparência atingir o menor número de telas.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasIcons) return;

  var PATHS = {
    alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    analytics: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 5-7"/>',
    archive: '<path d="M3 4h18v4H3zM5 8v12h14V8M9 12h6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
    beaker: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><line x1="7" y1="15" x2="17" y2="15"/>',
    bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7" rx="1"/><rect x="12" y="6" width="3" height="11" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    coins: '<circle cx="8" cy="8" r="5"/><path d="M18.1 6.2a5 5 0 0 1 0 9.6M14 14a5 5 0 0 1-6 4.8"/>',
    convert: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    drop: '<path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    estudos: '<path d="M4 4h11a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4z"/><path d="M4 4v13.5A2.5 2.5 0 016.5 20H18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    flame: '<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 2-5 2-9Z"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>',
    gauge: '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M13.4 12.6 19 7"/><path d="M4.6 19a9 9 0 1 1 14.8 0"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/>',
    /* Sol e lua entram para o alternador de tema da barra superior:
       o ícone tem de ser o mesmo em todos os módulos, e é aqui que
       essa promessa se cumpre. */
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    /* Reticências verticais: o botão de "mais ações" de uma linha de
       tabela. Não é de um módulo só — é o gesto padrão para tirar da
       linha o que não é do dia a dia sem escondê-lo. */
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    in: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    journal: '<path d="M4 4h13l3 3v13H4Z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    lend: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3H15"/>',
    macro: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    narrative: '<path d="M4 5h16M4 12h10M4 19h16"/><circle cx="18" cy="12" r="2.4"/>',
    oracle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    out: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pools: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>',
    portfolio: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>',
    pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    rd: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    re: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/>',
    risk: '<path d="M12 2 2 21h20L12 2Z"/><path d="M12 9v5M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/>',
    spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    stake: '<path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z"/><path d="m9 12 2 2 4-4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trades: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    trend: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
    wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 7l1.5-3.5A1 1 0 0 1 5.4 3H17"/><path d="M17 12h.01"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  };

  /* Nomes diferentes para o mesmo desenho. Cada módulo batizou o seu
     jeito; aqui os apelidos convergem para um nome canônico. */
  var ALIAS = {
    config: 'settings',
    down: 'arrowDown',
    gear: 'settings',
    grid: 'dashboard',
    trendUp: 'trend',
    up: 'arrowUp',
    x: 'close',
  };

  function resolver(nome) {
    if (!nome) return "";
    if (PATHS[nome]) return PATHS[nome];
    var a = ALIAS[nome];
    return a && PATHS[a] ? PATHS[a] : "";
  }

  /* Aceita as três convenções antigas de segundo argumento. É esta
     tolerância que impede o bug do "13 virou classe". */
  function normalizar(opts) {
    if (opts == null) return {};
    if (typeof opts === "number") return { size: opts };
    if (typeof opts === "string") return { "class": opts };
    return opts;
  }

  function get(nome, opts) {
    var corpo = resolver(nome);
    if (!corpo) return "";                    // desconhecido: quem chama decide

    var o = normalizar(opts);
    var cls = o["class"] || o.cls || "";
    var sw = o.strokeWidth != null ? o.strokeWidth : 1.8;

    /* width/height só entram quando pedidos. Sem eles o SVG herda o
       tamanho do CSS, que é o que os módulos esperam — e COM eles um
       SVG sem regra de CSS não estica pela caixa toda. */
    var medida = o.size ? ' width="' + o.size + '" height="' + o.size + '"' : "";

    return '<svg' + (cls ? ' class="' + cls + '"' : "") + medida +
      ' viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' +
      ' aria-hidden="true" focusable="false">' + corpo + '</svg>';
  }

  global.AtlasIcons = {
    get: get,
    has: function (nome) { return !!resolver(nome); },
    names: function () { return Object.keys(PATHS).sort(); },
    /* um módulo pode acrescentar o que só ele tem, sem editar este arquivo */
    add: function (nome, corpo) { if (nome && corpo) PATHS[nome] = corpo; }
  };
})(typeof window !== "undefined" ? window : this);
