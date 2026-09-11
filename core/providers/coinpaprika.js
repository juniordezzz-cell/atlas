/* ============================================================
   ATLAS · core/providers/coinpaprika.js
   Fallback amplo e keyless para quando o CoinGecko cai (429).
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "prices", "search", "rankings", "global",
                "assetDetail", "chart"

   IDs aqui são os do CoinPaprika (ex.: "sol-solana"). A fachada
   (academy/js/market-data.js) resolve o id via AtlasIdMap antes de
   chamar assetFull/chart quando a cadeia cai para este provedor.

   Todas as respostas seguem a MESMA forma canônica do CoinGecko —
   é isso que faz o fallback ser invisível para a tela.
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("coinpaprika")) return;

  var BASE = "https://api.coinpaprika.com/v1";
  var RWA_RE = /real.?world|rwa|tokenized/i;

  function usd(t) { return t && t.quotes && t.quotes.USD ? t.quotes.USD : {}; }

  function toRow(t) {
    var q = usd(t);
    return {
      id: t.id, symbol: (t.symbol || "").toUpperCase(), name: t.name,
      usd: q.price != null ? q.price : null,
      change24h: q.percent_change_24h != null ? q.percent_change_24h : null,
      volume24h: q.volume_24h != null ? q.volume_24h : null,
      marketCap: q.market_cap != null ? q.market_cap : null,
      rank: t.rank || null, image: null, category: null
    };
  }

  var CoinPaprika = {
    capabilities: ["prices", "search", "rankings", "global", "assetDetail", "chart"],

    global: function () {
      return AtlasHttp.getJSON(BASE + "/global",
        { ttl: 120000, cacheKey: "cp.global" }
      ).then(function (d) {
        if (!d) return null;
        return {
          marketCap: d.market_cap_usd != null ? d.market_cap_usd : null,
          volume24h: d.volume_24h_usd != null ? d.volume_24h_usd : null,
          btcDominance: d.bitcoin_dominance_percentage != null ? d.bitcoin_dominance_percentage : null
        };
      });
    },

    /* CoinPaprika devolve os tickers ordenados por rank; ordenamos no
       cliente por variação/volume conforme o pedido. */
    topMovers: function (o) {
      o = o || {};
      var limit = o.perPage || 20;
      return AtlasHttp.getJSON(BASE + "/tickers?limit=250",
        { ttl: 90000, cacheKey: "cp.tickers.250" }
      ).then(function (arr) {
        var rows = (arr || []).map(toRow);
        var order = o.order || "market_cap_desc";
        if (/24h_desc/.test(order)) rows.sort(function (a, b) { return (b.change24h || -1e9) - (a.change24h || -1e9); });
        else if (/24h_asc/.test(order)) rows.sort(function (a, b) { return (a.change24h || 1e9) - (b.change24h || 1e9); });
        else if (/volume/.test(order)) rows.sort(function (a, b) { return (b.volume24h || 0) - (a.volume24h || 0); });
        return rows.slice(0, limit);
      });
    },

    search: function (q) {
      q = String(q || "").trim();
      if (q.length < 2) return Promise.resolve([]);
      return AtlasHttp.getJSON(BASE + "/search?q=" + encodeURIComponent(q) + "&c=currencies&limit=15",
        { ttl: 1000 * 60 * 60 * 24, cacheKey: "cp.search." + q.toLowerCase() }
      ).then(function (d) {
        var cur = d && d.currencies ? d.currencies : [];
        return cur.map(function (c) {
          return { id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
                   rank: c.rank || 9999, thumb: "" };
        });
      });
    },

    /* Detalhe: /coins/<id> (descrição, links, tags) + /tickers/<id>
       (preço, market cap, variações). Duas chamadas combinadas. */
    assetFull: function (id) {
      if (!id) return Promise.resolve(null);
      var meta = AtlasHttp.getJSON(BASE + "/coins/" + encodeURIComponent(id),
        { ttl: 180000, cacheKey: "cp.coin." + id }).catch(function () { return null; });
      var tick = AtlasHttp.getJSON(BASE + "/tickers/" + encodeURIComponent(id),
        { ttl: 120000, cacheKey: "cp.tick." + id }).catch(function () { return null; });
      return Promise.all([meta, tick]).then(function (r) {
        var c = r[0], t = r[1];
        if (!c && !t) return null;
        c = c || {}; t = t || {};
        var q = usd(t);
        var tags = (c.tags || []).map(function (x) { return x && x.name ? x.name : x; }).filter(Boolean);
        var isRwa = tags.some(function (x) { return RWA_RE.test(x); });
        var links = {};
        (c.links_extended || []).forEach(function (l) {
          if (!l || !l.url) return;
          if (l.type === "website" && !links.homepage) links.homepage = l.url;
          if (l.type === "twitter") links.twitter = l.url;
          if (l.type === "telegram") links.telegram = l.url;
          if (l.type === "source_code") links.github = l.url;
          if (l.type === "reddit") links.reddit = l.url;
        });
        if (c.whitepaper && c.whitepaper.link) links.whitepaper = c.whitepaper.link;
        return {
          id: c.id || t.id || id, symbol: ((c.symbol || t.symbol) || "").toUpperCase(),
          name: c.name || t.name || "", image: (c.logo) || null,
          classification: isRwa ? "rwa" : "crypto",
          usd: q.price != null ? q.price : null,
          change: {
            h24: q.percent_change_24h != null ? q.percent_change_24h : null,
            d7:  q.percent_change_7d  != null ? q.percent_change_7d  : null,
            d30: q.percent_change_30d != null ? q.percent_change_30d : null,
            m3:  null, m6: null,
            y1:  q.percent_change_1y  != null ? q.percent_change_1y  : null
          },
          ath: q.ath_price != null ? q.ath_price : null, athDate: q.ath_date || null,
          atl: null, atlDate: null,
          marketCap: q.market_cap != null ? q.market_cap : null,
          fdv: null, volume24h: q.volume_24h != null ? q.volume_24h : null,
          rank: (c.rank || t.rank) || null,
          supply: {
            circulating: t.circulating_supply != null ? t.circulating_supply : null,
            total: t.total_supply != null ? t.total_supply : null,
            max: t.max_supply != null ? t.max_supply : null
          },
          platforms: [], categories: tags,
          description: c.description || null,
          links: {
            homepage: links.homepage || null, whitepaper: links.whitepaper || null,
            twitter: links.twitter || null, telegram: links.telegram || null,
            github: links.github || null, reddit: links.reddit || null
          },
          exchanges: []
        };
      });
    },

    /* Série de preço: /tickers/<id>/historical. O tier free limita a
       janela; se não vier, devolve null e a cadeia cai para a Binance. */
    chart: function (id, days) {
      if (!id) return Promise.resolve(null);
      days = days || 7;
      var start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      var interval = days <= 1 ? "1h" : (days <= 30 ? "6h" : "1d");
      return AtlasHttp.getJSON(BASE + "/tickers/" + encodeURIComponent(id) +
        "/historical?start=" + start + "&interval=" + interval,
        { ttl: days <= 1 ? 60000 : 300000, cacheKey: "cp.hist." + id + "." + days }
      ).then(function (arr) {
        if (!arr || !arr.length) return null;
        var pts = arr.map(function (p) { return [Date.parse(p.timestamp), p.price]; })
                     .filter(function (p) { return isFinite(p[0]) && p[1] != null; });
        return pts.length ? { days: days, points: pts } : null;
      }).catch(function () { return null; });
    }
  };

  window.AtlasProviders.register("coinpaprika", CoinPaprika);
})();
