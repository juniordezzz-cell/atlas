/* ============================================================
   ATLAS · core/atlas-contabilidade.js — o núcleo das contas

   POR QUE ISTO EXISTE
   -------------------
   A terceira auditoria achou dois erros de matemática no ATLAS, e
   NENHUM dos dois era erro de aritmética. As somas estavam certas. O
   que estava errado era o SIGNIFICADO dos números somados:

     1. "Patrimônio Total" somava o valor das posições e ignorava o
        caixa. Depositar US$ 50.000 deixava o patrimônio em ZERO;
        comprar US$ 30.000 o fazia "subir" para 30.000, como se o
        dinheiro nascesse na compra.

     2. "Rentabilidade" dividia o resultado REALIZADO do Trade
        (operações encerradas) pelo capital das operações ABERTAS —
        conjuntos disjuntos. Medido: lucro de 5.000 do Trade dividido
        pelo custo de 30.000 do Hold, exibido como +16,67%.

   Os dois passariam por qualquer revisão de fórmula, porque cada
   pedaço estava certo isoladamente. O que faltava era um lugar onde
   "patrimônio", "capital", "resultado" e "rentabilidade" fossem
   DEFINIDOS uma vez, de modo que um não pudesse ser combinado com
   outro que não lhe corresponde.

   É isso aqui. Não é uma biblioteca de calculadora — somar dois
   números não precisa de ajuda. É um vocabulário de grandezas
   financeiras em que:

     · uma razão só se forma a partir de um par que este arquivo
       produziu junto (numerador e denominador da mesma régua);
     · uma base inválida devolve NULO, não zero — porque "0%" é uma
       afirmação ("ficou de lado") e a ausência de base não é;
     · o dinheiro tem uma disciplina de arredondamento, e a
       quantidade de um ativo NÃO tem (0,00000001 BTC é real).

   AS DEFINIÇÕES, DE UMA VEZ
   -------------------------
     caixa               dinheiro parado numa carteira
     investido           valor de mercado das posições hoje
     custo               o que foi pago por essas posições
     patrimônio          caixa + investido
     resultado aberto    investido − custo        (não realizado)
     resultado realizado apurado em operações já encerradas
     base realizada      o capital que produziu o resultado realizado
     resultado total     aberto + realizado
     rentabilidade       resultado total ÷ (custo + base realizada)

   A última linha é a que impede o erro nº 2: o denominador tem de
   conter a base de TUDO que está no numerador. Quem informa resultado
   realizado é obrigado a informar a base dele.

   REGRA DE OURO Nº 4, EM FORMA DE CONTA
   -------------------------------------
   "Nenhum dinheiro pode desaparecer; o patrimônio total só muda com
   depósito ou saque." Em números:

       caixa + investido  =  depositado − sacado + resultado total

   `conferir.dinheiroFecha()` é essa igualdade escrita como função. É
   ela que os testes cobram, e é ela que teria pegado o erro nº 1 no
   dia em que ele nasceu.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasContabilidade) return;

  /* Tolerância para comparar dinheiro. Ponto flutuante binário não
     representa 0,1 exatamente; somar mil lançamentos acumula sujeira
     na casa dos bilionésimos. Meio centavo é folgado para o erro
     numérico e apertado para qualquer erro de conta de verdade. */
  var EPS = 0.005;

  function n(v) {
    var x = typeof v === "number" ? v : parseFloat(v);
    return isFinite(x) ? x : 0;
  }

  /* ------------------------------------------------------------
     DINHEIRO ARREDONDA; QUANTIDADE NÃO

     `dinheiro()` fecha na casa do centavo. É para usar nas FRONTEIRAS
     — ao guardar, ao exibir, ao comparar — nunca no meio de uma
     cadeia de contas, porque arredondar cedo e somar depois é como o
     total passa a diferir da soma das partes.

     Quantidade de ativo fica fora disto de propósito: 0,00000001 BTC
     é uma posição real, e arredondá-la a duas casas a apagaria.
     ------------------------------------------------------------ */
  function dinheiro(v) {
    var x = n(v);
    /* Math.round(x * 100) sozinho erra em casos como 1,005 (que em
       binário é 1,00499...). O ajuste por EPSILON de precisão relativa
       resolve sem inventar precisão que não existe. */
    return Math.round((x + Number.EPSILON * Math.abs(x)) * 100) / 100;
  }

  function ehBase(v) { return isFinite(v) && v > 0; }

  /* ============================================================
     RAZÃO — nulo não é zero

     `cost > 0 ? pnl / cost : 0` aparecia em vários lugares do ATLAS.
     O ramo do zero é o problema: devolver 0% para "não há base" faz a
     tela dizer "0,00% no período" com a mesma confiança com que diria
     um resultado medido. Quem lê não tem como distinguir "não mudou"
     de "não dá para saber".

     Aqui a ausência de base devolve null, e a tela escreve "—".
     ============================================================ */
  function razao(numerador, base) {
    var b = n(base);
    if (!ehBase(b)) return null;
    return n(numerador) / b;
  }

  function pct(numerador, base) {
    var r = razao(numerador, base);
    return r === null ? null : r * 100;
  }

  /* Média ponderada. A simples é um erro clássico em carteira: um APR
     de 300% numa posição de US$ 10 não pode pesar o mesmo que 4% numa
     de US$ 100.000. Sem peso total, devolve null — não zero. */
  function mediaPonderada(itens, valorDe, pesoDe) {
    var somaPeso = 0, somaProduto = 0;
    (itens || []).forEach(function (it) {
      var p = n(pesoDe(it));
      if (!(p > 0)) return;
      somaPeso += p;
      somaProduto += n(valorDe(it)) * p;
    });
    if (!ehBase(somaPeso)) return null;
    return somaProduto / somaPeso;
  }

  /* ============================================================
     POSIÇÃO — valor e custo andam juntos

     Devolver `resultado` e `resultadoPct` a partir do MESMO par é o
     que impede alguém de calcular a porcentagem com um custo que veio
     de outro lugar. Quem quiser o percentual pega o do objeto.
     ============================================================ */
  function posicao(dados) {
    dados = dados || {};
    var valor = n(dados.valor), custo = n(dados.custo);
    var resultado = valor - custo;
    return {
      valor: valor,
      custo: custo,
      resultado: resultado,
      resultadoPct: pct(resultado, custo)
    };
  }

  /* Soma de posições: agrega valor e custo e recalcula o percentual
     sobre o custo AGREGADO. Somar percentuais é o outro erro clássico
     — a média de +100% e −50% não é +25%. */
  function somaPosicoes(lista) {
    var valor = 0, custo = 0;
    (lista || []).forEach(function (p) {
      valor += n(p && p.valor);
      custo += n(p && p.custo);
    });
    return posicao({ valor: valor, custo: custo });
  }

  /* ============================================================
     PATRIMÔNIO — a conta que estava faltando

     `caixa` não é detalhe: é a diferença entre "o que está investido"
     e "o que eu tenho". Sem ele, depositar não muda o patrimônio e
     comprar muda — que é o oposto do que a regra de ouro nº 4 diz.

     `realizado` e `baseRealizada` andam JUNTOS. Informar o primeiro
     sem o segundo é exatamente o erro nº 2: o lucro entra na conta e
     o capital que o produziu não. Se vier resultado realizado sem
     base, a rentabilidade sai como null e a tela diz que não sabe —
     em vez de dividir por um denominador alheio.
     ============================================================ */
  function patrimonio(dados) {
    dados = dados || {};
    var caixa = n(dados.caixa);
    var pos = somaPosicoes(dados.posicoes || []);
    var realizado = n(dados.realizado);
    var baseRealizada = n(dados.baseRealizada);

    /* ------------------------------------------------------------
       RESULTADO ABERTO PODE NÃO SER `valor − custo`

       A tentação é derivar sempre, e ela quase me pegou escrevendo
       este arquivo. Mas há um caso legítimo em que os dois divergem: a
       TAXA JÁ COLETADA de uma pool do DeFi é resultado do usuário e
       não está mais dentro da posição — saiu para o caixa. `valor −
       custo` a perderia.

       Então quem tem um número melhor informa `resultadoAberto`, e
       quem não tem deixa a derivação valer. O que NÃO é opcional é a
       coerência: o `resultadoTotal` devolvido é sempre o que entra na
       rentabilidade, para a tela não poder exibir um resultado e um
       percentual calculado sobre outro.
       ------------------------------------------------------------ */
    var aberto = dados.resultadoAberto != null ? n(dados.resultadoAberto) : pos.resultado;
    var derivado = pos.resultado;

    var resultadoTotal = aberto + realizado;
    /* A base tem de cobrir TUDO que está no numerador. */
    var base = pos.custo + baseRealizada;
    var faltaBase = (realizado !== 0) && !ehBase(baseRealizada);

    return {
      caixa: caixa,
      investido: pos.valor,
      custo: pos.custo,
      patrimonio: caixa + pos.valor,

      resultadoAberto: aberto,
      resultadoRealizado: realizado,
      resultadoTotal: resultadoTotal,
      /* Quanto o informado se afasta de `valor − custo`. Zero na maior
         parte dos casos; diferente de zero é sinal de que há resultado
         fora da posição (taxa sacada) — não de erro. Fica exposto para
         quem auditar não precisar refazer a subtração. */
      diferencaParaDerivado: aberto - derivado,

      base: base,
      /* null quando não há base, e null também quando há resultado
         realizado sem a base dele — dividir aí seria o erro nº 2. */
      rentabilidade: faltaBase ? null : pct(resultadoTotal, base),
      baseIncompleta: faltaBase
    };
  }

  /* ============================================================
     CONFERIR — as invariantes como função

     Não é teste: é uma pergunta que qualquer tela pode fazer em
     qualquer momento. Devolve { ok, diferenca, ... } para quem chama
     decidir o que fazer — os testes reprovam, uma tela de diagnóstico
     mostra, e o resto ignora.
     ============================================================ */
  var conferir = {
    /* caixa + investido = depositado − sacado + resultado total */
    dinheiroFecha: function (d) {
      d = d || {};
      var esquerda = n(d.caixa) + n(d.investido);
      var direita = n(d.depositado) - n(d.sacado) + n(d.resultadoTotal);
      var dif = esquerda - direita;
      return {
        ok: Math.abs(dif) <= EPS,
        diferenca: dif,
        esquerda: esquerda,
        direita: direita,
        explicacao: "caixa + investido = depositado − sacado + resultado total"
      };
    },

    /* A soma das partes tem de dar o todo — vale para fatias de
       alocação, para módulos no consolidado e para carteiras. */
    somaBate: function (partes, total) {
      var s = (partes || []).reduce(function (a, x) { return a + n(x); }, 0);
      var dif = s - n(total);
      return { ok: Math.abs(dif) <= EPS, diferenca: dif, soma: s, total: n(total) };
    },

    /* Percentuais de uma distribuição fecham em 100 (ou em 0, quando
       não há nada distribuído). */
    fatiasFecham: function (pcts) {
      var s = (pcts || []).reduce(function (a, x) { return a + n(x); }, 0);
      if (!(pcts || []).length) return { ok: true, soma: 0, diferenca: 0 };
      var dif = s - 100;
      /* tolerância maior: percentuais costumam vir arredondados na
         casa decimal antes de chegar aqui */
      return { ok: Math.abs(dif) <= 0.5, diferenca: dif, soma: s };
    }
  };

  global.AtlasContabilidade = {
    EPS: EPS,
    n: n,
    dinheiro: dinheiro,
    razao: razao,
    pct: pct,
    mediaPonderada: mediaPonderada,
    posicao: posicao,
    somaPosicoes: somaPosicoes,
    patrimonio: patrimonio,
    conferir: conferir
  };
})(typeof window !== "undefined" ? window : this);
