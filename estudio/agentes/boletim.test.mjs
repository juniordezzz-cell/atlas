// Boletim: refazer um achado com o que aconteceu de verdade.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analisarPool } from "./ciclo.mjs";
import { avaliarAchado, avaliarTodos } from "./boletim.mjs";

const VELAS = JSON.parse(readFileSync(new URL("../motor/fixtures/gt_ohlcv_sol_usdc_orca_20261111.json", import.meta.url), "utf8"))
  .data.attributes.ohlcv_list.slice().sort((a, b) => a[0] - b[0]);
const HORA = 3600;

// O achado nasce 7 dias antes do fim das velas; os 7 dias seguintes são "o que aconteceu".
const corte = VELAS.length - 7 * 24;
const antes = VELAS.slice(0, corte), depois = VELAS.slice(corte);
const p0 = antes[antes.length - 1][4];
const POOL = { pool_id: "gecko:solana:SoLuSdC", rede: "Solana", dex: "Orca", par: "SOL/USDC", taxa_pct: 0.04,
  tvl: 10e6, vol_24h: 60e6, preco: p0, preco_usd: p0, ativo_simbolo: "SOL", cotacao: "USDC" };
const rodada = new Date((antes[antes.length - 1][0] + HORA) * 1000).toISOString();

function itemDe(ach, extra = {}) {
  return { achado_id: 1, rodada, agente: ach.agente, pool_id: ach.pool_id, par: ach.par, horizonte_dias: 7,
    preco: ach.preco, posicoes: ach.posicoes, faixa_min: ach.faixa_min, faixa_max: ach.faixa_max,
    capital_usd: ach.capital_usd, mercado: ach.mercado, candles: depois, tvl_usd: null, ...extra };
}

test("refaz um achado real com os 7 dias seguintes", () => {
  const r = analisarPool(POOL, antes);
  assert.ok(r.achados.length > 0);
  for (const ach of r.achados) {
    const { resultado: b } = avaliarAchado(itemDe(ach));
    assert.ok(b, ach.agente);
    assert.equal(b.horas, 7 * 24);
    assert.ok(Number.isFinite(b.real_usd) && Number.isFinite(b.base_real_usd));
    assert.ok(b.previsto_p10_usd <= b.previsto_media_usd && b.previsto_media_usd <= b.previsto_p90_usd);
    assert.equal(b.erro_usd, b.real_usd - b.previsto_media_usd);
    assert.equal(b.dentro_faixa, b.real_usd >= b.previsto_p10_usd && b.real_usd <= b.previsto_p90_usd);
    assert.equal(b.preco_fim, Math.fround(depois[depois.length - 1][4]));
    if (ach.agente === "acumulador_token") assert.ok(b.tokens && b.acertou === b.tokens.ganho_pct > 0);
    else if (ach.agente === "base") assert.equal(b.acertou, b.lucro);
    else assert.equal(b.acertou, b.lucro && b.ganhou_base);
    assert.equal(b.metodo, "antigo");                       // fixture de 11/11: antes da mudança
  }
});

test("preço parado e sem volume: o real é só o custo de gás", () => {
  const ach = analisarPool(POOL, antes).achados[0];
  const parado = depois.map((c) => [c[0], ach.preco, ach.preco, ach.preco, ach.preco, 0]);
  const M = { ...ach.mercado, vday: 0 };
  const { resultado: b } = avaliarAchado(itemDe(ach, { candles: parado, mercado: M }));
  const gas = M.gas * 2 * ach.posicoes.length * M.cotacao_usd;
  assert.ok(Math.abs(b.real_usd + gas) < 1e-3, `${b.real_usd} vs −${gas}`);   // preço em Float32, como no simulador
  assert.equal(b.lucro, false);
});

test("sem velas suficientes: fica para depois", () => {
  const ach = analisarPool(POOL, antes).achados[0];
  const r = avaliarTodos([itemDe(ach, { candles: depois.slice(0, 100) }), itemDe(ach, { horizonte_dias: 30 })]);
  assert.equal(r.resultados.length, 0);
  assert.equal(r.pulados.length, 2);
  assert.match(r.pulados[0].motivo, /faltam velas/);
});

test("achado depois da mudança de método é 'atual'", () => {
  const ach = analisarPool(POOL, antes).achados[0];
  const { resultado: b } = avaliarAchado(itemDe(ach, { rodada: "2026-11-14T01:00:00Z",
    candles: depois.map((c, i) => [Date.parse("2026-11-14T01:00:00Z") / 1000 + i * HORA, ...c.slice(1)]) }));
  assert.equal(b.metodo, "atual");
});
