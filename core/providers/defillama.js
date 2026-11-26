/* ============================================================
   ATLAS · core/providers/defillama.js
   Dados de DeFi/RWA/yields (keyless) + preço on-chain por contrato.
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "precosAtuais", "onchainPrice", "defiTvl", "defiChains", "defiYields",
                "rwaTvl", "protocolFlows"

   Fontes gratuitas e sem chave da DefiLlama:
     api.llama.fi/v2/historicalChainTvl        -> TVL total DeFi (série)
     api.llama.fi/v2/chains                     -> TVL por rede
     api.llama.fi/v2/historicalChainTvl/<rede>  -> série por rede (var 24h)
     api.llama.fi/protocols                     -> protocolos (categoria, tvl)
     yields.llama.fi/pools                      -> pools de yield (APY)
     coins.llama.fi/prices/current/<refs>       -> preço atual em lote (ids
                                                   coingecko:<id>) e por contrato

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
  /* valor de ~7 dias antes do último ponto da série (para fluxo da semana) */
  function valor7dAtras(arr) {
    if (!arr || arr.length < 2) return null;
    var alvo = arr[arr.length - 1].date - 7 * 86400;
    for (var i = arr.length - 2; i >= 0; i--) { if (arr[i].date <= alvo) return arr[i].tvl || null; }
    return null;
  }

  /* ---------- respostas de vários MB: só em memória (26/11/2026) ----------
     /protocols (~10 MB), yields (~11 MB), taxas (~6 MB) e volume (~3 MB)
     não cabem no localStorage: o AtlasHttp tentava gravar, convertia o
     objeto inteiro em texto a cada leitura e a gravação falhava. Aqui a
     promessa fica guardada em memória por `ttl` e quem chama guarda só o
     resultado já resumido. */
  var memo = {};
  function lerGrande(chave, url, ttl, timeout) {
    var m = memo[chave];
    if (m && Date.now() - m.t < ttl) return m.p;
    var p = AtlasHttp.getJSON(url, { ttl: 0, timeout: timeout || 25000, retries: 1 });
    memo[chave] = { t: Date.now(), p: p };
    p.catch(function () { if (memo[chave] && memo[chave].p === p) delete memo[chave]; });
    return p;
  }
  function protocolosBrutos() { return lerGrande("protocols", API + "/protocols", 300000); }
  function yieldsBrutos() { return lerGrande("yields", "https://yields.llama.fi/pools", 300000); }

  /* Agrupamento por protocolo-mãe: "Aave V3" + "Aave V2" = Aave.
     Pontes, curadores e alocadores contam o mesmo dinheiro de novo
     (a própria DefiLlama os tira do TVL padrão); CEX e Chain não são DeFi. */
  var FORA_DO_DEFI = /^(CEX|Chain|Bridge|Canonical Bridge|Cross Chain Bridge|Risk Curators|Onchain Capital Allocator)$/i;
  var NOME_GRUPO = { "maker": "Sky", "aero-protocol": "Aero", "ether-fi": "ether.fi", "pancakeswap": "PancakeSwap",
    "justlend": "JustLend", "uniswap": "Uniswap", "eigenlayer": "EigenLayer", "hyperliquid": "Hyperliquid" };
  var CHAVE_REDE_FORA = /-|^(staking|pool2|borrowed|doublecounted|liquidstaking|vesting|offers|treasury|dcAndLsOverlap)$/i;
  function chaveGrupo(p) {
    if (p.parentProtocol) return String(p.parentProtocol).replace(/^parent#/, "");
    return p.slug || String(p.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  function prefixoComum(nomes) {
    var partes = nomes.map(function (n) { return String(n).split(/\s+/); });
    var out = [];
    for (var i = 0; i < partes[0].length; i++) {
      var w = partes[0][i];
      if (partes.every(function (p) { return p[i] === w; })) out.push(w); else break;
    }
    return out.join(" ");
  }
  function nomeDoGrupo(chave, filhos) {
    if (NOME_GRUPO[chave]) return NOME_GRUPO[chave];
    if (filhos.length === 1) return filhos[0].name;
    var pre = prefixoComum(filhos.map(function (f) { return f.name; }));
    if (pre) return pre;
    return chave.split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }
  /* variação ponderada de um grupo: soma do valor de antes / soma do de hoje */
  function variacaoGrupo(filhos, campo) {
    var hoje = 0, antes = 0;
    filhos.forEach(function (f) {
      var c = f[campo];
      if (c == null || !isFinite(c) || !f.tvl) return;
      hoje += f.tvl; antes += f.tvl / (1 + c / 100);
    });
    return antes > 0 ? (hoje - antes) / antes * 100 : null;
  }
  /* agrupa linhas do overview (volume/taxas) pela mesma chave do /protocols */
  function somaPorGrupo(lista, filtro) {
    var g = {};
    (lista || []).forEach(function (x) {
      if (!x || !(x.total24h > 0) || (filtro && !filtro(x))) return;
      var k = chaveGrupo(x);
      var e = g[k] || (g[k] = { chave: k, nome: null, v24h: 0, antes: 0, filhos: [] });
      e.v24h += x.total24h;
      if (x.total48hto24h > 0) e.antes += x.total48hto24h;
      e.filhos.push({ name: x.displayName || x.name });
    });
    Object.keys(g).forEach(function (k) {
      var e = g[k];
      e.nome = nomeDoGrupo(k, e.filhos);
      e.change1d = e.antes > 0 ? (e.v24h - e.antes) / e.antes * 100 : null;
      // dia anterior quase zerado (protocolo novo, coleta falha) dá +19.000%: não informa nada
      if (e.change1d != null && Math.abs(e.change1d) > 500) e.change1d = null;
      delete e.filhos; delete e.antes;
    });
    return g;
  }

  var DefiLlama = {
    capabilities: ["onchainPrice", "precosAtuais", "seriesLote", "variacoes", "defiTvl", "defiChains", "defiYields", "rwaTvl", "protocolFlows", "stablecoins", "defiCategories",
                   "defiProtocolos", "defiVolume", "defiTaxas", "stablecoinsTotal", "yieldsBrutos"],

    /* ------------------------------------------------------------
       MERCADO · ABA DEFI (26/11/2026)
       ------------------------------------------------------------ */

    /* Protocolos agrupados pela mãe, maior TVL primeiro.
       { chave, nome, categoria, tvl, change1d, change7d, redes:{rede:tvl},
         redePrincipal, geckoId, logo, link } */
    defiProtocolos: function () {
      return protocolosBrutos().then(function (arr) {
        var grupos = {};
        (arr || []).forEach(function (p) {
          if (!(p.tvl > 0) || FORA_DO_DEFI.test(p.category || "")) return;
          var k = chaveGrupo(p);
          (grupos[k] || (grupos[k] = [])).push(p);
        });
        return Object.keys(grupos).map(function (k) {
          var fs = grupos[k].slice().sort(function (a, b) { return b.tvl - a.tvl; });
          var redes = {};
          fs.forEach(function (f) {
            var ct = f.chainTvls || {};
            Object.keys(ct).forEach(function (r) {
              if (CHAVE_REDE_FORA.test(r) || !(ct[r] > 0)) return;
              redes[r] = (redes[r] || 0) + ct[r];
            });
          });
          var principal = Object.keys(redes).sort(function (a, b) { return redes[b] - redes[a]; })[0] || fs[0].chain || null;
          var gecko = null; fs.some(function (f) { if (f.gecko_id) { gecko = f.gecko_id; return true; } return false; });
          var tvl = fs.reduce(function (s, f) { return s + f.tvl; }, 0);
          return {
            chave: k, nome: nomeDoGrupo(k, fs), categoria: fs[0].category || null, tvl: tvl,
            change1d: variacaoGrupo(fs, "change_1d"), change7d: variacaoGrupo(fs, "change_7d"),
            redes: redes, redePrincipal: principal, geckoId: gecko, logo: fs[0].logo || null,
            link: "https://defillama.com/protocol/" + encodeURIComponent(k)
          };
        }).sort(function (a, b) { return b.tvl - a.tvl; });
      });
    },

    /* Volume de DEX em 24h: total + por protocolo-mãe. Perpétuos ficaram
       pagos na DefiLlama (402); o da Hyperliquid vem do provedor dela. */
    defiVolume: function () {
      return lerGrande("dexs", API + "/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true", 300000)
        .then(function (d) {
          if (!d) return null;
          return { total24h: d.total24h || null, change1d: d.change_1d != null ? d.change_1d : null,
                   porGrupo: somaPorGrupo(d.protocols, function (x) { return /^dexs$/i.test(x.category || ""); }) };
        });
    },

    /* Taxas pagas pelos usuários em 24h, por protocolo-mãe. O total
       deixa de fora emissores de stablecoin (juros do Tesouro da Tether
       e da Circle), redes e corretoras — não é atividade DeFi. */
    defiTaxas: function () {
      return lerGrande("fees", API + "/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true", 300000)
        .then(function (d) {
          if (!d) return null;
          var g = somaPorGrupo(d.protocols, function (x) { return !/^(Stablecoin Issuer|Chain|CEX)$/i.test(x.category || ""); });
          var total = Object.keys(g).reduce(function (s, k) { return s + g[k].v24h; }, 0);
          return { total24h: total || null, porGrupo: g };
        });
    },

    /* Total de stablecoins em dólar e variação de 7 dias. */
    stablecoinsTotal: function () {
      return lerGrande("stchart", "https://stablecoins.llama.fi/stablecoincharts/all", 600000).then(function (arr) {
        if (!arr || arr.length < 8) return null;
        function usd(x) { return x && x.totalCirculatingUSD && x.totalCirculatingUSD.peggedUSD || 0; }
        var hoje = usd(arr[arr.length - 1]), antes = usd(arr[arr.length - 8]);
        return { total: hoje || null, change7d: antes ? (hoje - antes) / antes * 100 : null };
      });
    },

    /* Todas as pools de rendimento, cruas (lista grande, só em memória). */
    yieldsBrutos: function () {
      return yieldsBrutos().then(function (d) { return d && d.data ? d.data : []; });
    },

    /* ------------------------------------------------------------
       HISTÓRICO E VARIAÇÃO EM LOTE (16/10/2026)

       Medido no navegador: as 12 séries de 90 dias da carteira de
       teste vieram em ~1 s, em 3 pedidos paralelos e sem chave. Pela
       CoinGecko, um pedido por ativo e o limite da versão grátis
       levavam 1–2 minutos. A DefiLlama aceita o MESMO id da CoinGecko
       ("coingecko:<id>"), então nada precisa ser traduzido.
       O /chart recusa mais de 500 pontos por pedido: os ids vão em
       lotes de até 450 pontos (5 ativos × 90 dias).
       ------------------------------------------------------------ */
    seriesLote: function (cgIds, dias) {
      dias = dias || 90;
      var ids = (cgIds || []).filter(Boolean);
      if (!ids.length) return Promise.resolve({});
      var porLote = Math.max(1, Math.floor(450 / dias)), lotes = [];
      for (var i = 0; i < ids.length; i += porLote) lotes.push(ids.slice(i, i + porLote));
      var falhou = 0;
      return Promise.all(lotes.map(function (lote) {
        var refs = lote.map(function (id) { return "coingecko:" + id; }).join(",");
        /* ttl 0: quem guarda a versão diária enxuta é core/atlas-series.js */
        return AtlasHttp.getJSON("https://coins.llama.fi/chart/" + encodeURIComponent(refs) +
          "?span=" + dias + "&period=1d", { ttl: 0, retries: 1 })
          .catch(function () { falhou++; return null; });
      })).then(function (rs) {
        if (falhou === lotes.length) throw new Error("DefiLlama não respondeu.");
        var out = {};
        rs.forEach(function (r) {
          var coins = r && r.coins || {};
          Object.keys(coins).forEach(function (k) {
            var pts = (coins[k].prices || []).filter(function (x) { return x && x.price > 0; })
              .map(function (x) { return [x.timestamp * 1000, x.price]; });
            if (pts.length) out[k.replace(/^coingecko:/, "")] = pts;
          });
        });
        return out;
      });
    },

    /* { id: { h24, d7 } } — duas chamadas em lote (24h e 7d) */
    variacoes: function (cgIds) {
      var ids = (cgIds || []).filter(Boolean);
      if (!ids.length) return Promise.resolve({});
      var refs = ids.map(function (id) { return "coingecko:" + id; }).join(",");
      function periodo(p) {
        return AtlasHttp.getJSON("https://coins.llama.fi/percentage/" + encodeURIComponent(refs) + "?period=" + p,
          { ttl: 120000, cacheKey: "llama.pct." + p + "." + refs })
          .then(function (d) { return d && d.coins || {}; }, function () { return null; });
      }
      return Promise.all([periodo("24h"), periodo("7d")]).then(function (rs) {
        if (!rs[0] && !rs[1]) throw new Error("DefiLlama não respondeu.");
        var out = {};
        ids.forEach(function (id) {
          var a = rs[0] && rs[0]["coingecko:" + id], b = rs[1] && rs[1]["coingecko:" + id];
          if (typeof a === "number" || typeof b === "number") {
            out[id] = { h24: typeof a === "number" ? a : null, d7: typeof b === "number" ? b : null };
          }
        });
        return out;
      });
    },

    /* ------------------------------------------------------------
       PREÇO ATUAL EM LOTE — fonte principal da cadeia (16/10/2026)

       Medido no navegador: o top 100 da CoinGecko veio inteiro, com
       diferença máxima de 0,65% para ela. Até 200 ids passam; com 250
       a URL chega a 5,4 KB e a API devolve 400 — por isso lotes de 100.

       Preço com confiança baixa (pool rasa) ou mais velho que 1 h fica
       de fora: quem chama manda esses ids para a reserva (CoinGecko).
       PROPAGA o erro quando nenhum lote respondeu, como o pricesRaw da
       CoinGecko: falha de rede não pode virar "sem preço".
       ------------------------------------------------------------ */
    precosAtuais: function (cgIds) {
      var ids = [], visto = {};
      (cgIds || []).forEach(function (id) { if (id && !visto[id]) { visto[id] = 1; ids.push(String(id)); } });
      if (!ids.length) return Promise.resolve({});
      ids.sort();
      var lotes = [];
      for (var i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
      var falhou = 0, ultimoErro = null;
      return Promise.all(lotes.map(function (lote) {
        var refs = lote.map(function (id) { return "coingecko:" + id; }).join(",");
        return AtlasHttp.getJSON("https://coins.llama.fi/prices/current/" + encodeURIComponent(refs),
          { ttl: 60000, cacheKey: "llama.atual." + refs })
          .catch(function (e) { falhou++; ultimoErro = e; return null; });
      })).then(function (rs) {
        if (falhou === lotes.length) throw ultimoErro || new Error("DefiLlama não respondeu.");
        var agora = Date.now() / 1000, out = {};
        rs.forEach(function (r) {
          var coins = r && r.coins || {};
          Object.keys(coins).forEach(function (k) {
            var c = coins[k];
            if (!c || typeof c.price !== "number" || !isFinite(c.price) || !(c.price > 0)) return;
            if (typeof c.confidence === "number" && c.confidence < 0.9) return;
            if (typeof c.timestamp === "number" && agora - c.timestamp > 3600) return;
            out[k.replace(/^coingecko:/, "")] = c.price;
          });
        });
        return out;
      });
    },

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
              .then(function (h) {
                var v7 = valor7dAtras(h);
                return { name: c.name, tvl: c.tvl, change24h: change24hFromSeries(h),
                         change7d: v7 ? (c.tvl - v7) / v7 * 100 : null, delta7d: v7 ? c.tvl - v7 : null };
              })
              .catch(function () { return { name: c.name, tvl: c.tvl, change24h: null, change7d: null, delta7d: null }; });
          }));
        });
    },

    /* Yields: APY médio (pools grandes) + melhores pools. */
    defiYields: function () {
      return yieldsBrutos().then(function (d) {
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
      return protocolosBrutos()
        .then(function (arr) {
          return (arr || []).filter(function (p) { return /rwa/i.test(p.category || "") && p.tvl; })
            .sort(function (a, b) { return b.tvl - a.tvl; }).slice(0, n)
            .map(function (p) { return { name: p.name, tvl: p.tvl, change24h: p.change_1d != null ? p.change_1d : null,
                                         change7d: p.change_7d != null ? p.change_7d : null, logo: p.logo || null,
                                         link: "https://defillama.com/protocol/" + encodeURIComponent(p.slug || "") }; });
        });
    },

    /* Fluxo de protocolos: maiores entradas/saídas de TVL em 24h (em $).
       chainFilter opcional: só protocolos presentes naquela rede. */
    protocolFlows: function (n, chainFilter) {
      n = n || 8;
      return protocolosBrutos()
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
      return protocolosBrutos()
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
