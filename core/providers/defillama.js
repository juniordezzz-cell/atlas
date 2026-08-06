/* ============================================================
   ATLAS · core/providers/defillama.js
   ------------------------------------------------------------
   PROVEDOR DE POOLS — capacidade "pools".

   O registry.js já previa este arquivo:
     "pools" → pools de liquidez por chain+DEX (Fase 2: defillama)

   Um endpoint público, sem chave, cobrindo todas as chains e DEXes
   de uma vez: Orca e Raydium na Solana, Uniswap e Curve no Ethereum,
   Aerodrome na Base, PancakeSwap na BNB, e o resto.

     https://yields.llama.fi/pools

   Campos por pool: pool (id), chain, project, symbol, tvlUsd,
   apyBase, apyReward, poolMeta, underlyingTokens, url.

   TRÊS DECISÕES QUE PRECISAM DE EXPLICAÇÃO
   ----------------------------------------

   1. A resposta NÃO passa pelo cache do AtlasHttp (ttl: 0).
      São dezenas de MB e mais de 10 mil pools. O AtlasHttp guarda o
      que busca no localStorage, e jogar isso lá estouraria a cota do
      navegador inteiro — derrubando o ATLAS, não só o DeFi. Baixamos
      cru, filtramos, e guardamos SÓ o resultado enxuto.

   2. Não existe lista branca de protocolos.
      A tentação é filtrar por project === "orca" | "uniswap-v3" | ...
      Mas esses slugs mudam quando o protocolo lança versão nova
      ("aerodrome-v1" virou "aerodrome-slipstream"). Uma lista branca
      falharia em silêncio: a busca voltaria vazia e pareceria queda de
      rede. Então filtramos por chain + TVL mínimo + par de dois
      tokens, e usamos os nomes conhecidos apenas para ROTULAR e
      ordenar. Protocolo novo aparece sozinho.

   3. O DefiLlama não devolve id do CoinGecko.
      Ele dá "SOL-USDC" e endereços de contrato. Quem traduz símbolo
      em preço é o defi/js/tokens.js. Este arquivo resolve a DESCOBERTA
      da pool; o preço é outro problema, de propósito.
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasProviders) return;

  var URL_POOLS = "https://yields.llama.fi/pools";
  var KEY_CACHE = "atlas_pools_registry_v1";

  /* Chains que o ATLAS exibe, no nome que o DefiLlama usa ->
     nome que o ATLAS usa (a paleta do DeFi chama BSC de BNB). */
  var CHAINS = {
    "Solana": "Solana",
    "Ethereum": "Ethereum",
    "Base": "Base",
    "Arbitrum": "Arbitrum",
    "Polygon": "Polygon",
    "Optimism": "Optimism",
    "BSC": "BNB",
    "Avalanche": "Avalanche"
  };

  /* Rótulo bonito por slug. Só cosmético — slug ausente aqui não é
     descartado, só aparece com o nome cru do DefiLlama. */
  var ROTULOS = {
    "orca": "Orca",
    "raydium-amm": "Raydium", "raydium-clmm": "Raydium",
    "meteora-dlmm": "Meteora", "meteora-dammv2": "Meteora", "meteora": "Meteora",
    "kamino-liquidity": "Kamino", "kamino-lend": "Kamino",
    "lifinity-v2": "Lifinity",
    "uniswap-v2": "Uniswap", "uniswap-v3": "Uniswap", "uniswap-v4": "Uniswap",
    "pancakeswap-amm": "PancakeSwap", "pancakeswap-amm-v3": "PancakeSwap",
    "aerodrome-v1": "Aerodrome", "aerodrome-slipstream": "Aerodrome",
    "velodrome-v2": "Velodrome", "velodrome-slipstream": "Velodrome",
    "curve-dex": "Curve",
    "balancer-v2": "Balancer", "balancer-v3": "Balancer",
    "camelot-v3": "Camelot",
    "sushiswap": "SushiSwap", "sushiswap-v3": "SushiSwap",
    "quickswap-v3": "QuickSwap",
    "aave-v3": "Aave",
    "pendle": "Pendle"
  };

  /* Protocolos que o Jeferson usa — sobem no topo da ordenação.
     Não excluem ninguém, só definem preferência. */
  var PREFERIDOS = {
    "Orca": 1, "Raydium": 1, "Meteora": 1, "Kamino": 1,
    "Uniswap": 1, "Aerodrome": 1, "PancakeSwap": 1, "Curve": 1
  };

  function rotulo(project) {
    return ROTULOS[project] || String(project || "").replace(/-/g, " ");
  }

  /* "SOL-USDC" -> ["SOL","USDC"].  Só aceitamos par de DOIS tokens:
     pool de 3+ (tri-crypto, stable pools) não tem como ser acompanhada
     pelo modelo de performance de dois lados. */
  function par(symbol) {
    var partes = String(symbol || "").toUpperCase().split(/[-\/]/)
      .map(function (x) { return x.trim(); }).filter(Boolean);
    return partes.length === 2 ? partes : null;
  }

  function enxugar(p) {
    var chain = CHAINS[p.chain];
    if (!chain) return null;
    var tokens = par(p.symbol);
    if (!tokens) return null;

    var base = typeof p.apyBase === "number" ? p.apyBase : 0;
    var rew = typeof p.apyReward === "number" ? p.apyReward : 0;

    return {
      id: p.pool,
      chain: chain,
      protocol: rotulo(p.project),
      project: p.project,
      symbol: tokens.join("/"),
      base: tokens[0],
      quote: tokens[1],
      tvl: Math.round(p.tvlUsd || 0),
      apr: Math.round((base + rew) * 100) / 100,
      aprBase: Math.round(base * 100) / 100,
      meta: p.poolMeta || "",
      url: p.url || ""
    };
  }

  function lerCache() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
      if (o && o.pools && o.pools.length) return o;
    } catch (e) {}
    return null;
  }

  function gravarCache(pools) {
    var pacote = { ts: Date.now(), pools: pools };
    try {
      localStorage.setItem(KEY_CACHE, JSON.stringify(pacote));
    } catch (e) {
      /* cota cheia: tenta a metade antes de desistir */
      try {
        pacote.pools = pools.slice(0, Math.floor(pools.length / 2));
        localStorage.setItem(KEY_CACHE, JSON.stringify(pacote));
      } catch (e2) { /* segue só em memória */ }
    }
    return pacote;
  }

  var DefiLlama = {
    name: "DefiLlama",
    capabilities: ["pools"],

    /* Pools já baixadas, do localStorage. Sem rede. */
    cached: function () {
      var c = lerCache();
      return c ? c.pools : [];
    },

    /* Quando foi a última atualização (ms) ou null */
    atualizadoEm: function () {
      var c = lerCache();
      return c ? c.ts : null;
    },

    limpar: function () {
      try { localStorage.removeItem(KEY_CACHE); } catch (e) {}
    },

    /* ------------------------------------------------------------
       Busca na rede, filtra e guarda.
         opts.minTvl   TVL mínimo em USD          (padrão 250 mil)
         opts.porChain quantas pools por chain     (padrão 60)
       Devolve Promise<[pool]>. Rejeita com Error legível — o
       chamador mostra a mensagem e continua com a lista local.
       ------------------------------------------------------------ */
    refresh: function (opts) {
      opts = opts || {};
      var minTvl = opts.minTvl != null ? opts.minTvl : 250000;
      var porChain = opts.porChain != null ? opts.porChain : 60;

      if (!window.AtlasHttp) {
        return Promise.reject(new Error("AtlasHttp não carregado nesta página."));
      }

      /* ttl 0 = não guardar a resposta crua no localStorage. Ver
         decisão 1 no topo do arquivo. */
      return AtlasHttp.getJSON(URL_POOLS, { ttl: 0, timeout: 45000, retries: 1 })
        .then(function (data) {
          var lista = (data && data.data) ? data.data : [];
          if (!lista.length) throw new Error("A resposta do DefiLlama veio vazia.");

          var porC = {};
          lista.forEach(function (p) {
            if (!p || (p.tvlUsd || 0) < minTvl) return;
            var e = enxugar(p);
            if (!e) return;
            if (!porC[e.chain]) porC[e.chain] = [];
            porC[e.chain].push(e);
          });

          var out = [];
          Object.keys(porC).forEach(function (chain) {
            porC[chain].sort(function (a, b) {
              var pa = PREFERIDOS[a.protocol] ? 0 : 1;
              var pb = PREFERIDOS[b.protocol] ? 0 : 1;
              if (pa !== pb) return pa - pb;       // preferidos primeiro
              return b.tvl - a.tvl;                 // depois, maior TVL
            });
            out = out.concat(porC[chain].slice(0, porChain));
          });

          if (!out.length) {
            throw new Error("Nenhuma pool passou pelo filtro de TVL de " +
                            minTvl.toLocaleString("pt-BR") + " USD.");
          }

          gravarCache(out);
          return out;
        })
        .catch(function (err) {
          /* file:// sem CORS liberado costuma chegar aqui como
             TypeError "Failed to fetch" — mensagem inútil para o
             usuário, então traduzimos. */
          var m = err && err.message ? err.message : "";
          if (/fetch|network|Load failed/i.test(m)) {
            throw new Error("Não consegui alcançar o DefiLlama. " +
              "Rodando em file:// o navegador às vezes bloqueia. " +
              "A lista local continua valendo.");
          }
          throw (err instanceof Error ? err : new Error(String(m || "Falha desconhecida.")));
        });
    },

    /* ------------------------------------------------------------
       Consulta a lista em cache.
         opts.chain, opts.protocol   filtro exato (opcional)
         opts.q                      texto livre em par/protocolo
         opts.limite                 padrão 40
       ------------------------------------------------------------ */
    buscar: function (opts) {
      opts = opts || {};
      var q = String(opts.q || "").trim().toUpperCase();
      var lista = DefiLlama.cached();

      if (opts.chain) {
        lista = lista.filter(function (p) { return p.chain === opts.chain; });
      }
      if (opts.protocol) {
        lista = lista.filter(function (p) { return p.protocol === opts.protocol; });
      }
      if (q) {
        lista = lista.filter(function (p) {
          return p.symbol.indexOf(q) !== -1 ||
                 p.protocol.toUpperCase().indexOf(q) !== -1;
        });
      }
      return lista.slice(0, opts.limite != null ? opts.limite : 40);
    },

    /* Protocolos presentes no cache, por chain — para popular selects
       com o que existe de verdade, em vez de lista fixa. */
    protocolos: function (chain) {
      var visto = {}, out = [];
      DefiLlama.cached().forEach(function (p) {
        if (chain && p.chain !== chain) return;
        if (visto[p.protocol]) return;
        visto[p.protocol] = 1; out.push(p.protocol);
      });
      return out.sort();
    },

    chains: function () {
      var visto = {}, out = [];
      DefiLlama.cached().forEach(function (p) {
        if (!visto[p.chain]) { visto[p.chain] = 1; out.push(p.chain); }
      });
      return out.sort();
    }
  };

  window.AtlasProviders.register("defillama", DefiLlama);
})();
