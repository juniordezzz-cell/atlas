import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTexto, resolverCarteira, posicoes, saldosCaixa, listarCarteiras, verPosicoes, verCaixa, historico } from './leitura.mjs';
import { ErroUsuario } from './mcp.mjs';

const carteiras = { wallets: [
  { id: 'principal', name: 'Principal', type: 'global' },
  { id: 'w_bin', name: 'Binance', type: 'isolada', module: 'hold' },
  { id: 'w_jrb', name: 'JRB1', type: 'isolada', module: 'hold' },
] };
const hold = {
  ativos: [
    { id: 'a_pyth', ticker: 'PYTH', nome: 'Pyth Network', preco_atual: 0.1 },
    { id: 'a_jup', ticker: 'JUP', nome: 'Jupiter', preco_atual: 0.3 },
    { id: 'a_met', ticker: 'MET', nome: 'Meteora', preco_atual: 0 },
  ],
  carteira: [
    { ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 100, preco_medio: 0.05 },
    { ativo_id: 'a_pyth', walletId: 'w_jrb', quantidade: 20, preco_medio: 0.08 },
    { ativo_id: 'a_jup', quantidade: 10, preco_medio: 0.4 },
    { ativo_id: 'a_met', walletId: 'w_jrb', quantidade: 21, preco_medio: 0.2 },
    { ativo_id: 'a_jup', walletId: 'w_bin', quantidade: 0, preco_medio: 0.4 },
  ],
  vendas: [{ ativo_id: 'a_pyth', walletId: 'w_bin', resultado: 2.5 }],
  operacoes: [
    { id: 'op1', tipo: 'buy', ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 100, preco: 0.05, valorCaixa: 5, data: '2026-10-01', eventos: ['cx2'] },
    { id: 'op2', tipo: 'sell', ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 50, preco: 0.1, valorCaixa: 5, data: '2026-10-10', eventos: [] },
  ],
};
const caixa = [
  { id: 'cx1', data: '2026-09-30', tipo: 'deposito', valorUSD: 100, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx2', data: '2026-10-01', tipo: 'aporte', valorUSD: 5, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx3', data: '2026-10-05', tipo: 'transferencia', valorUSD: 20, ativo: 'USDT', walletId: 'w_bin', contraWalletId: 'w_jrb' },
  { id: 'cx4', data: '2026-10-06', tipo: 'saque', valorUSD: -3, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx5', data: '2026-10-07', tipo: 'inventado', valorUSD: 9, walletId: 'w_bin' },
];

test('normaliza acentos, espaços e caixa', () => {
  assert.equal(normalizarTexto('  Binânce '), 'binance');
});

test('resolve carteira por nome ou id com qualquer grafia', () => {
  assert.equal(resolverCarteira(carteiras, 'binance').id, 'w_bin');
  assert.equal(resolverCarteira(carteiras, ' JRB1 ').id, 'w_jrb');
  assert.equal(resolverCarteira(carteiras, 'Binânce').id, 'w_bin');
  assert.equal(resolverCarteira(carteiras, 'w_jrb').id, 'w_jrb');
  assert.equal(resolverCarteira(carteiras, undefined), null);
  assert.equal(resolverCarteira(carteiras, '  '), null);
  assert.throws(() => resolverCarteira(carteiras, 'OKX'), (e) => e instanceof ErroUsuario && /Principal, Binance, JRB1/.test(e.message));
  const duplicada = { wallets: [{ id: 'a', name: 'X' }, { id: 'b', name: 'x' }] };
  assert.throws(() => resolverCarteira(duplicada, 'x'), /Use o id: a, b/);
  assert.equal(resolverCarteira(null, 'principal').id, 'principal');
});

test('posições: sem walletId é principal; quantidade zero some; sem preço não vira zero', () => {
  const p = posicoes(hold);
  assert.equal(p.length, 4);
  assert.equal(p.find((x) => x.ticker === 'JUP').walletId, 'principal');
  const met = p.find((x) => x.ticker === 'MET');
  assert.equal(met.preco, null);
  assert.equal(met.valor, null);
  assert.equal(met.resultado, null);
  assert.deepEqual(posicoes(undefined), []);
});

test('caixa soma eventos válidos com o efeito de cada tipo', () => {
  assert.deepEqual(saldosCaixa(caixa), { w_bin: 75, w_jrb: 20 });
  assert.deepEqual(saldosCaixa(null), {});
});

test('ver_posicoes por carteira e consolidado, com sem-preço fora do total', () => {
  const bin = verPosicoes({ carteiras, hold }, { carteira: 'binance' });
  assert.equal(bin.dados.total, 10);
  assert.equal(bin.dados.realizado, 2.5);
  assert.match(bin.texto, /PYTH: 100 · preço médio \$ 0,05 · valor \$ 10,00 · resultado \+\$ 5,00/);
  const tudo = verPosicoes({ carteiras, hold }, {});
  const pyth = tudo.dados.posicoes.find((x) => x.ticker === 'PYTH');
  assert.equal(pyth.quantidade, 120);
  assert.equal(Math.round(pyth.precoMedio * 10000) / 10000, 0.055);
  assert.deepEqual(pyth.carteiras, ['w_bin', 'w_jrb']);
  assert.deepEqual(tudo.dados.semPreco, ['MET']);
  assert.equal(tudo.dados.total, 15);
  assert.match(tudo.texto, /Fora do total por falta de preço: MET/);
  const pythSo = verPosicoes({ carteiras, hold }, { token: 'pyth' });
  assert.deepEqual(pythSo.dados.posicoes.map((x) => x.ticker), ['PYTH']);
  assert.match(verPosicoes({ carteiras, hold: null }, { carteira: 'JRB1' }).texto, /Nenhuma posição no Hold na JRB1/);
});

test('ver_caixa mostra saldo em dólar e últimos movimentos da carteira', () => {
  const r = verCaixa({ carteiras, caixa }, { carteira: 'JRB1' });
  assert.equal(r.dados.total, 20);
  assert.match(r.texto, /JRB1: \$ 20,00/);
  assert.match(r.texto, /2026-10-05 · Transferência · USDT · \$ 20,00 \(Binance → JRB1\)/);
  const todas = verCaixa({ carteiras, caixa }, {});
  assert.deepEqual(todas.dados.saldos, { principal: 0, w_bin: 75, w_jrb: 20 });
});

test('historico junta Hold e caixa, sem repetir o aporte de uma compra', () => {
  const r = historico({ carteiras, hold, caixa }, { carteira: 'Binance' });
  assert.deepEqual(r.dados.itens.map((i) => i.data + ' ' + i.rotulo), [
    '2026-10-10 Venda', '2026-10-05 Transferência', '2026-10-01 Compra', '2026-09-30 Depósito',
  ]);
  assert.equal(historico({ carteiras, hold, caixa }, { token: 'PYTH', desde: '2026-10-05' }).dados.itens.length, 1);
  assert.equal(historico({ carteiras, hold, caixa }, { limite: 2 }).dados.itens.length, 2);
  assert.throws(() => historico({ carteiras, hold, caixa }, { desde: '05/10/2026' }), ErroUsuario);
  assert.throws(() => historico({ carteiras, hold, caixa }, { limite: 0 }), ErroUsuario);
  assert.equal(historico({ carteiras, hold: null, caixa: null }, {}).texto, 'Nenhuma operação encontrada com esses filtros.');
});

test('listar_carteiras resume caixa e Hold por carteira', () => {
  const r = listarCarteiras({ carteiras, hold, caixa });
  const jrb = r.dados.carteiras.find((w) => w.id === 'w_jrb');
  assert.deepEqual({ caixa: jrb.caixa, hold: jrb.hold, posicoes: jrb.posicoes }, { caixa: 20, hold: 2, posicoes: 2 });
  assert.match(r.texto, /Binance \(id w_bin\): caixa \$ 75,00 · Hold \$ 10,00 em 1 posição\(ões\)/);
  assert.equal(listarCarteiras({ carteiras: null, hold: null, caixa: null }).dados.carteiras[0].id, 'principal');
});
