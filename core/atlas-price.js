/* ============================================================
   ATLAS · core/atlas-price.js
   ------------------------------------------------------------
   PREÇO POR SÍMBOLO — arquivo único.

   Traduz "SOL" em 130.42. Parece simples, mas envolve achar o id
   da moeda (busca da CoinGecko, a única que tem) e depois o preço
   (DefiLlama, com a CoinGecko de reserva — desde 16/10/2026), e
   isso não pode ficar espalhado pelo código.

   Regras que este arquivo garante
   -------------------------------
   · Cache em memória por sessão: digitar SOL duas vezes não
     gera duas idas à rede.
   · Símbolos ambíguos: "SOL" devolve dezenas de resultados no
     CoinGecko. Damos preferência ao de maior capitalização,
     que é o que a pessoa quis dizer em 99% dos casos.
   · Falha de rede NUNCA trava a tela: devolve null e quem
     chamou segue com preenchimento manual.
   · Stablecoins conhecidas não vão à rede — valem 1 dólar.

   Uso
   ---
     AtlasPrice.bySymbol("SOL").then(function (p) {
       // p = { usd: 130.42, id: "solana", name: "Solana" } ou null
     });
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasPrice) return;

  var cache = {};          // símbolo -> {usd, id, name} | null
  var inflight = {};       // símbolo -> Promise (evita corrida)

  /* Stablecoins: preço é 1 por definição. Poupa duas chamadas
     e evita o caso em que a API devolve 0.9998 e a conta fecha
     com centavo de diferença. */
  var STABLES = {
    USDC: 1, USDT: 1, DAI: 1, USDE: 1, FDUSD: 1,
    PYUSD: 1, TUSD: 1, USDD: 1, BUSD: 1, USDS: 1
  };

  function provider() {
    if (!window.AtlasProviders || !AtlasProviders.get) return null;
    return AtlasProviders.get("coingecko") || null;
  }

  function normalizar(sym) {
    return String(sym || "").trim().toUpperCase();
  }

  /* Escolhe o candidato certo entre os resultados da busca.
     O CoinGecko devolve muita moeda de nome parecido; o critério
     é: símbolo IDÊNTICO, e entre esses, o mais bem ranqueado (que é
     o de maior capitalização).

     O FALLBACK QUE ACEITAVA QUALQUER UM
     -----------------------------------
     A linha era `var lista = exatos.length ? exatos : itens;` — sem
     nenhum símbolo idêntico, valia o primeiro resultado da busca,
     fosse ele qual fosse. Buscar um token tokenizado de ação (CRCLX,
     SKHYX, SPCXB) devolvia alguma moeda de nome parecido, e o ATLAS
     adotava o preço dela: US$ 0,004 no lugar de US$ 61.

     O estrago não parava no preço. A razão do par saía errada, a
     posição caía "fora da faixa", o Dashboard emitia alerta crítico,
     e nada na tela indicava que o número era de outro ativo — a
     definição de erro plausível.

     Sem símbolo idêntico, a resposta certa é NÃO SEI. A partir daí a
     regra do sistema assume: o usuário informa o preço na mão
     (ver core/atlas-precos.js). */
  function melhorCandidato(itens, sym) {
    if (!itens || !itens.length) return null;
    var lista = itens.filter(function (c) {
      return normalizar(c.symbol) === sym;
    });
    if (!lista.length) return null;
    lista = lista.slice().sort(function (a, b) {
      var ra = a.rank == null ? 1e9 : a.rank;
      var rb = b.rank == null ? 1e9 : b.rank;
      return ra - rb;
    });
    return lista[0];
  }

  /* Só o id: a busca é a parte que só a CoinGecko tem (cache de 24 h
     no provedor). O PREÇO não sai mais daqui um por um — a cadeia
     (core/atlas-precos.js) junta esses ids no lote da DefiLlama.
     Devolve { id, name } | null. */
  var idCache = {}, idInflight = {};
  function candidato(sym) {
    sym = normalizar(sym);
    if (!sym) return Promise.resolve(null);
    if (Object.prototype.hasOwnProperty.call(idCache, sym)) return Promise.resolve(idCache[sym]);
    if (idInflight[sym]) return idInflight[sym];
    var prov = provider();
    if (!prov || !prov.search) return Promise.resolve(null);
    idInflight[sym] = Promise.resolve()
      .then(function () { return prov.search(sym); })
      .then(function (itens) {
        var c = melhorCandidato(itens, sym);
        return c && c.id ? { id: c.id, name: c.name || sym } : null;
      })
      .then(function (r) { idCache[sym] = r; delete idInflight[sym]; return r; },
            function (e) { delete idInflight[sym]; throw e; });
    return idInflight[sym];
  }

  /* Preço atual de um id: DefiLlama primeiro, CoinGecko de reserva
     (só quando a DefiLlama não trouxe ou caiu). */
  function precoDoId(id) {
    var llama = window.AtlasProviders && AtlasProviders.get && AtlasProviders.get("defillama");
    var prov = provider();
    var p = llama && llama.precosAtuais
      ? llama.precosAtuais([id]).catch(function () { return {}; })
      : Promise.resolve({});
    return p.then(function (m) {
      if (typeof m[id] === "number") return m[id];
      return prov && prov.price ? prov.price(id) : null;
    });
  }

  function bySymbol(sym) {
    sym = normalizar(sym);
    if (!sym) return Promise.resolve(null);

    if (STABLES[sym] != null) {
      return Promise.resolve({ usd: STABLES[sym], id: sym.toLowerCase(), name: sym });
    }
    if (Object.prototype.hasOwnProperty.call(cache, sym)) {
      return Promise.resolve(cache[sym]);
    }
    if (inflight[sym]) return inflight[sym];

    var prov = provider();
    if (!prov || !prov.search) {
      cache[sym] = null;
      return Promise.resolve(null);
    }

    inflight[sym] = candidato(sym)
      .then(function (c) {
        if (!c) return null;
        return precoDoId(c.id).then(function (usd) {
          if (usd == null) return null;
          return { usd: Number(usd), id: c.id, name: c.name };
        });
      })
      .catch(function () { return null; })
      .then(function (r) {
        cache[sym] = r;
        delete inflight[sym];
        return r;
      });

    return inflight[sym];
  }

  window.AtlasPrice = {
    bySymbol: bySymbol,
    /* { id, name } | null — só a busca, sem preço */
    candidato: candidato,
    /* limpa o cache — útil quando a pessoa quer reconsultar */
    forget: function (sym) {
      if (sym) { delete cache[normalizar(sym)]; delete idCache[normalizar(sym)]; }
      else { cache = {}; idCache = {}; }
    },
    isStable: function (sym) { return STABLES[normalizar(sym)] != null; }
  };
})();
