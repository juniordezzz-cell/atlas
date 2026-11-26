/* ATLAS · Ferramentas/_comum/calculos.js
   Contas de dinheiro que as calculadoras da bancada dividem: juros,
   staking, impermanent loss, lucro, imposto, câmbio e alavancagem.
   Sem tela, sem rede, sem estado: só entrada e saída, para ser testado
   no Node contra valores conferidos à mão.

       node --test Ferramentas/_comum/calculos.test.cjs

   Regra da casa: toda função é pura. Data de hoje, cotação ou elemento
   de tela entram por parâmetro; quem busca é a página.
   No navegador: window.AtlasCalculos. No Node: require('./calculos.js'). */
(function (raiz) {
  'use strict';

  var F = {};

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* ══════════════════════════════════════════════════════════════
     TAXAS
     ══════════════════════════════════════════════════════════════ */

  /* Anual efetiva → mensal efetiva. A conversão certa é geométrica:
     (1+i)^(1/12) − 1. Dividir por 12 é o erro clássico e superestima —
     12% ao ano dividido por 12 dá 1% ao mês, que capitalizado devolve
     12,68% ao ano, não 12%. */
  F.anualParaMensal = function (taxaAnualPct) {
    return Math.pow(1 + num(taxaAnualPct) / 100, 1 / 12) - 1;
  };

  F.mensalParaAnual = function (taxaMensalDecimal) {
    return (Math.pow(1 + num(taxaMensalDecimal), 12) - 1) * 100;
  };

  /* APR (juros simples, sem reinvestir) → APY (com reinvestimento).
     `periodos` é quantas vezes por ano o rendimento é capitalizado. */
  F.aprParaApy = function (aprPct, periodos) {
    var n = num(periodos) || 365;
    return (Math.pow(1 + (num(aprPct) / 100) / n, n) - 1) * 100;
  };

  F.apyParaApr = function (apyPct, periodos) {
    var n = num(periodos) || 365;
    return (Math.pow(1 + num(apyPct) / 100, 1 / n) - 1) * n * 100;
  };

  /* ══════════════════════════════════════════════════════════════
     JUROS COMPOSTOS
     ══════════════════════════════════════════════════════════════ */

  /* Projeção mês a mês.

     ── O ERRO QUE ISTO CORRIGE ────────────────────────────────────
     A versão anterior aplicava juros também no mês 0, antes de passar
     tempo nenhum. O capital inicial rendia um mês a mais: R$ 1.000 a
     1% ao mês por 12 meses davam R$ 1.138,09 em vez de R$ 1.126,83 —
     treze capitalizações onde deviam ser doze. Os aportes escapavam do
     erro porque o saldo era zero no mês 0, então o problema aparecia
     só para quem começava com dinheiro na conta, que é a maioria.

     ── CONVENÇÃO ─────────────────────────────────────────────────
     Aporte e retirada acontecem NO FIM do mês, depois dos juros
     daquele mês (anuidade ordinária). É a convenção padrão e a que a
     pessoa espera: o dinheiro que você deposita hoje começa a render
     no mês que vem.

     Devolve a série completa, com o mês 0 valendo exatamente o capital
     inicial. */
  F.jurosCompostos = function (o) {
    o = o || {};
    var inicial = num(o.inicial);
    var aporte = num(o.aporte);
    var taxa = num(o.taxaMensal);              /* decimal: 0.01 = 1% */
    var meses = Math.max(0, Math.floor(num(o.meses)));
    var retirada = num(o.retirada);

    var saldo = inicial, investido = inicial, jurosAcum = 0;
    var serie = [{ mes: 0, juros: 0, investido: investido, jurosAcumulados: 0, saldo: saldo }];
    var mesQueZerou = null;

    for (var m = 1; m <= meses; m++) {
      var j = saldo * taxa;
      jurosAcum += j;
      saldo += j;
      if (aporte) { investido += aporte; saldo += aporte; }
      if (retirada) saldo -= retirada;
      /* Saldo negativo não existe: a carteira acabou. Registramos quando,
         em vez de esconder o fato zerando em silêncio. */
      if (saldo < 0) {
        saldo = 0;
        if (mesQueZerou === null) mesQueZerou = m;
      }
      serie.push({ mes: m, juros: j, investido: investido, jurosAcumulados: jurosAcum, saldo: saldo });
    }

    var ultimo = serie[serie.length - 1];
    return {
      serie: serie,
      saldoFinal: ultimo.saldo,
      investido: ultimo.investido,
      jurosTotais: ultimo.jurosAcumulados,
      retiradoTotal: retirada * meses,
      mesQueZerou: mesQueZerou
    };
  };

  /* Valor futuro pela fórmula fechada. Existe para o teste conferir a
     série contra a álgebra: se as duas discordarem, uma está errada. */
  F.valorFuturo = function (inicial, aporte, taxa, meses) {
    inicial = num(inicial); aporte = num(aporte);
    taxa = num(taxa); meses = Math.max(0, Math.floor(num(meses)));
    if (taxa === 0) return inicial + aporte * meses;
    var fator = Math.pow(1 + taxa, meses);
    return inicial * fator + aporte * ((fator - 1) / taxa);
  };

  /* ══════════════════════════════════════════════════════════════
     STAKING
     ══════════════════════════════════════════════════════════════ */

  /* Rendimento projetado. `modo` é 'apr' (simples) ou 'apy' (composto).

     A distinção importa e as plataformas usam as duas: em APR o
     rendimento não é reinvestido, então cresce em linha reta; em APY já
     está embutido o reinvestimento, e a taxa anunciada É a efetiva ao
     ano — por isso o expoente é o número de ANOS, não de períodos. */
  F.staking = function (o) {
    o = o || {};
    var qtd = num(o.quantidade);
    var taxa = num(o.taxaPct) / 100;
    var meses = num(o.meses);
    var anos = meses / 12;
    var rendimento = o.modo === 'apr'
      ? qtd * taxa * anos
      : qtd * (Math.pow(1 + taxa, anos) - 1);
    return {
      rendimento: rendimento,
      total: qtd + rendimento,
      /* rendimento sobre o principal, no período */
      retornoPct: qtd > 0 ? (rendimento / qtd) * 100 : 0
    };
  };

  /* ══════════════════════════════════════════════════════════════
     POOL DE LIQUIDEZ
     ══════════════════════════════════════════════════════════════ */

  /* Impermanent loss para qualquer proporção de pesos:

         IL = r^w1 / (w1·r + w2) − 1

     `r` é o desempenho RELATIVO do par, não a variação de um token. Num
     par SOL/ETH em que os dois dobram, r = 1 e não há IL nenhum — uma
     conta feita só sobre o SOL diria −5,72%.

     O caso 50/50 cai fora dela naturalmente: r^0.5/(0.5r+0.5), que é a
     forma clássica 2√r/(1+r). */
  F.impermanentLossPct = function (r, w1) {
    r = num(r);
    if (!(r > 0)) return 0;
    w1 = (w1 == null ? 0.5 : num(w1));
    var w2 = 1 - w1;
    var v = (Math.pow(r, w1) / (w1 * r + w2) - 1) * 100;
    /* IL nunca é ganho; r = 1 pode devolver +1e-15 por arredondamento */
    return v > 0 ? 0 : v;
  };

  /* Projeção de uma pool: quanto rende, e — o que importa de verdade —
     se rendeu mais do que ter apenas segurado os dois tokens. */
  F.pool = function (o) {
    o = o || {};
    var deposito = num(o.deposito);
    var precoIni = num(o.precoIni);
    var precoFim = num(o.precoFim);
    var aprPct = num(o.aprPct);
    var dias = num(o.dias);
    var w1 = (o.w1 == null ? 0.5 : num(o.w1));
    var w2 = 1 - w1;

    var r = precoIni > 0 ? precoFim / precoIni : 1;
    var ilPct = F.impermanentLossPct(r, w1);

    /* O benchmark de HOLD respeita os mesmos pesos: numa 80/20 você
       segurava 80% do volátil, não metade. */
    var valorHold = deposito * (w1 * r + w2);
    var valorPool = valorHold * (1 + ilPct / 100);
    var taxas = deposito * (aprPct / 100) * (dias / 365);
    var final = valorPool + taxas;

    return {
      r: r,
      variacaoParPct: (r - 1) * 100,
      ilPct: ilPct,
      valorHold: valorHold,
      valorPool: valorPool,
      taxas: taxas,
      final: final,
      ilPerda: valorHold - valorPool,
      roiPct: deposito > 0 ? (final / deposito - 1) * 100 : 0,
      /* A pergunta útil não é "as taxas cobrem o IL" no vácuo: é se
         fornecer liquidez foi melhor que segurar. Quando o par inteiro
         despenca, o IL pode estar coberto e ainda assim o ROI ser
         negativo — e a culpa não é da pool. */
      vsHold: final - valorHold,
      compensou: (final - valorHold) > 0
    };
  };

  /* ══════════════════════════════════════════════════════════════
     LUCRO EM OPERAÇÃO DE COMPRA E VENDA
     ══════════════════════════════════════════════════════════════ */

  /* ── O QUE ISTO CORRIGE ────────────────────────────────────────
     A versão anterior media o retorno sobre (quantidade × preço de
     compra), ignorando que a taxa de compra também saiu do seu bolso.
     Aqui o custo é o que você desembolsou: compra + taxa da compra. */
  F.lucroOperacao = function (o) {
    o = o || {};
    var qtd = num(o.quantidade);
    var compra = num(o.precoCompra);
    var venda = num(o.precoVenda);
    var taxaPct = num(o.taxaPct) / 100;

    var investido = qtd * compra;
    var recebido = qtd * venda;
    var taxaCompra = investido * taxaPct;
    var taxaVenda = recebido * taxaPct;
    var taxas = taxaCompra + taxaVenda;

    var custoTotal = investido + taxaCompra;
    var liquidoRecebido = recebido - taxaVenda;
    var lucro = liquidoRecebido - custoTotal;

    return {
      investido: investido,
      recebido: recebido,
      taxaCompra: taxaCompra,
      taxaVenda: taxaVenda,
      taxas: taxas,
      custoTotal: custoTotal,
      liquidoRecebido: liquidoRecebido,
      lucro: lucro,
      /* sobre o desembolso real, não sobre o preço de compra puro */
      lucroPct: custoTotal > 0 ? (lucro / custoTotal) * 100 : 0,
      /* preço de venda que zera a operação, taxas incluídas */
      precoEmpate: qtd > 0 && (1 - taxaPct) > 0
        ? custoTotal / (qtd * (1 - taxaPct))
        : 0
    };
  };

  /* ══════════════════════════════════════════════════════════════
     COMPARACAO ENTRE ATIVOS
     ══════════════════════════════════════════════════════════════ */

  /* Qual o primeiro ponto em que TODOS os ativos ja tem dado.

     ── POR QUE ISTO EXISTE ────────────────────────────────────────
     Cada serie era normalizada pelo proprio primeiro ponto. No grafico
     isso esta certo: nao existe retorno de antes do ativo existir. Mas a
     lista de "quem rendeu mais" comparava periodos diferentes -- uma
     moeda de tres meses com "+180%" aparecia acima do CDI de cinco anos
     com "+45%", como se fosse a mesma pergunta. Nao era.

     O ranking passa a medir todos a partir da data em que o ULTIMO ativo
     entrou. O grafico continua mostrando o historico inteiro. */
  F.janelaComum = function (series) {
    if (!series || !series.length) return { indice: 0, recortou: false, quemLimita: -1 };
    var indice = 0, quemLimita = -1;
    for (var i = 0; i < series.length; i++) {
      var lista = series[i] || [];
      var primeiro = -1;
      for (var j = 0; j < lista.length; j++) {
        if (lista[j] != null) { primeiro = j; break; }
      }
      if (primeiro < 0) continue;              /* serie vazia nao limita ninguem */
      if (primeiro > indice || quemLimita < 0) {
        if (primeiro >= indice) { indice = primeiro; quemLimita = i; }
      }
    }
    return { indice: indice, recortou: indice > 0, quemLimita: quemLimita };
  };

  /* Retorno de uma serie a partir de um indice. Se houver buraco exatamente
     nele, usa o proximo ponto com dado em vez de descartar o ativo. */
  F.retornoDesde = function (serie, indice) {
    if (!serie || !serie.length) return null;
    var base = null;
    for (var i = Math.max(0, indice); i < serie.length && base == null; i++) base = serie[i];
    if (base == null || base === 0) return null;
    var ultimo = null;
    for (var k = serie.length - 1; k >= 0 && ultimo == null; k--) ultimo = serie[k];
    if (ultimo == null) return null;
    return { base: base, ultimo: ultimo, multiplo: ultimo / base, pct: (ultimo / base - 1) * 100 };
  };


  /* Variacao percentual medida N periodos atras, dentro de uma serie de
     fechamentos ordenada do mais antigo para o mais recente.

     ── POR QUE A GUARDA IMPORTA ───────────────────────────────────
     Se a serie for mais curta que a janela pedida, isto devolve null.
     Nunca mede a partir do ponto mais antigo disponivel e chama o
     resultado de "1 ano": um token listado ha tres meses renderia um
     numero perfeitamente formatado e completamente falso -- o pior tipo
     de erro, porque nada na tela denuncia. Ausencia tem que parecer
     ausencia. */
  F.variacaoEmJanela = function (serie, periodos) {
    if (!serie || !serie.length) return null;
    if (!(periodos > 0)) return null;
    if (serie.length < periodos + 1) return null;
    var r = F.retornoDesde(serie, serie.length - 1 - periodos);
    return r ? r.pct : null;
  };

  /* ══════════════════════════════════════════════════════════════
     CAMBIO VIA STABLECOIN
     ══════════════════════════════════════════════════════════════ */

  /* Quanto vale UMA unidade de uma moeda, em dolar, a partir do preco de
     uma stablecoin cotada nas duas.

     ── A INVERSAO ─────────────────────────────────────────────────
     Se 1 USDT custa 1,00 USD e 5,17 BRL, entao 1 BRL vale 1,00/5,17 =
     0,193 USD. E' divisao, e a ordem importa: trocada, ela devolve 5,17
     -- "1 real vale 5,17 dolares" --, um numero com formato perfeito e
     sentido invertido. Nada na tela denunciaria. Por isso a linha mora
     aqui, com teste, e nao solta dentro da pagina.

     Devolve null quando o preco na fiat nao serve como divisor, em vez de
     Infinity vazando para a interface. */
  F.valorEmDolar = function (precoEmUsd, precoNaMoeda) {
    if (precoEmUsd == null || precoNaMoeda == null) return null;
    if (!isFinite(precoEmUsd) || !isFinite(precoNaMoeda)) return null;
    if (precoNaMoeda === 0) return null;
    return precoEmUsd / precoNaMoeda;
  };

  /* Converte entre duas moedas passando pelo dolar como ponte. Recebe
     quanto vale uma unidade de cada uma em dolar. */
  F.converterMoeda = function (valor, valorDolarDe, valorDolarPara) {
    if (valor == null || !isFinite(valor)) return null;
    if (valorDolarDe == null || valorDolarPara == null) return null;
    if (!isFinite(valorDolarDe) || !isFinite(valorDolarPara)) return null;
    if (valorDolarPara === 0) return null;
    return valor * valorDolarDe / valorDolarPara;
  };

  /* ══════════════════════════════════════════════════════════════
     TRADE ALAVANCADO
     ══════════════════════════════════════════════════════════════ */

  /* Margem de manutenção padrão: 0,5%, típica de pares majoritários em
     alavancagem baixa. Sobe com o tamanho da posição e com a
     alavancagem, então o resultado é otimista, não exato. */
  F.MMR_PADRAO = 0.005;

  /* Preço de liquidação, margem isolada.

     ── A DEDUÇÃO ─────────────────────────────────────────────────
     Com margem M, alavancagem L, preço de entrada P e quantidade
     Q = M·L/P, o patrimônio da posição a um preço p é

         equity = M + Q·(p − P)            (long)

     A corretora liquida quando o patrimônio cai abaixo da margem de
     manutenção exigida, que incide sobre a posição AO PREÇO ATUAL:

         M + Q·(p − P) ≤ mmr·Q·p

     Isolando p, e usando M/Q = P/L:

         long :  p ≤ P·(1 − 1/L) / (1 − mmr)
         short:  p ≥ P·(1 + 1/L) / (1 + mmr)

     ── O QUE MUDOU ───────────────────────────────────────────────
     A versão anterior usava P·(1 − 1/L + mmr), que aplica a margem de
     manutenção sobre a posição ao preço de ENTRADA. A diferença é
     pequena, mas tinha sinal: para long ela liquidava cedo demais (lado
     seguro) e para SHORT tarde demais — dizia que você tinha mais folga
     do que tem, que é o lado perigoso. */
  F.precoLiquidacao = function (o) {
    o = o || {};
    var entrada = num(o.entrada);
    var lev = num(o.alavancagem);
    var mmr = o.mmr == null ? F.MMR_PADRAO : num(o.mmr);
    if (!(entrada > 0) || !(lev > 0)) return null;
    return o.direcao === 'short'
      ? entrada * (1 + 1 / lev) / (1 + mmr)
      : entrada * (1 - 1 / lev) / (1 - mmr);
  };

  /* O mesmo limite expresso em retorno alavancado (%). Sai da mesma
     dedução, então bate com o preço acima por construção — as duas
     versões anteriores eram consistentes entre si, mas ambas com a
     aproximação. */
  F.limiteLiquidacaoPct = function (lev, direcao, mmr) {
    lev = num(lev);
    mmr = mmr == null ? F.MMR_PADRAO : num(mmr);
    if (!(lev > 0)) return 0;
    return direcao === 'short'
      ? ((lev * mmr - 1) / (1 + mmr)) * 100
      : ((lev * mmr - 1) / (1 - mmr)) * 100;
  };

  /* Resultado de uma operação alavancada. Liquidação é perda total da
     margem: nada de "prejuízo de 130%", que não existe em margem
     isolada. */
  F.trade = function (o) {
    o = o || {};
    var entrada = num(o.entrada);
    var saida = num(o.saida);
    var margem = num(o.margem);
    var lev = num(o.alavancagem) || 1;
    var curto = o.direcao === 'short';
    var mmr = o.mmr == null ? F.MMR_PADRAO : num(o.mmr);
    if (!(entrada > 0)) return null;

    var variacaoPct = ((saida - entrada) / entrada) * 100;
    var pnlPct = (curto ? -variacaoPct : variacaoPct) * lev;

    var liq = F.precoLiquidacao({ entrada: entrada, alavancagem: lev, direcao: o.direcao, mmr: mmr });
    var liquidado = liq != null && (curto ? saida >= liq : saida <= liq);

    var resultado = liquidado ? -margem : margem * (pnlPct / 100);
    return {
      variacaoPct: variacaoPct,
      pnlPct: liquidado ? -100 : pnlPct,
      resultado: resultado,
      saldoFinal: margem + resultado,
      precoLiquidacao: liq,
      liquidado: liquidado,
      limitePct: F.limiteLiquidacaoPct(lev, o.direcao, mmr),
      notional: margem * lev,
      quantidade: entrada > 0 ? (margem * lev) / entrada : 0
    };
  };


  /* ══════════════════════════════════════════════════════════════
     LEITURA DE NÚMERO DIGITADO (formato brasileiro)
     ══════════════════════════════════════════════════════════════ */

  /* "1.000" é mil, "0,5" é meio, "10.000,50" é dez mil e cinquenta.
     Com vírgula, os pontos são milhar e a vírgula é decimal. Sem
     vírgula, ponto seguido de exatamente 3 dígitos é milhar ("1.000");
     outro ponto é decimal ("1.5"). Sem número, devolve null. */
  F.lerNumero = function (texto) {
    var t = String(texto == null ? '' : texto).replace(/[^0-9,.\-]/g, '');
    if (!/[0-9]/.test(t)) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?[1-9][0-9]{0,2}(\.[0-9]{3})+$/.test(t)) t = t.replace(/\./g, '');
    var n = parseFloat(t);
    return isFinite(n) ? n : null;
  };

  /* O caminho de volta: número para escrever num campo de texto, no
     formato que o lerNumero entende. Vírgula decimal, sem separador de
     milhar e nunca em notação científica (String(1.2e-9) daria "1.2e-9",
     que voltaria como 1,2). Até 12 casas decimais. */
  F.numeroCampo = function (v) {
    if (v == null || v === '' || !isFinite(Number(v))) return '';
    return Number(v).toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 12 });
  };

  /* ══════════════════════════════════════════════════════════════
     IMPOSTO SOBRE LUCRO EM CRIPTO (estimativa)
     ══════════════════════════════════════════════════════════════ */

  /* Exchange brasileira ou carteira própria ('br'): vendas de até
     R$ 35.000 no mês são isentas; acima disso, o lucro paga 15% até
     R$ 5 mi de ganho, 17,5% até 10 mi, 20% até 30 mi e 22,5% acima.
     Exchange estrangeira ('ext', Lei 14.754/2023): 15% sobre o lucro,
     sem a isenção. Prejuízo não paga nada. `aliquota` é a efetiva. */
  var FAIXAS_IR = [[5e6, 0.15], [10e6, 0.175], [30e6, 0.20], [Infinity, 0.225]];
  F.impostoCripto = function (o) {
    o = o || {};
    var lucro = num(o.lucroBRL), vendas = num(o.vendasMesBRL);
    if (lucro <= 0) return { imposto: 0, isento: false, aliquota: 0 };
    if (o.custodia === 'ext') return { imposto: lucro * 0.15, isento: false, aliquota: 0.15 };
    if (vendas <= 35000) return { imposto: 0, isento: true, aliquota: 0 };
    var imposto = 0, base = 0, resto = lucro;
    for (var k = 0; k < FAIXAS_IR.length && resto > 0; k++) {
      var parte = Math.min(resto, FAIXAS_IR[k][0] - base);
      imposto += parte * FAIXAS_IR[k][1];
      resto -= parte;
      base = FAIXAS_IR[k][0];
    }
    return { imposto: imposto, isento: false, aliquota: imposto / lucro };
  };

  /* Preço de venda em que o lucro é zero, pagando a mesma taxa (%) na
     compra e na venda: compra × (1 + t) / (1 − t). Taxa de 100% ou
     mais não tem empate: null. */
  F.precoEmpate = function (precoCompra, taxaPct) {
    var t = num(taxaPct) / 100;
    if (t >= 1) return null;
    return num(precoCompra) * (1 + t) / (1 - t);
  };

  /* ══════════════════════════════════════════════════════════════
     COTAÇÃO DA COINBASE (exchange-rates, sem chave)
     Quem busca é a página; aqui só se lê a resposta.
     ══════════════════════════════════════════════════════════════ */

  function taxaPositiva(rates, codigo) {
    var n = Number(rates && rates[codigo]);
    return isFinite(n) && n > 0 ? n : null;
  }

  /* Resposta de exchange-rates?currency=BTC: quanto vale 1 BTC em cada
     moeda. Devolve { brl, usd, eur } ou null se faltar qualquer uma
     (moeda que a Coinbase não lista cai na outra fonte). */
  F.precosDeCoinbase = function (resposta) {
    var rates = resposta && resposta.data && resposta.data.rates;
    var brl = taxaPositiva(rates, 'BRL'), usd = taxaPositiva(rates, 'USD'), eur = taxaPositiva(rates, 'EUR');
    if (brl === null || usd === null || eur === null) return null;
    return { brl: brl, usd: usd, eur: eur };
  };

  /* Resposta de exchange-rates?currency=USD: quanto de cada moeda vale 1
     dólar. O que o câmbio precisa é o contrário (quanto vale 1 de cada
     moeda em dólar), por isso 1 / taxa. null se faltar alguma. */
  F.valoresEmDolarDeCoinbase = function (resposta) {
    var rates = resposta && resposta.data && resposta.data.rates;
    var cod = ['BRL', 'EUR', 'GBP', 'USDT', 'USDC'], t = {};
    for (var i = 0; i < cod.length; i++) {
      t[cod[i]] = taxaPositiva(rates, cod[i]);
      if (t[cod[i]] === null) return null;
    }
    return { usd: 1, brl: 1 / t.BRL, eur: 1 / t.EUR, gbp: 1 / t.GBP, usdt: 1 / t.USDT, usdc: 1 / t.USDC };
  };

  /* ══════════════════════════════════════════════════════════════
     COTAÇÃO EM VÁRIAS FONTES (19/11/2026)
     Ordem pedida pelo dono: CoinGecko só como segunda opção.
       dólar em reais ... Coinbase → CoinGecko
       preço do token ... Coinbase (lista conferida) → DefiLlama
                          (ou CoinPaprika, se o token veio da busca dela)
                          → CoinGecko
       busca de token ... CoinPaprika → CoinGecko
       BTC/ETH 24h ...... Binance → CoinGecko
       série histórica .. Binance → DefiLlama → CoinGecko
     A rede fica em _comum/cotacao.js; aqui só a leitura das respostas.
     Toda leitura devolve null quando a resposta não serve, para a página
     passar à próxima fonte em vez de mostrar número errado.
     ══════════════════════════════════════════════════════════════ */

  function positivo(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }

  /* Criptos que entram na Coinbase. Ticker igual não é a mesma moeda:
     só passa quem está nesta lista, pelo id da CoinGecko ou da CoinPaprika.
     Um id de CoinPaprika errado aqui só faz o token pular a Coinbase. */
  F.COINBASE_SIMBOLOS = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP', dogecoin: 'DOGE', aave: 'AAVE',
    cardano: 'ADA', chainlink: 'LINK', litecoin: 'LTC', polkadot: 'DOT', 'avalanche-2': 'AVAX',
    stellar: 'XLM', uniswap: 'UNI', near: 'NEAR', sui: 'SUI', 'shiba-inu': 'SHIB',
    'bitcoin-cash': 'BCH', 'hedera-hashgraph': 'HBAR', tron: 'TRX', tether: 'USDT', 'usd-coin': 'USDC'
  };
  /* id da CoinPaprika → id da CoinGecko, para as mesmas moedas */
  F.PAPRIKA_PARA_COINGECKO = {
    'btc-bitcoin': 'bitcoin', 'eth-ethereum': 'ethereum', 'sol-solana': 'solana', 'xrp-xrp': 'ripple',
    'doge-dogecoin': 'dogecoin', 'aave-new': 'aave', 'ada-cardano': 'cardano', 'link-chainlink': 'chainlink',
    'ltc-litecoin': 'litecoin', 'dot-polkadot': 'polkadot', 'avax-avalanche': 'avalanche-2',
    'xlm-stellar': 'stellar', 'uni-uniswap': 'uniswap', 'near-near-protocol': 'near', 'sui-sui': 'sui',
    'shib-shiba-inu': 'shiba-inu', 'bch-bitcoin-cash': 'bitcoin-cash', 'hbar-hedera-hashgraph': 'hedera-hashgraph',
    'trx-tron': 'tron', 'usdt-tether': 'tether', 'usdc-usd-coin': 'usd-coin'
  };

  /* token = { id, fonte: 'coingecko' | 'coinpaprika' }. Sem fonte, o id é
     da CoinGecko (links antigos e ?token= da Escada). */
  F.idCoingeckoConhecido = function (token) {
    if (!token || !token.id) return null;
    if (token.fonte === 'coinpaprika') return F.PAPRIKA_PARA_COINGECKO[token.id] || null;
    return String(token.id);
  };
  F.simboloCoinbase = function (token) {
    var cg = F.idCoingeckoConhecido(token);
    return (cg && F.COINBASE_SIMBOLOS[cg]) || null;
  };

  /* Executa as fontes em ordem e devolve { valor, fonte } da primeira que
     responder algo útil. Fonte que falha ou devolve null passa a vez.
     Se nenhuma servir, rejeita: a página mostra o aviso dela. */
  F.tentarEmOrdem = function (tentativas) {
    var lista = (tentativas || []).filter(Boolean), i = 0;
    function proxima() {
      if (i >= lista.length) return Promise.reject(new Error('sem resposta em nenhuma fonte'));
      var t = lista[i++];
      var p;
      try { p = Promise.resolve(t.buscar()); } catch (e) { p = Promise.reject(e); }
      return p.then(function (v) {
        return v == null ? proxima() : { valor: v, fonte: t.fonte };
      }, proxima);
    }
    return proxima();
  };

  /* ── dólar em reais ── */
  /* Coinbase exchange-rates?currency=USD: rates.BRL = reais por 1 dólar */
  F.dolarEmReaisDeCoinbase = function (resposta) {
    return taxaPositiva(resposta && resposta.data && resposta.data.rates, 'BRL');
  };
  /* CoinGecko simple/price?ids=tether&vs_currencies=brl,usd: pelo USDT */
  F.dolarEmReaisDeCoingecko = function (resposta) {
    var t = resposta && resposta.tether;
    var brl = positivo(t && t.brl), usd = positivo(t && t.usd);
    return brl && usd ? brl / usd : null;
  };

  /* ── preço de um token em US$ ── */
  /* Coinbase exchange-rates?currency=SOL: rates.USD = dólares por 1 SOL */
  F.precoDeCoinbase = function (resposta) {
    return taxaPositiva(resposta && resposta.data && resposta.data.rates, 'USD');
  };
  /* DefiLlama coins.llama.fi/prices/current/coingecko:<id> */
  F.precoDeDefiLlama = function (resposta, idCoingecko) {
    var c = resposta && resposta.coins && resposta.coins['coingecko:' + idCoingecko];
    return positivo(c && c.price);
  };
  /* CoinPaprika /tickers/<id> */
  F.precoDeCoinpaprika = function (resposta) {
    var q = resposta && resposta.quotes && resposta.quotes.USD;
    return positivo(q && q.price);
  };
  /* CoinGecko simple/price?ids=<id>&vs_currencies=usd */
  F.precoDeCoingecko = function (resposta, idCoingecko) {
    var c = resposta && resposta[idCoingecko];
    return positivo(c && c.usd);
  };

  /* ── busca de token ── devolve [{ id, sym, nome, img, rank, fonte }] ou
     null (lista vazia também passa a vez: a outra fonte pode achar). */
  function seguraHttps(u) { return /^https:\/\//.test(u || '') ? u : ''; }
  F.buscaDeCoinpaprika = function (resposta) {
    var cur = resposta && resposta.currencies;
    if (!Array.isArray(cur) || !cur.length) return null;
    var lista = cur.filter(function (c) { return c && c.id && c.is_active !== false; }).slice(0, 8).map(function (c) {
      return { id: String(c.id), sym: String(c.symbol || '').toUpperCase(), nome: String(c.name || ''),
        img: 'https://static.coinpaprika.com/coin/' + encodeURIComponent(c.id) + '/logo.png',
        rank: c.rank || null, fonte: 'coinpaprika' };
    });
    return lista.length ? lista : null;
  };
  F.buscaDeCoingecko = function (resposta) {
    var coins = resposta && resposta.coins;
    if (!Array.isArray(coins) || !coins.length) return null;
    return coins.filter(function (c) { return c && c.id; }).slice(0, 8).map(function (c) {
      return { id: String(c.id), sym: String(c.symbol || '').toUpperCase(), nome: String(c.name || ''),
        img: seguraHttps(c.large || c.thumb), rank: c.market_cap_rank || null, fonte: 'coingecko' };
    });
  };
  /* Token achado na CoinPaprika e preço só na CoinGecko: procura na busca
     dela o mesmo símbolo E o mesmo nome. Só o símbolo não basta (há dezenas
     de "SOL"); sem par exato, null — melhor sem preço que preço de outro. */
  F.idCoingeckoDaBusca = function (resposta, sym, nome) {
    var coins = (resposta && resposta.coins) || [];
    var s = String(sym || '').toUpperCase(), n = String(nome || '').trim().toLowerCase();
    if (!s || !n) return null;
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c && c.id && String(c.symbol || '').toUpperCase() === s && String(c.name || '').trim().toLowerCase() === n) return String(c.id);
    }
    return null;
  };

  /* ── BTC/ETH com variação de 24h ── devolve { usd, var24h } */
  /* Binance ticker/24hr?symbol=BTCUSDT (números chegam como texto) */
  F.tickerDeBinance = function (resposta) {
    var usd = positivo(resposta && resposta.lastPrice);
    var v = Number(resposta && resposta.priceChangePercent);
    return usd ? { usd: usd, var24h: isFinite(v) ? v : null } : null;
  };
  F.tickerDeCoingecko = function (resposta, idCoingecko) {
    var c = resposta && resposta[idCoingecko];
    var usd = positivo(c && c.usd), v = Number(c && c.usd_24h_change);
    return usd ? { usd: usd, var24h: isFinite(v) ? v : null } : null;
  };

  /* ── série histórica diária ── devolve [{ t (ms), v }] ou null.
     `minimo` evita aceitar meia dúzia de pontos como "1 ano". */
  F.serieDeDefiLlama = function (resposta, idCoingecko, minimo) {
    var c = resposta && resposta.coins && resposta.coins['coingecko:' + idCoingecko];
    var p = c && c.prices;
    if (!Array.isArray(p)) return null;
    var s = p.map(function (x) { return { t: Number(x && x.timestamp) * 1000, v: Number(x && x.price) }; })
      .filter(function (x) { return isFinite(x.t) && x.t > 0 && isFinite(x.v) && x.v > 0; })
      .sort(function (a, b) { return a.t - b.t; });
    return s.length >= (minimo || 2) ? s : null;
  };
  F.serieDeCoingecko = function (resposta, minimo) {
    var p = resposta && resposta.prices;
    if (!Array.isArray(p)) return null;
    var s = p.map(function (x) { return { t: Number(x && x[0]), v: Number(x && x[1]) }; })
      .filter(function (x) { return isFinite(x.t) && isFinite(x.v) && x.v > 0; });
    return s.length >= (minimo || 2) ? s : null;
  };

  /* ══════════════════════════════════════════════════════════════ */
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  raiz.AtlasCalculos = F;
})(typeof globalThis !== 'undefined' ? globalThis : this);
