import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMotor, CHAVES_GRAVAVEIS } from './motor.mjs';

function binance(m) {
  const w = m.carteiras.create({ name: 'Binance', type: 'global' });
  m.hold.actions.createAsset({ nome: 'Pyth Network', ticker: 'PYTH', preco_atual: 0.0867 });
  const id = m.hold.state.ativos.find((a) => a.ticker === 'PYTH').id;
  const r = m.hold.actions.executeBuy({ ativo_id: id, quantidade: 92.7072, preco: 0.0549, taxa: 0.005095, data: '2026-09-12', walletId: w.id, cobrirFalta: true });
  return { w, id, r };
}

test('motor vazio cria carteira e compra como o site, e só as três chaves mudam', () => {
  const m = criarMotor({});
  const { w, id, r } = binance(m);
  assert.equal(r.error, undefined);
  const pos = m.hold.get.positionOf(id, w.id);
  assert.equal(pos.quantidade, 92.7072);
  assert.equal(Math.round(pos.preco_medio * 1e6) / 1e6, 0.054955);
  assert.equal(m.caixa.saldo(w.id), 0);
  assert.deepEqual(Object.keys(m.alteracoes()).sort(), [...CHAVES_GRAVAVEIS].sort());
});

test('motor semeado lê o estado anterior e só reporta o que mudou', () => {
  const m1 = criarMotor({});
  binance(m1);
  const brutos = m1.alteracoes();
  const m2 = criarMotor(brutos);
  assert.equal(m2.carteiras.all().find((w) => w.name === 'Binance').type, 'global');
  assert.deepEqual(m2.alteracoes(), {});
  const w = m2.carteiras.all().find((x) => x.name === 'Binance');
  m2.caixa.registrar({ tipo: 'deposito', valorUSD: 43.98, ativo: 'USDT', walletId: w.id, data: '2026-10-15' });
  assert.deepEqual(Object.keys(m2.alteracoes()), ['atlas.caixa.v1']);
  assert.equal(m2.caixa.saldo(w.id), 43.98);
});

test('instâncias não vazam estado entre si', () => {
  const a = criarMotor({});
  a.carteiras.create({ name: 'Só na A', type: 'global' });
  const b = criarMotor({});
  assert.equal(b.carteiras.all().some((w) => w.name === 'Só na A'), false);
});

test('chave fora da lista é ignorada na entrada', () => {
  const m = criarMotor({ 'atlas.outra.v1': '{"x":1}' });
  assert.deepEqual(m.alteracoes(), {});
});
