/* node --test Ferramentas/scanner-pools/capital-dex.test.cjs
   Conta do bloco "Onde o capital rende mais" (capital-dex.js). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./capital-dex.js');

const lite = {
  parentProtocols: [{ id: 'parent#pancakeswap', name: 'PancakeSwap' }, { id: 'parent#uniswap', name: 'Uniswap' }],
  protocols: [
    { defillamaId: '1', name: 'PancakeSwap AMM V3', parentProtocol: 'parent#pancakeswap', category: 'Dexs',
      chainTvls: { BSC: { tvl: 1000e6 }, 'BSC-staking': { tvl: 500e6 }, Base: { tvl: 5e6 } } },
    { defillamaId: '2', name: 'Uniswap V3', parentProtocol: 'parent#uniswap', category: 'Dexs',
      chainTvls: { 'OP Mainnet': { tvl: 40e6 }, Ethereum: { tvl: 100e6 } } },
    { defillamaId: '3', name: 'Uniswap V4', parentProtocol: 'parent#uniswap', category: 'Dexs',
      chainTvls: { Ethereum: { tvl: 100e6 } } },
    { defillamaId: '4', name: 'Aave', category: 'Lending', chainTvls: { Ethereum: { tvl: 9e9 } } }
  ]
};
const dexs = { protocols: [
  { defillamaId: '1', breakdown24h: { bsc: { 'PancakeSwap AMM V3': 200e6 }, base: { 'PancakeSwap AMM V3': 9e6 } } },
  { defillamaId: '2', breakdown24h: { optimism: { 'Uniswap V3': 20e6 }, ethereum: { 'Uniswap V3': 150e6 } } },
  { defillamaId: '3', breakdown24h: { ethereum: { 'Uniswap V4': 50e6 } } }
] };
const lp = { protocols: [
  { defillamaId: '1', breakdown24h: { bsc: { x: 50e3 } } },
  { defillamaId: '2', breakdown24h: { ethereum: { x: 30e3 } } },
  { defillamaId: '3', breakdown24h: { ethereum: { x: 10e3 } } }
] };
const R = C.agrega(lite, dexs, lp);
const acha = (dex, rede) => R.find((l) => l.dex === dex && l.rede === rede);

test('junta as versões da mesma DEX pelo nome do protocolo-pai', () => {
  const u = acha('Uniswap', 'Ethereum');
  assert.equal(u.tvl, 200e6);
  assert.equal(u.vol, 200e6);
  assert.equal(u.lp, 40e3);
});

test('razão = volume ÷ TVL; por US$ 1.000 = taxa do LP ÷ TVL × 1.000; ao ano × 365', () => {
  const p = acha('PancakeSwap', 'BSC');
  assert.equal(p.razao, 0.2);
  assert.ok(Math.abs(p.por1000 - 0.05) < 1e-12);
  assert.ok(Math.abs(p.apr - 1.825) < 1e-9);
});

test('TVL de staking não conta e rede com nome diferente casa (OP Mainnet = optimism)', () => {
  assert.equal(acha('PancakeSwap', 'BSC').tvl, 1000e6);
  assert.equal(acha('Uniswap', 'OP Mainnet').vol, 20e6);
});

test('sem dado de taxa para o LP fica vazio, não zero', () => {
  const op = acha('Uniswap', 'OP Mainnet');
  assert.equal(op.lp, 0);
  assert.equal(op.por1000, null);
  const semFonte = C.agrega(lite, dexs, null).find((l) => l.dex === 'Uniswap' && l.rede === 'Ethereum');
  assert.equal(semFonte.lp, null);
  assert.equal(semFonte.apr, null);
});

test('corta TVL abaixo de US$ 10 mi e o que não é DEX', () => {
  assert.equal(acha('PancakeSwap', 'Base'), undefined);
  assert.equal(R.some((l) => l.dex === 'Aave'), false);
});

test('ordena pela razão, maior primeiro', () => {
  for (let i = 1; i < R.length; i++) assert.ok(R[i - 1].razao >= R[i].razao);
});
