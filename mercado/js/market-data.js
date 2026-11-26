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

  /* ---------- resultado resumido guardado no navegador (26/11/2026) ----------
     As respostas brutas da DefiLlama têm vários MB e ficam só em memória
     (core/providers/defillama.js). O que a tela usa, já resumido, fica aqui
     por `ttl`; se a fonte falhar, devolve o último resumo bom de até 24 h e
     anota a hora em AcademyData.idade[chave]. */
  var LS_MERCADO = "atlas.mercado.v1";
  var emVoo = {};
  function lerLS() { try { return JSON.parse(localStorage.getItem(LS_MERCADO) || "{}"); } catch (e) { return {}; } }
  function gravarLS(chave, dado) {
    try { var all = lerLS(); all[chave] = { t: Date.now(), d: dado }; localStorage.setItem(LS_MERCADO, JSON.stringify(all)); } catch (e) {}
  }
  function guardado(chave, ttl, fn) {
    var g = lerLS()[chave];
    if (g && Date.now() - g.t < ttl) { AcademyData.idade[chave] = g.t; return Promise.resolve(g.d); }
    if (emVoo[chave]) return emVoo[chave];
    var p = Promise.resolve().then(fn).then(function (d) {
      if (d == null || (Array.isArray(d) && !d.length)) throw new Error("vazio");
      gravarLS(chave, d); AcademyData.idade[chave] = Date.now(); return d;
    }).catch(function (e) {
      if (g && Date.now() - g.t < 86400000) { AcademyData.idade[chave] = g.t; return g.d; }
      throw e;
    });
    emVoo[chave] = p;
    p.then(function () { delete emVoo[chave]; }, function () { delete emVoo[chave]; });
    return p;
  }
  function prov(nome) { var x = P.get(nome); if (!x) throw new Error("provedor " + nome + " ausente"); return x; }

  /* ---------- Rendimentos: risco ESTIMADO pelo tipo de produto ----------
     baixo: Tesouro tokenizado, empréstimo nos protocolos grandes, staking líquido;
     alto: dólar sintético / estratégia de base, ou o que rende mais de 2× a régua;
     médio: o resto (cofres, curadores, empréstimo menor). A tela diz que é estimado. */
  var RISCO_BAIXO = /^(aave-v3|aave-v2|sky-lending|spark-savings|compound-v3|lido|rocket-pool|jito-liquid-staking|binance-staked-eth|coinbase-wrapped-staked-eth|blackrock-buidl|ondo-yield-assets|circle-usyc|marinade-liquid-staking|jupiter-staked-sol|ether\.fi-stake)$/;
  var RISCO_ALTO = /^(ethena-usde|usual-usd0|usd-ai|resolv|elixir|level|falcon-finance|f-x-protocol)/;
  var STAKING = /^(lido|rocket-pool|jito-liquid-staking|binance-staked-eth|coinbase-wrapped-staked-eth|jupiter-staked-sol|marinade-liquid-staking|kinetiq|ether\.fi-stake|stakewise-v2|frax-ether)$/;
  var NOME_PROJ = { "aave-v3": "Aave", "sky-lending": "Sky", "spark-savings": "Spark", "ethena-usde": "Ethena", "maple": "Maple",
    "morpho-blue": "Morpho", "jupiter-lend": "Jupiter", "kamino-lend": "Kamino", "usual-usd0": "Usual", "usd-ai": "USD.AI",
    "lido": "Lido", "rocket-pool": "Rocket Pool", "jito-liquid-staking": "Jito", "binance-staked-eth": "Binance",
    "jupiter-staked-sol": "Jupiter", "marinade-liquid-staking": "Marinade", "kinetiq": "Kinetiq", "compound-v3": "Compound",
    "invesco-ustb": "Invesco", "ether.fi-stake": "ether.fi", "coinbase-wrapped-staked-eth": "Coinbase" };
  function nomeProjeto(p) { return NOME_PROJ[p] || p.split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }
  function risco(proj, apy, regua) {
    if (RISCO_ALTO.test(proj) || (regua && apy > regua * 2)) return "alto";
    if (RISCO_BAIXO.test(proj)) return "baixo";
    return "medio";
  }
  function maiorPorChave(pools, chaveFn) {
    var m = {};
    pools.forEach(function (p) { var k = chaveFn(p); if (!m[k] || p.tvlUsd > m[k].tvlUsd) m[k] = p; });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  var AcademyData = {
    idade: {},

    /* ---- Mercado · aba DeFi (26/11/2026) ---- */
    defiProtocolos: function () {
      return guardado("protocolos", 300000, function () {
        return prov("defillama").defiProtocolos().then(function (l) {
          // só o que a tela usa: 200 maiores, redes resumidas às 4 maiores
          return (l || []).slice(0, 200).map(function (p) {
            var rs = Object.keys(p.redes || {}).sort(function (a, b) { return p.redes[b] - p.redes[a]; }).slice(0, 4);
            var redes = {}; rs.forEach(function (r) { redes[r] = p.redes[r]; });
            return { chave: p.chave, nome: p.nome, categoria: p.categoria, tvl: p.tvl, change1d: p.change1d, change7d: p.change7d,
                     redes: redes, redePrincipal: p.redePrincipal, geckoId: p.geckoId, link: p.link };
          });
        });
      });
    },
    defiVolume: function () {
      return guardado("volume", 300000, function () {
        return prov("defillama").defiVolume().then(function (v) {
          if (!v) return null;
          var g = v.porGrupo, top = Object.keys(g).map(function (k) { return g[k]; })
            .sort(function (a, b) { return b.v24h - a.v24h; }).slice(0, 60);
          var porGrupo = {}; top.forEach(function (x) { porGrupo[x.chave] = x; });
          return { total24h: v.total24h, change1d: v.change1d, porGrupo: porGrupo };
        });
      });
    },
    defiTaxas: function () {
      return guardado("taxas", 300000, function () {
        return prov("defillama").defiTaxas().then(function (v) {
          if (!v) return null;
          var g = v.porGrupo, top = Object.keys(g).map(function (k) { return g[k]; })
            .sort(function (a, b) { return b.v24h - a.v24h; }).slice(0, 80);
          var porGrupo = {}; top.forEach(function (x) { porGrupo[x.chave] = x; });
          return { total24h: v.total24h, porGrupo: porGrupo };
        });
      });
    },
    stablecoinsTotal: function () {
      return guardado("stables", 600000, function () { return prov("defillama").stablecoinsTotal(); });
    },
    hlVolume: function () {
      return guardado("hl", 300000, function () { return prov("hyperliquid").volumePerps(); });
    },

    /* ---- Mercado · aba Rendimentos ---- */
    rendimentos: function () {
      return guardado("rendimentos", 600000, function () {
        return prov("defillama").yieldsBrutos().then(function (pools) {
          pools = (pools || []).filter(function (p) { return p && p.apy != null && isFinite(p.apy) && p.apy > 0 && p.apy < 200 && !p.outlier; });
          var buidl = pools.filter(function (p) { return p.project === "blackrock-buidl" && p.tvlUsd > 1e7; });
          var tv = buidl.reduce(function (s, p) { return s + p.tvlUsd; }, 0);
          var regua = tv ? buidl.reduce(function (s, p) { return s + p.apy * p.tvlUsd; }, 0) / tv : null;
          function linha(p) {
            return { projeto: nomeProjeto(p.project), slug: p.project, simbolo: p.symbol, rede: p.chain, apy: p.apy,
                     tvl: p.tvlUsd, risco: risco(p.project, p.apy, regua), pool: p.pool };
          }
          var dolar = maiorPorChave(pools.filter(function (p) {
            return p.stablecoin && p.exposure === "single" && p.tvlUsd > 2e8 && p.apy >= 1 && !/^(blackrock-buidl|ondo-yield-assets|circle-usyc)$/.test(p.project);
          }), function (p) { return p.project + "|" + p.symbol; }).sort(function (a, b) { return b.tvlUsd - a.tvlUsd; }).slice(0, 8).map(linha);
          var staking = maiorPorChave(pools.filter(function (p) {
            return STAKING.test(p.project) && p.exposure === "single" && !p.stablecoin && p.tvlUsd > 5e7;
          }), function (p) { return p.project; }).sort(function (a, b) { return b.tvlUsd - a.tvlUsd; }).slice(0, 6).map(linha);
          if (!dolar.length && !staking.length) return null;
          return { regua: regua, dolar: dolar, staking: staking };
        });
      });
    },

    /* Pools do Scanner (as mesmas que o Simulador lê), só as Sólidas,
       maior nota primeiro. Precisa de ferramentas/scanner-pools/servidor.js. */
    scannerPools: function (n) {
      var S = window.ScannerServidor;
      if (!S) return Promise.resolve([]);
      return S.carregar().then(function (d) {
        var lista = S.lerTokens(), decisoes = S.lerDecisoes(), marcas = S.lerMarcas();
        var ps = S.semDuplicatas((d.pools || []).map(function (r) { return S.paraPool(r, marcas[r.id]); }));
        return ps.filter(function (p) { return S.trilhoEfetivo(p, lista, decisoes) === "solida" && p.apr != null; })
                 .sort(function (a, b) { return (b.nota || 0) - (a.nota || 0); }).slice(0, n || 6);
      }).catch(function () { return []; });
    },

    /* Classes de ativo tokenizado pelas categorias da CoinGecko (uma chamada).
       Desde nov/2026 a DefiLlama zera o TVL de BUIDL, Ondo, Paxos Gold e
       Tether Gold no /protocols, então a soma dela deixou de servir para RWA. */
    categoriasRwa: function () {
      var IDS = ["tokenized-products", "tokenized-private-credit", "tokenized-treasuries", "tokenized-gold", "tokenized-silver", "tokenized-stock"];
      return guardado("catrwa", 600000, function () {
        return P.tryChain("categories", "categories", []).then(function (cats) {
          var out = {};
          (cats || []).forEach(function (c) { if (IDS.indexOf(c.id) > -1 && c.marketCap) out[c.id] = { valor: c.marketCap, change24h: c.change24h }; });
          return Object.keys(out).length ? out : null;
        });
      });
    },

    /* Ações tokenizadas: lista inteira (alta, queda e soma do valor). */
    tokenizedStocksAll: function () {
      return guardado("acoes", 300000, function () {
        var cg = P.get("coingecko");
        if (!cg) return [];
        return cg.topMovers({ category: "tokenized-stock", order: "market_cap_desc", perPage: 100 }).then(function (rows) {
          return (rows || []).filter(function (r) { return r.usd; }).map(function (r) {
            return { id: r.id, symbol: r.symbol, name: r.name, usd: r.usd, change24h: r.change24h, marketCap: r.marketCap, volume24h: r.volume24h };
          });
        });
      });
    },

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

    /* ---- DeFi / RWA / yields (DefiLlama, fonte única keyless) ---- */
    defiTvl: function () { var d = P.get("defillama"); return d ? d.defiTvl().catch(function(){return null;}) : Promise.resolve(null); },
    defiCategories: function (n) { var d = P.get("defillama"); return d ? d.defiCategories(n).catch(function(){return null;}) : Promise.resolve(null); },
    stablecoins: function (n) { var d = P.get("defillama"); return d ? d.stablecoins(n).catch(function(){return null;}) : Promise.resolve(null); },

    /* RWAs em alta = estritamente AÇÕES TOKENIZADAS (categoria do CoinGecko
       tokenized-stock): TSLAX, MSTRX, CRCLX… ordenadas por variação 24h. */
    tokenizedStocks: function () {
      var cg = P.get("coingecko");
      if (!cg) return Promise.resolve([]);
      return cg.topMovers({ category: "tokenized-stock", order: "market_cap_desc", perPage: 60 })
        .then(function (rows) {
          return (rows || []).filter(function (r) { return r.change24h != null && r.usd; })
                             .sort(sortByChangeDesc).slice(0, 7);
        }).catch(function () { return []; });
    },

    /* Dominância de RWA por protocolo/empresa (Ondo, BUIDL, Paxos Gold…),
       em % do TVL de RWA. Mostra onde está o dinheiro dos ativos do mundo real. */
    rwaDominance: function (n) {
      var d = P.get("defillama");
      if (!d) return Promise.resolve(null);
      return d.rwaTvl(n || 8).then(function (rows) {
        var tot = rows.reduce(function (s, x) { return s + (x.tvl || 0); }, 0) || 1;
        rows.forEach(function (x) { x.share = x.tvl / tot * 100; });
        return { total: tot, list: rows };
      }).catch(function () { return null; });
    },
    defiChains: function (n) { var d = P.get("defillama"); return d ? d.defiChains(n).catch(function(){return [];}) : Promise.resolve([]); },
    defiYields: function () { var d = P.get("defillama"); return d ? d.defiYields().catch(function(){return null;}) : Promise.resolve(null); },
    rwaTvl: function (n) { var d = P.get("defillama"); return d ? d.rwaTvl(n).catch(function(){return [];}) : Promise.resolve([]); },
    protocolFlows: function (n, chainFilter) { var d = P.get("defillama"); return d ? d.protocolFlows(n, chainFilter).catch(function(){return [];}) : Promise.resolve([]); },

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
