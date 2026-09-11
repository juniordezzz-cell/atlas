/* ============================================================
   ATLAS · core/providers/defillama.js
   Dados de DeFi/RWA/yields (keyless) + preço on-chain por contrato.
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "onchainPrice", "defiTvl", "defiChains", "defiYields",
                "rwaTvl", "protocolFlows"

   Fontes gratuitas e sem chave da DefiLlama:
     api.llama.fi/v2/historicalChainTvl        -> TVL total DeFi (série)
     api.llama.fi/v2/chains                     -> TVL por rede
     api.llama.fi/v2/historicalChainTvl/<rede>  -> série por rede (var 24h)
     api.llama.fi/protocols                     -> protocolos (categoria, tvl)
     yields.llama.fi/pools                      -> pools de yield (APY)
     coins.llama.fi/prices/current/<refs>       -> preço por contrato

   Alimentam o command center (TVL DeFi, TVL por rede, RWA por TVL,
   yield médio, fluxo de protocolos). Todos com dado real.
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("defillama")) return;

  var API = "https://api.llama.fi";

  function change24hFromSeries(arr) {
    // arr: [{date(seg), tvl}] -> variação % entre o último e ~24h antes
    if (!arr || arr.length < 2) return null;
    var last = arr[arr.length - 1];
    var target = last.date - 86400;
    var prev = null;
    for (var i = arr.length - 2; i >= 0; i--) { if (arr[i].date <= target) { prev = arr[i]; break; } }
    if (!prev) prev = arr[0];
    if (!prev.tvl) return null;
    return (last.tvl - prev.tvl) / prev.tvl * 100;
  }

  var DefiLlama = {
    capabilities: ["onchainPrice", "defiTvl", "defiChains", "defiYields", "rwaTvl", "protocolFlows", "stablecoins", "defiCategories"],

    onchainPrice: function (refs) {
      refs = (refs || []).filter(Boolean);
      if (!refs.length) return Promise.resolve({});
      var joined = refs.join(",");
      return AtlasHttp.getJSON(
        "https://coins.llama.fi/prices/current/" + encodeURIComponent(joined),
        { ttl: 60000, cacheKey: "llama.px." + joined }
      ).then(function (d) {
        var coins = d && d.coins ? d.coins : {};
        var out = {};
        refs.forEach(function (ref) {
          var c = coins[ref];
          if (c && typeof c.price === "number") out[ref] = c.price;
        });
        return out;
      }).catch(function () { return {}; });
    },

    /* TVL total do DeFi: valor atual + série (últimos ~90 dias) p/ gráfico. */
    defiTvl: function () {
      return AtlasHttp.getJSON(API + "/v2/historicalChainTvl",
        { ttl: 300000, cacheKey: "llama.tvl.hist" }
      ).then(function (arr) {
        if (!arr || !arr.length) return null;
        var last = arr[arr.length - 1];
        var series = arr.slice(-90).map(function (p) { return [p.date * 1000, p.tvl]; });
        return { current: last.tvl, change24h: change24hFromSeries(arr), series: series };
      });
    },

    /* TVL por rede: top N com variação 24h (série por rede, em paralelo). */
    defiChains: function (n) {
      n = n || 6;
      return AtlasHttp.getJSON(API + "/v2/chains", { ttl: 300000, cacheKey: "llama.chains" })
        .then(function (arr) {
          var top = (arr || []).filter(function (c) { return c.tvl; })
                               .sort(function (a, b) { return b.tvl - a.tvl; }).slice(0, n);
          return Promise.all(top.map(function (c) {
            return AtlasHttp.getJSON(API + "/v2/historicalChainTvl/" + encodeURIComponent(c.name),
              { ttl: 300000, cacheKey: "llama.chain.hist." + c.name })
              .then(function (h) { return { name: c.name, tvl: c.tvl, change24h: change24hFromSeries(h) }; })
              .catch(function () { return { name: c.name, tvl: c.tvl, change24h: null }; });
          }));
        });
    },

    /* Yields: APY médio (pools grandes) + melhores pools. */
    defiYields: function () {
      return AtlasHttp.getJSON("https://yields.llama.fi/pools",
        { ttl: 300000, cacheKey: "llama.yields" }
      ).then(function (d) {
        var pools = d && d.data ? d.data : [];
        var big = pools.filter(function (p) { return p.tvlUsd > 1e7 && p.apy != null && p.apy < 1000; });
        var avg = big.length ? big.reduce(function (s, p) { return s + p.apy; }, 0) / big.length : null;
        var top = big.slice().sort(function (a, b) { return b.apy - a.apy; }).slice(0, 8)
          .map(function (p) { return { project: p.project, symbol: p.symbol, chain: p.chain, apy: p.apy, tvlUsd: p.tvlUsd }; });
        return { avgApy: avg, pools: top };
      });
    },

    /* Protocolos RWA por TVL (BlackRock BUIDL, Ondo, Tether Gold…). */
    rwaTvl: function (n) {
      n = n || 8;
      return AtlasHttp.getJSON(API + "/protocols", { ttl: 300000, cacheKey: "llama.protocols" })
        .then(function (arr) {
          return (arr || []).filter(function (p) { return /rwa/i.test(p.category || "") && p.tvl; })
            .sort(function (a, b) { return b.tvl - a.tvl; }).slice(0, n)
            .map(function (p) { return { name: p.name, tvl: p.tvl, change24h: p.change_1d != null ? p.change_1d : null, logo: p.logo || null }; });
        });
    },

    /* Fluxo de protocolos: maiores entradas/saídas de TVL em 24h (em $).
       chainFilter opcional: só protocolos presentes naquela rede. */
    protocolFlows: function (n, chainFilter) {
      n = n || 8;
      return AtlasHttp.getJSON(API + "/protocols", { ttl: 300000, cacheKey: "llama.protocols" })
        .then(function (arr) {
          return (arr || []).filter(function (p) {
              if (!(p.tvl > 5e7 && p.change_1d != null) || /cex|chain/i.test(p.category || "")) return false;
              if (chainFilter) { var chains = p.chains || []; if (chains.indexOf(chainFilter) === -1) return false; }
              return true;
            })
            .map(function (p) { return { name: p.name, tvl: p.tvl, change24h: p.change_1d, flowUsd: p.tvl * p.change_1d / 100, category: p.category || null, chains: p.chains || [] }; })
            .sort(function (a, b) { return Math.abs(b.flowUsd) - Math.abs(a.flowUsd); }).slice(0, n);
        });
    },

    /* Dominância de stablecoins por market cap (USDT domina ~59%, não 90%).
       Fonte: stablecoins.llama.fi. Devolve total + ranking com share %. */
    stablecoins: function (n) {
      return AtlasHttp.getJSON("https://stablecoins.llama.fi/stablecoins?includePrices=false",
        { ttl: 300000, cacheKey: "llama.stables" }
      ).then(function (d) {
        var arr = (d && d.peggedAssets ? d.peggedAssets : []).map(function (s) {
          return { symbol: (s.symbol || "").toUpperCase(), name: s.name,
                   mcap: (s.circulating && s.circulating.peggedUSD) || 0 };
        }).filter(function (x) { return x.mcap > 0; }).sort(function (a, b) { return b.mcap - a.mcap; });
        var tot = arr.reduce(function (s, x) { return s + x.mcap; }, 0) || 1;
        arr.forEach(function (x) { x.share = x.mcap / tot * 100; });
        return { total: tot, list: arr.slice(0, n || 6) };
      });
    },

    /* Dominância no DeFi por categoria de protocolo (Lending, Liquid
       Staking, Dexs…). Exclui CEX e Chain, que não são DeFi — igual à
       própria DefiLlama. Devolve total + lista com share %. */
    defiCategories: function (n) {
      return AtlasHttp.getJSON(API + "/protocols", { ttl: 300000, cacheKey: "llama.protocols" })
        .then(function (arr) {
          var byCat = {};
          (arr || []).forEach(function (p) {
            if (p.tvl > 0 && !/^(cex|chain)$/i.test(p.category || "")) {
              byCat[p.category] = (byCat[p.category] || 0) + p.tvl;
            }
          });
          var list = Object.keys(byCat).map(function (k) { return { cat: k, tvl: byCat[k] }; })
                           .sort(function (a, b) { return b.tvl - a.tvl; });
          var tot = list.reduce(function (s, x) { return s + x.tvl; }, 0) || 1;
          list.forEach(function (x) { x.share = x.tvl / tot * 100; });
          return { total: tot, list: list.slice(0, n || 7) };
        });
    }
  };

  window.AtlasProviders.register("defillama", DefiLlama);
})();
