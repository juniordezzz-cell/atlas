// GERADO por gerar-site.mjs a partir dos arquivos do site. Não edite à mão.
// Mudou algum desses arquivos? Rode: node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs
export function codigoSite(window, localStorage) {
"use strict";
// ---- wallets/walletStore.js ----
/* ============================================================
   ATLAS · /wallets/walletStore.js
   ------------------------------------------------------------
   NÚCLEO DE PERSISTÊNCIA E ESTADO — a fonte única da verdade.

   Este arquivo é o ÚNICO lugar do ATLAS inteiro que grava e lê
   carteiras. Nenhum módulo (Hold, Trade, DeFi, RWA, Dashboard)
   toca no localStorage de carteira direto — todos passam por
   AtlasWallets, que por baixo usa este store.

   O que o store guarda por carteira:
     { id, name, type:"global"|"isolada", module, color, emoji,
       order, isDefault }
   (Capital, saldo, valor atual e ativos vinculados ficam no
    ledger — walletLedger.js — mas persistidos junto, aqui.)

   Chave de storage: "atlas.wallets.v2"  (a MESMA de antes, para
   adotar os dados existentes sem perder nada na migração).

   Exposto em: window.AtlasWalletStore  (uso interno do pacote;
   os módulos NÃO chamam isto — chamam window.AtlasWallets).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasWalletStore) return;

  var KEY = "atlas.wallets.v2";

  /* ---- persistência resiliente (file:// e http) ---- */
  var mem = null;
  function canLS() {
    try {
      var k = "__atlas_w_probe__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  var HAS_LS = canLS();

  function readRaw() {
    if (!HAS_LS) return mem;
    try { return global.localStorage.getItem(KEY); } catch (e) { return mem; }
  }
  function writeRaw(str) {
    mem = str;
    if (!HAS_LS) return;
    try { global.localStorage.setItem(KEY, str); } catch (e) { /* fica em memória */ }
  }

  /* ---- pub/sub para a UI reagir a mudanças ---- */
  var subs = [];
  /* itera sobre uma CÓPIA: um assinante pode assinar/desassinar
     durante o próprio aviso sem embaralhar a lista em uso */
  function emit() { subs.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  /* devolve a função de cancelar — quem monta e desmonta usa ela */
  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    if (subs.indexOf(fn) === -1) subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i !== -1) subs.splice(i, 1);
    };
  }

  /* reage a mudanças vindas de OUTRA aba/módulo (mesmo origin) */
  if (HAS_LS) {
    global.addEventListener("storage", function (ev) {
      if (ev && ev.key === KEY) { _cache = null; emit(); }
    });
  }

  /* ---- estado inicial (primeira vez) ---- */
  function seed() {
    return {
      activeGlobalId: "principal",
      defaultId: "principal",
      wallets: [
        { id: "principal", name: "Principal", type: "global", module: null,
          color: "#4C9AFF", emoji: "", order: 0, isDefault: true }
      ],
      /* carteira ativa de cada módulo: { hold: id, defi: id, ... }
         Só precisa entrar aqui quando é uma carteira LOCAL — quando o
         módulo está numa global, a ativa é a activeGlobalId. */
      activeByModule: {},
      ledger: {}   // { walletId: { module: { capital, saldo, valorAtual, assets:[] } } }
    };
  }

  function firstGlobal(list) {
    for (var i = 0; i < list.length; i++) if (list[i].type === "global") return list[i];
    return list[0];
  }

  /* ------------------------------------------------------------
     MIGRAÇÃO / NORMALIZAÇÃO
     Lê o formato antigo (sem order/isDefault/ledger) e completa
     os campos novos sem descartar nada. Roda toda vez que carrega.
     ------------------------------------------------------------ */
  function normalize(data) {
    if (!data || !Array.isArray(data.wallets) || !data.wallets.length) return seed();

    // garante order sequencial estável e campos novos
    data.wallets.forEach(function (w, i) {
      if (typeof w.order !== "number") w.order = i;
      if (typeof w.isDefault !== "boolean") w.isDefault = false;
      if (typeof w.emoji !== "string") w.emoji = w.emoji || "";
      if (!w.color) w.color = "#4C9AFF";
      if (w.type !== "isolada") w.type = "global";
    });

    // ordena pela ordem persistida (mantém a lista determinística)
    data.wallets.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    data.wallets.forEach(function (w, i) { w.order = i; });

    // carteira padrão: se nenhuma marcada, a primeira global vira padrão
    var marked = data.wallets.filter(function (w) { return w.isDefault; });
    if (!marked.length) {
      var g = firstGlobal(data.wallets);
      if (g) g.isDefault = true;
      data.defaultId = g ? g.id : data.wallets[0].id;
    } else {
      // só UMA padrão
      marked.slice(1).forEach(function (w) { w.isDefault = false; });
      data.defaultId = marked[0].id;
    }

    // ativa global: precisa existir e ser global
    var act = data.wallets.filter(function (w) { return w.id === data.activeGlobalId; })[0];
    if (!act || act.type !== "global") data.activeGlobalId = firstGlobal(data.wallets).id;

    if (!data.ledger || typeof data.ledger !== "object") data.ledger = {};

    /* carteira ativa por módulo: descarta apontamentos para carteiras
       que não existem mais (excluídas aqui ou em outra aba) */
    if (!data.activeByModule || typeof data.activeByModule !== "object") data.activeByModule = {};
    var ids = {};
    data.wallets.forEach(function (w) { ids[w.id] = 1; });
    Object.keys(data.activeByModule).forEach(function (m) {
      if (!ids[data.activeByModule[m]]) delete data.activeByModule[m];
    });

    return data;
  }

  /* ---- cache em memória para não reparsear a cada leitura ---- */
  var _cache = null;
  function load() {
    if (_cache) return _cache;
    var raw = readRaw();
    if (!raw) { _cache = seed(); writeRaw(JSON.stringify(_cache)); return _cache; }
    try {
      _cache = normalize(JSON.parse(raw));
    } catch (e) {
      _cache = seed();
      writeRaw(JSON.stringify(_cache));
    }
    return _cache;
  }

  function save(data) {
    _cache = data;
    writeRaw(JSON.stringify(data));
    emit();
  }

  /* API interna do store (o manager é quem expõe ao mundo) */
  global.AtlasWalletStore = {
    KEY: KEY,
    hasLS: HAS_LS,
    load: load,
    save: save,
    firstGlobal: firstGlobal,
    subscribe: subscribe,
    emit: emit,
    /* invalida o cache — usado quando outra camada grava direto no ledger */
    invalidate: function () { _cache = null; }
  };
})(typeof window !== "undefined" ? window : this);

;
// ---- wallets/walletTypes.js ----
/* ============================================================
   ATLAS · /wallets/walletTypes.js
   ------------------------------------------------------------
   TIPOS, ÍCONES E RÓTULOS DE CARTEIRA.

   Tudo que descreve a APARÊNCIA e o VOCABULÁRIO de uma carteira
   (globo x cofre, iniciais x emoji, "Global" x "Local") mora aqui
   — separado da lógica de estado (walletStore) e da API pública
   (walletManager).

   O tipo interno continua "global" | "isolada" (para não quebrar
   Trade/RWA, que já gravam essa string). Na interface, "isolada"
   é mostrada como "Local".

   Exposto em: window.AtlasWalletTypes  (uso interno do pacote).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasWalletTypes) return;

  function capitalize(s) {
    s = String(s || "");
    var map = { hold: "Hold", trade: "Trade", defi: "DeFi", rwa: "RWA" };
    return map[s] || (s.charAt(0).toUpperCase() + s.slice(1));
  }

  var T = {
    /* iniciais para o "avatar" da carteira */
    initials: function (name) {
      var p = (name || "").trim().split(/\s+/);
      if (!p[0]) return "?";
      return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
    },

    /* O que aparece no selo redondo: emoji se houver, senão iniciais. */
    badge: function (w) {
      if (!w) return "";
      if (w.emoji) return w.emoji;
      return T.initials(w.name);
    },

    /* Ícone que identifica o TIPO da carteira.
       global  → globo: soma no total do ATLAS, atravessa todos os módulos.
       isolada → cofre: vive dentro de um módulo só, fora do total. */
    typeIcon: function (type, size) {
      var s = size || 14;
      var open = '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
                 '" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                 'stroke-linecap="round" stroke-linejoin="round">';
      if (type === "isolada") {
        return open +
          '<rect x="3" y="4" width="18" height="16" rx="2.5"/>' +
          '<circle cx="12" cy="12" r="3.6"/>' +
          '<path d="M12 8.4V6.6M12 17.4v-1.8M15.6 12h1.8M6.6 12h1.8"/>' +
          '</svg>';
      }
      return open +
        '<circle cx="12" cy="12" r="9"/>' +
        '<path d="M3 12h18"/>' +
        '<path d="M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z"/>' +
        '</svg>';
    },

    /* Paleta de ícones, em grupos. Símbolos de ativo são caracteres
       de texto (não logotipos), e os bichos das carteiras conhecidas
       são reconhecíveis sem copiar marca registrada. */
    iconGroups: function () {
      return [
        { label: "Ativos", items: [
          "\u20BF", "\u039E", "\u25CE", "\u20AE", "$",
          "\uD83E\uDE99", "\uD83D\uDC8E", "\uD83D\uDCCA"
        ]},
        { label: "Carteiras", items: [
          "\uD83E\uDD8A", "\uD83D\uDC7B", "\uD83D\uDC30", "\uD83D\uDD10",
          "\uD83C\uDFE6", "\uD83E\uDDCA", "\uD83D\uDEE1\uFE0F", "\uD83D\uDDDD\uFE0F"
        ]},
        { label: "Estratégia", items: [
          "\uD83C\uDF10", "\uD83C\uDF31", "\uD83D\uDE80", "\uD83D\uDC33",
          "\uD83D\uDD25", "\u26A1", "\uD83C\uDFAF", "\uD83E\uDDED",
          "\u2699\uFE0F", "\uD83D\uDCB0", "\uD83C\uDFD4\uFE0F", "\uD83C\uDF0A"
        ]}
      ];
    },

    /* lista achatada — mantida para quem já chamava emojiSet() */
    emojiSet: function () {
      var out = [];
      T.iconGroups().forEach(function (g) { out = out.concat(g.items); });
      return out;
    },

    /* rótulo de UI: interno "global"/"isolada", tela mostra "Local". */
    typeLabel: function (typeOrWallet) {
      var t = typeof typeOrWallet === "string" ? typeOrWallet : (typeOrWallet && typeOrWallet.type);
      return t === "isolada" ? "Local" : "Global";
    },

    typeTag: function (wallet, moduleName) {
      if (!wallet) return "Global";
      if (wallet.type === "isolada") {
        var mod = moduleName || wallet.module;
        return mod ? "Local · só no " + capitalize(mod) : "Local";
      }
      return "Global";
    },

    capitalize: capitalize
  };

  global.AtlasWalletTypes = T;
})(typeof window !== "undefined" ? window : this);

;
// ---- wallets/walletLedger.js ----
/* ============================================================
   ATLAS · /wallets/walletLedger.js
   ------------------------------------------------------------
   OS NÚMEROS DA CARTEIRA — capital, saldo, valor atual e ativos.

   Nível A da centralização: cada módulo continua DONO dos seus
   registros de domínio (o trade individual, a posição individual),
   mas o VALOR AGREGADO de cada carteira — quanto ela tem de
   capital, saldo, valor atual e quais ativos estão vinculados —
   passa a ser guardado AQUI, na central. Os módulos "reportam"
   seus totais; a central é a dona da soma.

   Formato persistido (dentro de walletStore, chave ledger):
     ledger[walletId][module] = {
       capital, saldo, valorAtual, assets:[...], ts
     }

   Leitura:
     AtlasWallets.balanceOf(walletId)            -> valor atual total
     AtlasWallets.balanceOf(walletId, "trade")   -> só do Trade
     AtlasWallets.ledgerOf(walletId)             -> objeto completo
     AtlasWallets.assetsOf(walletId)             -> ativos vinculados

   Escrita (feita pelos módulos, guardada):
     AtlasWallets.report("trade", walletId, {capital, saldo, valorAtual, assets})

   report() grava SILENCIOSO (sem disparar evento) de propósito:
   os módulos reportam durante o próprio render, e emitir aqui
   criaria laço de re-render. O seletor lê estes números na hora
   em que ele mesmo desenha.

   Exposto em: window.AtlasWalletLedger  (uso interno do pacote).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasWalletLedger) return;

  var Store = global.AtlasWalletStore;

  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

  /* ============================================================
     LEITORES AO VIVO — a correção da fonte dupla
     ------------------------------------------------------------
     Este ledger é um CACHE ENTRE PÁGINAS, e precisa ser: dentro do
     Hold não existe DeFiStore carregado, então a única forma de saber
     quanto a carteira tem em DeFi é o que o DeFi gravou da última vez.

     O problema era tratá-lo como VERDADE. Duas consequências reais,
     medidas antes desta mudança:

       · DeFi e RWA nunca chamavam report(). Com uma pool de US$ 12.500
         registrada, o seletor mostrava "US$ 0" na própria tela do DeFi.
       · Onde o cache existia, ele podia estar velho: valia o que o
         módulo gravou na última visita, não o que ele sabe agora.

     Agora cada módulo registra um LEITOR AO VIVO. Quando o store dele
     está carregado na página atual, o número vem de lá; quando não
     está, cai no cache. Verdade quando dá para saber, cache quando não
     dá — e nunca cache por cima de verdade.

     O mesmo leitor alimenta report(): a rotina que calcula o total de
     um módulo passa a ser UMA, então cache e leitura ao vivo não têm
     como divergir na regra de cálculo.
     ============================================================ */

  var live = {};   // módulo -> fn(walletId) -> {valorAtual, capital} | null

  function lerAoVivo(module, walletId) {
    var fn = live[module];
    if (typeof fn !== "function") return null;
    try {
      var r = fn(walletId);
      return (r && isFinite(Number(r.valorAtual))) ? r : null;
    } catch (e) { return null; }
  }

  function ledgerRoot() {
    var d = Store.load();
    if (!d.ledger || typeof d.ledger !== "object") d.ledger = {};
    return d;
  }

  var L = {
    /* grava os totais de um módulo para uma carteira (silencioso) */
    report: function (module, walletId, data) {
      if (!module || !walletId || !data) return false;
      var d = ledgerRoot();
      var w = d.ledger[walletId] || (d.ledger[walletId] = {});
      var prev = w[module];
      var next = {
        capital:    num(data.capital),
        saldo:      num(data.saldo),
        valorAtual: num(data.valorAtual != null ? data.valorAtual : data.saldo),
        assets:     Array.isArray(data.assets) ? data.assets.slice() : [],
        ts:         Date.now()
      };
      // só persiste se algo relevante mudou (evita gravação a cada frame)
      if (prev &&
          prev.capital === next.capital &&
          prev.saldo === next.saldo &&
          prev.valorAtual === next.valorAtual &&
          JSON.stringify(prev.assets) === JSON.stringify(next.assets)) {
        return false;
      }
      w[module] = next;
      // grava direto sem emitir (Store.save emitiria) — persistência crua
      try {
        if (Store.hasLS) global.localStorage.setItem(Store.KEY, JSON.stringify(d));
      } catch (e) {}
      return true;
    },

    /* objeto completo do ledger de uma carteira */
    ledgerOf: function (walletId) {
      var d = ledgerRoot();
      return d.ledger[walletId] || {};
    },

    /* Registra o leitor ao vivo de um módulo. Chamado pelo próprio
       módulo, na página em que o store dele existe. */
    registerLive: function (module, fn) {
      if (module && typeof fn === "function") live[module] = fn;
    },
    hasLive: function (module) { return typeof live[module] === "function"; },

    /* valor atual: total (todos os módulos) ou de um módulo só.
       Ao vivo quando o módulo está carregado nesta página; cache quando
       não está. */
    balanceOf: function (walletId, module) {
      var l = L.ledgerOf(walletId);

      if (module) {
        var v = lerAoVivo(module, walletId);
        if (v) return num(v.valorAtual);
        return l[module] ? num(l[module].valorAtual) : 0;
      }

      /* soma a UNIÃO dos módulos: os que têm leitor ao vivo (mesmo sem
         nada no cache ainda) e os que só existem no cache. Sem a união,
         um módulo carregado e nunca reportado ficaria de fora do total. */
      var vistos = {}, sum = 0, m;
      for (m in l) if (l.hasOwnProperty(m)) vistos[m] = 1;
      for (m in live) if (live.hasOwnProperty(m)) vistos[m] = 1;
      for (m in vistos) if (vistos.hasOwnProperty(m)) {
        var lv = lerAoVivo(m, walletId);
        sum += lv ? num(lv.valorAtual) : (l[m] ? num(l[m].valorAtual) : 0);
      }
      return sum;
    },

    /* capital investido: mesma regra do balanceOf */
    capitalOf: function (walletId, module) {
      var l = L.ledgerOf(walletId);

      if (module) {
        var v = lerAoVivo(module, walletId);
        if (v && v.capital != null) return num(v.capital);
        return l[module] ? num(l[module].capital) : 0;
      }

      var vistos = {}, sum = 0, m;
      for (m in l) if (l.hasOwnProperty(m)) vistos[m] = 1;
      for (m in live) if (live.hasOwnProperty(m)) vistos[m] = 1;
      for (m in vistos) if (vistos.hasOwnProperty(m)) {
        var lv = lerAoVivo(m, walletId);
        sum += (lv && lv.capital != null) ? num(lv.capital)
             : (l[m] ? num(l[m].capital) : 0);
      }
      return sum;
    },

    /* ativos vinculados: união dos ativos reportados pelos módulos */
    assetsOf: function (walletId, module) {
      var l = L.ledgerOf(walletId);
      var out = [];
      var seen = {};
      function push(arr) {
        (arr || []).forEach(function (a) {
          var key = String(a && a.id != null ? a.id : a);
          if (!seen[key]) { seen[key] = 1; out.push(a); }
        });
      }
      if (module) { push(l[module] && l[module].assets); return out; }
      for (var m in l) if (l.hasOwnProperty(m)) push(l[m].assets);
      return out;
    },

    /* limpa o ledger de uma carteira (quando ela é excluída) */
    forget: function (walletId) {
      var d = ledgerRoot();
      if (d.ledger[walletId]) {
        delete d.ledger[walletId];
        try {
          if (Store.hasLS) global.localStorage.setItem(Store.KEY, JSON.stringify(d));
        } catch (e) {}
      }
    }
  };

  global.AtlasWalletLedger = L;
})(typeof window !== "undefined" ? window : this);

;
// ---- wallets/walletManager.js ----
/* ============================================================
   ATLAS · /wallets/walletManager.js
   ------------------------------------------------------------
   API PÚBLICA DAS CARTEIRAS  →  window.AtlasWallets

   Este é o ÚNICO ponto de contato dos módulos com as carteiras.
   Nenhum módulo cria, edita, exclui, salva ou guarda estado de
   carteira por conta própria — todos chamam funções daqui.

   A superfície ANTIGA foi preservada inteira (all, globals,
   forModule, activeGlobal, get, create, rename, remove, setEmoji,
   badge, typeIcon, iconGroups, emojiSet, typeLabel, typeTag,
   stamp, subscribe, initials, isIsolated) — então Hold, Trade,
   DeFi, RWA, Dashboard e Relatórios continuam funcionando sem
   nenhuma alteração de chamada.

   NOVO nesta central:
     · carteira PADRÃO   → setDefault / getDefault / defaultId
     · ORDEM             → reorder / move
     · NÚMEROS (ledger)  → report / balanceOf / capitalOf /
                            assetsOf / ledgerOf
   ============================================================ */
(function (global) {
  "use strict";

  var Store  = global.AtlasWalletStore;
  var Types  = global.AtlasWalletTypes;
  var Ledger = global.AtlasWalletLedger;

  if (!Store || !Types) {
    if (global.console) console.error("[AtlasWallets] dependências ausentes (store/types).");
    return;
  }

  function load() { return Store.load(); }
  function save(d) { Store.save(d); }
  function firstGlobal(list) { return Store.firstGlobal(list); }

  function genId() { return "w_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function byId(list, id) { return list.filter(function (w) { return w.id === id; })[0] || null; }
  function sorted(list) {
    return list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /* minúsculas, sem acento, espaços colapsados — ver API.nameTaken */
  function normalizarNome(s) {
    s = String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
    return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s;
  }

  /* `nome`, ou "nome 2", "nome 3"… — o primeiro que nenhuma OUTRA
     carteira usa (renomear para o próprio nome não conta como repetido) */
  function nomeUnico(lista, nome, exceptId) {
    var usados = {};
    lista.forEach(function (w) { if (w.id !== exceptId) usados[normalizarNome(w.name)] = 1; });
    if (!usados[normalizarNome(nome)]) return nome;
    for (var n = 2; n < 1000; n++) {
      var cand = nome + " " + n;
      if (!usados[normalizarNome(cand)]) return cand;
    }
    return nome + " " + Date.now().toString(36);
  }

  var API = {
    /* ---------------- LISTAGEM ---------------- */
    all: function () { return sorted(load().wallets); },

    globals: function () {
      return sorted(load().wallets).filter(function (w) { return w.type === "global"; });
    },

    /* globais + isoladas do módulo pedido */
    forModule: function (moduleName) {
      return sorted(load().wallets).filter(function (w) {
        return w.type === "global" || w.module === moduleName;
      });
    },

    get: function (id) { return byId(load().wallets, id); },

    isIsolated: function (id) {
      var w = API.get(id);
      return !!(w && w.type === "isolada");
    },

    /* ---------------- ATIVA (global) ---------------- */
    activeGlobal: function () {
      var d = load();
      return byId(d.wallets, d.activeGlobalId) || firstGlobal(d.wallets);
    },
    activeGlobalId: function () { return API.activeGlobal().id; },

    setActiveGlobal: function (id) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w || w.type !== "global") return false;
      d.activeGlobalId = id;
      save(d);
      return true;
    },

    /* ---------------- ATIVA POR MÓDULO ----------------
       A carteira em que CADA módulo está. Se o módulo está numa
       carteira local, o id fica em activeByModule; se está numa
       global, vale a global ativa do ATLAS (e trocar a global em
       qualquer módulo muda para todos, que é o comportamento
       esperado de uma carteira "global").

       Isto existe para o Dashboard e os Relatórios usarem o MESMO
       caminho dos módulos, em vez de cada um inventar onde guardar
       a carteira selecionada. Hold, Trade, DeFi e RWA continuam
       podendo passar getActive/onSelect próprios, porque a partição
       dos dados deles depende do estado interno de cada um. */
    activeFor: function (moduleName) {
      var d = load();
      var localId = moduleName ? d.activeByModule[moduleName] : null;
      var w = localId ? byId(d.wallets, localId) : null;
      /* uma local só vale para o módulo dono dela */
      if (w && w.type === "isolada" && w.module === moduleName) return w;
      return API.activeGlobal();
    },
    setActiveFor: function (moduleName, id) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w) return false;
      if (w.type === "global") {
        if (moduleName) delete d.activeByModule[moduleName];
        d.activeGlobalId = id;
      } else {
        if (!moduleName || w.module !== moduleName) return false;
        d.activeByModule[moduleName] = id;
      }
      save(d);
      return true;
    },

    /* ---------------- PADRÃO ---------------- */
    defaultId: function () {
      var d = load();
      return d.defaultId || (firstGlobal(d.wallets) || {}).id || null;
    },
    getDefault: function () { return API.get(API.defaultId()); },
    setDefault: function (id) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w) return false;
      d.wallets.forEach(function (x) { x.isDefault = (x.id === id); });
      d.defaultId = id;
      save(d);
      return true;
    },

    /* ---------------- ORDEM ---------------- */
    /* recebe um array de ids na ordem desejada; ids ausentes vão ao fim */
    reorder: function (orderedIds) {
      var d = load();
      var pos = {};
      (orderedIds || []).forEach(function (id, i) { pos[id] = i; });
      d.wallets.forEach(function (w) {
        w.order = (pos[w.id] != null) ? pos[w.id] : (999 + (w.order || 0));
      });
      d.wallets.sort(function (a, b) { return a.order - b.order; });
      d.wallets.forEach(function (w, i) { w.order = i; });
      save(d);
      return true;
    },
    /* move uma carteira uma posição para cima (-1) ou baixo (+1) */
    move: function (id, dir) {
      var list = sorted(load().wallets);
      var i = list.map(function (w) { return w.id; }).indexOf(id);
      if (i < 0) return false;
      var j = i + (dir < 0 ? -1 : 1);
      if (j < 0 || j >= list.length) return false;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      return API.reorder(list.map(function (w) { return w.id; }));
    },

    /* ---------------- CRIAR / EDITAR / EXCLUIR ---------------- */
    /* ------------------------------------------------------------
       NOME ÚNICO

       Duas carteiras "M3p" — uma com US$ 128 e outra vazia — são
       indistinguíveis na lista e no Oráculo ("quanto tenho na M3p?"
       responderia por uma só). O diálogo impede quem digita
       (walletDialog.js); aqui fica a garantia para quem chama por
       código: nome repetido ganha número ("Nova carteira 2") em vez de
       ser recusado, porque o Trade cria com o nome padrão e usa a
       carteira devolvida na linha seguinte.

       Comparação sem caixa, sem acento e sem espaço sobrando: "M3p" e
       "m3P " são o mesmo nome para quem lê.
       ------------------------------------------------------------ */
    normalizeName: normalizarNome,
    nameTaken: function (name, exceptId) {
      var alvo = normalizarNome(name);
      if (!alvo) return null;
      return load().wallets.filter(function (w) {
        return w.id !== exceptId && normalizarNome(w.name) === alvo;
      })[0] || null;
    },

    create: function (opts) {
      opts = opts || {};
      var d = load();
      var maxOrder = d.wallets.reduce(function (m, w) { return Math.max(m, w.order || 0); }, -1);
      var w = {
        id: genId(),
        name: nomeUnico(d.wallets, (opts.name || "Nova carteira").trim(), null),
        type: opts.type === "isolada" ? "isolada" : "global",
        module: opts.type === "isolada" ? (opts.module || null) : null,
        color: opts.color || "#4C9AFF",
        emoji: opts.emoji || "",
        order: maxOrder + 1,
        isDefault: false
      };
      d.wallets.push(w);
      save(d);
      return w;
    },

    rename: function (id, name) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w) return false;
      w.name = nomeUnico(d.wallets, (name || w.name).trim(), w.id);
      save(d);
      return true;
    },

    setEmoji: function (id, emoji) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w) return false;
      w.emoji = emoji || "";
      save(d);
      return true;
    },

    setColor: function (id, color) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w || !color) return false;
      w.color = color;
      save(d);
      return true;
    },

    remove: function (id) {
      var d = load();
      var w = byId(d.wallets, id);
      if (!w) return false;
      /* nunca deixar zero carteiras globais */
      if (w.type === "global" && API.globals().length <= 1) return false;
      d.wallets = d.wallets.filter(function (x) { return x.id !== id; });
      if (d.activeGlobalId === id) d.activeGlobalId = firstGlobal(d.wallets).id;
      /* nenhum módulo pode ficar apontando para a carteira excluída */
      if (d.activeByModule) {
        Object.keys(d.activeByModule).forEach(function (m) {
          if (d.activeByModule[m] === id) delete d.activeByModule[m];
        });
      }
      if (d.defaultId === id) {
        var g = firstGlobal(d.wallets);
        d.defaultId = g ? g.id : (d.wallets[0] && d.wallets[0].id);
        if (g) g.isDefault = true;
      }
      if (Ledger) Ledger.forget(id);
      save(d);
      return true;
    },

    /* ---------------- NÚMEROS (ledger) ---------------- */
    report: function (module, walletId, data) {
      return Ledger ? Ledger.report(module, walletId, data) : false;
    },
    /* Um módulo declara COMO ler o total de uma carteira nele. Enquanto
       o store do módulo estiver carregado na página, este leitor manda;
       fora dela, vale o que ele gravou por último. */
    registerLive: function (module, fn) {
      return Ledger ? Ledger.registerLive(module, fn) : false;
    },
    balanceOf: function (walletId, module) {
      return Ledger ? Ledger.balanceOf(walletId, module) : 0;
    },
    capitalOf: function (walletId, module) {
      return Ledger ? Ledger.capitalOf(walletId, module) : 0;
    },
    assetsOf: function (walletId, module) {
      return Ledger ? Ledger.assetsOf(walletId, module) : [];
    },
    ledgerOf: function (walletId) {
      return Ledger ? Ledger.ledgerOf(walletId) : {};
    },

    /* ---------------- APARÊNCIA / VOCABULÁRIO (delegado) ---------------- */
    badge:     function (w) { return Types.badge(w); },
    typeIcon:  function (t, s) { return Types.typeIcon(t, s); },
    iconGroups: function () { return Types.iconGroups(); },
    emojiSet:  function () { return Types.emojiSet(); },
    typeLabel: function (x) { return Types.typeLabel(x); },
    typeTag:   function (w, m) { return Types.typeTag(w, m); },
    initials:  function (n) { return Types.initials(n); },

    /* ---------------- PROVENIÊNCIA ---------------- */
    /* carimbo padrão para qualquer registro do sistema.
       Uso: Object.assign(registro, AtlasWallets.stamp("hold", "manual")) */
    stamp: function (moduleName, origem, walletId) {
      return {
        walletId: walletId || API.activeGlobalId(),
        module: moduleName || null,
        data: new Date().toISOString(),
        origem: origem || "manual"
      };
    },

    /* ---------------- EVENTOS ---------------- */
    /* devolve a função que cancela a assinatura */
    subscribe: function (fn) { return Store.subscribe(fn); }
  };

  global.AtlasWallets = API;
})(typeof window !== "undefined" ? window : this);

;
// ---- wallets/walletCaixa.js ----
/* ============================================================
   ATLAS · /wallets/walletCaixa.js
   ------------------------------------------------------------
   O CAIXA DE CADA CARTEIRA — e o livro de eventos que o produz.

   A REGRA QUE ESTE ARQUIVO EXISTE PARA GARANTIR
   ---------------------------------------------
   Saldo é CONSEQUÊNCIA de eventos, nunca uma variável solta. Não
   existe `setSaldo`. Não existe campo `saldo` gravado. O caixa de uma
   carteira é sempre a soma do seu histórico, recalculada na leitura —
   e por isso é impossível ele divergir do extrato que a tela mostra.

   O QUE HAVIA ANTES
   -----------------
   Nada. O ATLAS inteiro não tinha conceito de dinheiro parado. O
   `walletLedger` guarda `{capital, saldo, valorAtual}` por módulo, mas
   ali "saldo" é sinônimo de "valor das posições" — é patrimônio
   alocado, não dinheiro disponível. O Trade tinha um array `equity`
   escrito uma única vez na criação da carteira e nunca mais tocado:
   fechar um trade não devolvia nada a lugar nenhum, porque não havia
   lugar nenhum para devolver.

   OS SEIS TIPOS, E O QUE CADA UM FAZ COM O PATRIMÔNIO
   ---------------------------------------------------
     deposito       + caixa      mundo externo → carteira    ↑ patrimônio
     saque          − caixa      carteira → mundo externo    ↓ patrimônio
     transferencia  − origem     carteira → carteira          = patrimônio
                    + destino
     swap           (neutro)     ativo → ativo, mesma carteira = patrimônio
     aporte         − caixa      caixa → posição              = patrimônio
     retorno        + caixa      posição → caixa              = patrimônio

   Só DEPÓSITO e SAQUE mudam o patrimônio total. Todo o resto
   redistribui — é essa a invariante que o teste `patrimônio fecha`
   verifica, e é ela que responde "onde está cada dólar".

   POR QUE UM ARQUIVO NOVO, E NÃO DENTRO DO walletLedger
   -----------------------------------------------------
   São coisas de natureza oposta. O walletLedger é um CACHE de valores
   agregados que os módulos reportam (e que pode estar velho, por
   design — ver o comentário lá). Este é um LIVRO-RAZÃO: append-only,
   fonte da verdade, sem cache possível. Misturar os dois faria o
   dinheiro disponível herdar a tolerância a defasagem que só faz
   sentido para valor de posição.

   Exposto em: window.AtlasCaixa
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasCaixa) return;

  var KEY = "atlas.caixa.v1";

  /* Efeito de cada tipo sobre o caixa da carteira citada em walletId.
     `contra` marca os que também mexem numa segunda carteira. */
  var TIPOS = {
    deposito:      { sinal: +1, contra: false, patrimonio: +1, rotulo: "Depósito" },
    saque:         { sinal: -1, contra: false, patrimonio: -1, rotulo: "Saque" },
    transferencia: { sinal: -1, contra: true,  patrimonio: 0,  rotulo: "Transferência" },
    swap:          { sinal: 0,  contra: false, patrimonio: 0,  rotulo: "Swap" },
    aporte:        { sinal: -1, contra: false, patrimonio: 0,  rotulo: "Aporte em posição" },
    retorno:       { sinal: +1, contra: false, patrimonio: 0,  rotulo: "Retorno de posição" }
  };

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function pos(v) { var n = Number(v); return (isFinite(n) && n > 0) ? n : null; }
  function txt(v) { return String(v == null ? "" : v).trim(); }
  function ativo(v) {
    var s = txt(v).toUpperCase();
    return s || "USDT";
  }

  function hoje() {
    var d = new Date();
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  function dia(v) {
    if (!v) return hoje();
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return hoje();
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  /* ============================================================
     QUANTO DE CADA ATIVO HÁ NO CAIXA — quantidade coerente com o US$

     Os módulos lançam aporte e retorno em DÓLAR: sem ativo (cai em
     "USDT") e sem quantidade. Somar só o US$ por ativo deixava a
     quantidade para trás — depósito de 500 USDT com quantidade, pool
     de 300 aberta com esse dinheiro, e o balde dizia 500 USDT valendo
     200. Quem reavalia a mercado (quantidade × preço) contava 500: 300
     de patrimônio que já tinha virado posição. Com ETH era pior: o ETH
     usado na pool continuava no caixa, oscilando com o preço.

     A regra, lançamento a lançamento, na ordem em que foram gravados
     (é a ordem em que o saldo foi conferido para cada gasto):

       · com quantidade informada  → usa a quantidade;
       · stablecoin sem quantidade → 1 unidade por dólar;
       · volátil sem quantidade    → pelo custo médio do balde, se houver
                                     quantidade nele; senão fica só em US$;
       · saída maior que o balde   → o que falta sai dos OUTROS ativos da
                                     carteira: stablecoins primeiro (é de
                                     onde sai dinheiro em dólar), depois o
                                     resto em proporção ao custo.

     O total em US$ não muda — continua sendo o saldo do livro.
     ============================================================ */
  var STABLES_BASE = { USDT: 1, USDC: 1, DAI: 1, BUSD: 1, FDUSD: 1, TUSD: 1, USDE: 1, PYUSD: 1, USDS: 1 };
  function ehStable(sym) {
    var P = global.AtlasPrecos;
    if (P && P.isStable) { try { return !!P.isStable(sym); } catch (e) {} }
    return !!STABLES_BASE[sym];
  }

  function baldesDoCaixa(walletId, porRede) {
    var grupos = {};   // rede → { ativo → balde }

    function balde(rede, symbol, nome, thumb) {
      var r = porRede ? (rede || "") : "";
      if (!grupos[r]) grupos[r] = {};
      var key = ativo(symbol);
      var b = grupos[r][key];
      if (!b) b = grupos[r][key] = { ativo: key, nome: nome || key, thumb: thumb || "", usd: 0, qtd: 0 };
      if (!b.nome && nome) b.nome = nome;
      if (!b.thumb && thumb) b.thumb = thumb;
      return b;
    }

    /* quantidade implícita de `usd` dólares deste balde */
    function qtdDe(b, usd) {
      if (ehStable(b.ativo)) return usd;
      if (b.qtd > 1e-12 && b.usd > 1e-9) return usd * (b.qtd / b.usd);
      return 0;
    }

    function tira(b, usd) {
      var q = qtdDe(b, usd);
      b.usd -= usd; b.qtd -= q;
      if (Math.abs(b.usd) < 1e-9) b.usd = 0;
      if (Math.abs(b.qtd) < 1e-12) b.qtd = 0;   /* poeira de ponto flutuante */
    }

    /* o balde ficou negativo: o que falta sai dos outros da mesma rede
       e, se não bastar, das OUTRAS redes.

       Depositar na Base e abrir uma pool na BNB Chain é uma ponte
       (bridge) que ninguém lança: o dinheiro saiu da Base. Cobrindo só
       dentro da rede, a BNB Chain ficava negativa, o gráfico por rede
       descartava o negativo e a Base aparecia com o depósito inteiro —
       59% onde o certo eram 35%. */
    function cobrirDosOutros(r, b) {
      var falta = -b.usd;
      if (!(falta > 1e-9)) return;
      function cobrirCom(outros) {
        var stables = outros.filter(function (x) { return ehStable(x.ativo); })
          .sort(function (a, c) { return c.usd - a.usd; });
        stables.forEach(function (x) {
          if (!(falta > 1e-9)) return;
          var usar = Math.min(falta, x.usd); tira(x, usar); falta -= usar;
        });
        var volateis = outros.filter(function (x) { return !ehStable(x.ativo) && x.usd > 1e-9; });
        var soma = volateis.reduce(function (s, x) { return s + x.usd; }, 0);
        if (falta > 1e-9 && soma > 1e-9) {
          var usarTotal = Math.min(falta, soma);
          volateis.forEach(function (x) { tira(x, usarTotal * (x.usd / soma)); });
          falta -= usarTotal;
        }
      }
      function baldesDe(rede) {
        return Object.keys(grupos[rede]).map(function (k) { return grupos[rede][k]; })
          .filter(function (x) { return x !== b && x.usd > 1e-9; });
      }
      cobrirCom(baldesDe(r));
      if (porRede && falta > 1e-9) {
        Object.keys(grupos).filter(function (x) { return x !== r; })
          .forEach(function (outra) { if (falta > 1e-9) cobrirCom(baldesDe(outra)); });
      }
      /* o que foi coberto some do balde negativo; o que não deu para
         cobrir fica negativo — caixa negativo de verdade, que o
         supervisor acusa */
      b.usd = -falta; b.qtd = 0;
    }

    function mover(rede, symbol, usd, qtd, nome, thumb) {
      if (!usd && !qtd) return;
      var b = balde(rede, symbol, nome, thumb);
      if (usd >= 0) {
        b.qtd += (qtd != null) ? qtd : qtdDe(b, usd);
        b.usd += usd;
      } else if (qtd != null) {
        b.usd += usd; b.qtd += qtd;   /* qtd já vem negativa */
      } else {
        tira(b, -usd);
      }
      if (b.usd < -1e-9) cobrirDosOutros(porRede ? (rede || "") : "", b);
    }

    ler().forEach(function (e) {
      var t = TIPOS[e.tipo];
      if (!t) return;
      if (e.walletId === walletId) {
        if (e.tipo === "swap") {
          mover(e.rede, e.ativo, -e.valorUSD, e.qtdOrigem != null ? -e.qtdOrigem : null, e.ativoNome, e.ativoThumb);
          mover(e.rede, e.ativoDestino || "USDT", +e.valorUSD, e.qtdDestino, e.ativoDestinoNome, e.ativoDestinoThumb);
          return;
        }
        mover(e.rede, e.ativo, t.sinal * e.valorUSD, e.qtd != null ? t.sinal * e.qtd : null, e.ativoNome, e.ativoThumb);
        return;
      }
      if (t.contra && e.contraWalletId === walletId) {
        mover(e.rede, e.ativo, +e.valorUSD, e.qtd, e.ativoNome, e.ativoThumb);
      }
    });

    function limpar(mapa) {
      return Object.keys(mapa).map(function (k) {
        var a = mapa[k];
        return { ativo: a.ativo, nome: a.nome || a.ativo, thumb: a.thumb || "",
                 usd: Math.round(a.usd * 1e6) / 1e6, qtd: Math.round(a.qtd * 1e8) / 1e8 };
      }).filter(function (a) { return Math.abs(a.usd) > 1e-6 || Math.abs(a.qtd) > 1e-8; })
        .sort(function (a, b) { return Math.abs(b.usd) - Math.abs(a.usd); });
    }
    return { grupos: grupos, limpar: limpar };
  }

  /* ---- persistência ---- */
  var _mem = null;

  function ler() {
    if (_mem) return _mem;
    try {
      var raw = global.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      _mem = Array.isArray(arr) ? arr : [];
    } catch (e) { _mem = []; }
    return _mem;
  }

  function gravar(arr) {
    _mem = arr;
    try { global.localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* só memória */ }
    emitir();
  }

  var subs = [];
  function emitir() { subs.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var _seq = 0;
  function gerarId() {
    _seq = (_seq + 1) % 100000;
    return "cx_" + Date.now().toString(36) + _seq.toString(36);
  }

  function normalizar(ev) {
    if (!ev) return null;
    var tipo = String(ev.tipo || "").toLowerCase();
    if (!TIPOS[tipo]) return null;

    var valor = num(ev.valorUSD);
    /* Valor negativo é erro de entrada, não uma forma alternativa de
       escrever o tipo oposto. Math.abs() aqui corrigiria em silêncio um
       saque digitado como −100 e o registraria como intencional. */
    if (!(valor > 0)) return null;
    if (!ev.walletId) return null;
    if (TIPOS[tipo].contra && !ev.contraWalletId) return null;
    if (TIPOS[tipo].contra && ev.contraWalletId === ev.walletId) return null;

    return {
      id: ev.id || gerarId(),
      data: dia(ev.data),
      tipo: tipo,
      valorUSD: valor,
      ativo: ativo(ev.ativo),
      ativoNome: txt(ev.ativoNome) || null,
      ativoThumb: txt(ev.ativoThumb) || null,
      walletId: ev.walletId,
      contraWalletId: ev.contraWalletId || null,
      module: ev.module || null,
      refId: ev.refId || null,
      /* swap guarda os dois lados: sem isso ele seria um evento sem
         conteúdo, já que não mexe no caixa em dólar */
      ativoDestino: ev.ativoDestino ? ativo(ev.ativoDestino) : null,
      ativoDestinoNome: txt(ev.ativoDestinoNome) || null,
      ativoDestinoThumb: txt(ev.ativoDestinoThumb) || null,
      qtd: ev.qtd != null ? pos(ev.qtd) : null,
      qtdOrigem: ev.qtdOrigem != null ? pos(ev.qtdOrigem) : null,
      qtdDestino: ev.qtdDestino != null ? pos(ev.qtdDestino) : null,
      /* Em que rede o dinheiro está (Base, Arbitrum, Solana...). Opcional:
         uma carteira EVM guarda o mesmo token em várias redes, e sem
         isto o ETH da Base e o da Arbitrum viravam um ETH só. */
      rede: txt(ev.rede) || null,
      obs: ev.obs || "",
      criadoEm: ev.criadoEm || new Date().toISOString()
    };
  }

  var API = {
    TIPOS: TIPOS,

    /* ---------------- escrita ---------------- */

    /* ------------------------------------------------------------
       A TRAVA DE VERDADE — no livro, não na tela

       "Carteira sem caixa não abre posição" estava implementado em
       CINCO telas: o wizard de pool, o de staking/lending, o formulário
       de trade, a compra do Hold e as ações desta tela. O RWA não
       tinha, e por isso adicionar um ativo furava o caixa em silêncio.

       Regra espalhada por tela é regra que um caminho novo esquece —
       importação, restauração de backup, uma tela futura. Aqui ela
       fica no lugar por onde TODO aporte passa, e as telas continuam
       verificando antes só para poder dar uma mensagem melhor: elas
       explicam quanto falta, o livro apenas recusa.

       Só o APORTE é travado. Saque e transferência são gastos também,
       mas quem os registra é esta tela, que já confere — e travá-los
       aqui impediria de corrigir um lançamento errado registrando o
       oposto.
       ------------------------------------------------------------ */
    registrar: function (ev) {
      var n = normalizar(ev);
      if (!n) return null;
      if (n.tipo === "aporte" && !API.podeGastar(n.walletId, n.valorUSD).ok) return null;
      var arr = ler().slice();
      arr.push(n);
      gravar(arr);
      return n;
    },

    /* ------------------------------------------------------------
       Vários de uma vez, tudo ou nada.

       Aplica em SEQUÊNCIA, não em bloco: a abertura de saldo registra
       o depósito e os aportes que ele financia na mesma chamada, e um
       saldo conferido contra o estado ANTERIOR recusaria todos os
       aportes — o depósito ainda não teria entrado. Sequencial, cada
       evento vê o efeito do anterior, que é como o dinheiro funciona.
       ------------------------------------------------------------ */
    registrarVarios: function (lista) {
      var normalizados = (lista || []).map(normalizar);
      if (normalizados.some(function (x) { return !x; })) return null;

      var original = ler().slice();
      var arr = original.slice();
      for (var i = 0; i < normalizados.length; i++) {
        var n = normalizados[i];
        if (n.tipo === "aporte") {
          _mem = arr;                                   // saldo do estado parcial
          if (!API.podeGastar(n.walletId, n.valorUSD).ok) { _mem = original; return null; }
        }
        arr.push(n);
      }
      _mem = original;
      gravar(arr);
      return normalizados;
    },

    remover: function (id) {
      var arr = ler();
      var proximo = arr.filter(function (e) { return e.id !== id; });
      if (proximo.length === arr.length) return false;
      gravar(proximo);
      return true;
    },

    /* Apaga os eventos ligados a uma posição — usado quando a posição
       é excluída (não encerrada) e o dinheiro dela nunca existiu. */
    removerPorRef: function (module, refId) {
      if (!refId) return 0;
      var arr = ler();
      var proximo = arr.filter(function (e) {
        return !(e.refId === refId && (!module || e.module === module));
      });
      var n = arr.length - proximo.length;
      if (n) gravar(proximo);
      return n;
    },

    /* ---------------- leitura ---------------- */

    eventos: function (opts) {
      opts = opts || {};
      var ordem = {};
      var arr = ler().filter(function (e, i) {
        ordem[e.id] = i;
        if (opts.walletId && e.walletId !== opts.walletId && e.contraWalletId !== opts.walletId) return false;
        if (opts.tipo && e.tipo !== opts.tipo) return false;
        if (opts.module && e.module !== opts.module) return false;
        if (opts.refId && e.refId !== opts.refId) return false;
        if (opts.de && e.data < dia(opts.de)) return false;
        if (opts.ate && e.data > dia(opts.ate)) return false;
        return true;
      });
      /* mais recente primeiro; empate resolvido pela ordem de registro,
         para o extrato ficar estável entre carregamentos.

         O desempate por criadoEm sozinho não bastava: fechar uma pool e
         abrir a próxima no mesmo milissegundo deixava os dois
         lançamentos com o mesmo carimbo, e a ordem entre eles ficava
         ao acaso. A rentabilidade lê essa ordem (abrir antes de fechar
         conta o dinheiro duas vezes) — então o último desempate é a
         posição no livro, que é a ordem real em que foram lançados. */
      return arr.sort(function (a, b) {
        if (a.data !== b.data) return a.data < b.data ? 1 : -1;
        var ca = String(a.criadoEm || ""), cb = String(b.criadoEm || "");
        if (ca !== cb) return ca < cb ? 1 : -1;
        return ordem[b.id] - ordem[a.id];
      });
    },

    /* ------------------------------------------------------------
       O CAIXA DE UMA CARTEIRA — derivado, sempre

       Percorre o livro inteiro. Não há cache, e é de propósito: o
       custo é irrelevante (centenas de eventos) e o benefício é a
       impossibilidade estrutural de o saldo mostrado divergir do
       extrato que o produziu.
       ------------------------------------------------------------ */
    saldo: function (walletId) {
      if (!walletId) return 0;
      var total = 0;
      ler().forEach(function (e) {
        var t = TIPOS[e.tipo];
        if (!t) return;
        if (e.walletId === walletId) total += t.sinal * e.valorUSD;
        /* o outro lado da transferência entra com o sinal invertido */
        if (t.contra && e.contraWalletId === walletId) total += -t.sinal * e.valorUSD;
      });
      /* poeira de ponto flutuante não é saldo */
      return Math.round(total * 1e6) / 1e6;
    },

    saldos: function () {
      var out = {};
      ler().forEach(function (e) {
        var t = TIPOS[e.tipo];
        if (!t) return;
        out[e.walletId] = (out[e.walletId] || 0) + t.sinal * e.valorUSD;
        if (t.contra && e.contraWalletId) {
          out[e.contraWalletId] = (out[e.contraWalletId] || 0) + -t.sinal * e.valorUSD;
        }
      });
      Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 1e6) / 1e6; });
      return out;
    },

    caixaPorAtivo: function (walletId) {
      if (!walletId) return [];
      var b = baldesDoCaixa(walletId, false);   /* ver a regra lá em cima */
      return b.limpar(b.grupos[""] || {});
    },

    /* ------------------------------------------------------------
       O CAIXA DE UMA CARTEIRA, POR REDE

       Mesma conta de caixaPorAtivo, agrupada antes pela rede do
       evento. Movimento sem rede cai em `rede: null` ("sem rede
       informada") — nada some por não ter a etiqueta. Transferência
       e swap acontecem na rede do próprio evento.

       Devolve [{ rede, usd, ativos: [{ativo, nome, thumb, usd, qtd}] }],
       redes com mais dinheiro primeiro, "sem rede" por último.
       ------------------------------------------------------------ */
    caixaPorRede: function (walletId) {
      if (!walletId) return [];
      var bal = baldesDoCaixa(walletId, true), grupos = bal.grupos;
      return Object.keys(grupos).map(function (r) {
        var ativos = bal.limpar(grupos[r]);
        var usd = ativos.reduce(function (s, a) { return s + a.usd; }, 0);
        return { rede: r || null, usd: Math.round(usd * 1e6) / 1e6, ativos: ativos };
      }).filter(function (g) { return g.ativos.length; })
        .sort(function (a, b) {
          if (!a.rede !== !b.rede) return a.rede ? -1 : 1;
          return b.usd - a.usd;
        });
    },

    /* ------------------------------------------------------------
       MARCAR A REDE DE MOVIMENTOS QUE JÁ EXISTEM

       A rede nasceu depois dos primeiros lançamentos, e um movimento
       sem ela some do recorte por rede. Isto não é um "editar evento"
       genérico — de propósito: valor, tipo, data e carteira continuam
       imutáveis, porque são o que o livro garante. Só a etiqueta muda.

       filtro: id do evento, ou { walletId, module, refId, tipo,
       apenasSemRede } no formato de eventos(). Devolve quantos foram
       marcados.
       ------------------------------------------------------------ */
    marcarRede: function (filtro, rede) {
      var r = txt(rede) || null;
      var alvo = typeof filtro === "string" ? { id: filtro } : (filtro || {});
      var arr = ler(), n = 0;
      arr.forEach(function (e) {
        if (alvo.id && e.id !== alvo.id) return;
        if (alvo.walletId && e.walletId !== alvo.walletId && e.contraWalletId !== alvo.walletId) return;
        if (alvo.module && e.module !== alvo.module) return;
        if (alvo.refId && e.refId !== alvo.refId) return;
        if (alvo.tipo && e.tipo !== alvo.tipo) return;
        if (alvo.apenasSemRede && e.rede) return;
        if (e.rede === r) return;
        e.rede = r; n++;
      });
      if (n) gravar(arr);
      return n;
    },

    /* Redes sugeridas nos formulários. Texto livre continua valendo. */
    REDES: ["Solana", "Ethereum", "Base", "Arbitrum", "BNB Chain", "Polygon",
            "Optimism", "Avalanche", "Sui", "HyperEVM"],

    /* Caixa somado de todas as carteiras GLOBAIS — é o que sobe para o
       patrimônio consolidado. Carteira local fica fora, pela mesma
       regra que já vale para as posições. */
    caixaGlobal: function () {
      var W = global.AtlasWallets;
      var ids = (W && W.globals) ? W.globals().map(function (w) { return w.id; }) : ["principal"];
      var s = API.saldos(), t = 0;
      ids.forEach(function (id) { t += s[id] || 0; });
      return Math.round(t * 1e6) / 1e6;
    },

    /* ------------------------------------------------------------
       PODE GASTAR?

       A pergunta que bloqueia a abertura de posição sem caixa. Devolve
       um objeto em vez de um booleano porque a tela precisa dizer
       QUANTO falta — "saldo insuficiente" sem número obriga a pessoa a
       ir conferir noutra tela.
       ------------------------------------------------------------ */
    podeGastar: function (walletId, valor) {
      var v = num(valor);
      var s = API.saldo(walletId);
      /* tolerância de um centavo: o caixa vem de somas de ponto
         flutuante, e recusar por 0,0000001 seria recusar o saldo
         inteiro que a pessoa acabou de ver na tela */
      var ok = v <= s + 0.01;
      return { ok: ok, saldo: s, pedido: v, falta: ok ? 0 : Math.round((v - s) * 100) / 100 };
    },

    /* ------------------------------------------------------------
       COBRIR A FALTA — o depósito que acompanha a posição

       Exigir o depósito ANTES de abrir a posição obrigava quem
       registra posições que já existem de verdade — cinco pools em
       cinco carteiras — a ir cinco vezes a Carteiras & Movimentações
       antes de cadastrar cada uma. O dinheiro dessas posições veio de
       fora; o registro honesto disso é um depósito seguido do aporte.

       Grava só a DIFERENÇA entre o valor e o caixa que a carteira já
       tem, para não ignorar dinheiro que já estava lá. O depósito
       leva module/refId da posição: é rastreável até ela, e excluir a
       posição (removerPorRef) o apaga junto.

       Uma função só para todos os módulos. Quem não pede (importação,
       backup, testes) continua na trava: sem caixa, sem posição.

       Devolve o evento de depósito, null se não precisou, ou false se
       o livro recusou.
       ------------------------------------------------------------ */
    cobrirFalta: function (walletId, valor, opts) {
      opts = opts || {};
      var v = num(valor);
      if (!walletId || !(v > 0)) return null;
      var conf = API.podeGastar(walletId, v);
      if (conf.ok) return null;
      /* conf.falta vem arredondada ao centavo; aqui vai o valor exato,
         para o aporte seguinte não ser recusado por fração */
      var dep = API.registrar({
        tipo: "deposito", valorUSD: v - conf.saldo, walletId: walletId,
        module: opts.module || null, refId: opts.refId || null, rede: opts.rede || null,
        data: opts.data, obs: opts.obs || "Depósito automático para abrir posição"
      });
      return dep || false;
    },

    /* Quanto cobrirFalta depositaria — para a tela avisar ANTES. */
    faltaPara: function (walletId, valor) {
      var v = num(valor);
      if (!walletId || !(v > 0)) return 0;
      var conf = API.podeGastar(walletId, v);
      return conf.ok ? 0 : Math.round((v - conf.saldo) * 100) / 100;
    },

    /* ------------------------------------------------------------
       PATRIMÔNIO PELO LIVRO — a conta de conferência

       Só depósito e saque mudam o total. Se esta soma não bater com
       (caixa + posições), há dinheiro aparecendo ou sumindo em algum
       lugar — e é isso que o teste de invariante verifica.
       ------------------------------------------------------------ */
    patrimonioExterno: function () {
      var t = 0;
      ler().forEach(function (e) {
        var d = TIPOS[e.tipo];
        if (d && d.patrimonio) t += d.patrimonio * e.valorUSD;
      });
      return Math.round(t * 1e6) / 1e6;
    },

    /* Quanto saiu do caixa para posições de um módulo (aportes menos
       retornos). É o que permite responder "onde está cada dólar" sem
       perguntar a cada módulo. */
    alocadoPorModulo: function (walletId) {
      var out = {};
      ler().forEach(function (e) {
        if (walletId && e.walletId !== walletId) return;
        if (e.tipo !== "aporte" && e.tipo !== "retorno") return;
        var m = e.module || "outros";
        out[m] = (out[m] || 0) + (e.tipo === "aporte" ? e.valorUSD : -e.valorUSD);
      });
      Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 1e6) / 1e6; });
      return out;
    },

    rotulo: function (tipo) {
      var t = TIPOS[String(tipo || "").toLowerCase()];
      return t ? t.rotulo : "Movimento";
    },

    /* ---------------- eventos de UI ---------------- */
    subscribe: function (fn) {
      if (typeof fn !== "function") return function () {};
      if (subs.indexOf(fn) === -1) subs.push(fn);
      return function () {
        var i = subs.indexOf(fn);
        if (i !== -1) subs.splice(i, 1);
      };
    },

    /* Descarta o cache em memória — usado pela bateria de testes, que
       reescreve o localStorage por baixo. */
    _reload: function () { _mem = null; return ler(); }
  };

  /* reage a mudanças vindas de outra aba */
  try {
    global.addEventListener("storage", function (ev) {
      if (ev && ev.key === KEY) { _mem = null; emitir(); }
    });
  } catch (e) {}

  global.AtlasCaixa = API;
})(typeof window !== "undefined" ? window : this);

;
// ---- hold/js/state.js ----
/* ============================================================
   HOLD SYSTEM · js/state.js
   Estado central único. Toda a UI lê daqui e NUNCA muta dados
   diretamente — tudo passa por Store.actions.*, que:
     1) valida a regra de negócio
     2) altera o estado central
     3) registra histórico
     4) emite evento
     5) espelha no localStorage
   ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "atlas.hold.state.v2";

  /* ---- Ponte com a Central de Carteiras (AtlasWallets) ----
     As POSIÇÕES do Hold passam a pertencer a uma carteira (o dinheiro
     é por carteira). Ativos continuam do módulo inteiro. A carteira
     ativa efetiva é
     a global ativa da central, ou uma Local escolhida dentro do Hold. */
  /* Local selecionada dentro do Hold: não propaga para a central, mas
     persiste. O Hold é SPA e re-renderiza sem recarregar, então uma
     variável de memória "funcionava" durante a sessão e sumia no F5 —
     era um bug silencioso, mais difícil de notar que o do DeFi. */
  var KEY_LOCAL = "atlas.hold.wallet.v1";
  var localWalletId = (function () {
    try { return localStorage.getItem(KEY_LOCAL) || null; } catch (e) { return null; }
  })();
  function setLocalWalletId(id) {
    localWalletId = id || null;
    try {
      if (localWalletId) localStorage.setItem(KEY_LOCAL, localWalletId);
      else localStorage.removeItem(KEY_LOCAL);
    } catch (e) { /* sem storage → só memória */ }
  }

  function activeWalletId() {
    if (!window.AtlasWallets) return "principal";
    if (localWalletId) {
      var w = window.AtlasWallets.get(localWalletId);
      if (w && (w.type === "isolada" && w.module === "hold")) return localWalletId;
      setLocalWalletId(null); // carteira apagada na central: limpa o vestígio
    }
    return window.AtlasWallets.activeGlobalId();
  }

  function activeWallet() {
    if (!window.AtlasWallets) return { id: "principal", name: "Principal", type: "global" };
    return window.AtlasWallets.get(activeWalletId()) || window.AtlasWallets.activeGlobal();
  }

  /* ------------------------------------------------------------
     MODO "TODAS AS CARTEIRAS"

     Escolhido no seletor de carteira. Ligado, as leituras do Hold
     (posições, caixa, realizado, curva, alertas) passam a somar TODAS
     as carteiras que o Hold enxerga: as globais e as locais do Hold.
     Escolher uma carteira específica desliga o modo e mostra só ela.
     As escritas (comprar, vender, desfazer) sempre usam a carteira
     explícita da operação — nunca a soma.
     ------------------------------------------------------------ */
  var KEY_ESCOPO = "atlas.hold.escopo.v1";
  function modoTodas() {
    try { return localStorage.getItem(KEY_ESCOPO) === "todas"; } catch (e) { return false; }
  }
  function setModoTodas(on) {
    try { localStorage.setItem(KEY_ESCOPO, on ? "todas" : "carteira"); } catch (e) {}
  }
  function idsDoHold() {
    return window.AtlasWallets && window.AtlasWallets.forModule
      ? window.AtlasWallets.forModule("hold").map(function (w) { return w.id; })
      : ["principal"];
  }
  /* as carteiras que a tela está olhando agora */
  function escopoIds() { return modoTodas() ? idsDoHold() : [activeWalletId()]; }

  /* Toda posição antiga sem walletId é adotada pela carteira principal. */
  function ensureWalletStamp() {
    var changed = false;
    (HOLD_STATE.carteira || []).forEach(function (p) {
      if (!p.walletId) { p.walletId = "principal"; changed = true; }
    });
    return changed;
  }

  /* ---- Event system (nomes travados na spec) ---- */
  var EVENTS = {
    ASSET_CREATED:    "ASSET_CREATED",
    POSITION_UPDATED: "POSITION_UPDATED",
    TRADE_EXECUTED:   "TRADE_EXECUTED",
    STATE_CHANGED:    "STATE_CHANGED"   // interno p/ re-render
  };

  var bus = {};
  function on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); }
  function emit(evt, payload) {
    (bus[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } });
    if (evt !== EVENTS.STATE_CHANGED) emit(EVENTS.STATE_CHANGED, { evt: evt, payload: payload });
  }

  /* ---- State ---- */
  var HOLD_STATE = {
    ativos: [], carteira: [], historico: [], config: {},
    /* Medições diárias do valor da carteira, por carteira. Ver
       recordSnapshot(). Existe para o painel poder desenhar uma curva
       que ele MEDIU, em vez de uma que ele inventou. */
    snapshots: {},
    /* Uma linha por venda: custo baixado, apurado e o resultado entre
       os dois. Sem isto o lucro de uma venda ia para o caixa e para
       resultado nenhum — o "Lucro Total" ficava abaixo do que o
       patrimônio mostrava. Ver executeSell e realizado(). */
    vendas: [],
    /* Uma linha por compra/venda com TUDO o que ela mexeu: a posição
       como era antes, os eventos de caixa que gravou e a venda que
       apurou. É o que permite desfazer uma operação digitada errado
       sem deixar resto no caixa nem no preço médio. Ver undoLast(). */
    operacoes: []
  };

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---- persistence ---- */
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(HOLD_STATE));
    }
    catch (e) { console.warn("localStorage indisponível:", e); }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        Object.keys(HOLD_STATE).forEach(function (k) {
          /* Chave ausente no arquivo NÃO herda o que estava em memória:
             ela volta ao vazio. Sem isto, "Começar do zero" apagava as
             posições e deixava os snapshots de pé — o painel desenhava
             a curva de uma carteira que não existe mais. Vale para
             qualquer chave nova que o formato ganhe depois. */
          HOLD_STATE[k] = parsed[k] != null ? parsed[k] : (Array.isArray(HOLD_STATE[k]) ? [] : {});
        });
        var mudouCarteira = ensureWalletStamp();
        if (limparTeses() || mudouCarteira) persist();
        watchWallets();
        return;
      } catch (e) { console.warn("Estado corrompido, recarregando semente."); }
    }
    // primeira execução -> semente
    var seed = window.HOLD_SEED || {};
    HOLD_STATE.ativos    = clone(seed.ativos || []);
    HOLD_STATE.carteira  = clone(seed.carteira || []);
    HOLD_STATE.historico = clone(seed.historico || []);
    HOLD_STATE.config    = clone(seed.config || {});
    /* Carteira zerada, série zerada. Medição é sobre as posições — sem
       elas, não há o que a curva possa afirmar. */
    HOLD_STATE.snapshots = {};
    HOLD_STATE.vendas = [];
    ensureWalletStamp();
    persist();
    watchWallets();
  }

  /* ------------------------------------------------------------
     O ATLAS NÃO TEM MAIS TESES

     O módulo foi construído em volta delas: convicção no ativo, tese
     vinculada na posição, linha "Tese criada/revisada" no histórico.
     O conceito saiu do sistema (decisão do dono do produto,
     23/09/2026), e o que ele deixou gravado sai junto na primeira
     leitura — compras, vendas e preços ficam intactos.
     ------------------------------------------------------------ */
  var EVENTOS_DE_TESE = { THESIS_CREATED: 1, THESIS_UPDATED: 1, STUDY_CONVERTED: 1 };
  function limparTeses() {
    var mudou = false;
    (HOLD_STATE.ativos || []).forEach(function (a) {
      ["tese_id", "conviccao"].forEach(function (k) { if (k in a) { delete a[k]; mudou = true; } });
    });
    (HOLD_STATE.carteira || []).forEach(function (p) {
      if ("semTese" in p) { delete p.semTese; mudou = true; }
    });
    var antes = (HOLD_STATE.historico || []).length;
    HOLD_STATE.historico = (HOLD_STATE.historico || []).filter(function (h) {
      return !EVENTOS_DE_TESE[h.tipo_acao] && h.subtipo !== "thesis" && h.subtipo !== "study";
    });
    HOLD_STATE.historico.forEach(function (h) {
      if ("tese_id" in h) { delete h.tese_id; mudou = true; }
    });
    ["alerta_sem_tese", "mostrar_conviccao", "alerta_invalidacao", "alerta_revisao"].forEach(function (k) {
      if (HOLD_STATE.config && k in HOLD_STATE.config) { delete HOLD_STATE.config[k]; mudou = true; }
    });
    return mudou || HOLD_STATE.historico.length !== antes;
  }

  var watchingWallets = false;
  function watchWallets() {
    if (watchingWallets || !window.AtlasWallets) return;
    watchingWallets = true;
    window.AtlasWallets.subscribe(function () {
      // troca de carteira global feita em qualquer módulo re-renderiza o Hold
      emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
    });
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---- history helper (toda ação gera histórico) ---- */
  function logHistory(tipo_acao, subtipo, ativo_id, justificativa, impacto, quando) {
    var h = {
      id: uid("h"), tipo_acao: tipo_acao, subtipo: subtipo || null,
      ativo_id: ativo_id || null,
      justificativa: justificativa || "", impacto: impacto || "",
      data: quando || new Date().toISOString()
    };
    HOLD_STATE.historico.unshift(h);
    return h;
  }

  /* ------------------------------------------------------------
     QUANTIDADE SEM RESTO DE PONTO FLUTUANTE

     0,7 − 0,4 dá 0,29999999999999993 em JavaScript. A tela mostrava
     "0,3", a pessoa digitava 0,3 para vender tudo e a venda era
     recusada como "Quantidade inválida" — não havia como fechar a
     posição. Toda quantidade passa a ser arredondada em 10 casas
     (mais fina que qualquer token real) antes de ser gravada ou
     comparada.
     ------------------------------------------------------------ */
  var CASAS_QTD = 1e10;
  function arredQtd(q) { return Math.round((+q || 0) * CASAS_QTD) / CASAS_QTD; }

  /* Data da operação: o dia escolhido no formulário vira um instante
     para o histórico. Hoje → agora; dia passado → meio-dia local
     daquele dia (evita o dia "pular" ao converter para UTC). */
  function instanteDe(dia) {
    var s = String(dia || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s >= diaIso()) return new Date().toISOString();
    return new Date(s + "T12:00:00").toISOString();
  }

  /* ============================================================
     SELECTORS (derivações — nunca alteram estado)
     ============================================================ */
  function asset(id) { return HOLD_STATE.ativos.find(function (a) { return a.id === id; }); }
  function posicaoReal(aid, wid) {
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid && (p.walletId || "principal") === wid; });
  }
  /* O mesmo ativo em várias carteiras vira UMA linha na visão somada:
     quantidade somada e preço médio ponderado pelo custo. É só leitura
     — `partes` guarda as posições verdadeiras, e nenhuma ação grava
     neste objeto. */
  function somarPosicoes(lista) {
    if (lista.length === 1) return lista[0];
    var q = 0, custo = 0;
    lista.forEach(function (p) { q += p.quantidade; custo += p.quantidade * p.preco_medio; });
    return { ativo_id: lista[0].ativo_id, quantidade: arredQtd(q), preco_medio: q ? custo / q : 0,
             walletId: null, virtual: true, partes: lista };
  }
  /* Com carteira explícita, a posição verdadeira dela. Sem, a posição
     do que a tela está olhando (uma carteira, ou todas somadas). */
  function positionOf(aid, walletId) {
    if (walletId) return posicaoReal(aid, walletId);
    var ids = escopoIds();
    var achadas = HOLD_STATE.carteira.filter(function (p) {
      return p.ativo_id === aid && ids.indexOf(p.walletId || "principal") >= 0;
    });
    return achadas.length ? somarPosicoes(achadas) : undefined;
  }
  /* posições do que a tela está olhando — uma por ativo */
  function walletPositions(walletId) {
    if (walletId) {
      return HOLD_STATE.carteira.filter(function (p) { return (p.walletId || "principal") === walletId; });
    }
    var ids = escopoIds(), porAtivo = {}, ordem = [];
    HOLD_STATE.carteira.forEach(function (p) {
      if (ids.indexOf(p.walletId || "principal") < 0) return;
      if (!porAtivo[p.ativo_id]) { porAtivo[p.ativo_id] = []; ordem.push(p.ativo_id); }
      porAtivo[p.ativo_id].push(p);
    });
    return ordem.map(function (aid) { return somarPosicoes(porAtivo[aid]); });
  }
  /* posição de um ativo em QUALQUER carteira */
  function anyPositionOf(aid) {
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid; });
  }

  /* ============================================================
     STATUS DO ATIVO É CONSEQUÊNCIA, NÃO DECLARAÇÃO

     `status` era um campo GRAVADO, e o formulário de "Adicionar ativo"
     oferecia "Investido" numa lista suspensa. Medido na auditoria: dá
     para cadastrar um ativo marcado como investido sem comprar nada —
     nenhuma posição, nenhum dólar saindo do caixa. A partir daí o
     módulo mente em quatro lugares ao mesmo tempo:

       · Ativos → filtro "Investidos" lista um ativo que não se possui;
       · Métricas → conta "1 investido" contra 0 posições;
       · o inverso também acontecia — vender tudo numa carteira e
         continuar com posição em OUTRA deixava o campo desencontrado.

     Agora o status é derivado do único fato que o determina: existe
     posição? Vendeu alguma vez? É a mesma decisão que a auditoria
     tomou no status da faixa das pools (DeFiStore.statusDe) e pelo
     mesmo motivo — dado que descreve outro dado não pode ser digitado.
     ============================================================ */
  function statusDe(a) {
    if (!a) return "watchlist";
    if (anyPositionOf(a.id)) return "invested";
    /* Venda desfeita não conta: a linha fica no histórico, marcada. */
    var vendeu = HOLD_STATE.historico.some(function (h) {
      return h.ativo_id === a.id && h.subtipo === "sell" && !h.desfeita;
    });
    return vendeu ? "sold" : "watchlist";
  }

  function positionValue(p) {
    var a = asset(p.ativo_id); if (!a) return 0;
    return p.quantidade * a.preco_atual;
  }
  function positionCost(p) { return p.quantidade * p.preco_medio; }
  function positionPnL(p) { return positionValue(p) - positionCost(p); }
  function positionPnLPct(p) {
    var c = positionCost(p); return c === 0 ? 0 : (positionPnL(p) / c) * 100;
  }

  /* soma o valor das posições em TODAS as carteiras globais
     (o que sobe pro dashboard principal), independente da carteira ativa */
  function globalTotal() {
    var globalIds = window.AtlasWallets && window.AtlasWallets.globals
      ? window.AtlasWallets.globals().map(function (w) { return w.id; })
      : ["principal"];
    return HOLD_STATE.carteira.reduce(function (s, p) {
      var wid = p.walletId || "principal";
      return globalIds.indexOf(wid) > -1 ? s + positionValue(p) : s;
    }, 0);
  }

  function portfolioValue() {
    return walletPositions().reduce(function (s, p) { return s + positionValue(p); }, 0);
  }
  function portfolioCost() {
    return walletPositions().reduce(function (s, p) { return s + positionCost(p); }, 0);
  }
  function portfolioPnL() { return portfolioValue() - portfolioCost(); }
  function portfolioPnLPct() {
    var c = portfolioCost(); return c === 0 ? 0 : (portfolioPnL() / c) * 100;
  }
  /* Resultado JÁ REALIZADO em vendas de uma carteira, e o custo que o
     produziu (a base dele na rentabilidade). Andam juntos pelo mesmo
     motivo do Trade: numerador sem o seu denominador é o erro nº 2. */
  function vendasDe(walletId) {
    var ids = walletId ? [walletId] : escopoIds();
    return (HOLD_STATE.vendas || []).filter(function (v) { return ids.indexOf(v.walletId || "principal") >= 0; });
  }
  function realizado(walletId) {
    return vendasDe(walletId).reduce(function (s, v) { return s + (Number(v.resultado) || 0); }, 0);
  }
  function capitalRealizado(walletId) {
    return vendasDe(walletId).reduce(function (s, v) { return s + (Number(v.custo) || 0); }, 0);
  }
  /* O realizado de UM ativo na carteira. Sem isto, um ativo vendido
     com prejuízo aparecia na lista com "—" no resultado, e a tela dele
     dizia "Ainda não investido" — como se o dinheiro nunca tivesse
     passado por ali. */
  function realizadoDoAtivo(aid, walletId) {
    return vendasDe(walletId).filter(function (v) { return v.ativo_id === aid; })
      .reduce(function (acc, v) {
        acc.resultado += Number(v.resultado) || 0;
        acc.custo += Number(v.custo) || 0;
        acc.apurado += Number(v.apurado) || 0;
        acc.vendas++;
        return acc;
      }, { resultado: 0, custo: 0, apurado: 0, vendas: 0 });
  }

  /* A última operação desfazível de um ativo numa carteira. Só a mais
     recente: desfazer uma do meio deixaria o preço médio das seguintes
     calculado sobre uma base que deixou de existir. */
  function ultimaOperacao(aid, walletId) {
    var ids = walletId ? [walletId] : escopoIds();
    return (HOLD_STATE.operacoes || []).filter(function (o) {
      return o.ativo_id === aid && ids.indexOf(o.walletId) >= 0;
    })[0] || null;
  }

  function positionWeight(p) {
    var tot = portfolioValue(); return tot === 0 ? 0 : (positionValue(p) / tot) * 100;
  }

  /* ============================================================
     A CURVA DA CARTEIRA PASSA A SER MEDIDA

     O painel desenhava "Performance da carteira" a partir de uma
     função chamada, no próprio comentário, de "série sintética
     determinística": doze pontos rotulados Jan…Dez, interpolando do
     custo até o valor atual com uma ondulação de Math.sin() por cima.
     Nada ali aconteceu. Uma carteira aberta ontem exibia um ano de
     história, com subidas e quedas que ninguém viveu — e o mesmo
     desenho alimentava o sparkline do KPI "Valor da carteira",
     colando aparência de trajetória num número que é de hoje.

     É o mesmo defeito que esta auditoria já removeu do Trade
     (Math.sin(i) * 50) e do painel macro do RWA. Preço histórico o
     ATLAS não tem — e não dá para inventá-lo de trás para frente.
     O que ele PODE afirmar é o que mediu: uma leitura por dia, por
     carteira, igual ao snapshot do DeFi (Store._serie em
     defi/js/data.js). Dia sem abrir o sistema não vira ponto: a série
     repete o último valor conhecido, em degrau.

     Antes da primeira medição a série vem vazia — e vazio é um estado
     que a tela sabe desenhar. Melhor um espaço que diz "ainda não há
     medição" do que uma curva que diz o que não houve.
     ============================================================ */
  var MAX_SNAPS = 400;   /* só p/ o caminho de reserva, abaixo */

  function walletIdsGlobais() {
    return (window.AtlasWallets && window.AtlasWallets.globals)
      ? window.AtlasWallets.globals().map(function (w) { return w.id; })
      : ["principal"];
  }

  /* ------------------------------------------------------------
     A MEDIÇÃO SAIU DAQUI

     Os snapshots do Hold moravam em HOLD_STATE.snapshots, dentro do
     estado do módulo. Funcionava para o próprio painel do Hold e era
     invisível para todo o resto: a consolidação da raiz não tinha como
     ler uma medição guardada dentro de um store que ela não carrega —
     e por isso desenhava o Hold como linha reta.

     "Quanto isto valia naquele dia" é o mesmo conceito nos quatro
     módulos, e estava escrito três vezes em três formatos. Agora é um
     lugar só: core/atlas-snapshots.js. O Hold escreve lá e lê de lá.

     O caminho de reserva abaixo existe para a página aberta em
     file:// sem o arquivo compartilhado carregado — o módulo continua
     desenhando a própria curva, só não alimenta a consolidação.
     ------------------------------------------------------------ */
  /* Mede CADA carteira do Hold pelas posições dela — não "a carteira
     ativa". No modo todas, gravar a soma sob o id da ativa poria o
     valor de todas dentro de uma só. */
  function recordSnapshot() {
    var r = null;
    idsDoHold().forEach(function (wid) {
      var ps = walletPositions(wid);
      var v = ps.reduce(function (s, p) { return s + positionValue(p); }, 0);
      var c = ps.reduce(function (s, p) { return s + positionCost(p); }, 0);
      r = registrarSnapshot(wid, v, c);
    });
    return r;
  }
  function registrarSnapshot(wid, v, c) {
    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.registrar("hold", wid, { v: v, c: c });
    }

    /* reserva local */
    if (!HOLD_STATE.snapshots || typeof HOLD_STATE.snapshots !== "object") HOLD_STATE.snapshots = {};
    if (!Array.isArray(HOLD_STATE.snapshots[wid])) HOLD_STATE.snapshots[wid] = [];
    var snaps = HOLD_STATE.snapshots[wid];
    var hoje = diaIso();
    if (!snaps.length && v === 0 && c === 0) return snaps;
    var ultimo = snaps[snaps.length - 1];
    if (ultimo && ultimo.d === hoje) {
      if (ultimo.v === v && ultimo.c === c) return snaps;
      ultimo.v = v; ultimo.c = c;
    } else {
      snaps.push({ d: hoje, v: v, c: c });
      if (snaps.length > MAX_SNAPS) snaps.splice(0, snaps.length - MAX_SNAPS);
    }
    persist();
    return snaps;
  }

  function diaIso(d) {
    var x = d || new Date();
    return x.getFullYear() + "-" +
      String(x.getMonth() + 1).padStart(2, "0") + "-" +
      String(x.getDate()).padStart(2, "0");
  }

  /* Série da carteira ATIVA — o que o painel do Hold desenha. */
  function portfolioHistory(dias) {
    recordSnapshot();
    dias = dias || 90;
    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.serie(dias, {
        modules: ["hold"], wallets: escopoIds()
      }).map(function (p) { return { date: p.date, value: p.value, medido: p.medido }; });
    }
    return reservaSerie(HOLD_STATE.snapshots[escopoIds()[0]] || [], dias);
  }

  /* Série somando TODAS as carteiras globais — o que a consolidação
     precisa, e o que ela nunca teve como pedir. `globalTotal()` já
     soma assim; esta é a mesma régua ao longo do tempo. */
  function globalHistory(dias) {
    recordSnapshot();
    dias = dias || 90;
    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.serie(dias, {
        modules: ["hold"], wallets: walletIdsGlobais()
      });
    }
    return [];
  }

  function reservaSerie(snaps, dias) {
    if (!snaps.length) return [];
    var porDia = {};
    snaps.forEach(function (x) { porDia[x.d] = x; });
    var hoje = new Date(), corrente = null;
    var inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (dias - 1));
    var iniIso = diaIso(inicio);
    for (var k = 0; k < snaps.length; k++) if (snaps[k].d <= iniIso) corrente = snaps[k];
    var out = [];
    for (var i = dias - 1; i >= 0; i--) {
      var d = new Date(hoje); d.setDate(hoje.getDate() - i);
      var iso = diaIso(d);
      if (porDia[iso]) corrente = porDia[iso];
      if (!corrente) continue;
      out.push({ date: iso, value: corrente.v, cost: corrente.c, medido: !!porDia[iso] });
    }
    return out;
  }

  function counts() {
    return {
      ativos: HOLD_STATE.ativos.length,
      investidos: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "invested"; }).length,
      watchlist: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "watchlist"; }).length,
      vendidos: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "sold"; }).length,
      posicoes: walletPositions().length,
      historico: HOLD_STATE.historico.length
    };
  }

  /* ============================================================
     PREFERÊNCIAS DO MÓDULO — que existiam e não valiam nada

     Configurações → Hold oferecia interruptores que NENHUMA linha de
     código do módulo lia. Ligar ou desligar não mudava nada na tela —
     e um controle que não controla é pior que um ausente, porque a
     pessoa desliga o alerta, continua vendo o alerta e conclui que o
     sistema está quebrado.

     Agora as preferências correspondem aos alertas que EXISTEM, e são
     lidas aqui. O limite de concentração também sai daqui: ele estava
     escrito como "40" em três lugares (o alerta, a barra de peso da
     lista e o selo da tela do ativo) — três cópias da mesma regra.
     ============================================================ */
  var PADRAO_CONFIG = {
    alerta_concentracao: true,
    limite_concentracao: 40
  };

  function config(chave) {
    var c = HOLD_STATE.config || {};
    var v = c[chave];
    if (v === undefined || v === null || v === "") return PADRAO_CONFIG[chave];
    if (typeof PADRAO_CONFIG[chave] === "number") {
      var n = parseFloat(v);
      return isFinite(n) ? n : PADRAO_CONFIG[chave];
    }
    if (typeof PADRAO_CONFIG[chave] === "boolean") return v !== false && v !== "false";
    return v;
  }

  /* Um número, um dono: quem quiser saber se uma posição está
     concentrada pergunta aqui. */
  function concentrada(pct) { return pct > config("limite_concentracao"); }

  /* Alertas derivados das posições: concentração acima do limite. */
  function alerts() {
    var out = [];
    walletPositions().forEach(function (p) {
      if (!config("alerta_concentracao")) return;
      var pct = positionWeight(p);
      if (concentrada(pct)) {
        var a3 = asset(p.ativo_id);
        out.push({ level: "info", title: "Concentração elevada", sub: (a3 ? a3.ticker : "—") + " representa " + pct.toFixed(0) + "% da carteira.", asset: p.ativo_id });
      }
    });
    return out;
  }

  /* ============================================================
     ACTIONS (única via de mutação)
     ============================================================ */
  var actions = {

    /* -- Ativo -- */
    createAsset: function (data) {
      /* ------------------------------------------------------------
         UM TICKER, UM ATIVO

         Nada impedia cadastrar SOL duas vezes. Medido na auditoria do
         Hold: três ativos com ticker SOL convivendo, com preços 100,
         100 e 250 — o MESMO ativo valendo coisas diferentes na mesma
         tela.

         O estrago se espalha: a lista mostra o ativo três vezes, cada
         cópia acumula a sua posição, "Atualizar preços" busca SOL três
         vezes e grava em três lugares, e a alocação por ativo conta
         como se fossem três ativos distintos — diluindo uma
         concentração real em três fatias que parecem pequenas.

         É a mesma classe de defeito que a terceira auditoria passou
         inteira removendo: um conceito com mais de uma fonte.
         ------------------------------------------------------------ */
      var tk = String(data.ticker || "").trim().toUpperCase();
      if (!tk) return { error: "Informe o ticker do ativo." };
      var existente = HOLD_STATE.ativos.filter(function (x) {
        return String(x.ticker || "").toUpperCase() === tk;
      })[0];
      if (existente) {
        return { error: tk + " já está cadastrado como \"" + existente.nome + "\". " +
                        "Um ticker, um ativo — abra o ativo existente para comprar mais.",
                 asset: existente };
      }

      var a = {
        id: uid("as"),
        nome: data.nome, ticker: tk,
        tipo: data.tipo || "Cripto",
        preco_atual: num(data.preco_atual), market_cap: num(data.market_cap),
        setor: data.setor || "", categoria: data.categoria || ""
      };
      /* id exato da CoinGecko, quando o ativo veio do autocompletar:
         é por ele que o preço é buscado (ver refreshPrices). */
      if (data.cg_id) a.cg_id = String(data.cg_id);
      /* `status` NÃO é gravado aqui — ver statusDe(). Todo ativo nasce
         em watchlist porque é isso que ele é: cadastrado e não
         comprado. Vira "investido" quando a compra acontece. */
      HOLD_STATE.ativos.push(a);
      logHistory(EVENTS.ASSET_CREATED, "asset", a.id,
        "Ativo adicionado ao sistema.", a.ticker + " criado em " + statusLabel(statusDe(a)) + ".");
      emit(EVENTS.ASSET_CREATED, a); persist();
      return a;
    },

    updateAsset: function (id, patch) {
      var a = asset(id); if (!a) return;
      /* `status` é derivado (statusDe). Aceitar um patch de status
         aqui reabriria a porta que a auditoria fechou: um ativo
         "investido" por declaração, sem posição nenhuma. */
      var limpo = {};
      Object.keys(patch || {}).forEach(function (k) {
        if (k !== "status" && k !== "id") limpo[k] = patch[k];
      });
      Object.assign(a, limpo);
      persist(); emit(EVENTS.STATE_CHANGED, { evt: "asset_patched", payload: a });
      return a;
    },

    /* ============================================================
       EXCLUIR ATIVO — não existia, e a regra nova tornou isso caro

       O Hold nunca teve como apagar um ativo. Conviver com lixo já era
       ruim; depois de "um ticker, um ativo" virou um beco: um ticker
       digitado errado passa a BLOQUEAR o certo para sempre, e a única
       saída era apagar o módulo inteiro.

       O que a exclusão NÃO pode fazer:
         · sumir com posição aberta — o dinheiro está lá dentro. Quem
           quer sair vende, e a venda devolve o apurado ao caixa. Por
           isso a recusa quando há posição em qualquer carteira.
         · apagar o histórico. As linhas viram registro de um ativo que
           não existe mais, e as telas já sabem exibir isso ("—"). Um
           livro de decisões que se reescreve não é livro de decisões.
       ============================================================ */
    deleteAsset: function (id) {
      var a = asset(id); if (!a) return { error: "Ativo inexistente." };

      var pos = anyPositionOf(id);
      if (pos) {
        return { error: a.ticker + " tem posição aberta (" + pos.quantidade + " unidades). " +
                        "Venda antes de excluir — o apurado volta para o caixa da carteira. " +
                        "Excluir aqui faria o dinheiro sumir sem venda e sem saque." };
      }

      if (a.ticker && window.AtlasPrecos) window.AtlasPrecos.limparManual(a.ticker);

      HOLD_STATE.ativos = HOLD_STATE.ativos.filter(function (x) { return x.id !== id; });
      logHistory(EVENTS.ASSET_CREATED, "asset", id,
        "Ativo excluído do sistema.", a.ticker + " removido — não havia posição aberta.");
      emit(EVENTS.STATE_CHANGED, { evt: "asset_deleted", payload: a }); persist();
      return { deleted: a };
    },

    /* updatePrice() vivia aqui e NUNCA foi chamada por tela nenhuma —
       nem antes nem depois de o módulo ganhar remarcação de preço. Quem
       faz o trabalho hoje são refreshPrices() (todas, pela cadeia) e
       precoManual() (uma, informada por você). Uma terceira porta para
       gravar preço, sem dono, é a próxima divergência esperando
       acontecer. */


    /* ============================================================
       PREÇO NA MÃO — a regra do ATLAS, que faltava no Hold

       O botão "Atualizar preços" já dizia, quando nenhuma fonte
       reconhecia o ativo: "informe o preço na mão em Editar". Só que
       o Hold NÃO TINHA Editar — nem formulário, nem botão, nem rota.
       A instrução apontava para um lugar inexistente, e o preço de um
       ativo que nenhuma API conhece ficava travado no que foi digitado
       no cadastro, para sempre.

       O preço informado aqui vai para o registro manual central
       (core/atlas-precos.js), não para um campo solto: é ele que vence
       a API na cadeia de resolução, envelhece depois de sete dias e
       avisa quando está velho. Gravar só em `preco_atual` faria o
       próximo "Atualizar preços" apagá-lo em silêncio.
       ============================================================ */
    precoManual: function (id, usd) {
      var a = asset(id); if (!a) return { error: "Ativo inexistente." };
      var v = num(usd);
      if (!(v > 0)) return { error: "O preço precisa ser maior que zero." };
      if (!a.ticker) return { error: "O ativo precisa de ticker para ter preço." };
      if (window.AtlasPrecos) window.AtlasPrecos.definirManual(a.ticker, v);
      a.preco_atual = v;
      a.precoFonte = "manual";
      a.precoEm = new Date().toISOString();
      logHistory(EVENTS.POSITION_UPDATED, "price", id,
        "Preço informado manualmente.", a.ticker + " marcado a " + fmtMoney(v) + " por você.");
      emit(EVENTS.POSITION_UPDATED, a); persist();
      return { asset: a };
    },

    /* ============================================================
       ATUALIZAR TODOS OS PREÇOS — a regra do ATLAS também aqui

       updatePrice() existia e NUNCA era chamada por tela nenhuma: o
       preço do Hold era digitado no cadastro do ativo e envelhecia em
       silêncio para sempre. Uma carteira de longo prazo marcada a
       preço de meses atrás não é uma carteira de longo prazo — é uma
       fotografia antiga com moldura de painel ao vivo.

       Passa pela cadeia única (core/atlas-precos.js): preço manual do
       usuário → id curado → busca → DEX. O que nenhuma fonte
       reconhecer volta em `faltando`, para a tela pedir o valor —
       nunca vira zero, nunca fica escondido.

       Devolve Promise<{ atualizados, faltando, divergentes }>.
       ============================================================ */
    refreshPrices: function () {
      if (!window.AtlasPrecos) {
        return Promise.reject(new Error("Camada de preços não carregada nesta página."));
      }
      /* ------------------------------------------------------------
         SÓ CRIPTO VAI PARA A CADEIA AUTOMÁTICA

         A cadeia do ATLAS é de cripto: CoinGecko e, por último, pools
         de DEX casadas pelo SÍMBOLO. Medido em 08/10/2026: AAPL, TSLA,
         SPY e GOLD voltavam com preço — de tokens homônimos em DEX. Uma
         ação cadastrada no Hold era marcada pelo preço de um token
         qualquer, com cara de cotação. Ação, ETF, commodity e "outro"
         ficam no preço informado por você (Editar).
         ------------------------------------------------------------ */
      var todos = HOLD_STATE.ativos.filter(function (a) { return a.ticker; });
      var comTicker = todos.filter(ehCripto);
      var soManual = todos.filter(function (a) { return !ehCripto(a) && !(a.preco_atual > 0); })
        .map(function (a) { return a.ticker; });
      if (!comTicker.length) {
        return Promise.resolve({ atualizados: 0, faltando: [], divergentes: [], soManual: soManual, erro: null });
      }

      /* Quem foi cadastrado pelo autocompletar tem o id exato da
         CoinGecko. Buscar pelo id evita o casamento por símbolo, que
         é ambíguo (há dezenas de "UNI", "PEPE"...). Preço manual
         continua vencendo — ele nem entra nesta lista. */
      var prov = window.AtlasProviders && window.AtlasProviders.get && window.AtlasProviders.get("coingecko");
      var porId = comTicker.filter(function (a) {
        return a.cg_id && prov && prov.pricesRaw && !window.AtlasPrecos.manual(a.ticker);
      });
      var porSimbolo = comTicker.filter(function (a) { return porId.indexOf(a) < 0; });

      var pIds = porId.length
        ? prov.pricesRaw(porId.map(function (a) { return a.cg_id; })).catch(function (e) { return { __erro: e }; })
        : Promise.resolve({});
      var pSim = porSimbolo.length
        ? window.AtlasPrecos.deVarios(porSimbolo.map(function (a) { return a.ticker; }))
        : Promise.resolve({ valores: {}, fonte: {}, faltando: [], divergentes: [], erro: null });

      return Promise.all([pIds, pSim]).then(function (rs) {
        var mapaId = rs[0] || {}, d = rs[1];
        var n = 0, faltando = (d.faltando || []).slice();
        var erro = mapaId.__erro || d.erro || null;
        function aplicar(a, p, fonte) {
          if (p == null || !(p > 0)) return false;
          if (a.preco_atual !== p) {
            a.preco_atual = p; a.precoFonte = fonte; n++;
            a.precoEm = new Date().toISOString();
          } else if (fonte !== "manual") {
            /* conferido agora e igual: o preço continua fresco. O
               manual não — a idade dele é a de quando você o digitou. */
            a.precoEm = new Date().toISOString();
          }
          return true;
        }
        porId.forEach(function (a) {
          if (!aplicar(a, mapaId[a.cg_id], "coingecko")) faltando.push(a.ticker);
        });
        porSimbolo.forEach(function (a) {
          var k = String(a.ticker).toUpperCase();
          /* Com a fonte principal fora do ar, TODO ativo cai na DEX,
             que casa pelo símbolo — inclusive BTC e ETH, que ganhariam
             o preço de qualquer token homônimo. Melhor manter o preço
             anterior e tentar de novo. */
          if (erro && d.fonte[k] === "dex") return;
          aplicar(a, d.valores[k], d.fonte[k] || null);
        });
        persist();
        if (n) emit(EVENTS.STATE_CHANGED, { evt: "prices_refreshed" });
        return { atualizados: n, faltando: faltando, divergentes: d.divergentes || [],
                 soManual: soManual, erro: erro };
      });
    },

    /* Remarcação automática ao abrir o Hold: o preço só mudava quando
       alguém lembrava de clicar em "Atualizar preços", e a valorização
       da carteira ficava parada no preço do cadastro. Só dispara se
       algum ativo cripto estiver mais velho que `minutos`. */
    refreshIfStale: function (minutos) {
      var lim = Date.now() - (minutos || 15) * 60000;
      var velho = HOLD_STATE.ativos.some(function (a) {
        return a.ticker && ehCripto(a) && (!a.precoEm || new Date(a.precoEm).getTime() < lim);
      });
      if (!velho || !window.AtlasPrecos) return Promise.resolve(null);
      return actions.refreshPrices().catch(function () { return null; });
    },

    /* -- Carteira / trades -- */
    // Executa compra. O que decide se ela pode acontecer é o caixa.
    executeBuy: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };

      var qty = arredQtd(num(data.quantidade)), price = num(data.preco);
      if (qty <= 0 || price <= 0) return { error: "Quantidade e preço devem ser positivos." };
      if (data.data && String(data.data).slice(0, 10) > diaIso()) {
        return { error: "A data da compra não pode estar no futuro." };
      }
      /* ------------------------------------------------------------
         TAXA — da corretora ou da rede, em dólar

         Na compra ela é custo de entrar na posição: sai do caixa junto
         com o valor dos tokens e entra no preço médio. Comprar 1 BTC a
         60.000 pagando 60 de taxa custa 60.060 — é a partir daí que o
         ativo precisa subir para dar lucro.
         ------------------------------------------------------------ */
      var taxa = num(data.taxa);
      if (taxa < 0) return { error: "A taxa não pode ser negativa." };

      /* ------------------------------------------------------------
         O CUSTO SAI DO CAIXA DA CARTEIRA ESCOLHIDA

         A compra criava a posição do nada: o patrimônio subia sozinho
         e nenhum dinheiro saía de lugar nenhum. Agora o custo sai do
         caixa da carteira da posição. Com data.cobrirFalta (o
         formulário), o que faltar entra antes como depósito automático
         (AtlasCaixa.cobrirFalta); sem ela, carteira sem caixa não compra.
         ------------------------------------------------------------ */
      var custo = qty * price + taxa;
      var widC = data.walletId || activeWalletId();
      if (window.AtlasWallets && (!window.AtlasWallets.get || !window.AtlasWallets.get(widC))) {
        return { error: "Carteira inválida para registrar a compra." };
      }
      var depAuto = null;
      if (data.cobrirFalta && window.AtlasCaixa && window.AtlasCaixa.cobrirFalta) {
        depAuto = window.AtlasCaixa.cobrirFalta(widC, custo, {
          module: "hold", refId: "hold:" + a.id, data: data.data,
          obs: "Depósito automático para comprar " + (a.ticker || "")
        });
        if (depAuto === false) return { error: "O caixa da carteira não pôde ser registrado." };
      }
      if (window.AtlasCaixa) {
        var conf = window.AtlasCaixa.podeGastar(widC, custo);
        if (!conf.ok) {
          return { error: "Caixa insuficiente: há " + fmtMoney(conf.saldo) +
                          " e a compra custa " + fmtMoney(custo) +
                          ". Registre um depósito em Carteiras & Movimentações." };
        }
      }

      var pos = positionOf(a.id, widC);
      var antes = pos ? clone(pos) : null;
      if (pos) {
        var newQty = arredQtd(pos.quantidade + qty);
        pos.preco_medio = ((pos.quantidade * pos.preco_medio) + custo) / newQty;
        pos.quantidade = newQty;
      } else {
        pos = { ativo_id: a.id, quantidade: qty, preco_medio: custo / qty, status: "invested" };
        // estampa de carteira/proveniência (o dinheiro é por carteira)
        if (window.AtlasWallets) Object.assign(pos, window.AtlasWallets.stamp("hold", data.origem || "compra", widC));
        else pos.walletId = "principal";
        /* aberta no dia da compra, não no dia do cadastro */
        if (data.data) pos.data = instanteDe(data.data);
        HOLD_STATE.carteira.push(pos);
      }
      /* `a.status = "invested"` saiu: existir posição JÁ é ser
         investido, e statusDe() lê isso direto. */
      var hBuy = logHistory(EVENTS.TRADE_EXECUTED, "buy", a.id,
        data.justificativa || "Compra registrada.",
        "Compra de " + fmtQtd(qty) + " " + a.ticker + " a " + fmtMoney(price) +
        " (total " + fmtMoney(custo) + (taxa > 0 ? ", com taxa de " + fmtMoney(taxa) : "") + ").",
        instanteDe(data.data));
      /* O dinheiro sai do caixa e vira posição. Era gravado TAMBÉM em
         AtlasMovements.record() — a mesma compra virava um movimento
         gravado ali, um movimento derivado das posições e um evento de
         caixa aqui. O AtlasMovements passou a ser uma vista do caixa,
         então este é o único registro. */
      var evAporte = null;
      if (window.AtlasCaixa) {
        evAporte = window.AtlasCaixa.registrar({
          tipo: "aporte", valorUSD: custo, walletId: widC,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Compra de " + fmtQtd(qty) + " " + (a.ticker || "") +
               (taxa > 0 ? " (taxa " + fmtMoney(taxa) + ")" : "")
        });
      }
      HOLD_STATE.operacoes.unshift({
        id: uid("op"), tipo: "buy", ativo_id: a.id, walletId: widC,
        quantidade: qty, preco: price, taxa: taxa, valorCaixa: custo, data: data.data || diaIso(),
        antes: antes,
        eventos: [evAporte && evAporte.id, depAuto && depAuto.id].filter(Boolean),
        histId: hBuy.id
      });
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "buy" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      return { position: pos, depositoAuto: depAuto ? depAuto.valorUSD : 0 };
    },

    // Venda: o apurado volta ao caixa da carteira.
    executeSell: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };
      var widS = data.walletId || activeWalletId();
      var pos = positionOf(a.id, widS); if (!pos) return { error: "Sem posição para vender nesta carteira." };
      var qty = arredQtd(num(data.quantidade)), price = num(data.preco);
      var tem = arredQtd(pos.quantidade);
      if (qty <= 0) return { error: "Informe a quantidade a vender." };
      if (qty > tem) {
        return { error: "Você tem " + fmtQtd(tem) + " " + a.ticker + " nesta carteira — não dá para vender " + fmtQtd(qty) + "." };
      }
      if (data.data && String(data.data).slice(0, 10) > diaIso()) {
        return { error: "A data da venda não pode estar no futuro." };
      }
      /* ------------------------------------------------------------
         VENDA A PREÇO ZERO FAZIA O DINHEIRO SUMIR

         A compra validava preço positivo; a venda não. O campo já vem
         preenchido com `preco_atual`, que é ZERO em ativo cadastrado
         sem preço — e nenhuma fonte reconhecendo o ticker, ele fica
         zero. Confirmar assim apagava a posição e creditava $0 no
         caixa: o capital investido evaporava do ATLAS sem depósito,
         sem saque e sem prejuízo declarado.

         É a regra de ouro nº 4 — nenhum dinheiro pode desaparecer.
         ------------------------------------------------------------ */
      if (price <= 0) {
        return { error: "Informe o preço de venda. A " + fmtMoney(0) +
                        " a posição sairia da carteira sem nada voltar ao caixa." };
      }
      /* Na venda a taxa sai do que volta: vender 1 BTC a 70.000 com 70
         de taxa devolve 69.930 ao caixa, e é sobre isso que o lucro é
         apurado. */
      var taxa = num(data.taxa);
      if (taxa < 0) return { error: "A taxa não pode ser negativa." };
      if (taxa >= qty * price) {
        return { error: "A taxa (" + fmtMoney(taxa) + ") é maior que o valor da venda (" +
                        fmtMoney(qty * price) + ") — confira os números." };
      }

      /* O resultado da venda é apurado ANTES de a quantidade baixar,
         sobre o preço médio da posição: é esse custo que sai dela. */
      var antes = clone(pos);
      var custoVendido = qty * pos.preco_medio;
      var venda = {
        id: uid("v"), ativo_id: a.id, walletId: pos.walletId || widS,
        quantidade: qty, preco: price, precoMedio: pos.preco_medio,
        taxa: taxa, custo: custoVendido, apurado: qty * price - taxa,
        resultado: qty * price - taxa - custoVendido,
        data: data.data || new Date().toISOString()
      };
      HOLD_STATE.vendas.unshift(venda);

      pos.quantidade = arredQtd(tem - qty);
      if (pos.quantidade <= 0) {
        HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== pos; });
        /* O ativo vira "vendido" sozinho: sem posição em carteira
           nenhuma e com venda no histórico, statusDe() já responde. */
      }
      var resTxt = venda.resultado >= 0 ? "lucro de " + fmtMoney(venda.resultado) : "prejuízo de " + fmtMoney(-venda.resultado);
      var hSell = logHistory(EVENTS.TRADE_EXECUTED, "sell", a.id,
        data.justificativa || "Venda registrada.",
        "Venda de " + fmtQtd(qty) + " " + a.ticker + " a " + fmtMoney(price) +
        (taxa > 0 ? ", taxa de " + fmtMoney(taxa) : "") +
        " (" + resTxt + " sobre o preço médio de " + fmtMoney(venda.precoMedio) + ").",
        instanteDe(data.data));
      var widRet = pos.walletId || widS;
      var apurado = venda.apurado;
      /* ------------------------------------------------------------
         VENDER NÃO É TIRAR DINHEIRO DO ATLAS

         A venda removia a posição e registrava uma "saída" — e o
         dinheiro sumia do sistema. Mas vender não é sacar: o apurado
         vira CAIXA da mesma carteira, disponível para a próxima
         decisão. Quem quiser tirar do ATLAS registra um saque, que é
         outro evento e reduz o patrimônio de propósito.
         ------------------------------------------------------------ */
      var evRet = null;
      if (window.AtlasCaixa) {
        evRet = window.AtlasCaixa.registrar({
          tipo: "retorno", valorUSD: apurado, walletId: widRet,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Venda de " + fmtQtd(qty) + " " + (a.ticker || "") +
               (taxa > 0 ? " (taxa " + fmtMoney(taxa) + ")" : "")
        });
      }
      HOLD_STATE.operacoes.unshift({
        id: uid("op"), tipo: "sell", ativo_id: a.id, walletId: widRet,
        quantidade: qty, preco: price, taxa: taxa, valorCaixa: apurado, data: data.data || diaIso(),
        antes: antes, eventos: evRet ? [evRet.id] : [],
        vendaId: venda.id, histId: hSell.id
      });
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "sell" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      return { position: pos, venda: venda };
    },

    /* ============================================================
       DESFAZER A ÚLTIMA OPERAÇÃO — para o erro de digitação

       Não havia como corrigir uma compra lançada errado: o único
       caminho era vender (gravando um resultado que não existiu) ou
       apagar o módulo. Agora a operação mais recente de um ativo numa
       carteira pode ser desfeita por inteiro: a posição volta a ser o
       que era (quantidade E preço médio), os eventos de caixa que ela
       gravou saem do extrato — inclusive o depósito automático — e a
       venda deixa de contar no realizado.

       Só a mais recente, de propósito (ver ultimaOperacao). E venda só
       se desfaz se o dinheiro dela ainda está no caixa: se já foi
       gasto em outra compra, apagar o retorno deixaria o caixa
       negativo — desfaça a outra compra antes.

       O histórico NÃO é apagado: ganha a linha "Operação desfeita", e
       a original fica marcada. Livro de decisões não se reescreve.
       ============================================================ */
    undoLast: function (aid, walletId) {
      var op = ultimaOperacao(aid, walletId);
      if (!op) return { error: "Não há operação para desfazer nesta carteira." };
      var a = asset(aid);
      var C = window.AtlasCaixa;

      if (op.tipo === "sell" && C && op.eventos.length) {
        var apurado = op.valorCaixa != null ? op.valorCaixa : op.quantidade * op.preco;
        var conf = C.podeGastar(op.walletId, apurado);
        if (!conf.ok) {
          return { error: "O dinheiro desta venda (" + fmtMoney(apurado) + ") já não está todo no caixa — há " +
                          fmtMoney(conf.saldo) + ". Desfaça antes a operação que usou esse dinheiro." };
        }
      }

      /* posição: volta exatamente ao que era */
      var atual = positionOf(aid, op.walletId);
      HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== atual; });
      if (op.antes) HOLD_STATE.carteira.push(clone(op.antes));

      if (op.vendaId) {
        HOLD_STATE.vendas = HOLD_STATE.vendas.filter(function (v) { return v.id !== op.vendaId; });
      }
      if (C && C.remover) op.eventos.forEach(function (id) { C.remover(id); });

      HOLD_STATE.operacoes = HOLD_STATE.operacoes.filter(function (o) { return o !== op; });
      HOLD_STATE.historico.forEach(function (h) { if (h.id === op.histId) h.desfeita = true; });
      logHistory(EVENTS.TRADE_EXECUTED, "undo", aid, "Operação desfeita.",
        (op.tipo === "buy" ? "Compra" : "Venda") + " de " + fmtQtd(op.quantidade) + " " +
        (a ? a.ticker : "") + " a " + fmtMoney(op.preco) + " foi desfeita — posição e caixa voltaram ao que eram.");
      emit(EVENTS.POSITION_UPDATED, op.antes); persist();
      return { desfeita: op };
    },

    /* updateConfig() saiu: nenhuma tela a chamava. As preferências do
       módulo são editadas em Configurações → Hold, por
       core/atlas-module-settings.js, que grava direto na chave. Manter
       um segundo caminho de escrita para o mesmo objeto é como as duas
       telas passam a discordar sobre o que está ligado. O Hold LÊ as
       preferências em config() — ver o bloco lá em cima. */


    resetToSeed: function () {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      /* A medição vive fora do estado do módulo agora — apagar só a
         chave do Hold deixaria a curva de pé no livro compartilhado,
         descrevendo uma carteira que não existe mais. */
      if (window.AtlasSnapshots) window.AtlasSnapshots.limpar("hold");
      load(); emit(EVENTS.STATE_CHANGED, { evt: "reset" });
    },

    /* exportJSON()/importJSON() saíram. O botão que usava o primeiro
       gerava um arquivo que o segundo nunca leu — importJSON não era
       chamado por tela nenhuma. Pior, o arquivo levava POSIÇÕES sem os
       eventos de caixa que as explicam: restaurá-lo recriaria
       patrimônio sem depósito que o justifique.

       O backup do ATLAS é central (core/atlas-backup.js), cobre
       atlas.hold.state.v2 e atlas.hold.wallet.v1 e restaura tudo junto,
       caixa incluído. Um formato de backup por sistema, não um por
       módulo. */
  };

  /* ---- utils ---- */
  function ehCripto(a) { return !a.tipo || a.tipo === "Cripto"; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function statusLabel(s) {
    return { invested: "investido", watchlist: "watchlist", sold: "vendido" }[s] || s;
  }
  /* Texto que fica GRAVADO no histórico: sempre em dólar e na grafia
     do resto do ATLAS ("US$ 1.234,56"). Era "$1,234" em en-US — a
     única tela do sistema com vírgula de milhar. Não passa pelo
     conversor de moeda de propósito: o registro não pode mudar de
     valor quando alguém troca a moeda de exibição. */
  function fmtMoney(v) {
    var n = num(v);
    var abs = Math.abs(n);
    var opt = abs >= 1000 ? { maximumFractionDigits: 0 }
      : abs > 0 && abs < 1 ? { maximumFractionDigits: 6 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return (n < 0 ? "−" : "") + "US$ " + Math.abs(n).toLocaleString("pt-BR", opt);
  }
  function fmtQtd(q) { return (+q || 0).toLocaleString("pt-BR", { maximumFractionDigits: 8 }); }

  /* ---- public API ---- */
  window.Store = {
    EVENTS: EVENTS, state: HOLD_STATE,
    on: on, emit: emit, init: load, persist: persist, uid: uid,
    actions: actions,
    get: {
      asset: asset, positionOf: positionOf,
      anyPositionOf: anyPositionOf, walletPositions: walletPositions,
      positionValue: positionValue, positionCost: positionCost, positionPnL: positionPnL,
      positionPnLPct: positionPnLPct, positionWeight: positionWeight,
      realizado: realizado, capitalRealizado: capitalRealizado,
      realizadoDoAtivo: realizadoDoAtivo, ultimaOperacao: ultimaOperacao,
      portfolioValue: portfolioValue, portfolioCost: portfolioCost,
      portfolioPnL: portfolioPnL, portfolioPnLPct: portfolioPnLPct,
      globalTotal: globalTotal, statusDe: statusDe,
      portfolioHistory: portfolioHistory, globalHistory: globalHistory,
      recordSnapshot: recordSnapshot,
      counts: counts, alerts: alerts,
      config: config, concentrada: concentrada
    },
    /* ---- Carteiras (ponte com a central) ---- */
    wallets: {
      /* No modo todas, `active()` devolve uma carteira-vista ("Todas as
         carteiras") para os rótulos das telas; `real()` é sempre a
         carteira de verdade — é ela que um formulário oferece. */
      todas: modoTodas,
      setTodas: function (on) {
        setModoTodas(!!on);
        emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
      },
      escopo: escopoIds,
      real: activeWallet,
      caixa: function () {
        if (!window.AtlasCaixa) return null;
        return escopoIds().reduce(function (s, id) { return s + (window.AtlasCaixa.saldo(id) || 0); }, 0);
      },
      eventosCaixa: function () {
        if (!window.AtlasCaixa) return [];
        /* eventos() recebe { walletId }, não o id solto — com o id solto o
           filtro era ignorado e voltava o livro de TODAS as carteiras */
        return escopoIds().reduce(function (acc, id) { return acc.concat(window.AtlasCaixa.eventos({ walletId: id }) || []); }, []);
      },
      list: function () { return window.AtlasWallets ? window.AtlasWallets.forModule("hold") : [{ id: "principal", name: "Principal", type: "global", color: "#4C9AFF" }]; },
      active: function () {
        return modoTodas()
          ? { id: null, name: "Todas as carteiras", todas: true, type: "todas" }
          : activeWallet();
      },
      activeId: activeWalletId,
      set: function (id) {
        if (!window.AtlasWallets) return;
        var w = window.AtlasWallets.get(id);
        if (!w) return;
        setModoTodas(false);   // escolher uma carteira sai da soma
        if (w.type === "global") { setLocalWalletId(null); window.AtlasWallets.setActiveGlobal(id); }
        else { setLocalWalletId(id); } // Local do Hold: fica só aqui, mas persiste
        emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
      },
      create: function (opts) {
        if (!window.AtlasWallets) return null;
        opts = opts || {};
        return window.AtlasWallets.create({ name: opts.name, type: opts.type || "isolada", module: "hold", color: opts.color, emoji: opts.emoji });
      }
    },
    fmt: { money: fmtMoney, qtd: fmtQtd }
  };
})();

;
return window;
}
