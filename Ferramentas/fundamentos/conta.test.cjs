/* node --test Ferramentas/fundamentos/conta.test.cjs */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./conta.js');

// 60 dias: os 30 primeiros valem 10 por dia, os 30 últimos 20 por dia
const DIA = 86400;
const serie = C.limpaSerie(Array.from({ length: 60 }, (_, i) => [1700000000 + i * DIA, i < 30 ? 10 : 20]));

test('soma da janela e da janela anterior', () => {
  assert.equal(C.somaJanela(serie, 30, 0), 600);
  assert.equal(C.somaJanela(serie, 30, 1), 300);
  assert.equal(C.somaJanela(serie, 30, 2), null);   // não há 90 dias
});

test('período: variação contra o período anterior e anualizado', () => {
  const p = C.periodo(serie, 30);
  assert.equal(p.variacao, 100);
  assert.equal(p.anual, 600 * 365 / 30);
  assert.equal(C.periodo(serie, 90), null);
  assert.equal(C.periodo(serie, 60).variacao, null);   // sem período anterior
});

test('limpa a série: ordena, descarta lixo e zera negativo', () => {
  const s = C.limpaSerie([[3, 5], [1, -2], ['x', 1], null, [2, 7]]);
  assert.deepEqual(s, [[1, 0], [2, 7], [3, 5]]);
});

test('múltiplo = valor de mercado ÷ receita anual; sem receita fica vazio', () => {
  assert.equal(C.multiplo(1000, 100), 10);
  assert.equal(C.multiplo(1000, 0), null);
  assert.equal(C.multiplo(0, 100), null);
});

test('resumo junta as quatro séries, o múltiplo e a parte do token nas taxas', () => {
  const taxas = serie, token = C.limpaSerie(serie.map(([t, v]) => [t, v / 10]));
  const r = C.resumo({ nome: 'X', simbolo: 'XX', mcap: 21900, series: { taxas, token, volume: null } }, 30);
  assert.equal(r.volume, null);
  assert.equal(r.taxas.soma, 600);
  assert.equal(r.token.soma, 60);
  assert.equal(r.parteToken, 10);
  assert.equal(r.multiploToken, 21900 / (60 * 365 / 30));   // 30 anos
});

test('leitura só com fatos', () => {
  const taxas = serie, token = C.limpaSerie(serie.map(([t, v]) => [t, v / 10]));
  const r = C.resumo({ nome: 'X', simbolo: 'XX', mcap: 21900, series: { taxas, token } }, 30);
  const t = C.leitura(r);
  assert.match(t, /cresceram 100% nos últimos 30 dias/);
  assert.match(t, /Quem tem XX recebe 10% das taxas/);
  assert.match(t, /30 anos/);
  assert.doesNotMatch(t, /compr|vend/i);
  const semToken = C.resumo({ nome: 'Y', simbolo: 'YY', mcap: 5, series: { taxas, token: C.limpaSerie(serie.map(([t]) => [t, 0])) } }, 30);
  assert.match(C.leitura(semToken), /não recebe parte das taxas/);
});

test('média de 7 dias', () => {
  const m = C.media7(serie);
  assert.equal(m.length, 54);
  assert.equal(m[0][1], 10);
  assert.equal(m[m.length - 1][1], 20);
});

test('catálogo: pai com token, solto sem pai, sem rede nem corretora', () => {
  const lite = {
    parentProtocols: [{ id: 'parent#uniswap', name: 'Uniswap', symbol: 'UNI', gecko_id: 'uniswap', mcap: 3e9 },
      { id: 'parent#semtoken', name: 'Sem', mcap: 0 }],
    protocols: [
      { name: 'Uniswap V3', parentProtocol: 'parent#uniswap', tvl: 2e9 },
      { name: 'Uniswap V4', parentProtocol: 'parent#uniswap', tvl: 1e9 },
      { name: 'Orca DEX Solo', geckoId: 'orca', symbol: 'ORCA', mcap: 7e7, tvl: 2e8, category: 'Dexs' },
      { name: 'Bitcoin', geckoId: 'bitcoin', symbol: 'BTC', mcap: 1e12, category: 'Chain' }
    ]
  };
  const c = C.catalogo(lite);
  assert.deepEqual(c.map((x) => x.slug), ['uniswap', 'orca-dex-solo']);
  assert.equal(c[0].tvl, 3e9);
});
