/* ============================================================
   ATLAS · core/providers/coinlore.js
   Último fallback keyless para panorama global e rankings.
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "global", "rankings"

   Fonte simples e sem chave. Cobre os ~100 maiores por market cap —
   suficiente como rede de segurança quando CoinGecko e CoinPaprika
   falham ao mesmo tempo. Sem detalhe de ativo nem gráfico.
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("coinlore")) return;

  var BASE = "https://api.coinlore.net/api";

  function num(x) { var n = parseFloat(x); return isFinite(n) ? n : null; }

  var CoinLore = {
    capabilities: ["global", "rankings"],

    global: function () {
      return AtlasHttp.getJSON(BASE + "/global/",
        { ttl: 120000, cacheKey: "cl.global" }
      ).then(function (arr) {
        var d = arr && arr[0];
        if (!d) return null;
        return {
          marketCap: num(d.total_mcap),
          volume24h: num(d.total_volume),
          btcDominance: num(d.btc_d)
        };
      });
    },

    topMovers: function (o) {
      o = o || {};
      var limit = o.perPage || 20;
      return AtlasHttp.getJSON(BASE + "/tickers/?start=0&limit=100",
        { ttl: 90000, cacheKey: "cl.tickers.100" }
      ).then(function (d) {
        var rows = (d && d.data ? d.data : []).map(function (c) {
          return {
            id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
            usd: num(c.price_usd), change24h: num(c.percent_change_24h),
            volume24h: num(c.volume24), marketCap: num(c.market_cap_usd),
            rank: c.rank || null, image: null, category: null
          };
        });
        var order = o.order || "market_cap_desc";
        if (/24h_desc/.test(order)) rows.sort(function (a, b) { return (b.change24h || -1e9) - (a.change24h || -1e9); });
        else if (/24h_asc/.test(order)) rows.sort(function (a, b) { return (a.change24h || 1e9) - (b.change24h || 1e9); });
        else if (/volume/.test(order)) rows.sort(function (a, b) { return (b.volume24h || 0) - (a.volume24h || 0); });
        return rows.slice(0, limit);
      });
    }
  };

  window.AtlasProviders.register("coinlore", CoinLore);
})();
