/* ============================================================
   ATLAS · core/providers/id-map.js
   Tradutor de identidade de ativo entre APIs.
   Depende de: core/http.js

   Cada fonte nomeia o mesmo ativo de um jeito: CoinGecko diz
   "solana", CoinPaprika diz "sol-solana", a Binance diz "SOLUSDT".
   Quando a cadeia de fallback cai do CoinGecko para outro provedor,
   é preciso traduzir o id canônico (CoinGecko) para o id da fonte de
   reserva. Este módulo faz isso pelo SÍMBOLO.

   window.AtlasIdMap.resolve(canonicalId, symbol, target)
     target: "binance" | "coinpaprika" | "coinlore"
     -> Promise<string|null>

   Binance usa o próprio símbolo (o provedor acrescenta "USDT").
   Paprika/Lore: lookup por símbolo no catálogo (cacheado 24h); em
   empate, o de menor rank. Não achou -> null (a cadeia segue e, se
   ninguém tiver, a tela diz "indisponível" — nunca inventa).
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasIdMap) return;
  if (!window.AtlasHttp) return;

  // memo em memória: { target: { SYM: id } }
  var memo = { coinpaprika: null, coinlore: null };

  function buildPaprika() {
    if (memo.coinpaprika) return Promise.resolve(memo.coinpaprika);
    return AtlasHttp.getJSON("https://api.coinpaprika.com/v1/coins",
      { ttl: 1000 * 60 * 60 * 24, cacheKey: "idmap.cp.coins" }
    ).then(function (arr) {
      var map = {};
      (arr || []).forEach(function (c) {
        if (!c || !c.symbol || c.is_active === false) return;
        var sym = c.symbol.toUpperCase();
        var rank = c.rank || 999999;
        if (!map[sym] || rank < map[sym].rank) map[sym] = { id: c.id, rank: rank };
      });
      var flat = {};
      Object.keys(map).forEach(function (s) { flat[s] = map[s].id; });
      memo.coinpaprika = flat;
      return flat;
    }).catch(function () { return {}; });
  }

  function buildLore() {
    if (memo.coinlore) return Promise.resolve(memo.coinlore);
    return AtlasHttp.getJSON("https://api.coinlore.net/api/tickers/?start=0&limit=100",
      { ttl: 1000 * 60 * 60 * 24, cacheKey: "idmap.cl.coins" }
    ).then(function (d) {
      var map = {};
      (d && d.data ? d.data : []).forEach(function (c) {
        if (!c || !c.symbol) return;
        var sym = c.symbol.toUpperCase();
        if (!map[sym]) map[sym] = c.id; // já vêm por rank
      });
      memo.coinlore = map;
      return map;
    }).catch(function () { return {}; });
  }

  window.AtlasIdMap = {
    resolve: function (canonicalId, symbol, target) {
      var sym = String(symbol || "").toUpperCase();
      if (!sym) return Promise.resolve(null);
      if (target === "binance") return Promise.resolve(sym);
      if (target === "coinpaprika") {
        return buildPaprika().then(function (m) { return m[sym] || null; });
      }
      if (target === "coinlore") {
        return buildLore().then(function (m) { return m[sym] || null; });
      }
      return Promise.resolve(null);
    }
  };
})();
