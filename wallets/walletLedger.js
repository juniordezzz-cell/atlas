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

    /* valor atual: total (todos os módulos) ou de um módulo só */
    balanceOf: function (walletId, module) {
      var l = L.ledgerOf(walletId);
      if (module) return l[module] ? num(l[module].valorAtual) : 0;
      var sum = 0;
      for (var m in l) if (l.hasOwnProperty(m)) sum += num(l[m].valorAtual);
      return sum;
    },

    /* capital investido: total ou de um módulo */
    capitalOf: function (walletId, module) {
      var l = L.ledgerOf(walletId);
      if (module) return l[module] ? num(l[module].capital) : 0;
      var sum = 0;
      for (var m in l) if (l.hasOwnProperty(m)) sum += num(l[m].capital);
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
