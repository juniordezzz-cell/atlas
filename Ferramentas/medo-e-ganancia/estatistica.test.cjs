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

/* ── aba Agora ── */
test('maxMovel acha o topo dentro da janela', () => {
  const P = [1, 5, 3, 2, 4, 1];
  assert.deepEqual(E.maxMovel(P, 3), [0, 1, 1, 1, 4, 4]);
});

test('situacao mede a queda desde o topo de 90 dias', () => {
  const P = Array.from({ length: 400 }, (_, i) => (i === 350 ? 200 : 100));
  const s = E.situacao(P, 1000);
  assert.equal(s.topo90.preco, 200);
  assert.equal(s.topo90.dias, 49);
  assert.equal(s.topo90.queda, -0.5);
  assert.equal(s.topo365.dia, 1350);
});

test('quedas conta a recuperação e a queda que ainda não voltou', () => {
  const P = [100, 85, 80, 95, 101, 100, 70, 60];
  const ev = E.quedas(P, 0, 0.1, 90);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].dia, 1);
  assert.equal(ev[0].voltou, 3, 'do dia 1 até o dia 4');
  assert.ok(Math.abs(ev[0].pior - (80 / 85 - 1)) < 1e-9);
  assert.equal(ev[1].aberta, true);
  assert.equal(ev[1].topo, 101);
});

test('analogos junta dias parecidos e mede o tempo até o alvo', () => {
  // 365 dias em 100, depois cai a 50 (-50%), volta a 80, cai de novo a 50 e fica
  const P = Array(365).fill(100).concat([50, 50, 60, 80, 80], Array(30).fill(80), [50, 50]);
  const r = E.analogos(P, 0, () => 10, { alvoRel: 1.5, usarMedo: true, limiar: 25, tolerancia: 0.05 });
  assert.equal(r.length, 1, 'a queda que encosta em hoje é a situação atual e não entra');
  assert.equal(r[0].dia, 365);
  assert.equal(r[0].diasNaZona, 2);
  assert.equal(r[0].alvo, 3, '50 -> 75 (alvo +50%) no dia 368');
  assert.equal(r[0].mais20, 2);
  assert.equal(r[0].pior, 0);
});

test('analogos com usarMedo ignora dias sem medo', () => {
  const P = Array(365).fill(100).concat([50, 50], Array(20).fill(90), [50, 50]);
  const r = E.analogos(P, 0, () => 60, { alvoRel: 1.2, usarMedo: true, limiar: 25 });
  assert.equal(r.length, 0);
  const r2 = E.analogos(P, 0, () => 60, { alvoRel: 1.2, usarMedo: false, limiar: 25 });
  assert.equal(r2.length, 1);
});

test('cenario: um ciclo por queda, até voltar ao topo', () => {
  // topo 100; cai a 50 (dia 365), volta a 100 (dia 400); sobe a 200 e cai a 100 (queda atual, hoje)
  const P = Array(365).fill(100).concat(Array(35).fill(50), Array(30).fill(100), Array(30).fill(200), Array(30).fill(100));
  const r = E.cenario(P, 0, () => 10, { usarMedo: true, limiar: 25, tolerancia: 0.05, alvoRel: 1.5 });
  assert.equal(r.length, 2);
  assert.equal(r[0].dia, 365);
  assert.equal(r[0].voltou, 35);
  assert.equal(r[0].momentos, 35, 'todos os dias a 50 antes da volta são o mesmo ciclo');
  assert.equal(r[0].atual, false);
  assert.equal(r[0].alvo, 35, '50 -> 75 só quando volta a 100');
  assert.equal(r[1].atual, true, 'a queda de hoje fica marcada');
  assert.equal(r[1].voltou, null);
});

test('cenario: queda que começa nos últimos dias não vira linha', () => {
  const P = Array(400).fill(100).concat([50, 50, 50]);
  const r = E.cenario(P, 0, () => 10, { usarMedo: true, limiar: 25 });
  assert.equal(r.length, 0);
});
