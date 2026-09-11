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
    capabilities: ["prices", "search", "rankings", "global", "assetDetail", "chart", "categories"],

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

    /* ============================================================
       PREÇO DE UM DIA ESPECÍFICO

       O ATLAS só sabia perguntar "quanto vale agora". Quem registra uma
       pool aberta na semana passada recebia o preço de hoje, e o
       próprio formulário admitia o problema no rodapé: "preço de
       mercado agora — corrija se a posição é de outra data". Ou seja,
       o sistema sabia que o número estava errado e passava a conta
       para o usuário.

       O endpoint /history devolve o preço no fechamento de 00:00 UTC
       daquele dia. Isso é uma APROXIMAÇÃO do "preço naquele dia" — não
       o preço do instante da operação, que ninguém tem como recuperar.
       Quem exibe precisa dizer isso; devolvemos `aproximado: true` para
       a tela não ter desculpa de omitir.

       Data no formato DD-MM-AAAA, que é o que esta API exige. O cache
       é longo de propósito: preço de um dia que já passou não muda
       mais. É o único preço do sistema que pode ser guardado sem medo.
       ============================================================ */
    priceOn: function (id, iso) {
      if (!id || !iso) return Promise.resolve(null);
      var p = String(iso).slice(0, 10).split("-");
      if (p.length !== 3) return Promise.resolve(null);
      var ddmmyyyy = p[2] + "-" + p[1] + "-" + p[0];

      return AtlasHttp.getJSON(
        BASE + "/coins/" + encodeURIComponent(id) +
        "/history?date=" + ddmmyyyy + "&localization=false",
        { ttl: 1000 * 60 * 60 * 24 * 30, headers: headers(),
          cacheKey: "cg.hist." + id + "." + ddmmyyyy }
      ).then(function (d) {
        var v = d && d.market_data && d.market_data.current_price &&
                d.market_data.current_price.usd;
        if (typeof v !== "number" || !isFinite(v) || v <= 0) return null;
        return { usd: v, em: String(iso).slice(0, 10), aproximado: true,
                 nota: "fechamento de 00:00 UTC do dia" };
      }).catch(function () { return null; });
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

    /* ------------------------------------------------------------
       Lote: vários ids em uma única chamada (economiza rate limit)

       DUAS VERSÕES, e a diferença é o ponto

         pricesRaw   PROPAGA o erro. Quem chama decide o que dizer ao
                     usuário — e o AtlasHttp já entrega a mensagem
                     pronta ("Limite de requisições atingido", "Tempo
                     de resposta esgotado", "Serviço indisponível").
         prices      engole e devolve {}. Continua existindo para quem
                     só quer enfeitar a tela e não se importa.

       Só havia a segunda. Num 429 do CoinGecko — que na versão sem
       chave acontece com facilidade — o DeFi recebia um mapa vazio,
       concluía "sem preço para estes tokens" e mantinha na tela o
       último valor gravado, sem nenhum aviso. Falha de rede virava
       número velho com aparência de número atual, que é exatamente o
       tipo de mentira que este sistema não pode contar.
       ------------------------------------------------------------ */
    pricesRaw: function (ids) {
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
      });
    },

    prices: function (ids) {
      return CoinGecko.pricesRaw(ids).catch(function () { return {}; });
    },

    setApiKey: function (k) { try { localStorage.setItem(KEY_LS, k || ""); } catch (e) {} },

    /* ============================================================
       ACADEMY — dados de mercado (central de pesquisa)

       Métodos abaixo alimentam o command center. Formas canônicas
       combinadas com os provedores de fallback (Binance, CoinPaprika,
       CoinLore): o mesmo shape sai de todos, então a tela não sabe
       qual fonte respondeu. Ver docs/superpowers/specs.
       ============================================================ */

    /* Panorama do mercado: market cap, volume e dominância do BTC. */
    global: function () {
      return AtlasHttp.getJSON(BASE + "/global",
        { ttl: 120000, headers: headers(), cacheKey: "cg.global" }
      ).then(function (d) {
        var g = d && d.data; if (!g) return null;
        return {
          marketCap: g.total_market_cap && g.total_market_cap.usd || null,
          volume24h: g.total_volume && g.total_volume.usd || null,
          btcDominance: g.market_cap_percentage && g.market_cap_percentage.btc || null
        };
      });
    },

    /* Rankings: altas, quedas, volume, e categorias (ex.: RWA).
       order ex.: "price_change_percentage_24h_desc" | "volume_desc"
       category ex.: "real-world-assets-rwa" (opcional). */
    topMovers: function (o) {
      o = o || {};
      var order = o.order || "market_cap_desc";
      var url = BASE + "/coins/markets?vs_currency=usd&order=" + order +
        "&per_page=" + (o.perPage || 20) + "&page=1&price_change_percentage=24h&sparkline=false" +
        (o.category ? "&category=" + encodeURIComponent(o.category) : "");
      return AtlasHttp.getJSON(url, {
        ttl: 90000, headers: headers(),
        cacheKey: "cg.mkts." + order + "." + (o.category || "") + "." + (o.perPage || 20)
      }).then(function (arr) {
        return (arr || []).map(function (c) {
          return {
            id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
            usd: c.current_price, change24h: c.price_change_percentage_24h,
            volume24h: c.total_volume, marketCap: c.market_cap,
            rank: c.market_cap_rank, image: c.image, category: o.category || null
          };
        });
      });
    },

    /* Setores/categorias do mercado, para o painel "categorias". */
    categories: function () {
      return AtlasHttp.getJSON(BASE + "/coins/categories",
        { ttl: 300000, headers: headers(), cacheKey: "cg.cats" }
      ).then(function (arr) {
        return (arr || []).map(function (c) {
          return { id: c.id, name: c.name, change24h: c.market_cap_change_24h,
                   marketCap: c.market_cap, volume24h: c.volume_24h };
        });
      });
    },

    /* Detalhe profundo do ativo — quase tudo da página do ativo numa
       chamada só: preço, variações por janela, ATH/ATL, supply,
       contratos por rede, categorias, descrição, links e exchanges.
       Campo ausente = null (a tela mostra "indisponível"). */
    assetFull: function (id) {
      if (!id) return Promise.resolve(null);
      return AtlasHttp.getJSON(BASE + "/coins/" + encodeURIComponent(id) +
        "?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false",
        { ttl: 180000, headers: headers(), cacheKey: "cg.coin." + id }
      ).then(function (c) {
        if (!c) return null;
        var m = c.market_data || {};
        var plats = [];
        var det = c.detail_platforms || {};
        Object.keys(det).forEach(function (chain) {
          var p = det[chain];
          if (p && p.contract_address) {
            plats.push({ chain: chain || "", contract: p.contract_address, explorerUrl: null });
          }
        });
        var isRwa = (c.categories || []).some(function (x) {
          return /real.?world|rwa|tokenized/i.test(x || "");
        });
        var l = c.links || {};
        return {
          id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
          image: c.image && c.image.large || null,
          classification: isRwa ? "rwa" : "crypto",
          usd: m.current_price && m.current_price.usd || null,
          change: {
            h24: m.price_change_percentage_24h != null ? m.price_change_percentage_24h : null,
            d7:  m.price_change_percentage_7d  != null ? m.price_change_percentage_7d  : null,
            d30: m.price_change_percentage_30d != null ? m.price_change_percentage_30d : null,
            m3:  m.price_change_percentage_60d != null ? m.price_change_percentage_60d : null,
            m6:  m.price_change_percentage_200d != null ? m.price_change_percentage_200d : null,
            y1:  m.price_change_percentage_1y  != null ? m.price_change_percentage_1y  : null
          },
          ath: m.ath && m.ath.usd || null, athDate: m.ath_date && m.ath_date.usd || null,
          atl: m.atl && m.atl.usd || null, atlDate: m.atl_date && m.atl_date.usd || null,
          marketCap: m.market_cap && m.market_cap.usd || null,
          fdv: m.fully_diluted_valuation && m.fully_diluted_valuation.usd || null,
          volume24h: m.total_volume && m.total_volume.usd || null,
          rank: c.market_cap_rank || null,
          supply: {
            circulating: m.circulating_supply != null ? m.circulating_supply : null,
            total: m.total_supply != null ? m.total_supply : null,
            max: m.max_supply != null ? m.max_supply : null
          },
          platforms: plats,
          categories: (c.categories || []).filter(Boolean),
          description: (c.description && c.description.en) || null,
          links: {
            homepage: (l.homepage || [])[0] || null,
            whitepaper: l.whitepaper || null,
            twitter: l.twitter_screen_name ? "https://twitter.com/" + l.twitter_screen_name : null,
            telegram: l.telegram_channel_identifier ? "https://t.me/" + l.telegram_channel_identifier : null,
            github: (l.repos_url && l.repos_url.github || [])[0] || null,
            reddit: l.subreddit_url || null
          },
          exchanges: (c.tickers || []).slice(0, 15).map(function (t) {
            return { name: t.market && t.market.name || "", pair: (t.base || "") + "/" + (t.target || ""),
                     url: t.trade_url || null };
          })
        };
      });
    },

    /* Série de preço para o gráfico. days: 1|7|30|90|180|365. */
    chart: function (id, days) {
      if (!id) return Promise.resolve(null);
      days = days || 7;
      return AtlasHttp.getJSON(BASE + "/coins/" + encodeURIComponent(id) +
        "/market_chart?vs_currency=usd&days=" + days,
        { ttl: days <= 1 ? 60000 : 300000, headers: headers(),
          cacheKey: "cg.chart." + id + "." + days }
      ).then(function (d) {
        var pts = d && d.prices;
        if (!pts || !pts.length) return null;
        return { days: days, points: pts };
      });
    }
  };

  window.AtlasProviders.register("coingecko", CoinGecko);
})();
