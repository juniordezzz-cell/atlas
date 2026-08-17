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

    setApiKey: function (k) { try { localStorage.setItem(KEY_LS, k || ""); } catch (e) {} }
  };

  window.AtlasProviders.register("coingecko", CoinGecko);
})();
