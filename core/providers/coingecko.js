/* ============================================================
   ATLAS · core/providers/coingecko.js
   Provedor de preços e busca de ativos (CoinGecko keyless).
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "prices", "search"

   API do provedor:
     .search(q)            -> Promise<[{id,symbol,name,rank,thumb}]>
     .price(id)            -> Promise<number|null>            (USD)
     .priceFull(id)        -> Promise<{usd, marketCap, image, symbol, name}|null>
     .prices(ids)          -> Promise<{ id: usd }>            (lote)
     .setApiKey(key)       -> Demo key opcional (30 req/min)

   Limites keyless: ~5-15 req/min → TTLs conservadores:
     busca 24h · preço simples 60s · market data 120s
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return; // exige o core
  if (window.AtlasProviders.get("coingecko")) return;

  var BASE = "https://api.coingecko.com/api/v3";
  var KEY_LS = "atlas.assets.cg_key.v1"; // mesma chave já usada pelo autocomplete

  function headers() {
    try {
      var k = localStorage.getItem(KEY_LS) || "";
      return k ? { "x-cg-demo-api-key": k } : {};
    } catch (e) { return {}; }
  }

  var CoinGecko = {
    capabilities: ["prices", "search"],

    search: function (q) {
      q = String(q || "").trim().toLowerCase();
      if (q.length < 2) return Promise.resolve([]);
      return AtlasHttp.getJSON(BASE + "/search?query=" + encodeURIComponent(q), {
        ttl: 1000 * 60 * 60 * 24, headers: headers(), cacheKey: "cg.search." + q
      }).then(function (data) {
        var items = (data && data.coins ? data.coins : []).map(function (c) {
          return { id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
                   rank: c.market_cap_rank || 9999, thumb: c.thumb || c.large || "" };
        });
        items.sort(function (a, b) { return a.rank - b.rank; });
        return items;
      });
    },

    /* Preço simples em USD (compatível com o comportamento antigo) */
    price: function (id) {
      if (!id) return Promise.resolve(null);
      return AtlasHttp.getJSON(
        BASE + "/simple/price?ids=" + encodeURIComponent(id) + "&vs_currencies=usd",
        { ttl: 60000, headers: headers(), cacheKey: "cg.price." + id }
      ).then(function (d) {
        return d && d[id] && typeof d[id].usd === "number" ? d[id].usd : null;
      }).catch(function () { return null; });
    },

    /* Preço + market cap + imagem + nome — para autopreenchimento completo.
       Rejeita com erro amigável (AtlasHttp) para o chamador exibir toast. */
    priceFull: function (id) {
      if (!id) return Promise.resolve(null);
      return AtlasHttp.getJSON(
        BASE + "/coins/markets?vs_currency=usd&ids=" + encodeURIComponent(id) +
        "&order=market_cap_desc&per_page=1&page=1&sparkline=false",
        { ttl: 120000, headers: headers(), cacheKey: "cg.markets." + id }
      ).then(function (arr) {
        var c = arr && arr[0];
        if (!c) return null;
        return {
          id: c.id,
          symbol: (c.symbol || "").toUpperCase(),
          name: c.name,
          usd: typeof c.current_price === "number" ? c.current_price : null,
          marketCap: typeof c.market_cap === "number" ? c.market_cap : null,
          image: c.image || ""
        };
      });
    },

    /* Lote: vários ids em uma única chamada (economiza rate limit) */
    prices: function (ids) {
      ids = (ids || []).filter(Boolean);
      if (!ids.length) return Promise.resolve({});
      var joined = ids.slice().sort().join(",");
      return AtlasHttp.getJSON(
        BASE + "/simple/price?ids=" + encodeURIComponent(joined) + "&vs_currencies=usd",
        { ttl: 60000, headers: headers(), cacheKey: "cg.prices." + joined }
      ).then(function (d) {
        var out = {};
        ids.forEach(function (id) {
          if (d && d[id] && typeof d[id].usd === "number") out[id] = d[id].usd;
        });
        return out;
      }).catch(function () { return {}; });
    },

    setApiKey: function (k) { try { localStorage.setItem(KEY_LS, k || ""); } catch (e) {} }
  };

  window.AtlasProviders.register("coingecko", CoinGecko);
})();
