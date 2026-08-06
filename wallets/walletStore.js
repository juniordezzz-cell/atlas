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
