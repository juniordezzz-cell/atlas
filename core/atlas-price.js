/* ============================================================
   ATLAS · core/atlas-price.js
   ------------------------------------------------------------
   PREÇO POR SÍMBOLO — arquivo único.

   Traduz "SOL" em 130.42. Parece simples, mas envolve duas
   chamadas ao CoinGecko (achar o id da moeda, depois buscar o
   preço), e isso não pode ficar espalhado pelo código.

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
    if (!prov || !prov.search || !prov.price) {
      cache[sym] = null;
      return Promise.resolve(null);
    }

    inflight[sym] = Promise.resolve()
      .then(function () { return prov.search(sym); })
      .then(function (itens) {
        var c = melhorCandidato(itens, sym);
        if (!c || !c.id) return null;
        return prov.price(c.id).then(function (usd) {
          if (usd == null) return null;
          return { usd: Number(usd), id: c.id, name: c.name || sym };
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
    /* limpa o cache — útil quando a pessoa quer reconsultar */
    forget: function (sym) {
      if (sym) delete cache[normalizar(sym)];
      else cache = {};
    },
    isStable: function (sym) { return STABLES[normalizar(sym)] != null; }
  };
})();
