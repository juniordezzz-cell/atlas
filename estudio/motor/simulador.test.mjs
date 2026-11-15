// Critério de pronto da Fase 1: o motor dá os mesmos números do simulador
// para as mesmas entradas. Roda o código ORIGINAL do HTML (bloco //<core> e
// statsOf, extraídos do arquivo em tempo de teste) ao lado do módulo e exige
// igualdade exata, valor a valor.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as motor from "./simulador.mjs";

const HTML = readFileSync(new URL("../referencia/simulador-pools.html", import.meta.url), "utf8");
const MOD = readFileSync(new URL("./simulador.mjs", import.meta.url), "utf8");
const bloco = (s) => s.slice(s.indexOf("//<core>"), s.indexOf("//</core>") + 9).replace(/\r\n/g, "\n");
const stats = (s) => s.match(/function statsOf\(R,days\)\{[\s\S]*?\n  loss:[^\n]*\n/)[0].replace(/\r\n/g, "\n");

// O código original do HTML vira um módulo temporário e é importado no
// mesmo realm, para comparar objetos e Float64Array com deepEqual estrito.
const tmp = join(mkdtempSync(join(tmpdir(), "simulador-html-")), "core.mjs");
writeFileSync(tmp, bloco(HTML) + "\n" + stats(HTML) + "\nexport {genZ,buildPaths,build,evalStrat,statsOf};\n");
const html = await import(pathToFileURL(tmp).href);

// Mercado padrão do simulador (DEF + rede Solana), em frações como market().
const BASE = { p0: 84, vol: 0.75, mu: 0, kappa: 0, days: 30, tvl: 10e6, vday: 25e6, fee: 0.0004, conc: 0.08, gas: 0.003, swap: 0.0015, nsim: 200, seed: 42 };
const CENARIOS = {
  aleatorio: BASE,
  lateral: { ...BASE, kappa: 25 },
  alta: { ...BASE, mu: 0.8, seed: 7 },
  base_rede: { ...BASE, gas: 0.03, fee: 0.0005, tvl: 8e6, vday: 12e6, days: 14 },
};
const CAMPOS = ["pnl", "fees", "il", "tir", "reb", "cost", "hodl"];

function caminhosHtml(M) {
  const steps = Math.min(M.days * 24, 1440);
  return html.buildPaths(html.genZ(M.nsim, steps, M.seed), M.nsim, steps, M, M.vol);
}

test("o bloco copiado é idêntico ao do simulador", () => {
  assert.equal(bloco(MOD), bloco(HTML));
  assert.equal(stats(MOD), stats(HTML));
});

for (const [nome, M] of Object.entries(CENARIOS)) {
  test(`mesmos caminhos de preço · ${nome}`, () => {
    assert.deepEqual(motor.caminhos(M).data, caminhosHtml(M).data);
  });

  test(`mesmos resultados em todos os modelos · ${nome}`, () => {
    const pxM = motor.caminhos(M), pxH = caminhosHtml(M);
    for (const t of motor.MODELOS) for (let n = 1; n <= 6; n++) for (const reb of [0, 1]) {
      const dM = motor.build(t, n, 100, 75, 100, M.p0), dH = html.build(t, n, 100, 75, 100, M.p0);
      assert.deepEqual(dM, dH, `${t}×${n}: posições`);
      const rM = motor.evalStrat(dM, reb, pxM, M), rH = html.evalStrat(dH, reb, pxH, M);
      for (const c of CAMPOS) assert.deepEqual(rM[c], rH[c], `${t}×${n} reb=${reb}: ${c}`);
      assert.deepEqual(motor.statsOf(rM, M.days), html.statsOf(rH, M.days), `${t}×${n} reb=${reb}: estatísticas`);
    }
  });
}

test("caça-estratégias igual ao laço do simulador (300 caminhos, capital/faixa da B)", () => {
  const M = { ...BASE, nsim: 400 };
  const B = { cap: 100, lo: 75, hi: 100, reb: 1 };
  const lista = motor.cacar(M, B);
  const pxH = { ...caminhosHtml(M), n: 300 };
  const esperado = [];
  for (const t of motor.MODELOS) for (let n = 1; n <= 6; n++) {
    if (t === "single" && n > 1) continue;
    if (t !== "single" && t !== "acc" && n === 1) continue;
    esperado.push({ t, n, st: html.statsOf(html.evalStrat(html.build(t, n, B.cap, B.lo, B.hi, M.p0), B.reb, pxH, M), M.days) });
  }
  assert.deepEqual(lista, esperado);
  assert.equal(lista.length, 1 + 4 * 5 + 6);
});

test("posições inválidas saem como no defs() do simulador", () => {
  const pos = [{ cap: 10, a: 1, b: 2 }, { cap: 0, a: 1, b: 2 }, { cap: 5, a: 3, b: 2 }, { cap: 5, a: 0, b: 2 }];
  assert.deepEqual(motor.validas(pos), [{ cap: 10, a: 1, b: 2 }]);
});
