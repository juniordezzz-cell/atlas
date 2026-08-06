/* ============================================================
   ATLAS · core/providers/registry.js
   Registro central de provedores de dados.

   Regra de arquitetura do ATLAS:
   nenhum módulo implementa regra específica de uma corretora,
   DEX ou protocolo. Tudo entra como PROVEDOR registrado aqui.
   Adicionar uma nova fonte = registrar um novo provedor,
   sem reescrever componentes.

   Capacidades (capability) conhecidas:
     "prices"  → preço/market data de ativos   (ex.: coingecko)
     "search"  → busca de ativos               (ex.: coingecko)
     "pools"   → pools de liquidez por chain+DEX (Fase 2: defillama)
     "lending" → mercados de empréstimo         (Fase 2: defillama)

   API:
     AtlasProviders.register(name, impl)       impl.capabilities = ["prices",...]
     AtlasProviders.get(name)               -> impl | null
     AtlasProviders.forCapability(cap)      -> primeiro provedor que atende
     AtlasProviders.list()                  -> nomes registrados
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasProviders) return;

  var registry = {};
  var order = []; // ordem de registro = ordem de preferência

  window.AtlasProviders = {
    register: function (name, impl) {
      if (!name || !impl) return;
      if (!registry[name]) order.push(name);
      registry[name] = impl;
    },
    get: function (name) { return registry[name] || null; },
    forCapability: function (cap) {
      for (var i = 0; i < order.length; i++) {
        var p = registry[order[i]];
        if (p && p.capabilities && p.capabilities.indexOf(cap) !== -1) return p;
      }
      return null;
    },
    list: function () { return order.slice(); }
  };
})();
