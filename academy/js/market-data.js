/* ============================================================
   ATLAS · academy/js/market-data.js
   Fachada de dados do Academy — o ÚNICO ponto que as telas chamam.
   Depende de: core/http.js, core/providers/* (registry, coingecko,
   coinpaprika, binance, coinlore, defillama, feargreed, id-map)

   Esconde a cadeia de fallback (AtlasProviders.tryChain) e o tradutor
   de identidade (AtlasIdMap). A tela pede "gainers", "asset", "chart"
   e recebe a forma canônica — sem saber qual API respondeu.

   Regra do projeto: campo ausente = null; a UI mostra "indisponível".
   Nunca inventa número.
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyData) return;

  var P = window.AtlasProviders;

  // Ativos fixos da faixa de mercado. PAXG = ouro tokenizado.
  var TICKER = [
    { id: "bitcoin",  sym: "BTC" },
    { id: "ethereum", sym: "ETH" },
    { id: "solana",   sym: "SOL" },
    { id: "pax-gold", sym: "PAXG" }
  ];

  // Categoria RWA do CoinGecko (confirmada no /coins/categories).
  var RWA_CATEGORY = "real-world-assets-rwa";

  // Uma lista ampla alimenta gainers/losers/volume anormal (1 chamada).
  function market(perPage) {
    return P.tryChain("rankings", "topMovers",
      [{ order: "market_cap_desc", perPage: perPage || 250 }]
    ).catch(function () { return []; });
  }

  function sortByChangeDesc(a, b) { return (b.change24h == null ? -1e9 : b.change24h) - (a.change24h == null ? -1e9 : a.change24h); }
  function sortByChangeAsc(a, b)  { return (a.change24h == null ?  1e9 : a.change24h) - (b.change24h == null ?  1e9 : b.change24h); }

  var AcademyData = {

    /* Faixa superior: BTC/ETH/SOL/PAXG com preço, %24h e imagem.
       Deriva da lista ampla (CoinGecko) e completa o que faltar pela
       Binance — assim a faixa aparece mesmo com o CoinGecko fora. */
    ticker: function () {
      return market(250).then(function (rows) {
        var byId = {}, bySym = {};
        rows.forEach(function (r) { if (r.id) byId[String(r.id).toLowerCase()] = r;
                                    if (r.symbol) bySym[r.symbol.toUpperCase()] = r; });
        var result = [], missing = [];
        TICKER.forEach(function (w) {
          var r = byId[w.id] || bySym[w.sym];
          if (r && r.usd != null) {
            result.push({ id: w.id, symbol: w.sym, name: r.name || w.sym,
                          usd: r.usd, change24h: r.change24h, image: r.image || null });
          } else { missing.push(w); result.push(null); }
        });
        if (!missing.length) return result;
        // completa faltantes pela Binance (BTC/ETH/SOL/PAXG têm par USDT)
        var bin = P.get("binance");
        var pr = bin ? bin.prices(missing.map(function (w) { return w.sym; })) : Promise.resolve([]);
        return pr.then(function (arr) {
          var m = {}; (arr || []).forEach(function (t) { m[t.symbol] = t; });
          var i = 0;
          return result.map(function (row, idx) {
            if (row) return row;
            var w = TICKER[idx]; var t = m[w.sym];
            return { id: w.id, symbol: w.sym, name: w.sym,
                     usd: t ? t.usd : null, change24h: t ? t.change24h : null, image: null };
          });
        });
      });
    },

    /* Lista ampla do mercado (top ~250 por market cap). Alimenta o
       heatmap, o ranking, a dominância e os movers numa fonte só. */
    markets: function () { return market(250); },

    global: function () {
      return P.tryChain("global", "global", []);
    },

    feargreed: function () {
      return P.tryChain("feargreed", "feargreed", []).catch(function () { return null; });
    },

    gainers: function () {
      return market(250).then(function (rows) {
        return rows.filter(function (r) { return r.marketCap != null && r.change24h != null; })
                   .sort(sortByChangeDesc).slice(0, 15);
      });
    },

    losers: function () {
      return market(250).then(function (rows) {
        return rows.filter(function (r) { return r.marketCap != null && r.change24h != null; })
                   .sort(sortByChangeAsc).slice(0, 15);
      });
    },

    /* Volume anormal: maior razão volume/market cap (sinal de que algo
       se move além do tamanho do ativo). Ignora market cap nulo/zero. */
    abnormalVolume: function () {
      return market(250).then(function (rows) {
        return rows.filter(function (r) { return r.marketCap > 0 && r.volume24h > 0; })
                   .map(function (r) { r._ratio = r.volume24h / r.marketCap; return r; })
                   .sort(function (a, b) { return b._ratio - a._ratio; })
                   .slice(0, 10);
      });
    },

    /* RWAs em alta: categoria RWA do CoinGecko, ordenada por variação.
       Só o CoinGecko tem a categoria; se falhar, [] -> "indisponível". */
    rwa: function () {
      var cg = P.get("coingecko");
      if (!cg) return Promise.resolve([]);
      return cg.topMovers({ category: RWA_CATEGORY, order: "market_cap_desc", perPage: 50 })
        .then(function (rows) {
          return (rows || []).filter(function (r) { return r.change24h != null; })
                             .sort(sortByChangeDesc).slice(0, 15);
        }).catch(function () { return []; });
    },

    /* Categorias/setores na ordem natural do CoinGecko (por market cap).
       Quem exibe decide como ordenar/cortar. */
    categories: function () {
      return P.tryChain("categories", "categories", []).then(function (cats) {
        return (cats || []).filter(function (c) { return c.marketCap; }).slice(0, 24);
      }).catch(function () { return []; });
    },

    search: function (q) {
      return P.tryChain("search", "search", [q]).catch(function () { return []; });
    },

    /* Detalhe do ativo. Primário CoinGecko pelo id canônico; se cair e
       tivermos o símbolo, resolve o id do CoinPaprika e tenta lá. */
    asset: function (id, symbol) {
      var cg = P.get("coingecko");
      var first = cg ? cg.assetFull(id).catch(function () { return null; }) : Promise.resolve(null);
      return first.then(function (a) {
        if (a) return a;
        if (!symbol || !window.AtlasIdMap) return null;
        return AtlasIdMap.resolve(id, symbol, "coinpaprika").then(function (pid) {
          if (!pid) return null;
          var cp = P.get("coinpaprika");
          return cp ? cp.assetFull(pid) : null;
        });
      });
    },

    /* Gráfico: CoinGecko por id; senão Binance pelo símbolo; senão
       CoinPaprika pelo id resolvido. */
    chart: function (id, symbol, days) {
      var cg = P.get("coingecko");
      var p = cg ? cg.chart(id, days).catch(function () { return null; }) : Promise.resolve(null);
      return p.then(function (c) {
        if (c) return c;
        var bin = P.get("binance");
        if (symbol && bin) {
          return bin.chart(symbol, days).then(function (cb) {
            if (cb) return cb;
            if (!window.AtlasIdMap) return null;
            return AtlasIdMap.resolve(id, symbol, "coinpaprika").then(function (pid) {
              var cp = P.get("coinpaprika");
              return (pid && cp) ? cp.chart(pid, days) : null;
            });
          });
        }
        return null;
      });
    }
  };

  window.AcademyData = AcademyData;
})();
