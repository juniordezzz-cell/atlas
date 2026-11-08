/* ATLAS · core/testes/atlas-dados.test.cjs
   Testes do roteador de dados (core/atlas-dados.js) com rede falsa.

       node --test core/testes/atlas-dados.test.cjs

   Cada teste monta uma rede de mentira: um mapa de "pedaço de URL" para
   resposta (objeto), erro (status) ou função. Assim dá para fingir uma
   API respondendo, dando limite (429) ou fora do ar. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criar } = require('../atlas-dados.js');

function rede(regras) {
  const chamadas = [];
  return {
    chamadas,
    getJSON(url) {
      chamadas.push(url);
      for (const [pedaco, resp] of regras) {
        if (url.indexOf(pedaco) === -1) continue;
        const r = typeof resp === 'function' ? resp(url) : resp;
        if (r && r.__erro) { const e = new Error('falhou'); e.status = r.__erro; return Promise.reject(e); }
        return Promise.resolve(r);
      }
      const e = new Error('sem regra: ' + url); e.status = 0; return Promise.reject(e);
    }
  };
}
const ERRO = (status) => ({ __erro: status });
function memoria() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m };
}
function montar(regras, extra) {
  const http = rede(regras);
  let t = 1_700_000_000_000;
  const relogio = { agora: () => t, andar: ms => { t += ms; } };
  const D = criar(Object.assign({ http, armazenamento: memoria(), agora: relogio.agora, intervalos: {}, catalogo: { quando: 0, lista: [] } }, extra || {}));
  return { D, http, relogio };
}
const conta = (http, pedaco) => http.chamadas.filter(u => u.indexOf(pedaco) !== -1).length;

/* ── camada de baixo ── */
test('pedir pausa a fonte depois de 429', async () => {
  const { D, http, relogio } = montar([['api.coingecko.com', ERRO(429)]]);
  await assert.rejects(D.pedir('coingecko', 'https://api.coingecko.com/api/v3/ping'));
  const e = await D.pedir('coingecko', 'https://api.coingecko.com/api/v3/ping').catch(x => x);
  assert.equal(e.pausada, true);
  assert.equal(conta(http, 'coingecko'), 1, 'a segunda chamada não sai para a rede');
  relogio.andar(4 * 60 * 1000);
  await assert.rejects(D.pedir('coingecko', 'https://api.coingecko.com/api/v3/ping'));
  assert.equal(conta(http, 'coingecko'), 2, 'depois da pausa, tenta de novo');
});

test('pedir junta pedidos iguais', async () => {
  const { D, http } = montar([['coins.llama.fi', { coins: {} }]]);
  const u = 'https://coins.llama.fi/prices/current/coingecko:solana';
  await Promise.all([D.pedir('defillama', u), D.pedir('defillama', u)]);
  assert.equal(http.chamadas.length, 1);
});

/* ── preço atual ── */
test('precos usa só a DefiLlama quando ela responde tudo', async () => {
  const { D, http } = montar([['coins.llama.fi/prices/current', { coins: {
    'coingecko:solana': { price: 150, timestamp: 1_700_000_000, confidence: 0.99 },
    'coingecko:bitcoin': { price: 70000, timestamp: 1_700_000_000, confidence: 0.99 } } }]]);
  const r = await D.precos([{ id: 'solana', sym: 'SOL' }, { id: 'bitcoin', sym: 'BTC' }]);
  assert.deepEqual(r.precos, { solana: 150, bitcoin: 70000 });
  assert.equal(r.fontes.solana, 'DefiLlama');
  assert.equal(http.chamadas.length, 1);
});

test('precos manda à Binance só quem faltou', async () => {
  const { D, http } = montar([
    ['coins.llama.fi/prices/current', { coins: { 'coingecko:solana': { price: 150, confidence: 0.99 } } }],
    ['binance', u => /JUPUSDT/.test(decodeURIComponent(u)) ? [{ symbol: 'JUPUSDT', price: '0.23' }] : ERRO(400)]
  ]);
  const r = await D.precos([{ id: 'solana', sym: 'SOL' }, { id: 'jupiter-exchange-solana', sym: 'JUP' }]);
  assert.equal(r.precos['jupiter-exchange-solana'], 0.23);
  assert.equal(r.fontes['jupiter-exchange-solana'], 'Binance');
  assert.equal(conta(http, 'api.coingecko.com'), 0, 'CoinGecko nem é chamada');
});

test('precos devolve o último bom quando tudo falha', async () => {
  const arm = memoria();
  const ok = montar([['coins.llama.fi/prices/current', { coins: { 'coingecko:solana': { price: 150, confidence: 0.99 } } }]], { armazenamento: arm });
  await ok.D.precos([{ id: 'solana', sym: 'SOL' }]);
  const fora = montar([], { armazenamento: arm });
  const r = await fora.D.precos([{ id: 'solana', sym: 'SOL' }]);
  assert.equal(r.precos.solana, 150);
  assert.deepEqual(r.salvos, ['solana']);
  assert.ok(r.quando.solana > 0);
});

/* ── câmbio ── */
test('cambio cai para a Binance', async () => {
  const { D } = montar([
    ['open.er-api.com', ERRO(500)],
    ['binance', u => {
      const d = decodeURIComponent(u);
      return [{ symbol: 'USDTBRL', price: '5.5' }, { symbol: 'EURUSDT', price: '1.1' }, { symbol: 'GBPUSDT', price: '1.25' }]
        .filter(x => d.indexOf(x.symbol) !== -1);
    }]
  ]);
  const r = await D.cambio();
  assert.equal(r.fonte, 'Binance');
  assert.equal(r.por.brl, 5.5);
  assert.ok(Math.abs(r.por.eur - 1 / 1.1) < 1e-12);
  assert.ok(Math.abs(r.por.gbp - 1 / 1.25) < 1e-12);
  assert.equal(r.salvo, false);
});

test('cambio devolve o último bom', async () => {
  const arm = memoria();
  await montar([['open.er-api.com', { result: 'success', rates: { BRL: 5.4, EUR: 0.9, GBP: 0.8 } }]], { armazenamento: arm }).D.cambio();
  const r = await montar([], { armazenamento: arm }).D.cambio();
  assert.equal(r.salvo, true);
  assert.equal(r.por.brl, 5.4);
});

/* ── busca ── */
test('buscar acha no catálogo sem rede', async () => {
  const catalogo = { quando: 1, lista: [['solana', 'SOL', 'Solana', '4128/large/solana.png', 5], ['bitcoin', 'BTC', 'Bitcoin', '1/large/bitcoin.png', 1]] };
  const { D, http } = montar([], { catalogo });
  const r = await D.buscar('sol');
  assert.equal(r[0].id, 'solana');
  assert.equal(r[0].fonte, 'catálogo');
  assert.equal(http.chamadas.length, 0);
});

/* ── velas e histórico ── */
test('velas pula a Binance quando o preço não bate', async () => {
  const k = (c) => [1, String(c), String(c), String(c), String(c)];
  const { D } = montar([
    ['binance', [k(10), k(10), k(10)]],
    ['api.coingecko.com', [[1, 1, 1, 1, 1], [2, 1, 1, 1, 1], [3, 1, 1, 1, 1]]]
  ]);
  const r = await D.velas('outro-token', 'XYZ', '1h', 100, 1.0);
  assert.equal(r.fonte, 'CoinGecko');
  assert.equal(r.velas.length, 3);
});

test('historico cai para a DefiLlama', async () => {
  const { D } = montar([
    ['binance', ERRO(400)],
    ['coins.llama.fi/chart', { coins: { 'coingecko:pax-gold': { prices: [{ timestamp: 1, price: 2000 }, { timestamp: 2, price: 2010 }, { timestamp: 3, price: 2020 }] } } }]
  ]);
  const r = await D.historico('pax-gold', 'PAXG', 365);
  assert.equal(r.fonte, 'DefiLlama');
  assert.deepEqual(r.serie[2], { t: 3000, v: 2020 });
});
