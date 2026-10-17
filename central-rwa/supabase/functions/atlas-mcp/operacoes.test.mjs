import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMotor } from './motor.mjs';
import { criarCarteira, deposito, saque, compra, venda, hojeBrasil } from './operacoes.mjs';
import { ErroUsuario } from './mcp.mjs';

const AGORA = Date.parse('2026-10-16T02:00:00Z'); // 23:00 de 15/10 em São Paulo
const novo = () => { const m = criarMotor({}); criarCarteira(m, { nome: 'Binance' }, AGORA); return m; };

test('hoje é calculado no fuso de São Paulo', () => {
  assert.equal(hojeBrasil(AGORA), '2026-10-15');
});

test('cria carteira global e recusa nome repetido ou vazio', () => {
  const m = criarMotor({});
  const r = criarCarteira(m, { nome: 'Binance' }, AGORA);
  assert.equal(r.dados.carteira.tipo, 'global');
  assert.match(r.resumo, /Criar a carteira Binance \(global\)/);
  assert.throws(() => criarCarteira(m, { nome: ' binance ' }, AGORA), /Já existe uma carteira chamada/);
  assert.throws(() => criarCarteira(m, { nome: '' }, AGORA), ErroUsuario);
});

test('depósito de stablecoin usa a quantidade como valor; outro token exige valor_usd', () => {
  const m = novo();
  const r = deposito(m, { carteira: 'binance', token: 'usdt', quantidade: 43.98, data: '2026-10-15' }, AGORA);
  assert.match(r.resumo, /Depósito de 43,98 USDT \(\$ 43,98\) no caixa da Binance, em 2026-10-15/);
  const w = m.carteiras.all().find((x) => x.name === 'Binance');
  assert.equal(m.caixa.saldo(w.id), 43.98);
  assert.throws(() => deposito(m, { carteira: 'Binance', token: 'SOL', quantidade: 1 }, AGORA), /valor_usd/);
  assert.throws(() => deposito(m, { carteira: 'OKX', token: 'USDT', quantidade: 1 }, AGORA), /Não encontrei a carteira "OKX"/);
});

test('saque recusa caixa insuficiente', () => {
  const m = novo();
  deposito(m, { carteira: 'Binance', token: 'USDT', quantidade: 10 }, AGORA);
  assert.throws(() => saque(m, { carteira: 'Binance', token: 'USDT', quantidade: 11 }, AGORA), /Caixa insuficiente na Binance: há \$ 10,00/);
  assert.match(saque(m, { carteira: 'Binance', token: 'USDT', quantidade: 4 }, AGORA).resumo, /Saque de 4 USDT/);
});

test('compra sem caixa e sem cobrir_falta é recusada com o valor que falta', () => {
  const m = novo();
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'JUP', quantidade: 13.986, preco: 0.365, taxa_usd: 0.00511, data: '2026-09-27' }, AGORA), /Falta \$ 5,11 no caixa da Binance/);
});

test('compra com cobrir_falta cadastra o ativo, deposita na data e acerta o preço médio', () => {
  const m = novo();
  const r = compra(m, { carteira: 'Binance', token: 'morpho', nome: 'Morpho', quantidade: 3.996, preco: 2.683, taxa_usd: 0.010732, data: '2026-09-27', cobrir_falta: true }, AGORA);
  assert.match(r.resumo, /MORPHO é novo no Hold e será cadastrado/);
  assert.match(r.resumo, /Depósito automático de \$ 10,73/);
  compra(m, { carteira: 'Binance', token: 'MORPHO', quantidade: 6.54345, preco: 2.682, taxa_usd: 0.0175671, data: '2026-09-27', cobrir_falta: true }, AGORA);
  const a = m.hold.state.ativos.find((x) => x.ticker === 'MORPHO');
  const w = m.carteiras.all().find((x) => x.name === 'Binance');
  const pos = m.hold.get.positionOf(a.id, w.id);
  assert.equal(pos.quantidade, 10.53945);
  assert.equal(Math.round(pos.preco_medio * 1000) / 1000, 2.685);
  assert.equal(m.caixa.saldo(w.id), 0);
});

test('compra usa o caixa existente antes de depositar', () => {
  const m = novo();
  deposito(m, { carteira: 'Binance', token: 'USDT', quantidade: 3 }, AGORA);
  const r = compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 60, preco: 0.08368, data: '2026-09-27', cobrir_falta: true }, AGORA);
  assert.equal(Math.round(r.dados.deposito_automatico * 100) / 100, 2.02);
});

test('datas inválidas ou no futuro são recusadas', () => {
  const m = novo();
  const base = { carteira: 'Binance', token: 'USDT', quantidade: 1 };
  assert.throws(() => deposito(m, { ...base, data: '27/09/2026' }, AGORA), /AAAA-MM-DD/);
  assert.throws(() => deposito(m, { ...base, data: '2026-10-16' }, AGORA), /está no futuro/);
  assert.throws(() => deposito(m, { ...base, data: '2026-02-30' }, AGORA), /AAAA-MM-DD/);
  assert.match(deposito(m, base, AGORA).resumo, /em 2026-10-15/);
});

test('venda por fração devolve ao caixa e informa o resultado', () => {
  const m = novo();
  compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 100, preco: 0.05, data: '2026-09-12', cobrir_falta: true }, AGORA);
  const r = venda(m, { carteira: 'Binance', token: 'pyth', fracao: 0.5, preco: 0.1, data: '2026-10-15' }, AGORA);
  assert.match(r.resumo, /Venda de 50 PYTH a \$ 0,1 na Binance/);
  assert.match(r.resumo, /Resultado \+\$ 2,50/);
  assert.match(r.resumo, /Fica 50 PYTH/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'PYTH', quantidade: 999, preco: 0.1 }, AGORA), /não dá para vender/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'JUP', quantidade: 1, preco: 0.3 }, AGORA), /Não há JUP no Hold/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'PYTH', fracao: 2, preco: 0.1 }, AGORA), /fração/);
});

test('números inválidos viram ErroUsuario', () => {
  const m = novo();
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: -1, preco: 1 }, AGORA), /quantidade precisa ser um número maior que zero/);
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 1, preco: 1, taxa_usd: -1 }, AGORA), /taxa não pode ser negativa/);
  assert.throws(() => compra(m, { carteira: 'Binance', token: '', quantidade: 1, preco: 1 }, AGORA), /ticker/);
});
