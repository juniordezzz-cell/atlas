/* Testes das contas da Calculadora de Market Cap.
   Rodar na raiz: node --test Ferramentas/calculadora-market-cap/calculo.test.cjs
   Gabarito: os números do texto original (SKY × AAVE, CoinGecko out/2026). */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./calculo.js");

const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-9), a + " ≠ " + b);

test("gabarito SKY: valor de mercado hoje e a US$ 1", () => {
  const hoje = C.mcapNoPreco(0.077, 23.4e9);
  perto(hoje, 1.8018e9, 1e3);
  const aUmDolar = C.mcapNoPreco(1, 23.4e9);
  perto(aUmDolar, 23.4e9, 1);
  perto(C.multiplicador(aUmDolar, hoje), 12.987, 0.001);
});

test("gabarito AAVE: 13× e US$ 100 em AAVE", () => {
  perto(160.78 * 13, 2090.14, 0.001);
  const r = C.meuDinheiro(100, 160.78, 1045.07);
  perto(r.tokens, 0.62197, 0.00001);
  perto(r.valorFinal, 650, 0.01);
  perto(r.lucro, 550, 0.01);
  perto(r.lucroPct, 550, 0.01);
});

test("régua: SKY a US$ 1 cabe ~9,45 AAVEs", () => {
  const r = C.regua(23.4e9, [
    { id: "aave", name: "Aave", symbol: "AAVE", marketCap: 2.476e9 },
    { id: "zero", name: "Zero", symbol: "Z", marketCap: 0 }
  ]);
  assert.equal(r.length, 1);
  perto(r[0].vezes, 9.4507, 0.0001);
  assert.deepEqual(C.regua(null, [{ id: "a", marketCap: 1 }]), []);
});

test("precoNoMcap: valer como a Solana", () => {
  perto(C.precoNoMcap(63e9, 23.4e9), 2.6923, 0.0001);
  assert.equal(C.precoNoMcap(63e9, 0), null);
});

/* Critério da CoinGecko, conferido no JUP em 13/10/2026: FDV = preço ×
   oferta TOTAL (6,86 bi), não a máxima (10 bi, desatualizada depois da
   queima). A máxima só entra quando não há total. */
test("oferta usa a total quando existe (JUP: total 6,86 bi, máx. 10 bi)", () => {
  const o = C.oferta({ circulating: 3.32e9, total: 6.86e9, max: 10e9 });
  assert.equal(o.cheia, 6.86e9);
  assert.equal(o.base, "total");
  perto(o.faltaEntrar, 3.54e9, 1);
  perto(o.pctCirculando, 0.48397, 0.00001);
  assert.equal(o.semTeto, false);
  assert.equal(o.teto, 10e9);
  assert.equal(o.inconsistente, false);
});

test("oferta sem total usa a máxima", () => {
  const o = C.oferta({ circulating: 3e9, total: null, max: 10e9 });
  assert.equal(o.cheia, 10e9);
  assert.equal(o.base, "max");
  assert.equal(o.faltaEntrar, 7e9);
  perto(o.pctCirculando, 0.3);
});

test("oferta sem teto usa a total (ETH)", () => {
  const o = C.oferta({ circulating: 120e6, total: 120e6, max: null });
  assert.equal(o.base, "total");
  assert.equal(o.semTeto, true);
  assert.equal(o.teto, null);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("oferta sem total nem máximo", () => {
  const o = C.oferta({ circulating: 5e6, total: null, max: null });
  assert.equal(o.cheia, null);
  assert.equal(o.base, null);
  assert.equal(o.faltaEntrar, null);
  assert.equal(o.pctCirculando, null);
  assert.equal(o.circulante, 5e6);
});

test("oferta com circulação zero ou ausente", () => {
  const o = C.oferta({ circulating: 0, total: 1e9, max: 1e9 });
  assert.equal(o.circulante, null);
  assert.equal(o.cheia, 1e9);
  assert.equal(o.pctCirculando, null);
  assert.equal(C.oferta(null).circulante, null);
});

test("oferta inconsistente: circulação maior que a cheia vira 100%", () => {
  const o = C.oferta({ circulating: 12e9, total: 10e9, max: 10e9 });
  assert.equal(o.inconsistente, true);
  assert.equal(o.cheia, 12e9);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("contas nunca devolvem NaN/Infinity", () => {
  assert.equal(C.mcapNoPreco(NaN, 1), null);
  assert.equal(C.mcapNoPreco(1, Infinity), null);
  assert.equal(C.mcapNoPreco(-1, 10), null);
  assert.equal(C.multiplicador(10, 0), null);
  assert.equal(C.meuDinheiro(100, 0, 1), null);
  assert.equal(C.meuDinheiro(0, 1, 1), null);
});

const LISTA = [
  { id: "bitcoin", name: "Bitcoin", marketCap: 2000e9 },
  { id: "ethereum", name: "Ethereum", marketCap: 500e9 },
  { id: "solana", name: "Solana", marketCap: 63e9 },
  { id: "jupiter", name: "Jupiter", marketCap: 1.5e9 },
  { id: "aave", name: "Aave", marketCap: 2.476e9 }
];

test("ranking: entre dois vizinhos, ignorando o próprio token", () => {
  const r = C.posicaoNoRanking(10e9, LISTA, "jupiter");
  assert.equal(r.posicao, 4);
  assert.equal(r.acima.id, "solana");
  assert.equal(r.abaixo.id, "aave");
  assert.equal(r.maiorQueTodos, false);
  assert.equal(r.foraDaLista, false);
  assert.equal(r.tamanhoLista, 4);
});

test("ranking: maior que o 1º", () => {
  const r = C.posicaoNoRanking(5000e9, LISTA);
  assert.equal(r.posicao, 1);
  assert.equal(r.maiorQueTodos, true);
  assert.equal(r.acima, null);
  assert.equal(r.abaixo.id, "bitcoin");
});

test("ranking: abaixo do último da lista", () => {
  const r = C.posicaoNoRanking(1e6, LISTA, "jupiter");
  assert.equal(r.foraDaLista, true);
  assert.equal(r.posicao, null);
  assert.equal(r.acima.id, "aave");
  assert.equal(r.abaixo, null);
  assert.equal(C.posicaoNoRanking(null, LISTA), null);
  assert.equal(C.posicaoNoRanking(1e9, []), null);
});

test("lerNumero entende o jeito brasileiro de digitar", () => {
  assert.equal(C.lerNumero("1"), 1);
  assert.equal(C.lerNumero("0,5"), 0.5);
  assert.equal(C.lerNumero("0.077"), 0.077);
  assert.equal(C.lerNumero("1.000"), 1000);
  assert.equal(C.lerNumero("1.234.567,89"), 1234567.89);
  assert.equal(C.lerNumero("1,234.5"), 1234.5);
  assert.equal(C.lerNumero("US$ 100"), 100);
  assert.equal(C.lerNumero("$2,50"), 2.5);
  assert.equal(C.lerNumero("10 bi"), 10e9);
  assert.equal(C.lerNumero("2,5 mi"), 2.5e6);
  assert.equal(C.lerNumero("3 tri"), 3e12);
  assert.equal(C.lerNumero("50k"), 50e3);
  assert.equal(C.lerNumero("50 mil"), 50e3);
});

test("lerNumero recusa o que não é número positivo", () => {
  assert.equal(C.lerNumero(""), null);
  assert.equal(C.lerNumero("   "), null);
  assert.equal(C.lerNumero("abc"), null);
  assert.equal(C.lerNumero("-5"), null);
  assert.equal(C.lerNumero("0"), null);
  assert.equal(C.lerNumero(null), null);
  assert.equal(C.lerNumero("1,2,3"), null);
});

test("formatos", () => {
  assert.equal(C.fmtUSD(1.8018e9), "US$ 1,80 bi");
  assert.equal(C.fmtUSD(23.4e9), "US$ 23,40 bi");
  assert.equal(C.fmtUSD(3.2e12), "US$ 3,20 tri");
  assert.equal(C.fmtUSD(4.5e6), "US$ 4,50 mi");
  assert.equal(C.fmtUSD(1234.5), "US$ 1.234,50");
  assert.equal(C.fmtUSD(160.78), "US$ 160,78");
  assert.equal(C.fmtUSD(0.0767), "US$ 0,0767");
  assert.equal(C.fmtUSD(0.000012345), "US$ 0,00001235");
  assert.equal(C.fmtUSD(null), "—");
  assert.equal(C.fmtQtd(23.4e9), "23,4 bi");
  assert.equal(C.fmtQtd(1298.7), "1.299");
  assert.equal(C.fmtQtd(12.345), "12,35");
  assert.equal(C.fmtQtd(0.62197), "0,622");
  assert.equal(C.fmtVezes(12.987), "13×");
  assert.equal(C.fmtVezes(9.4507), "9,5×");
  assert.equal(C.fmtVezes(0.3712), "0,37×");
  assert.equal(C.fmtVezes(4000), "4.000×");
  assert.equal(C.fmtVezes(null), "—");
  assert.equal(C.fmtPct(0.62), "62%");
  assert.equal(C.fmtPct(0.0734), "7,3%");
  assert.equal(C.fmtPct(null), "—");
});

test("linkSeguro só aceita http(s)", () => {
  assert.equal(C.linkSeguro("https://docs.jup.ag"), "https://docs.jup.ag");
  assert.equal(C.linkSeguro("http://x.io/a"), "http://x.io/a");
  assert.equal(C.linkSeguro("javascript:alert(1)"), null);
  assert.equal(C.linkSeguro("  "), null);
  assert.equal(C.linkSeguro(null), null);
});

test("linksDoToken: oficial primeiro, Tokenomist depois", () => {
  const a = C.linksDoToken({ id: "jupiter", links: { whitepaper: "https://station.jup.ag/docs", homepage: "https://jup.ag" } });
  assert.deepEqual(a.map(l => l.tipo), ["oficial", "tokenomist"]);
  assert.equal(a[0].url, "https://station.jup.ag/docs");
  assert.equal(a[1].url, "https://tokenomist.ai/jupiter");
  const b = C.linksDoToken({ id: "x", links: { whitepaper: "", homepage: "https://x.io" } });
  assert.equal(b[0].url, "https://x.io");
  const c = C.linksDoToken({ id: "y y", links: { whitepaper: "javascript:1", homepage: null } });
  assert.deepEqual(c.map(l => l.tipo), ["tokenomist"]);
  assert.equal(c[0].url, "https://tokenomist.ai/y%20y");
});
