// Fase 3: os agentes. Critério de pronto: cada agente grava achados e status,
// e o ranking bate com o caça-estratégias do simulador. Aqui a simulação de
// cada agente é comparada, número a número, com o hunt() do HTML original
// (mesmo método do simulador.test.mjs) e com cacar() do motor.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cacar, caminhos, MODELOS } from "../motor/simulador.mjs";
import { AGENTES, aplicarRegra, naListaDeCompra } from "./regras.mjs";
import { analisarPool, prepararPool, simular, volumesDiarios, rodarAgentes, emDolar } from "./ciclo.mjs";
import { relatorioDoDia } from "./supervisor.mjs";

const VELAS = JSON.parse(readFileSync(new URL("../motor/fixtures/gt_ohlcv_sol_usdc_orca_20261111.json", import.meta.url), "utf8"))
  .data.attributes.ohlcv_list;
const SOL_USDC = { pool_id: "llama:sol", rede: "Solana", dex: "Orca", par: "SOL/USDC", taxa_pct: 0.04, tvl: 10e6, vol_24h: 25e6,
  preco: 84.71, preco_usd: 84.71, ativo_simbolo: "SOL", cotacao: "USDC" };

// hunt() do HTML com o código original (bloco core + statsOf), sem tela.
const HTML = readFileSync(new URL("../referencia/simulador-pools.html", import.meta.url), "utf8");
const bloco = (s) => s.slice(s.indexOf("//<core>"), s.indexOf("//</core>") + 9).replace(/\r\n/g, "\n");
const stats = (s) => s.match(/function statsOf\(R,days\)\{[\s\S]*?\n  loss:[^\n]*\n/)[0].replace(/\r\n/g, "\n");
const tmp = join(mkdtempSync(join(tmpdir(), "simulador-html-")), "core.mjs");
writeFileSync(tmp, bloco(HTML) + "\n" + stats(HTML) + "\nexport {genZ,buildPaths,build,evalStrat,statsOf};\n");
const html = await import(pathToFileURL(tmp).href);
// O hunt() do HTML usa sub(PX,300) — sub fica fora do core, então recriado aqui igual.
function huntHtml(M, s) {
  const steps = Math.min(M.days * 24, 1440);
  const PX = html.buildPaths(html.genZ(M.nsim, steps, M.seed), M.nsim, steps, M, M.vol);
  const px = { ...PX, n: Math.min(PX.n, 300) }, list = [];
  for (const t of ["single", "nested", "curve", "bidask", "spot", "acc"]) for (let n = 1; n <= 6; n++) {
    if (t === "single" && n > 1) continue;
    if (t !== "single" && t !== "acc" && n === 1) continue;
    const d = html.build(t, n, s.cap, s.lo, s.hi, M.p0), st = html.statsOf(html.evalStrat(d, s.reb, px, M), M.days);
    list.push({ t, n, st });
  }
  return list;
}

test("cada estratégia simulada pelos agentes é igual ao caça-estratégias do HTML", () => {
  const prep = prepararPool(SOL_USDC, VELAS);
  const M1000 = { ...prep.M, nsim: 1000 };   // o simulador sorteia 1000 e o hunt usa os primeiros 300
  const ref = huntHtml(M1000, { cap: prep.cap, lo: prep.lo, hi: prep.hi, reb: 0 });
  const mot = cacar(M1000, { cap: prep.cap, lo: prep.lo, hi: prep.hi, reb: 0 });
  const px = caminhos(prep.M);                // 300 caminhos: os mesmos 300 primeiros
  assert.equal(ref.length, 27);   // 1 + 4 modelos × 5 + 6 (Acumulação)
  for (const h of ref) {
    const a = simular(prep, px, h.t, h.n);
    assert.deepEqual(a.st, h.st, `${h.t}×${h.n}`);
    assert.deepEqual(mot.find((x) => x.t === h.t && x.n === h.n).st, h.st, `cacar ${h.t}×${h.n}`);
  }
});

test("o agente fica com o melhor N do seu modelo, como o ranking do caça-estratégias", () => {
  const prep = prepararPool(SOL_USDC, VELAS);
  const lista = cacar({ ...prep.M, nsim: 1000 }, { cap: prep.cap, lo: prep.lo, hi: prep.hi, reb: 0 });
  const r = analisarPool(SOL_USDC, VELAS);
  for (const an of r.analises.filter((x) => x.trabalha)) {
    const ag = AGENTES.find((a) => a.id === an.agente);
    const melhor = lista.filter((x) => x.t === ag.modelo && ag.faixas.includes(x.n)).sort((x, y) => y.st.mean - x.st.mean)[0];
    assert.equal(an.faixas, melhor.n, ag.id);
    assert.equal(an.media_usd, melhor.st.mean * prep.cot, ag.id);
  }
  assert.ok(r.analises.some((x) => x.trabalha), "pelo menos um agente trabalhou na pool de teste");
});

test("achado só quando ganha da Faixa única na mesma pool, com média positiva", () => {
  // giro altíssimo: as taxas pagam a estratégia
  const r = analisarPool({ ...SOL_USDC, taxa_pct: 0.3, vol_24h: 60e6 }, VELAS);
  assert.ok(r.achados.length > 0);
  for (const a of r.achados) {
    assert.ok(a.media_usd > 0);
    if (a.agente !== "base") assert.ok(a.media_usd > a.ref_media_usd && a.ganho_vs_ref_usd > 0, a.agente);
    assert.equal(a.capital_usd, 1000);
    assert.ok(Math.abs(a.posicoes.reduce((s, q) => s + q.cap, 0) - 1000) < 1e-6, "capital das posições em dólar");
    assert.ok(a.faixa_min < a.preco && a.preco < a.faixa_max);
  }
});

test("par cotado em outro token: simula na cotação e devolve em dólar", () => {
  // Mesma pool vista como se a cotação valesse $2: capital, TVL, volume e gás
  // viram metade na unidade da cotação; o resultado em dólar é o mesmo.
  const em1 = prepararPool(SOL_USDC, VELAS);
  const pool2 = { ...SOL_USDC, cotacao: "XYZ", preco_usd: SOL_USDC.preco * 2 };
  const em2 = prepararPool(pool2, VELAS);
  assert.equal(em2.cot, 2);
  assert.equal(em2.cap, 500);
  const px = caminhos(em1.M);
  for (const t of MODELOS) {
    const n = t === "single" ? 1 : 3;
    const d1 = emDolar(simular(em1, px, t, n).st, em1.cot), d2 = emDolar(simular(em2, px, t, n).st, em2.cot);
    for (const k of ["mean", "p10", "fees", "il"]) assert.ok(Math.abs(d1[k] - d2[k]) < 1e-6 * (1 + Math.abs(d1[k])), `${t} ${k}`);
  }
  // sem preço em dólar e cotação desconhecida: não simula
  assert.equal(prepararPool({ ...SOL_USDC, preco_usd: null, cotacao: "XYZ" }, VELAS).erro, "sem preço da cotação em dólar");
});

test("regras dos agentes", () => {
  const m = { dias: 30, giro: 2, giroEstavel: true, volumeCaindo3d: false, lateral: 0.7, sigma30: 0.7, sigma7: 0.5,
    kappa: 10, mu: 0.1, diasHistorico: 40, naLista: true, acimaDaMinima30: 0.05 };
  const ok = (id, x = m, e) => { const r = aplicarRegra(id, x, e); return r.procura && r.descarta !== true; };
  assert.ok(ok("base"));
  assert.ok(!ok("base", { ...m, volumeCaindo3d: true }));
  assert.ok(!ok("base", { ...m, giroEstavel: false }));
  assert.ok(ok("concentrador"));
  assert.ok(!ok("concentrador", m, { meiaLarguraCentral: 0.01 }));   // σ7·√(30/365) ≈ 14% > 1%
  assert.ok(!ok("concentrador", { ...m, lateral: 0.5 }));
  assert.ok(ok("curva"));
  assert.ok(!ok("curva", { ...m, mu: -0.45 }));
  assert.ok(!ok("curva", { ...m, kappa: 2 }));
  assert.ok(ok("pontas"));
  assert.ok(!ok("pontas", { ...m, sigma7: 0.1 }));
  assert.ok(!ok("pontas", { ...m, sigma30: 0.4 }));
  assert.ok(!ok("grade"));
  assert.ok(ok("grade", { ...m, diasHistorico: 12 }));
  assert.ok(!ok("grade", { ...m, diasHistorico: 12, giro: 0.8 }));
  assert.ok(ok("acumulador"));
  assert.ok(!ok("acumulador", { ...m, acimaDaMinima30: 0.2 }));
  assert.ok(!ok("acumulador", { ...m, naLista: false }));
  // sem dado (lateralidade precisa de 30 dias): não procura
  assert.ok(!ok("concentrador", { ...m, lateral: null }));
});

test("lista de compra do Acumulador", () => {
  for (const s of ["SOL", "WSOL", "JUP", "cbBTC", "WETH", "HYPE", "PENDLE", "UNI", "AAPLx", "CRCLx", "RNDR"]) assert.ok(naListaDeCompra(s), s);
  for (const s of ["BONK", "WIF", "USDC", "AAPLX", "", null]) assert.ok(!naListaDeCompra(s), String(s));
});

test("volume por dia completo, sem o dia que ainda não fechou", () => {
  const h = 3600, d0 = 20000 * 86400;
  const v = [[d0, 1, 1, 1, 1, 10], [d0 + h, 1, 1, 1, 1, 5], [d0 + 86400, 1, 1, 1, 1, 7], [d0 + 2 * 86400, 1, 1, 1, 1, 99]];
  assert.deepEqual(volumesDiarios(v), [15, 7]);
  // dia sem volume conhecido fica de fora
  const v2 = [[d0, 1, 1, 1, 1, 0], [d0 + 86400, 1, 1, 1, 1, 7], [d0 + 2 * 86400, 1, 1, 1, 1, 99]];
  assert.deepEqual(volumesDiarios(v2), [7]);
});

test("rodada completa: status dos seis agentes e pools sem dados", () => {
  const r = rodarAgentes({ rodada: "2026-11-13T00:00:00+00:00", pools: [
    { ...SOL_USDC, candles: VELAS },
    { ...SOL_USDC, pool_id: "sem-velas", candles: VELAS.slice(0, 50) },
    { ...SOL_USDC, pool_id: "sem-taxa", taxa_pct: null, candles: VELAS },
  ] });
  assert.equal(r.status.length, 6);
  assert.deepEqual(r.status.map((s) => s.agente), AGENTES.map((a) => a.id));
  for (const s of r.status) assert.equal(s.pools_vistas, 3);
  assert.deepEqual(r.erros.map((e) => e.erro).sort(), ["menos de 7 dias de velas", "sem taxa"]);
  const vazio = rodarAgentes({ rodada: "x", pools: [] });
  assert.ok(vazio.status.every((s) => s.estado === "sem_pools" && s.achados === 0));
});

test("supervisor: ranking, disputas e conflitos", () => {
  const a = (agente, pool_id, media_usd, rodada = "2026-11-13T10:00:00+00:00") => ({ agente, pool_id, par: pool_id, media_usd, p10_usd: 0, ganho_vs_ref_usd: 1, modelo: "x", faixas: 2, rodada });
  const rel = relatorioDoDia([
    a("curva", "P1", 30, "2026-11-13T09:00:00+00:00"),
    a("curva", "P1", 40),
    a("pontas", "P1", 25),
    a("grade", "P2", 50),
  ], [{ pool_id: "P1", analises: [
    { agente: "curva", achado: true, media_usd: 40 },
    { agente: "concentrador", descarta: true, motivo: "volatilidade passa da faixa do meio" },
    { agente: "acumulador", descarta: true, motivo: "fora da lista de compra" },
  ] }]);
  assert.deepEqual(rel.ranking.map((x) => [x.agente, x.pool_id, x.media_usd]), [["grade", "P2", 50], ["curva", "P1", 40], ["pontas", "P1", 25]]);
  assert.equal(rel.disputas.length, 1);
  assert.equal(rel.disputas[0].vencedor, "curva");
  assert.equal(rel.disputas[0].diferenca_usd, 15);
  assert.deepEqual(rel.conflitos.map((c) => [c.agente, c.contra]), [["curva", "concentrador"]]);
});

test("rodar.mjs: JSON entra pela entrada padrão e sai pela saída padrão", () => {
  const entrada = { rodada: "2026-11-13T00:00:00+00:00", pools: [{ ...SOL_USDC, taxa_pct: 0.3, vol_24h: 60e6, candles: VELAS }], achados_hoje: [] };
  const p = spawnSync(process.execPath, [fileURLToPath(new URL("./rodar.mjs", import.meta.url))], { input: JSON.stringify(entrada), encoding: "utf8" });
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.equal(out.status.length, 6);
  assert.ok(out.achados.length > 0);
  assert.ok(out.relatorio.ranking.length > 0);
});
