import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarCandles, janela, aprTaxas, volRealizada, lateralidade } from "./metricas.mjs";
import { calibrar, estimarProcesso } from "./calibracao.mjs";
import { evalStrat, build, caminhos, statsOf } from "./simulador.mjs";

// Velas reais de 1h do SOL/USDC da Orca (Czfq3x…44zE), GeckoTerminal, 11/11/2026.
const BRUTO = JSON.parse(readFileSync(new URL("./fixtures/gt_ohlcv_sol_usdc_orca_20261111.json", import.meta.url), "utf8"))
  .data.attributes.ohlcv_list;
const SOL = normalizarCandles(BRUTO);

// Velas sintéticas: preço que sobe r por hora, ou alterna ±.
const hora = (i) => 1_790_000_000 + i * 3600;
const serie = (n, f) => Array.from({ length: n }, (_, i) => { const p = f(i); return [hora(i), p, p, p, p, 1]; });

test("normaliza: ordem crescente, sem repetidos e sem preço inválido", () => {
  assert.equal(BRUTO[0][0] > BRUTO[1][0], true, "a GeckoTerminal manda do mais novo ao mais antigo");
  assert.equal(SOL.length, 1000);
  for (let i = 1; i < SOL.length; i++) assert.equal(SOL[i][0] - SOL[i - 1][0], 3600);
  const sujo = [[hora(2), 1, 1, 1, 3, 0], [hora(1), 1, 1, 1, 2, 0], [hora(1), 1, 1, 1, 2, 0], [hora(3), 1, 1, 1, 0, 0], ["x"]];
  assert.deepEqual(normalizarCandles(sujo).map((c) => c[4]), [2, 3]);
});

test("janela pega os últimos N dias pela vela mais recente", () => {
  assert.equal(janela(SOL, 7).length, 168);
  assert.equal(janela(SOL, 30).length, 720);
});

test("APR de taxas = 365 × taxa × volume ÷ TVL", () => {
  assert.equal(aprTaxas(0.04, 77_842_717, 21_391_356), 365 * 0.0004 * 77_842_717 / 21_391_356);
  assert.equal(aprTaxas(0.3, 1_000_000, 0), null);
});

test("volatilidade: zero para preço constante, conhecida para ±r alternado", () => {
  assert.equal(volRealizada(serie(800, () => 10), 30), 0);
  const r = 0.01, alt = serie(800, (i) => 100 * Math.exp(i % 2 ? r : 0));
  const v = volRealizada(alt, 30);
  // retornos ±r alternados: desvio amostral ≈ r → anual ≈ r·√8760
  assert.ok(Math.abs(v - r * Math.sqrt(8760)) / v < 0.01, String(v));
  assert.equal(volRealizada(serie(100, () => 10), 30), null, "pouca vela = sem número");
});

test("volatilidade real do SOL fica numa faixa plausível", () => {
  const v7 = volRealizada(SOL, 7), v30 = volRealizada(SOL, 30);
  assert.ok(v7 > 0.2 && v7 < 2, `7d ${v7}`);
  assert.ok(v30 > 0.2 && v30 < 2, `30d ${v30}`);
});

test("lateralidade: 1 para preço parado, baixa para tendência forte", () => {
  assert.equal(lateralidade(serie(720, () => 50)), 1);
  const tend = lateralidade(serie(720, (i) => 50 * Math.exp(0.002 * i)));
  assert.ok(tend < 0.25, String(tend));
  const sol = lateralidade(SOL);
  assert.ok(sol >= 0 && sol <= 1);
});

test("κ alto para preço que volta à média, baixo para passeio aleatório", () => {
  const volta = serie(720, (i) => 100 * Math.exp(0.05 * Math.sin(i / 3)));
  assert.equal(estimarProcesso(volta, 30, 0.5).kappa, 25, "preso no limite do cenário Lateral");
  const tend = estimarProcesso(serie(720, (i) => 100 * Math.exp(0.0005 * i)), 30, 0.3);
  assert.equal(tend.mu, 0.8, "tendência forte para no limite do cenário Alta");
});

test("calibrar monta o mercado do simulador para uma pool real", () => {
  const pool = { rede: "Solana", preco: SOL.at(-1)[4], tvl: 21_391_356, vol24h: 77_842_717, taxaPct: 0.04 };
  const { M, origem } = calibrar(pool, BRUTO);
  assert.equal(M.p0, pool.preco);
  assert.equal(M.fee, 0.0004);
  assert.equal(M.gas, 0.003);
  assert.equal(M.conc, 0.08);
  assert.equal(origem.janelaDias, 30);
  assert.equal(origem.concEstimada, true);
  assert.ok(M.kappa >= 0 && M.kappa <= 25 && M.mu >= -0.6 && M.mu <= 0.8);
  // e o simulador roda com ele
  const r = statsOf(evalStrat(build("nested", 4, 1000, M.p0 * 0.9, M.p0 * 1.1, M.p0), 1, caminhos({ ...M, nsim: 100 }), { ...M, nsim: 100 }), M.days);
  assert.ok(Number.isFinite(r.mean) && r.fees > 0);
});

test("calibrar recusa rede fora da v1 e pool sem dados", () => {
  assert.equal(calibrar({ rede: "Arbitrum", preco: 1, tvl: 1, vol24h: 1, taxaPct: 0.05 }, BRUTO), null);
  assert.equal(calibrar({ rede: "Base", preco: 0, tvl: 1, vol24h: 1, taxaPct: 0.05 }, BRUTO), null);
  assert.equal(calibrar({ rede: "Base", preco: 1, tvl: 1, vol24h: 1, taxaPct: 0.05 }, []), null);
});

test("sem 30 dias de velas, usa 7", () => {
  const { origem } = calibrar({ rede: "Base", preco: 3000, tvl: 1e6, vol24h: 2e6, taxaPct: 0.05 }, SOL.slice(-200));
  assert.equal(origem.janelaDias, 7);
});
