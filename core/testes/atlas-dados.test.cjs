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

test('precos com fontes limitadas não sai delas e pode não guardar', async () => {
  const arm = memoria();
  const { D, http } = montar([['coins.llama.fi/prices/current', { coins: {} }], ['binance', [{ symbol: 'JUPUSDT', price: '0.2' }]]], { armazenamento: arm });
  const r = await D.precos([{ id: 'jupiter-exchange-solana', sym: 'JUP' }], { fontes: ['defillama'], guardar: false });
  assert.equal(r.precos['jupiter-exchange-solana'], undefined);
  assert.equal(conta(http, 'binance'), 0);
  await montar([['coins.llama.fi/prices/current', { coins: { 'coingecko:solana': { price: 1 } } }]], { armazenamento: arm }).D.precos([{ id: 'solana', sym: 'SOL' }], { guardar: false });
  assert.equal(arm.getItem('atlas.dados.ultimo.v1'), null, 'guardar:false não grava');
});

test('variacoes24h pela DefiLlama', async () => {
  const { D } = montar([['coins.llama.fi/percentage', { coins: { 'coingecko:solana': -1.5 } }]]);
  assert.deepEqual(await D.variacoes24h(['solana', 'bitcoin']), { solana: -1.5 });
});

test('velas tenta a DefiLlama antes da CoinGecko', async () => {
  const { D, http } = montar([
    ['binance', ERRO(400)],
    ['coins.llama.fi/chart', { coins: { 'coingecko:x': { prices: [{ timestamp: 1, price: 1 }, { timestamp: 2, price: 2 }, { timestamp: 3, price: 3 }] } } }]
  ]);
  const r = await D.velas('x', 'XYZ', '1h', 100);
  assert.equal(r.fonte, 'DefiLlama');
  assert.equal(conta(http, 'api.coingecko.com'), 0);
});

test('buscar com soRede pula o catálogo', async () => {
  const catalogo = { quando: 1, lista: [['solana', 'SOL', 'Solana', '', 5]] };
  const { D } = montar([['api.coingecko.com/api/v3/search', { coins: [{ id: 'solana-x', symbol: 'solx', name: 'Sol X' }] }]], { catalogo });
  const r = await D.buscar('sol', { soRede: true });
  assert.equal(r[0].id, 'solana-x');
});

test('historico ignora a Binance quando o preço não bate', async () => {
  const k = (c) => [1, '0', '0', '0', String(c)];
  const { D } = montar([
    ['binance', [k(10), k(10), k(10)]],
    ['coins.llama.fi/chart', { coins: { 'coingecko:x': { prices: [{ timestamp: 1, price: 1 }, { timestamp: 2, price: 1 }, { timestamp: 3, price: 1 }] } } }]
  ]);
  const r = await D.historico('x', 'XYZ', 365, 1);
  assert.equal(r.fonte, 'DefiLlama');
});

/* ── velas longas e medo e ganância (ferramenta Medo e Ganância, 14/11) ── */
test('velasLongas pagina a Binance até a última página', async () => {
  const k = (t) => [t, '1', '2', '0.5', '1.5', '0', 0, '100'];
  const { D, http } = montar([['klines', u => {
    const de = +/startTime=(\d+)/.exec(u)[1];
    const n = de === 0 ? 1000 : 10;
    return Array.from({ length: n }, (_, i) => k(de + i * 864e5));
  }]]);
  const r = await D.velasLongas('BTC', '1d', 0);
  assert.equal(r.velas.length, 1010);
  assert.equal(conta(http, 'klines'), 2);
  assert.equal(r.velas[0].v, 100, 'volume em dólar vem do campo 7');
  assert.equal(r.fonte, 'Binance');
});

test('velasLongas recusa stablecoin sem ir à rede', async () => {
  const { D, http } = montar([]);
  await assert.rejects(D.velasLongas('USDT', '1d', 0));
  assert.equal(http.chamadas.length, 0);
});

test('medoGanancia ordena a série e guarda a última boa', async () => {
  const dados = { data: [{ value: '20', timestamp: '1700086400' }, { value: '10', timestamp: '1700000000' }]
    .concat(Array.from({ length: 40 }, (_, i) => ({ value: '50', timestamp: String(1600000000 + i * 86400) }))) };
  const arm = memoria();
  const a = montar([['alternative.me', dados]], { armazenamento: arm });
  const r = await a.D.medoGanancia();
  assert.equal(r.serie[r.serie.length - 1].v, 20);
  assert.ok(r.serie[0].t < r.serie[1].t);
  const b = montar([['alternative.me', ERRO(500)]], { armazenamento: arm });
  const g = await b.D.medoGanancia();
  assert.equal(g.guardado, true);
  assert.equal(g.serie.length, r.serie.length);
});
