/* ============================================================
   ATLAS · core/providers/defillama.js
   Preço on-chain por endereço de contrato (keyless).
   Depende de: core/http.js, core/providers/registry.js

   Capacidade: "onchainPrice"

   Quando um ativo tem contrato mas nenhum provedor de mercado sabe
   seu preço, a DefiLlama resolve pelo par "<chain>:<contrato>". Útil
   para RWA/tokens de nicho na aba On-chain da página do ativo.

   .onchainPrice(refs) -> Promise<{ "<chain>:<contrato>": usd }>
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("defillama")) return;

  window.AtlasProviders.register("defillama", {
    capabilities: ["onchainPrice"],

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
    }
  });
})();
