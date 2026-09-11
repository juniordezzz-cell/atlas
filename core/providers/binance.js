/* ============================================================
   ATLAS · core/providers/binance.js
   Fallback keyless de preço e gráfico para os ativos grandes.
   Depende de: core/http.js, core/providers/registry.js

   Capacidades: "prices", "chart"

   A Binance não tem chave e tem limite altíssimo — é a fonte de
   reserva mais robusta para preço e candles. Em troca, só cobre o
   que é negociado lá (pares contra USDT) e não traz metadado
   (market cap, supply, nome). Para um ativo que a Binance não lista,
   os métodos devolvem null e a cadeia segue para o próximo provedor.

   Entrada por SÍMBOLO (ex.: "BTC", "SOL"); montamos "<SYM>USDT".
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("binance")) return;

  var BASE = "https://api.binance.com/api/v3";

  // days -> intervalo de candle (equilíbrio entre densidade e limite)
  function intervalFor(days) {
    if (days <= 1)   return { i: "15m", limit: 96 };
    if (days <= 7)   return { i: "1h",  limit: 168 };
    if (days <= 30)  return { i: "4h",  limit: 180 };
    if (days <= 90)  return { i: "8h",  limit: 270 };
    if (days <= 180) return { i: "12h", limit: 360 };
    return { i: "1d", limit: 365 };
  }

  var Binance = {
    capabilities: ["prices", "chart"],

    prices: function (symbols) {
      symbols = (symbols || []).filter(Boolean);
      if (!symbols.length) return Promise.resolve([]);
      var pairs = symbols.map(function (s) { return String(s).toUpperCase() + "USDT"; });
      var url = BASE + "/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(pairs));
      return AtlasHttp.getJSON(url, { ttl: 60000, cacheKey: "bn.24hr." + pairs.join(",") })
        .then(function (arr) {
          return (arr || []).map(function (t) {
            var sym = String(t.symbol || "").replace(/USDT$/, "");
            var price = parseFloat(t.lastPrice);
            return {
              id: sym, symbol: sym, name: sym,
              usd: isFinite(price) ? price : null,
              change24h: t.priceChangePercent != null ? parseFloat(t.priceChangePercent) : null,
              image: null
            };
          });
        }).catch(function () { return []; });
    },

    chart: function (symbol, days) {
      if (!symbol) return Promise.resolve(null);
      days = days || 7;
      var pair = String(symbol).toUpperCase() + "USDT";
      var iv = intervalFor(days);
      var url = BASE + "/klines?symbol=" + pair + "&interval=" + iv.i + "&limit=" + iv.limit;
      return AtlasHttp.getJSON(url, {
        ttl: days <= 1 ? 60000 : 300000, cacheKey: "bn.kl." + pair + "." + days
      }).then(function (arr) {
        if (!arr || !arr.length) return null;
        var pts = arr.map(function (k) { return [k[0], parseFloat(k[4])]; })
                     .filter(function (p) { return isFinite(p[1]); });
        return pts.length ? { days: days, points: pts } : null;
      }).catch(function () { return null; }); // par inexistente (400) -> null
    }
  };

  window.AtlasProviders.register("binance", Binance);
})();
