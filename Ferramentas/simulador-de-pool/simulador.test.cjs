/* Contas do Simulador de Pool (17/11/2026): teste no histórico e inversão
   da ordem dos tokens. Roda com: node --test Ferramentas/scanner-pools/*.test.cjs */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");

function carregar() {
  const ctx = { window: {}, document: { getElementById: () => null }, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/simulador.js", "utf8"), ctx);
  return ctx.window.SimuladorPool;
}
function dias(n, preco, vol) {
  return Array.from({ length: n }, (_, i) => ({ t: i * 864e5, o: preco, h: preco, l: preco, c: preco, bu: preco, qu: 1, vol }));
}

test("preço parado dentro da faixa: sem perda e taxa = taxa × volume × fatia", () => {
  const S = carregar();
  const p = { tvl: 1e6, fee: 0.3 };
  const d = { base: "SOL", quote: "USDC", linhas: dias(31, 100, 200000) };
  const t = S._testar(p, d, 90, 110, 1000, 30);
  const ef = 1 / (1 - Math.pow(90 / 110, 1 / 4));
  const esperado = 30 * 0.003 * 200000 * (1000 * ef / 1e6);
  assert.ok(Math.abs(t.semTaxa - 1000) < 1e-6, "sem troca de tokens com o preço parado");
  assert.ok(Math.abs(t.segurar - 1000) < 1e-6);
  assert.ok(Math.abs(t.taxas - esperado) < 1e-6, `taxas ${t.taxas} vs ${esperado}`);
  assert.strictEqual(t.dentro, 1);
});

test("preço fora da faixa: não rende taxa", () => {
  const S = carregar();
  const d = { base: "SOL", quote: "USDC", linhas: dias(31, 100, 200000).map((x, i) => i ? { ...x, o: 150, h: 150, l: 150, c: 150, bu: 150 } : x) };
  const t = S._testar({ tvl: 1e6, fee: 0.3 }, d, 90, 110, 1000, 30);
  assert.strictEqual(t.taxas, 0);
  assert.strictEqual(t.saida, "acima");
  assert.ok(t.semTaxa < t.segurar, "acima da faixa, a pool vira toda USDC e perde a alta");
});

test("a fatia nas taxas nunca passa de 100% do volume", () => {
  const S = carregar();
  const d = { base: "SOL", quote: "USDC", linhas: dias(8, 100, 1000) };
  const t = S._testar({ tvl: 10, fee: 1 }, d, 99, 101, 1e6, 7);
  assert.ok(t.taxas <= 7 * 0.01 * 1000 + 1e-9);
});

test("inverter troca base e cotação sem mudar o valor em dólar", () => {
  const S = carregar();
  const d = { base: "USDC", quote: "SOL", linhas: [{ t: 0, o: 0.01, h: 0.0125, l: 0.008, c: 0.01, bu: 1, qu: 100, vol: 5 }] };
  const r = S._inverter(d);
  assert.strictEqual(r.base, "SOL");
  assert.strictEqual(r.linhas[0].c, 100);
  assert.strictEqual(r.linhas[0].h, 125);
  assert.strictEqual(r.linhas[0].l, 80);
  assert.strictEqual(r.linhas[0].bu, 100);
});

test("tokens do par tiram a taxa do nome e tratam WETH como ETH", () => {
  const S = carregar();
  assert.deepStrictEqual(Array.from(S._tokens({ pool: "WETH/USDC 0.05%" })), ["ETH", "USDC"]);
  assert.deepStrictEqual(Array.from(S._tokens({ pool: "SOL-USDC" })), ["SOL", "USDC"]);
});
