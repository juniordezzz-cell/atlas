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
