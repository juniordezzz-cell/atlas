/* ATLAS · Ferramentas/medo-e-ganancia/estatistica.test.cjs
       node --test Ferramentas/medo-e-ganancia/estatistica.test.cjs */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./estatistica.js');

/* série de mentira: dia -> valor */
const de = (mapa) => (d) => (d in mapa ? mapa[d] : null);
const linha = (n, f) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, f(i)]));

test('resumo: mediana, acerto e extremos', () => {
  const r = E.resumo([-0.5, 0.1, 0.2, 0.3, 1]);
  assert.equal(r.n, 5);
  assert.equal(r.med, 0.2);
  assert.equal(r.win, 0.8);
  assert.equal(r.min, -0.5);
  assert.equal(r.max, 1);
  assert.equal(E.resumo([]), null);
});

test('retornos respeita o fim válido e pula dia sem índice', () => {
  const preco = de(linha(10, (i) => 100 + i * 10));
  const indice = de({ 0: 10, 1: 20, 3: 30, 8: 40 });
  const r = E.retornos(preco, indice, 0, 9, 2, 9);
  assert.deepEqual(r.map((x) => x[0]), [0, 1, 3], 'dia 8 + 2 passa do fim; dia 2 não tem índice');
  assert.ok(Math.abs(r[0][2] - 0.2) < 1e-9);
});

test('episodios junta dias com folga e descarta ondas curtas', () => {
  const v = { 0: 10, 1: 12, 2: 50, 5: 20, 30: 5, 31: 6 };
  const indice = de(Object.assign(linha(40, () => 60), v));
  const eps = E.episodios(indice, 0, 39, 25, 10, 3);
  assert.equal(eps.length, 1, 'a onda de 2 dias (30-31) fica de fora');
  assert.equal(eps[0].start, 0);
  assert.equal(eps[0].end, 5);
  assert.equal(eps[0].days, 3);
  assert.equal(eps[0].minV, 10);
  assert.deepEqual(eps[0].list, [0, 1, 5]);
});

test('depoisDaOnda acha o fundo e a queda extra', () => {
  const preco = de(linha(800, (i) => (i < 50 ? 100 - i : 50 + i)));
  const r = E.depoisDaOnda(preco, { start: 0, end: 3 }, 799);
  assert.equal(r.mi, 49);
  assert.ok(Math.abs(r.dd - (-0.49)) < 1e-9);
  assert.equal(r.toBottom, 49);
  assert.equal(r.r730, (50 + 730) / 100 - 1);
});

test('entrada: 1º dia, último dia e média da onda', () => {
  const preco = de({ 1: 10, 2: 20, 4: 30 });
  const e = { start: 1, end: 4, list: [1, 2, 4] };
  assert.deepEqual(E.entrada(preco, e, 'first'), { d0: 1, P: 10 });
  assert.deepEqual(E.entrada(preco, e, 'last'), { d0: 4, P: 30 });
  assert.deepEqual(E.entrada(preco, e, 'avg'), { d0: 4, P: 20 });
});

test('marcos: dias até cada múltiplo, pico e pior momento antes do pico', () => {
  const preco = de({ 0: 100, 1: 80, 2: 160, 3: 210, 4: 150, 5: 320 });
  const m = E.marcos(preco, 0, 100, 5);
  assert.equal(m.hit[1.5], 2);
  assert.equal(m.hit[2], 3);
  assert.equal(m.hit[3], 5);
  assert.equal(m.hit[5], undefined);
  assert.equal(m.mx, 3.2);
  assert.equal(m.mxd, 5);
  assert.equal(m.mn, 0.8);
  assert.equal(m.mnd, 1);
  assert.equal(m.cur, 3.2);
});

test('simularAportes: fixo, reserva e calibrado com preço constante', () => {
  const preco = () => 10;
  const indice = (d) => (d === 7 ? 10 : d === 14 ? 90 : 50);
  const r = E.simularAportes({ preco, indice, a: 0, b: 21, passo: 7, aporte: 100, mult: 2, limiar: 25, fimCompra: 21 });
  const s = r.estrategias;
  assert.equal(s.fixo.inv, 400);
  assert.equal(s.fixo.val, 400);
  assert.equal(s.res.inv, 400);
  assert.equal(s.res.cash, 200, 'gastou o caixa no dia 7 e acumulou de novo');
  assert.equal(s.cal.inv, 100 + 200 + 50 + 100);
  assert.ok(s.real.sold > 0, 'vendeu 3% no dia de índice 90');
  assert.equal(s.fixo.mult, 1);
});

test('simularAportes: depois do fim da compra o aporte vira caixa', () => {
  const preco = (d) => (d <= 7 ? 10 : 0.001);
  const r = E.simularAportes({ preco, indice: () => 50, a: 0, b: 21, passo: 7, aporte: 100, mult: 2, limiar: 25, fimCompra: 7 });
  assert.equal(r.estrategias.fixo.cash, 200);
  assert.equal(r.estrategias.fixo.q, 20);
});
