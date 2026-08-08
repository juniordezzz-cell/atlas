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
    create: function (opts) {
      opts = opts || {};
      var d = load();
      var maxOrder = d.wallets.reduce(function (m, w) { return Math.max(m, w.order || 0); }, -1);
      var w = {
        id: genId(),
        name: (opts.name || "Nova carteira").trim(),
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
      w.name = (name || w.name).trim();
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
