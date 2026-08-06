/* ============================================================
   ATLAS · DeFi — performance.js
   ------------------------------------------------------------
   MOTOR DE PERFORMANCE DE POOL. Função pura: entra posição e
   preços, sai métricas. Nenhum DOM, nenhuma rede.

   O QUE ESTE ARQUIVO NÃO CONSEGUE FAZER (e por quê)
   -------------------------------------------------
   Numa pool de liquidez concentrada as quantidades MUDAM sozinhas.
   Se o preço do ORCA sobe, a Orca vende o seu ORCA e compra SOL —
   você entrou com 2 SOL e 100 ORCA e agora tem outra coisa. É por
   isso que o "Balance" no print da Orca é lido da blockchain, e não
   calculado a partir da entrada.

   Como o ATLAS registra a posição na mão, existem dois modos:

     · SEM quantidade atual informada
       Calculamos qtdEntrada x precoAtual. Isso é um BENCHMARK HODL:
       "quanto eu teria se não tivesse feito pool nenhuma". É número
       honesto e útil, mas vai divergir da Orca com o tempo. A
       diferença é justamente o impermanent loss.

     · COM quantidade atual informada
       Calculamos o valor real da posição e, de brinde, o impermanent
       loss (real menos benchmark). Aí o número bate com a Orca.

   Chamar o benchmark de "valor da posição" seria mentira confortável.
   O objeto devolvido diz qual modo foi usado, e a tela mostra.

   ESPELHANDO A CONTA DA ORCA
   --------------------------
   No print: Total PnL 5,91 = Unrealized 0,62 + Realized 5,29.
   Ou seja, o PnL total soma a variação de mercado com a taxa JÁ
   coletada, e a taxa pendente (0,33) fica de fora, mostrada à parte.
   É a mesma conta aqui — de propósito, para os números conferirem
   lado a lado com a corretora.
   ============================================================ */
(function () {
  "use strict";

  function n(v) {
    var x = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(x) ? x : 0;
  }

  /* ------------------------------------------------------------
     calcular(pos, precos)

     pos = {
       base, quote,                 símbolos
       qtyBase, qtyQuote,           quantidade na ENTRADA
       priceBase, priceQuote,       preço na ENTRADA (USD)
       qtyBaseNow, qtyQuoteNow,     quantidade AGORA (opcional)
       feesColetadas, feesPendentes,
       rangeLow, rangeHigh,         faixa, na denominação abaixo
       rangeDenom                   "base_por_quote" | "quote_por_base"
     }
     precos = { SOL: 80.1, ORCA: 1.24 }   (USD, por símbolo)

     Devolve o objeto de métricas, ou null se não houver dado
     suficiente. Campo faltando NUNCA vira zero silencioso: quem
     não tem preço atual vem com precoOk=false e a tela avisa.
     ------------------------------------------------------------ */
  function calcular(pos, precos) {
    if (!pos) return null;
    precos = precos || {};

    var sB = String(pos.base || "").toUpperCase();
    var sQ = String(pos.quote || "").toUpperCase();

    var qB = n(pos.qtyBase), qQ = n(pos.qtyQuote);
    var eB = n(pos.priceBase), eQ = n(pos.priceQuote);

    var aB = precos[sB], aQ = precos[sQ];
    var temB = typeof aB === "number" && isFinite(aB) && aB > 0;
    var temQ = typeof aQ === "number" && isFinite(aQ) && aQ > 0;

    /* Custo de entrada. Se a pessoa só registrou um lado (acontece
       em pool single-sided), o outro lado entra como zero e a conta
       segue válida. */
    var custo = qB * eB + qQ * eQ;

    /* Benchmark HODL: mesma quantidade, preço de hoje. */
    var hodl = (temB ? qB * aB : qB * eB) + (temQ ? qQ * aQ : qQ * eQ);

    /* Valor real, só se a pessoa informou a composição atual. */
    var nB = n(pos.qtyBaseNow), nQ = n(pos.qtyQuoteNow);
    var temReal = (nB > 0 || nQ > 0);
    var real = temReal
      ? (temB ? nB * aB : nB * eB) + (temQ ? nQ * aQ : nQ * eQ)
      : null;

    var valorAtual = temReal ? real : hodl;
    var pnlMercado = valorAtual - custo;
    var il = temReal ? (real - hodl) : null;

    var coletadas = n(pos.feesColetadas);
    var pendentes = n(pos.feesPendentes);

    /* Mesma composição da Orca: mercado + taxa realizada.
       Pendente fica fora, mostrado separado. */
    var pnlTotal = pnlMercado + coletadas;

    /* ---- Faixa de preço ----
       A pool cota uma razão, não um preço em dólar. No print da Orca
       é "SOL per ORCA" = preço do ORCA dividido pelo preço do SOL.
       Guardamos qual token é o numerador para não inverter a faixa. */
    var razao = null, dentro = null;
    var denom = pos.rangeDenom || "base_por_quote";
    if (temB && temQ) {
      razao = denom === "quote_por_base" ? (aQ / aB) : (aB / aQ);
    }
    var low = n(pos.rangeLow), high = n(pos.rangeHigh);
    var temFaixa = low > 0 && high > 0 && high > low;
    if (temFaixa && razao != null) dentro = (razao >= low && razao <= high);

    /* posição relativa dentro da faixa, 0..1 — alimenta a barra */
    var posFaixa = null;
    if (temFaixa && razao != null) {
      posFaixa = (razao - low) / (high - low);
      if (posFaixa < 0) posFaixa = 0;
      if (posFaixa > 1) posFaixa = 1;
    }

    return {
      precoOk: temB && temQ,
      faltando: [].concat(temB ? [] : [sB]).concat(temQ ? [] : [sQ]),

      precoEntradaBase: eB, precoEntradaQuote: eQ,
      precoAtualBase: temB ? aB : null, precoAtualQuote: temQ ? aQ : null,

      custo: custo,
      hodl: hodl,
      real: real,
      modo: temReal ? "real" : "hodl",
      valorAtual: valorAtual,

      pnlMercado: pnlMercado,
      pnlMercadoPct: custo > 0 ? (pnlMercado / custo) * 100 : 0,
      il: il,
      ilPct: (il != null && hodl > 0) ? (il / hodl) * 100 : null,

      feesColetadas: coletadas,
      feesPendentes: pendentes,
      feesTotal: coletadas + pendentes,

      pnlTotal: pnlTotal,
      pnlTotalPct: custo > 0 ? (pnlTotal / custo) * 100 : 0,

      razao: razao,
      rangeLow: low, rangeHigh: high,
      temFaixa: temFaixa,
      dentroDaFaixa: dentro,
      posFaixa: posFaixa,

      /* variação de cada lado, isolada — responde "a pool subiu por
         causa de qual dos dois?" */
      varBase: (temB && eB > 0) ? ((aB - eB) / eB) * 100 : null,
      varQuote: (temQ && eQ > 0) ? ((aQ - eQ) / eQ) * 100 : null
    };
  }

  /* Símbolos que uma lista de posições precisa cotar — para pedir
     todos os preços numa chamada só. */
  function simbolos(posicoes) {
    var visto = {}, out = [];
    (posicoes || []).forEach(function (p) {
      [p.base, p.quote].forEach(function (s) {
        var k = String(s || "").toUpperCase();
        if (k && !visto[k]) { visto[k] = 1; out.push(k); }
      });
    });
    return out;
  }

  window.DeFiPerf = { calcular: calcular, simbolos: simbolos };
})();
