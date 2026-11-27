/* node --test Ferramentas/scanner-pools/eficiencia.test.cjs
   Conta da aba Eficiência (eficiencia.js): volume 24h ÷ TVL por plataforma e por rede. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./eficiencia.js');

const lite = {
  parentProtocols: [{ id: 'parent#pancakeswap', name: 'PancakeSwap' }, { id: 'parent#uniswap', name: 'Uniswap' }],
  protocols: [
    { defillamaId: '1', name: 'PancakeSwap AMM V3', parentProtocol: 'parent#pancakeswap', category: 'Dexs',
      chainTvls: { BSC: { tvl: 1000e6 }, 'BSC-staking': { tvl: 500e6 }, Base: { tvl: 5e6 } } },
    { defillamaId: '2', name: 'Uniswap V3', parentProtocol: 'parent#uniswap', category: 'Dexs',
      chainTvls: { 'OP Mainnet': { tvl: 40e6 }, Ethereum: { tvl: 100e6 } } },
    { defillamaId: '3', name: 'Uniswap V4', parentProtocol: 'parent#uniswap', category: 'Dexs',
      chainTvls: { Ethereum: { tvl: 100e6 } } },
    { defillamaId: '5', name: 'Orca', category: 'Dexs', chainTvls: { Solana: { tvl: 200e6 } } },
    { defillamaId: '6', name: 'Miuda', category: 'Dexs', chainTvls: { Solana: { tvl: 2e6 } } },
    { defillamaId: '4', name: 'Aave', category: 'Lending', chainTvls: { Ethereum: { tvl: 9e9 } } }
  ]
};
const dexs = { protocols: [
  { defillamaId: '1', breakdown24h: { bsc: { 'PancakeSwap AMM V3': 200e6 }, base: { 'PancakeSwap AMM V3': 9e6 } } },
  { defillamaId: '2', breakdown24h: { optimism: { 'Uniswap V3': 20e6 }, ethereum: { 'Uniswap V3': 150e6 } } },
  { defillamaId: '3', breakdown24h: { ethereum: { 'Uniswap V4': 50e6 } } },
  { defillamaId: '5', breakdown24h: { solana: { Orca: 120e6 } } },
  { defillamaId: '6', breakdown24h: { solana: { Miuda: 50e6 } } }
] };
const L = E.agrega(lite, dexs);
const P = E.ranking(L, 'dex'), R = E.ranking(L, 'rede');
const acha = (lista, nome) => lista.find((x) => x.nome === nome);

test('junta as versões da plataforma pelo protocolo-pai e soma as redes', () => {
  const u = acha(P, 'Uniswap');
  assert.equal(u.tvl, 240e6);
  assert.equal(u.vol, 220e6);
});

test('razão = volume 24h ÷ TVL; staking não entra no TVL', () => {
  const p = acha(P, 'PancakeSwap');
  assert.equal(p.tvl, 1005e6);
  assert.ok(Math.abs(p.razao - 209e6 / 1005e6) < 1e-12);
});

test('rede com nome diferente nas duas fontes casa (OP Mainnet = optimism)', () => {
  assert.equal(L.find((l) => l.rede === 'OP Mainnet').vol, 20e6);
});

test('por rede soma todas as plataformas da rede', () => {
  assert.equal(acha(R, 'Solana').tvl, 202e6);
  assert.equal(acha(R, 'Solana').vol, 170e6);
});

test('fica de fora: TVL abaixo de US$ 50 mi e o que não é DEX', () => {
  assert.equal(acha(P, 'Miuda'), undefined);
  assert.equal(acha(R, 'OP Mainnet'), undefined);
  assert.equal(acha(P, 'Aave'), undefined);
});

test('ordena pela razão, maior primeiro, e corta no limite', () => {
  assert.equal(P[0].nome, 'Uniswap');
  for (let i = 1; i < P.length; i++) assert.ok(P[i - 1].razao >= P[i].razao);
  assert.equal(E.ranking(L, 'dex', 2).length, 2);
});
