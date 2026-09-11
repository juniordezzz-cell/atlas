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

   A capacidade "pools" existiu e foi RETIRADA na terceira auditoria,
   junto com o provedor defillama que a implementava. O catálogo dele
   era filtrado por TVL mínimo e não continha a maior parte das pools
   reais do usuário; o campo de busca que ele alimentava respondia
   "nenhuma pool encontrada" para pools que existem, e reordenava o par
   quando encontrava. O par passou a ser 100% manual, na ordem digitada
   (ver defi/pools.html, passo 3).

   Registrar uma nova capacidade continua sendo só chamar register() —
   a arquitetura não mudou, só saiu um provedor que não entregava.

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
    list: function () { return order.slice(); },

    /* ------------------------------------------------------------
       CADEIA DE FALLBACK

       forCapability devolve UM provedor. Isso basta quando a fonte
       nunca falha — mas o CoinGecko keyless falha com facilidade
       (429). chainFor devolve TODOS os provedores da capacidade, na
       ordem de registro (= ordem de preferência), e tryChain tenta um
       por um: pula quem rejeita OU quem devolve vazio, e só desiste
       quando ninguém respondeu. A tela nunca sabe qual fonte atendeu.
       ------------------------------------------------------------ */
    chainFor: function (cap) {
      var out = [];
      for (var i = 0; i < order.length; i++) {
        var p = registry[order[i]];
        if (p && p.capabilities && p.capabilities.indexOf(cap) !== -1) out.push(p);
      }
      return out;
    },

    tryChain: function (cap, method, args) {
      var chain = this.chainFor(cap);
      function empty(v) {
        return v == null ||
          (Array.isArray(v) && v.length === 0) ||
          (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
      }
      var i = 0, lastErr = null;
      function next() {
        if (i >= chain.length) {
          return Promise.reject(lastErr || new Error("Sem fonte de dados disponível."));
        }
        var impl = chain[i++];
        var fn = impl && impl[method];
        if (typeof fn !== "function") return next();
        return Promise.resolve().then(function () { return fn.apply(impl, args || []); })
          .then(function (res) {
            if (empty(res)) return next();
            try { console.log("[academy] " + cap + " respondido por provedor #" + i); } catch (e) {}
            return res;
          })
          .catch(function (err) { lastErr = err; return next(); });
      }
      return next();
    }
  };
})();
