/* ============================================================
   ATLAS · core/providers/feargreed.js
   Índice de Medo e Ganância do mercado cripto (alternative.me).
   Depende de: core/http.js, core/providers/registry.js

   Capacidade: "feargreed"

   Fonte única e gratuita, sem chave. Não há fallback: se cair, a
   faixa do dashboard mostra "indisponível" — nunca um número velho.
   O valor vai de 0 (medo extremo) a 100 (ganância extrema).

   API do provedor:
     .feargreed() -> Promise<{ value, label, ts }|null>
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("feargreed")) return;

  var LABELS = {
    "Extreme Fear": "Medo extremo",
    "Fear": "Medo",
    "Neutral": "Neutro",
    "Greed": "Ganância",
    "Extreme Greed": "Ganância extrema"
  };

  window.AtlasProviders.register("feargreed", {
    capabilities: ["feargreed"],

    feargreed: function () {
      return AtlasHttp.getJSON("https://api.alternative.me/fng/?limit=1", {
        ttl: 1000 * 60 * 30, cacheKey: "fng.latest"
      }).then(function (d) {
        var it = d && d.data && d.data[0];
        if (!it) return null;
        var v = parseInt(it.value, 10);
        if (!isFinite(v)) return null;
        return {
          value: v,
          label: LABELS[it.value_classification] || it.value_classification || "",
          ts: parseInt(it.timestamp, 10) * 1000
        };
      });
    }
  });
})();
