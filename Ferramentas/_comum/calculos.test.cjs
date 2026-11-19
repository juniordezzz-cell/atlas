/* ATLAS · Ferramentas/_comum/calculos.test.cjs
   Testes das contas comuns da bancada.

       node --test Ferramentas/_comum/calculos.test.cjs

   Os valores esperados vêm de fórmula fechada ou de conta feita à mão,
   nunca do que o código devolveu. Teste que copia a saída do código só
   garante que ele continua errando igual. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('./calculos.js');
const C = F;

let secao = '';
function sec(t) { secao = t; }
function eq(nome, real, esperado, tol) {
  tol = tol == null ? 1e-9 : tol;
  const titulo = secao + ' · ' + nome;
  test(titulo, () => {
    assert.ok(Math.abs(real - esperado) <= tol, titulo + ': ' + real + ' (esperado ' + esperado + ')');
  });
}
function eqv(nome, real, esperado) {
  const titulo = secao + ' · ' + nome;
  test(titulo, () => { assert.equal(real, esperado); });
}

/* ══════════════════════════════════════════════════════════════
   1. CONVERSÃO DE TAXAS
   ══════════════════════════════════════════════════════════════ */
sec('Taxa anual para mensal e a volta');
/* 12,68% ao ano equivale a 1% ao mes: 1,01^12 = 1,126825 */
eq('12,6825% ao ano = 1% ao mes', F.anualParaMensal(12.682503), 0.01, 1e-8);
eq('a volta devolve o mesmo', F.mensalParaAnual(0.01), 12.682503, 1e-5);
eq('0% continua 0%', F.anualParaMensal(0), 0);

sec('Dividir por 12 e o erro classico');
/* 12% ao ano NAO e 1% ao mes: 1,01^12 = 12,68% */
const errado = 12 / 12 / 100;                    /* o que muita gente faz */
const certo = F.anualParaMensal(12);
eqv('a conversao correta e menor que 12/12', certo < errado, true);
eq('12% ao ano da 0,9489% ao mes', certo, 0.00948879, 1e-8);
eq('e capitalizada devolve exatamente 12%', F.mensalParaAnual(certo), 12, 1e-9);

sec('APR e APY');
/* 10% APR capitalizado diariamente: (1+0,1/365)^365 - 1 = 10,5156% */
eq('10% APR ao dia vira 10,5156% APY', F.aprParaApy(10, 365), 10.515578, 1e-5);
eq('a volta devolve os 10%', F.apyParaApr(F.aprParaApy(10, 365), 365), 10, 1e-9);
eq('capitalizacao anual: APR = APY', F.aprParaApy(10, 1), 10, 1e-9);

/* ══════════════════════════════════════════════════════════════
   2. JUROS COMPOSTOS — o erro do mes zero
   ══════════════════════════════════════════════════════════════ */
sec('Juros compostos: so capital inicial');
/* Conta a mao: 1000 x 1,01^12 = 1126,825030... */
let r = F.jurosCompostos({ inicial: 1000, aporte: 0, taxaMensal: 0.01, meses: 12 });
eq('1000 a 1% por 12 meses', r.saldoFinal, 1126.825030, 1e-6);
eq('juros totais = 126,83', r.jurosTotais, 126.825030, 1e-6);
eq('investido continua 1000', r.investido, 1000);
eq('a serie tem 13 pontos (mes 0 ate 12)', r.serie.length, 13);
eq('o mes 0 vale exatamente o capital inicial', r.serie[0].saldo, 1000);
eq('o mes 0 nao rende nada', r.serie[0].juros, 0);
/* A versao antiga dava 1138,09 aqui: treze capitalizacoes em vez de doze */
eqv('nao repete o bug das 13 capitalizacoes', Math.abs(r.saldoFinal - 1138.09) > 10, true);

sec('Juros compostos: so aportes');
/* Anuidade ordinaria: 500 x ((1,01^12 - 1)/0,01) = 6341,25 */
r = F.jurosCompostos({ inicial: 0, aporte: 500, taxaMensal: 0.01, meses: 12 });
eq('500/mes por 12 meses a 1%', r.saldoFinal, 6341.251507, 1e-6);
eq('investido = 6000', r.investido, 6000);
eq('juros = 341,25', r.jurosTotais, 341.251507, 1e-6);
/* O aporte entra no FIM do mes, entao o ultimo nao rende. Se entrasse
   no inicio (anuidade antecipada), o total seria 1% maior: 6404,66. */
eq('menor que a anuidade antecipada', r.saldoFinal * 1.01, 6404.664, 0.01);
eqv('o ultimo aporte nao rende', r.saldoFinal < 6404.66, true);

sec('Juros compostos: serie bate com a formula fechada');
[[1000, 500, 0.01, 12], [10000, 500, 0.01, 240], [0, 100, 0.008, 60], [5000, 0, 0.005, 36]]
  .forEach(function (c) {
    const s = F.jurosCompostos({ inicial: c[0], aporte: c[1], taxaMensal: c[2], meses: c[3] });
    const f = F.valorFuturo(c[0], c[1], c[2], c[3]);
    eq('inicial ' + c[0] + ', aporte ' + c[1] + ', ' + c[3] + ' meses', s.saldoFinal, f, 1e-6);
  });

sec('Juros compostos: taxa zero');
r = F.jurosCompostos({ inicial: 1000, aporte: 100, taxaMensal: 0, meses: 10 });
eq('sem juros, saldo = inicial + aportes', r.saldoFinal, 2000);
eq('juros totais = 0', r.jurosTotais, 0);

sec('Juros compostos: retirada que zera a carteira');
r = F.jurosCompostos({ inicial: 1000, aporte: 0, taxaMensal: 0, meses: 20, retirada: 100 });
eq('saldo nao fica negativo', r.saldoFinal, 0);
eq('avisa em que mes acabou', r.mesQueZerou, 11);
r = F.jurosCompostos({ inicial: 100000, aporte: 0, taxaMensal: 0.01, meses: 12, retirada: 500 });
eqv('retirada menor que os juros nao zera', r.mesQueZerou, null);
eqv('e o saldo cresce mesmo assim', r.saldoFinal > 100000, true);

sec('Juros compostos: meses = 0');
r = F.jurosCompostos({ inicial: 1000, aporte: 500, taxaMensal: 0.01, meses: 0 });
eq('devolve o proprio capital', r.saldoFinal, 1000);
eq('serie com um ponto so', r.serie.length, 1);

/* ══════════════════════════════════════════════════════════════
   3. STAKING
   ══════════════════════════════════════════════════════════════ */
sec('Staking: APR e juros simples');
let s = F.staking({ quantidade: 100, taxaPct: 12, meses: 12, modo: 'apr' });
eq('100 tokens, 12% APR, 1 ano', s.rendimento, 12);
s = F.staking({ quantidade: 100, taxaPct: 12, meses: 6, modo: 'apr' });
eq('meio ano rende metade', s.rendimento, 6);
s = F.staking({ quantidade: 100, taxaPct: 12, meses: 24, modo: 'apr' });
eq('dois anos rende o dobro, sem compor', s.rendimento, 24);

sec('Staking: APY ja e a taxa efetiva ao ano');
s = F.staking({ quantidade: 100, taxaPct: 12, meses: 12, modo: 'apy' });
eq('um ano de 12% APY = 12 tokens', s.rendimento, 12, 1e-9);
s = F.staking({ quantidade: 100, taxaPct: 12, meses: 24, modo: 'apy' });
/* 100 x (1,12^2 - 1) = 25,44 */
eq('dois anos compoem: 25,44', s.rendimento, 25.44, 1e-9);
eqv('APY rende mais que APR no mesmo prazo',
  F.staking({ quantidade: 100, taxaPct: 12, meses: 24, modo: 'apy' }).rendimento >
  F.staking({ quantidade: 100, taxaPct: 12, meses: 24, modo: 'apr' }).rendimento, true);
s = F.staking({ quantidade: 100, taxaPct: 12, meses: 6, modo: 'apy' });
/* 100 x (1,12^0,5 - 1) = 5,8300... — menos que a metade linear, correto */
eq('meio ano de APY nao e metade', s.rendimento, 5.830052, 1e-6);
eqv('e e menor que o APR de meio ano', s.rendimento < 6, true);

/* ══════════════════════════════════════════════════════════════
   4. IMPERMANENT LOSS
   ══════════════════════════════════════════════════════════════ */
sec('IL: valores canonicos 50/50');
[[1.25, -0.62], [1.5, -2.02], [2, -5.72], [3, -13.40], [4, -20.00], [5, -25.46], [0.5, -5.72]]
  .forEach(function (c) { eq('r=' + c[0], F.impermanentLossPct(c[0], 0.5), c[1], 0.01); });
eq('r=1 nao tem IL', F.impermanentLossPct(1, 0.5), 0);
eq('r invalido devolve 0', F.impermanentLossPct(0, 0.5), 0);
eq('metade e o dobro dao o mesmo IL',
  F.impermanentLossPct(2, 0.5), F.impermanentLossPct(0.5, 0.5), 1e-12);

sec('IL: 80/20 perde menos que 50/50');
[1.5, 2, 3, 5].forEach(function (rr) {
  eqv('r=' + rr, F.impermanentLossPct(rr, 0.8) > F.impermanentLossPct(rr, 0.5), true);
});
eq('80/20 em r=1,5', F.impermanentLossPct(1.5, 0.8), -1.20, 0.01);

sec('Pool: o HOLD respeita os pesos');
let p = F.pool({ deposito: 10000, precoIni: 100, precoFim: 150, aprPct: 0, dias: 365, w1: 0.5 });
eq('50/50: hold = 10000 x 1,25', p.valorHold, 12500);
p = F.pool({ deposito: 10000, precoIni: 100, precoFim: 150, aprPct: 0, dias: 365, w1: 0.8 });
/* 80% no volatil que subiu 50%: 10000 x (0,8x1,5 + 0,2) = 14000 */
eq('80/20: hold = 10000 x 1,4', p.valorHold, 14000);

sec('Pool: taxas contra impermanent loss');
p = F.pool({ deposito: 10000, precoIni: 100, precoFim: 150, aprPct: 20, dias: 365, w1: 0.5 });
eq('taxas de 20% ao ano por 1 ano', p.taxas, 2000);
eq('IL de -2,02%', p.ilPct, -2.02, 0.01);
eq('valor na pool', p.valorPool, 12247.448714, 1e-5);
eqv('com taxa alta, compensou', p.compensou, true);
eq('vs hold', p.vsHold, 12247.448714 + 2000 - 12500, 1e-5);
p = F.pool({ deposito: 10000, precoIni: 100, precoFim: 400, aprPct: 5, dias: 30, w1: 0.5 });
eqv('par disparou e taxa baixa: nao compensou', p.compensou, false);

sec('Pool: taxas sao proporcionais ao tempo');
p = F.pool({ deposito: 10000, precoIni: 100, precoFim: 100, aprPct: 36.5, dias: 10, w1: 0.5 });
eq('36,5% ao ano por 10 dias = 1%', p.taxas, 100, 1e-9);
eq('par parado nao tem IL', p.ilPct, 0);
eq('e o hold e o proprio deposito', p.valorHold, 10000);

/* ══════════════════════════════════════════════════════════════
   5. LUCRO EM OPERACAO
   ══════════════════════════════════════════════════════════════ */
sec('Lucro: sem taxa');
let L = F.lucroOperacao({ quantidade: 2, precoCompra: 100, precoVenda: 150, taxaPct: 0 });
eq('investido', L.investido, 200);
eq('recebido', L.recebido, 300);
eq('lucro', L.lucro, 100);
eq('retorno de 50%', L.lucroPct, 50);
eq('preco de empate = preco de compra', L.precoEmpate, 100);

sec('Lucro: a taxa de compra faz parte do custo');
L = F.lucroOperacao({ quantidade: 1, precoCompra: 1000, precoVenda: 1000, taxaPct: 1 });
/* comprou por 1000 + 10 de taxa; vendeu por 1000 - 10 = 990.
   prejuizo de 20 sobre 1010 desembolsados = -1,9802% */
eq('vender pelo mesmo preco da prejuizo', L.lucro, -20);
eq('custo total = 1010', L.custoTotal, 1010);
eq('percentual sobre o desembolso real', L.lucroPct, -1.980198, 1e-6);
/* A versao antiga dividia por 1000 e dizia -2,00%. Diferenca pequena,
   mas era a MESMA pergunta com resposta diferente da do portfolio. */
eqv('nao usa o preco de compra puro como base',
  Math.abs(L.lucroPct - (-2)) > 1e-6, true);

sec('Lucro: preco de empate cobre as duas taxas');
L = F.lucroOperacao({ quantidade: 1, precoCompra: 1000, precoVenda: 1000, taxaPct: 1 });
const empate = L.precoEmpate;
const conferindo = F.lucroOperacao({ quantidade: 1, precoCompra: 1000, precoVenda: empate, taxaPct: 1 });
eq('vender no preco de empate zera o resultado', conferindo.lucro, 0, 1e-9);
eqv('e o empate e maior que o preco de compra', empate > 1000, true);

sec('Lucro: prejuizo');
L = F.lucroOperacao({ quantidade: 10, precoCompra: 50, precoVenda: 30, taxaPct: 0.5 });
eq('investido 500', L.investido, 500);
eq('taxa de compra 2,50', L.taxaCompra, 2.5);
eq('taxa de venda 1,50', L.taxaVenda, 1.5);
eq('lucro = 298,50 - 502,50', L.lucro, -204);

/* ══════════════════════════════════════════════════════════════
   6. TRADE ALAVANCADO — o lado perigoso do erro
   ══════════════════════════════════════════════════════════════ */
sec('Liquidacao: a deducao exata');
/* long, P=100, L=10, mmr=0,005 -> 100 x 0,9 / 0,995 = 90,452261 */
eq('long 10x', F.precoLiquidacao({ entrada: 100, alavancagem: 10, direcao: 'long' }),
  90.452261, 1e-6);
/* short: 100 x 1,1 / 1,005 = 109,452736 */
eq('short 10x', F.precoLiquidacao({ entrada: 100, alavancagem: 10, direcao: 'short' }),
  109.452736, 1e-6);
eq('long 2x', F.precoLiquidacao({ entrada: 100, alavancagem: 2, direcao: 'long' }),
  50.251256, 1e-6);
eq('sem alavancagem, long liquida em zero',
  F.precoLiquidacao({ entrada: 100, alavancagem: 1, direcao: 'long' }), 0);

sec('Liquidacao: a aproximacao antiga errava para o lado perigoso');
/* antiga: entrada x (1 + 1/lev - mmr) para short */
const antigaShort = 100 * (1 + 1 / 10 - 0.005);          /* 109,50 */
const novaShort = F.precoLiquidacao({ entrada: 100, alavancagem: 10, direcao: 'short' });
eqv('a antiga dizia que a liquidacao vinha DEPOIS', antigaShort > novaShort, true);
eqv('ou seja, prometia folga que nao existe', antigaShort - novaShort > 0.04, true);
/* para long a antiga errava para o lado seguro */
const antigaLong = 100 * (1 - 1 / 10 + 0.005);           /* 90,50 */
const novaLong = F.precoLiquidacao({ entrada: 100, alavancagem: 10, direcao: 'long' });
eqv('no long a antiga liquidava cedo demais', antigaLong > novaLong, true);

sec('Liquidacao: preco e percentual contam a mesma historia');
[2, 5, 10, 20].forEach(function (lev) {
  ['long', 'short'].forEach(function (d) {
    const preco = F.precoLiquidacao({ entrada: 1000, alavancagem: lev, direcao: d });
    const t = F.trade({ entrada: 1000, saida: preco, margem: 100, alavancagem: lev, direcao: d });
    eq(d + ' ' + lev + 'x: no preco de liquidacao, o limite bate',
      t.limitePct, F.limiteLiquidacaoPct(lev, d), 1e-9);
    eqv(d + ' ' + lev + 'x: e a posicao esta liquidada', t.liquidado, true);
  });
});

sec('Trade: resultado da operacao');
let t = F.trade({ entrada: 100, saida: 110, margem: 1000, alavancagem: 5, direcao: 'long' });
eq('subiu 10%', t.variacaoPct, 10);
eq('com 5x, retorno de 50%', t.pnlPct, 50);
eq('lucro de 500 sobre margem de 1000', t.resultado, 500);
eq('saldo final 1500', t.saldoFinal, 1500);
eq('notional = margem x alavancagem', t.notional, 5000);
eq('quantidade = notional / entrada', t.quantidade, 50);

t = F.trade({ entrada: 100, saida: 90, margem: 1000, alavancagem: 5, direcao: 'short' });
eq('short ganha na queda', t.pnlPct, 50);
eq('lucro de 500', t.resultado, 500);

sec('Trade: liquidacao perde a margem, nunca mais que ela');
t = F.trade({ entrada: 100, saida: 50, margem: 1000, alavancagem: 10, direcao: 'long' });
eqv('liquidado', t.liquidado, true);
eq('perde exatamente a margem', t.resultado, -1000);
eq('e nao mais que 100%', t.pnlPct, -100);
eq('saldo final zero', t.saldoFinal, 0);
/* sem o teto, a conta crua diria -500% */
eqv('a conta crua daria muito pior', ((50 - 100) / 100) * 10 * 100 < -100, true);

sec('Trade: um passo antes da liquidacao ainda nao liquida');
const liq = F.precoLiquidacao({ entrada: 100, alavancagem: 10, direcao: 'long' });
t = F.trade({ entrada: 100, saida: liq + 0.01, margem: 1000, alavancagem: 10, direcao: 'long' });
eqv('acima do preco de liquidacao, segue viva', t.liquidado, false);
t = F.trade({ entrada: 100, saida: liq - 0.01, margem: 1000, alavancagem: 10, direcao: 'long' });
eqv('abaixo, liquidou', t.liquidado, true);

sec('Trade: alavancagem maior liquida mais perto');
let anterior = 0;
[2, 5, 10, 20, 50].forEach(function (lev) {
  const pl = F.precoLiquidacao({ entrada: 100, alavancagem: lev, direcao: 'long' });
  eqv(lev + 'x liquida acima do ' + (anterior || 'zero'), pl > anterior, true);
  anterior = pl;
});

/* ══════════════════════════════════════════════════════════════
   7. COMPARACAO ENTRE ATIVOS — a janela comum
   ══════════════════════════════════════════════════════════════ */
sec('Janela comum: todos com o mesmo historico');
let J = F.janelaComum([[1, 2, 3], [10, 20, 30], [5, 6, 7]]);
eq('comeca do zero', J.indice, 0);
eqv('nao recortou nada', J.recortou, false);

sec('Janela comum: um ativo entra depois');
J = F.janelaComum([[1, 2, 3, 4], [null, null, 5, 6], [7, 8, 9, 10]]);
eq('a janela comeca onde o mais novo entra', J.indice, 2);
eqv('recortou', J.recortou, true);
eq('e sabe quem limitou', J.quemLimita, 1);

sec('Janela comum: serie totalmente vazia nao limita ninguem');
J = F.janelaComum([[1, 2, 3], [null, null, null], [4, 5, 6]]);
eq('a janela continua no zero', J.indice, 0);
eqv('nao recortou por causa da vazia', J.recortou, false);

sec('Janela comum: sem ativo nenhum');
J = F.janelaComum([]);
eq('indice zero', J.indice, 0);
eqv('nao recortou', J.recortou, false);

sec('Retorno medido a partir da janela');
/* O caso que motivou a mudanca: um ativo antigo que subiu bastante ao
   longo de todo o periodo, e um novo que subiu no trecho curto em que
   existe. Medido desde o inicio de cada um, a comparacao nao responde
   pergunta nenhuma -- sao periodos diferentes. */
const antigo = [100, 120, 140, 160, 180];        /* +80% no total */
const novo   = [null, null, null, 100, 150];     /* +50%, so no fim  */
const jc = F.janelaComum([antigo, novo]);
eq('a janela comeca onde o novo entra', jc.indice, 3);

const antigoDesdeOInicio = F.retornoDesde(antigo, 0);
const antigoNaJanela = F.retornoDesde(antigo, jc.indice);
const novoNaJanela = F.retornoDesde(novo, jc.indice);
eq('o antigo, desde o inicio dele: +80%', antigoDesdeOInicio.pct, 80, 1e-9);
eq('o antigo, na janela comum: +12,5%', antigoNaJanela.pct, 12.5, 1e-9);
eq('o novo, na janela comum: +50%', novoNaJanela.pct, 50, 1e-9);
eqv('na janela comum, o novo realmente ganhou', novoNaJanela.pct > antigoNaJanela.pct, true);
eqv('e medido errado o antigo e que pareceria melhor',
  antigoDesdeOInicio.pct > novoNaJanela.pct, true);

sec('Retorno: casos de borda');
eqv('serie vazia devolve null', F.retornoDesde([], 0), null);
eqv('so nulos devolve null', F.retornoDesde([null, null], 0), null);
eqv('base zero devolve null, para nao dividir por zero', F.retornoDesde([0, 5], 0), null);
const comBuraco = F.retornoDesde([null, null, 50, null, 75], 1);
eq('buraco no indice pedido: usa o proximo com dado', comBuraco.base, 50);
eq('e o ultimo ponto valido', comBuraco.ultimo, 75);
eq('resultado +50%', comBuraco.pct, 50, 1e-9);


sec('Variacao medida N periodos atras');
/* serie de 11 fechamentos: 100 ... 200, subindo de 10 em 10 */
const fech = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
eq('1 periodo atras: de 190 para 200 = +5,263%', F.variacaoEmJanela(fech, 1), (200 / 190 - 1) * 100, 1e-9);
eq('5 periodos atras: de 150 para 200 = +33,33%', F.variacaoEmJanela(fech, 5), (200 / 150 - 1) * 100, 1e-9);
eq('10 periodos atras: de 100 para 200 = +100%', F.variacaoEmJanela(fech, 10), 100, 1e-9);

sec('Variacao: historico curto devolve null, nao um numero falso');
/* A serie tem 11 pontos. Pedir 365 nao pode devolver "de 100 para 200",
   que e' o que aconteceria se a funcao apenas truncasse o indice. */
eqv('janela maior que a serie: null', F.variacaoEmJanela(fech, 365), null);
eqv('janela igual ao tamanho da serie: null (faltaria a base)', F.variacaoEmJanela(fech, 11), null);
eqv('exatamente na borda ainda mede', F.variacaoEmJanela(fech, 10) !== null, true);
eqv('serie vazia: null', F.variacaoEmJanela([], 7), null);
eqv('serie nula: null', F.variacaoEmJanela(null, 7), null);
eqv('zero periodos: null', F.variacaoEmJanela(fech, 0), null);
eqv('periodos negativo: null', F.variacaoEmJanela(fech, -3), null);

sec('Variacao: queda e estabilidade');
eq('queda de 200 para 100 = -50%', F.variacaoEmJanela([200, 150, 100], 2), -50, 1e-9);
eq('preco parado = 0%', F.variacaoEmJanela([50, 50, 50], 2), 0, 1e-9);


sec('Cambio: valor de uma moeda em dolar');
/* 1 USDT custa 1,00 USD e 5,17 BRL  ->  1 BRL vale 1/5,17 USD */
eq('1 BRL em dolar', F.valorEmDolar(1, 5.17), 1 / 5.17, 1e-12);
eqv('e vale MENOS que um dolar, nao mais', F.valorEmDolar(1, 5.17) < 1, true);
eq('1 EUR em dolar (USDT a 0,92 EUR)', F.valorEmDolar(1, 0.92), 1 / 0.92, 1e-12);
eqv('o euro vale MAIS que um dolar', F.valorEmDolar(1, 0.92) > 1, true);
eq('o proprio dolar vale 1', F.valorEmDolar(1, 1), 1, 1e-12);

sec('Cambio: a inversao trocada seria um numero plausivel');
/* Este e' o teste que existe por causa do erro que ele impede: invertida,
   a conta devolveria 5,17 -- "1 real vale 5,17 dolares" -- com formato
   impecavel. Se alguem trocar a ordem, isto quebra. */
eqv('1 BRL nao pode valer mais de um dolar', F.valorEmDolar(1, 5.17) < 1, true);
eq('e o valor certo e' + " 0,1934...", F.valorEmDolar(1, 5.17), 0.19342359767891683, 1e-12);

sec('Cambio: divisor invalido nao vira Infinity');
eqv('preco zero na moeda: null', F.valorEmDolar(1, 0), null);
eqv('preco nulo: null', F.valorEmDolar(1, null), null);
eqv('preco indefinido: null', F.valorEmDolar(undefined, 5.17), null);

sec('Cambio: conversao entre duas moedas');
/* BRL vale 1/5,17 USD; EUR vale 1/0,92 USD */
const vBRL = F.valorEmDolar(1, 5.17);
const vEUR = F.valorEmDolar(1, 0.92);
const vUSD = 1;
eq('100 BRL em dolar', F.converterMoeda(100, vBRL, vUSD), 100 / 5.17, 1e-9);
eq('100 USD em real', F.converterMoeda(100, vUSD, vBRL), 100 * 5.17, 1e-9);
eq('a mesma moeda nao muda o valor', F.converterMoeda(42, vBRL, vBRL), 42, 1e-9);

/* ida e volta tem que fechar: e' o teste que pega ordem trocada em
   qualquer um dos dois sentidos */
const ida = F.converterMoeda(250, vBRL, vEUR);
const volta = F.converterMoeda(ida, vEUR, vBRL);
eq('converter e desconverter devolve o valor original', volta, 250, 1e-9);

sec('Cambio: conversao com entrada invalida');
eqv('valor nulo: null', F.converterMoeda(null, vBRL, vUSD), null);
eqv('destino zero: null', F.converterMoeda(100, vBRL, 0), null);
eqv('origem nula: null', F.converterMoeda(100, null, vUSD), null);
eq('zero converte para zero', F.converterMoeda(0, vBRL, vEUR), 0, 1e-12);



/* ── Novas da bancada do ATLAS ── */
test('lerNumero aceita formato brasileiro', () => {
  assert.equal(C.lerNumero('1.000'), 1000);
  assert.equal(C.lerNumero('0,5'), 0.5);
  assert.equal(C.lerNumero('10.000,50'), 10000.5);
  assert.equal(C.lerNumero('R$ 2.500'), 2500);
  assert.equal(C.lerNumero(''), null);
  assert.equal(C.lerNumero('abc'), null);
});
test('impostoCripto', () => {
  assert.deepEqual(C.impostoCripto({ lucroBRL: 10000, vendasMesBRL: 35000, custodia: 'br' }), { imposto: 0, isento: true, aliquota: 0 });
  assert.equal(C.impostoCripto({ lucroBRL: 136812.5, vendasMesBRL: 412500, custodia: 'br' }).imposto.toFixed(2), '20521.88');
  assert.equal(C.impostoCripto({ lucroBRL: 6e6, vendasMesBRL: 9e6, custodia: 'br' }).imposto, 5e6 * 0.15 + 1e6 * 0.175);
  assert.equal(C.impostoCripto({ lucroBRL: 1000, vendasMesBRL: 2000, custodia: 'ext' }).imposto, 150);
  assert.equal(C.impostoCripto({ lucroBRL: -500, vendasMesBRL: 90000, custodia: 'br' }).imposto, 0);
});
test('precoEmpate', () => {
  assert.equal(C.precoEmpate(50000, 0.1).toFixed(1), '50100.1');
  assert.equal(C.precoEmpate(10, 0), 10);
  assert.equal(C.precoEmpate(10, 100), null);
});

/* ── Correções da revisão final (08/11) ── */
test('lerNumero: zero à esquerda não é grupo de milhar', () => {
  assert.equal(C.lerNumero('0.001'), 0.001);
  assert.equal(C.lerNumero('0.123'), 0.123);
  assert.equal(C.lerNumero('1.234'), 1234);
});
test('numeroCampo escreve sem notação científica e volta igual pelo lerNumero', () => {
  assert.equal(C.numeroCampo(1.2e-9), '0,0000000012');
  assert.equal(C.numeroCampo(74526), '74526');
  assert.equal(C.numeroCampo(0.231704), '0,231704');
  assert.equal(C.numeroCampo(12345.5), '12345,5');
  assert.equal(C.numeroCampo(null), '');
  [1.2e-9, 0.001, 0.123, 74526, 12345.5, 6988.5521, 0.14309116].forEach(v =>
    assert.equal(C.lerNumero(C.numeroCampo(v)), v));
});

sec('Coinbase: preço de uma cripto');
/* resposta de exchange-rates?currency=BTC: valores são "quanto vale 1 BTC" */
const respBtc = { data: { currency: 'BTC', rates: { BRL: '510000.5', USD: '95000', EUR: '85000.25', GBP: '72000' } } };
const pBtc = F.precosDeCoinbase(respBtc);
eq('BRL como número', pBtc.brl, 510000.5);
eq('USD como número', pBtc.usd, 95000);
eq('EUR como número', pBtc.eur, 85000.25);
eqv('moeda que falta: null (cai na outra fonte)', F.precosDeCoinbase({ data: { rates: { BRL: '1', USD: '1' } } }), null);
eqv('taxa zero: null', F.precosDeCoinbase({ data: { rates: { BRL: '0', USD: '1', EUR: '1' } } }), null);
eqv('texto no lugar do número: null', F.precosDeCoinbase({ data: { rates: { BRL: 'x', USD: '1', EUR: '1' } } }), null);
eqv('resposta vazia: null', F.precosDeCoinbase({}), null);
eqv('sem resposta: null', F.precosDeCoinbase(undefined), null);

sec('Coinbase: câmbio em dólar');
/* 1 USD = 5,3721 BRL  ->  1 BRL vale 1/5,3721 USD (e não 5,37) */
const respUsd = { data: { currency: 'USD', rates: { BRL: '5.3721', EUR: '0.8950555092760567', GBP: '0.7494046489174207', USDT: '1.0015825003505539', USDC: '1' } } };
const vCb = F.valoresEmDolarDeCoinbase(respUsd);
eq('o dólar vale 1', vCb.usd, 1);
eq('1 BRL em dólar', vCb.brl, 1 / 5.3721, 1e-12);
eqv('1 BRL vale menos que 1 dólar', vCb.brl < 1, true);
eqv('1 EUR vale mais que 1 dólar', vCb.eur > 1, true);
eqv('1 GBP vale mais que 1 dólar', vCb.gbp > 1, true);
eq('1 USDT em dólar', vCb.usdt, 1 / 1.0015825003505539, 1e-12);
eq('1 USDC em dólar', vCb.usdc, 1, 1e-12);
eq('100 USD em real fecha com a taxa', F.converterMoeda(100, vCb.usd, vCb.brl), 537.21, 1e-9);
eqv('falta uma moeda: null', F.valoresEmDolarDeCoinbase({ data: { rates: { BRL: '5', EUR: '1', GBP: '1', USDT: '1' } } }), null);
eqv('resposta vazia: null', F.valoresEmDolarDeCoinbase(null), null);

/* ══════════════════════════════════════════════════════════════
   COTAÇÃO EM VÁRIAS FONTES (19/11/2026)
   Respostas simuladas no formato de cada API: a nuvem não alcança
   nenhuma delas, então o formato real se confere no navegador.
   ══════════════════════════════════════════════════════════════ */
sec('Dólar em reais');
eq('Coinbase: rates.BRL é o dólar em reais', F.dolarEmReaisDeCoinbase({ data: { currency: 'USD', rates: { BRL: '5.3721' } } }), 5.3721);
eqv('Coinbase sem BRL: null', F.dolarEmReaisDeCoinbase({ data: { rates: { EUR: '0.9' } } }), null);
eqv('Coinbase vazia: null', F.dolarEmReaisDeCoinbase(null), null);
/* USDT a 5,40 BRL e 1,0008 USD -> dólar = 5,40 / 1,0008 */
eq('CoinGecko pelo USDT', F.dolarEmReaisDeCoingecko({ tether: { brl: 5.40, usd: 1.0008 } }), 5.40 / 1.0008, 1e-12);
eqv('CoinGecko com usd zero: null', F.dolarEmReaisDeCoingecko({ tether: { brl: 5.4, usd: 0 } }), null);
eqv('CoinGecko sem tether: null', F.dolarEmReaisDeCoingecko({}), null);

sec('Preço do token');
eq('Coinbase: rates.USD de exchange-rates?currency=SOL', F.precoDeCoinbase({ data: { currency: 'SOL', rates: { USD: '142.35', BRL: '765' } } }), 142.35);
eqv('Coinbase sem USD: null', F.precoDeCoinbase({ data: { rates: { BRL: '1' } } }), null);
eq('DefiLlama pela chave coingecko:<id>', F.precoDeDefiLlama({ coins: { 'coingecko:jupiter-exchange-solana': { symbol: 'JUP', price: 0.4321, timestamp: 1763500000, confidence: 0.99 } } }, 'jupiter-exchange-solana'), 0.4321);
eqv('DefiLlama sem o token: null', F.precoDeDefiLlama({ coins: {} }, 'xyz'), null);
eqv('DefiLlama de outro token: null', F.precoDeDefiLlama({ coins: { 'coingecko:bitcoin': { price: 9e4 } } }, 'ethereum'), null);
eq('CoinPaprika: quotes.USD.price', F.precoDeCoinpaprika({ id: 'sol-solana', quotes: { USD: { price: 141.9 } } }), 141.9);
eqv('CoinPaprika sem cotação: null', F.precoDeCoinpaprika({ id: 'sol-solana' }), null);
eq('CoinGecko simple/price', F.precoDeCoingecko({ solana: { usd: 142.1 } }, 'solana'), 142.1);
eqv('CoinGecko preço nulo: null', F.precoDeCoingecko({ solana: { usd: null } }, 'solana'), null);

sec('Quem entra na Coinbase');
eqv('id da CoinGecko conferido', F.simboloCoinbase({ id: 'solana', fonte: 'coingecko' }), 'SOL');
eqv('sem fonte vale como CoinGecko (?token= da Escada)', F.simboloCoinbase({ id: 'avalanche-2' }), 'AVAX');
eqv('id da CoinPaprika conferido', F.simboloCoinbase({ id: 'sol-solana', fonte: 'coinpaprika' }), 'SOL');
eqv('token fora da lista: não usa a Coinbase', F.simboloCoinbase({ id: 'jupiter-exchange-solana' }), null);
eqv('mesmo ticker, outra moeda: não usa a Coinbase', F.simboloCoinbase({ id: 'sol-wrapped-sol', fonte: 'coinpaprika' }), null);
eqv('CoinPaprika conhecida vira id da CoinGecko', F.idCoingeckoConhecido({ id: 'btc-bitcoin', fonte: 'coinpaprika' }), 'bitcoin');
eqv('CoinPaprika desconhecida: null', F.idCoingeckoConhecido({ id: 'abc-abc', fonte: 'coinpaprika' }), null);
eqv('as duas listas cobrem as mesmas moedas',
  Object.values(F.PAPRIKA_PARA_COINGECKO).sort().join(), Object.keys(F.COINBASE_SIMBOLOS).sort().join());

sec('Busca de token');
const buscaCp = F.buscaDeCoinpaprika({ currencies: [
  { id: 'sol-solana', name: 'Solana', symbol: 'SOL', rank: 6, is_new: false, is_active: true, type: 'coin' },
  { id: 'old-morto', name: 'Morto', symbol: 'MRT', rank: 0, is_active: false }
] });
eqv('CoinPaprika: ignora moeda inativa', buscaCp.length, 1);
eqv('CoinPaprika: id e fonte', buscaCp[0].id + '|' + buscaCp[0].fonte, 'sol-solana|coinpaprika');
eqv('CoinPaprika: símbolo e nome', buscaCp[0].sym + '|' + buscaCp[0].nome, 'SOL|Solana');
eqv('CoinPaprika: logo pelo id', buscaCp[0].img, 'https://static.coinpaprika.com/coin/sol-solana/logo.png');
eqv('CoinPaprika sem resultado: null (tenta a CoinGecko)', F.buscaDeCoinpaprika({ currencies: [] }), null);
const buscaCg = F.buscaDeCoingecko({ coins: [{ id: 'solana', name: 'Solana', symbol: 'sol', market_cap_rank: 6, thumb: 'https://x/t.png', large: 'javascript:alert(1)' }] });
eqv('CoinGecko: símbolo em maiúsculas e fonte', buscaCg[0].sym + '|' + buscaCg[0].fonte, 'SOL|coingecko');
eqv('CoinGecko: imagem que não é https sai vazia', buscaCg[0].img, '');
eqv('CoinGecko vazia: null', F.buscaDeCoingecko({ coins: [] }), null);
const buscaPar = { coins: [
  { id: 'solana-wormhole', symbol: 'SOL', name: 'Wrapped Solana' },
  { id: 'solana', symbol: 'sol', name: 'Solana' }
] };
eqv('par na CoinGecko: mesmo símbolo E nome', F.idCoingeckoDaBusca(buscaPar, 'SOL', 'Solana'), 'solana');
eqv('só o símbolo igual não basta', F.idCoingeckoDaBusca(buscaPar, 'SOL', 'Solana Classic'), null);

sec('BTC e ETH com variação de 24h');
const tkB = F.tickerDeBinance({ symbol: 'BTCUSDT', lastPrice: '91234.56000000', priceChangePercent: '-1.234' });
eq('Binance: preço vem como texto', tkB.usd, 91234.56);
eq('Binance: variação em %', tkB.var24h, -1.234);
eqv('Binance sem preço: null', F.tickerDeBinance({ code: -1121, msg: 'Invalid symbol.' }), null);
const tkG = F.tickerDeCoingecko({ bitcoin: { usd: 91200, usd_24h_change: 2.5 } }, 'bitcoin');
eq('CoinGecko: preço', tkG.usd, 91200);
eq('CoinGecko: variação', tkG.var24h, 2.5);
eqv('CoinGecko sem variação: preço fica, variação null', F.tickerDeCoingecko({ bitcoin: { usd: 1 } }, 'bitcoin').var24h, null);

sec('Série histórica');
const sDl = F.serieDeDefiLlama({ coins: { 'coingecko:sp500-xstock': { symbol: 'SPYx', prices: [
  { timestamp: 1700086400, price: 452 }, { timestamp: 1700000000, price: 450 }, { timestamp: 1700172800, price: 0 }
] } } }, 'sp500-xstock');
eqv('DefiLlama: ordena e descarta preço zero', sDl.length, 2);
eqv('DefiLlama: segundos viram milissegundos', sDl[0].t, 1700000000 * 1000);
eq('DefiLlama: primeiro valor é o mais antigo', sDl[0].v, 450);
eqv('DefiLlama com menos pontos que o mínimo: null', F.serieDeDefiLlama({ coins: { 'coingecko:a': { prices: [{ timestamp: 1, price: 1 }, { timestamp: 2, price: 1 }] } } }, 'a', 30), null);
eqv('DefiLlama sem o token: null', F.serieDeDefiLlama({ coins: {} }, 'a'), null);
const sCg = F.serieDeCoingecko({ prices: [[1700000000000, 450], [1700086400000, 452]] });
eqv('CoinGecko market_chart: pontos', sCg.length, 2);
eqv('CoinGecko vazia: null', F.serieDeCoingecko({ prices: [] }), null);

sec('Fontes em ordem');
test('Fontes em ordem · a primeira que responde vence', async () => {
  const r = await F.tentarEmOrdem([
    { fonte: 'Coinbase', buscar: () => 5.37 },
    { fonte: 'CoinGecko', buscar: () => { throw new Error('não devia chamar'); } }
  ]);
  assert.deepEqual(r, { valor: 5.37, fonte: 'Coinbase' });
});
test('Fontes em ordem · falha e null passam a vez', async () => {
  const chamadas = [];
  const r = await F.tentarEmOrdem([
    { fonte: 'Coinbase', buscar: () => { chamadas.push('cb'); return Promise.reject(new Error('Limite')); } },
    { fonte: 'DefiLlama', buscar: () => { chamadas.push('dl'); return null; } },
    null,
    { fonte: 'CoinGecko', buscar: () => { chamadas.push('cg'); return Promise.resolve(142); } }
  ]);
  assert.deepEqual(chamadas, ['cb', 'dl', 'cg']);
  assert.deepEqual(r, { valor: 142, fonte: 'CoinGecko' });
});
test('Fontes em ordem · erro síncrono não derruba a sequência', async () => {
  const r = await F.tentarEmOrdem([
    { fonte: 'A', buscar: () => { throw new TypeError('x'); } },
    { fonte: 'B', buscar: () => 1 }
  ]);
  assert.equal(r.fonte, 'B');
});
test('Fontes em ordem · todas falham: rejeita para a tela mostrar o aviso', async () => {
  await assert.rejects(F.tentarEmOrdem([
    { fonte: 'A', buscar: () => Promise.reject(new Error('x')) },
    { fonte: 'B', buscar: () => null }
  ]), /nenhuma fonte/);
});
test('Fontes em ordem · lista vazia rejeita', async () => {
  await assert.rejects(F.tentarEmOrdem([]), /nenhuma fonte/);
});
