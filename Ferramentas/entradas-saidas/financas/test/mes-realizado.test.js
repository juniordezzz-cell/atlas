/* O resumo é do MÊS ATUAL e do que JÁ ACONTECEU.

   O Planejar gera os lançamentos do ano inteiro (salário de janeiro a
   dezembro). O resumo somava todos: com salário de R$ 1.000/mês, o card
   "Entradas" mostrava R$ 12.000 em setembro e o "Saldo do mês" o saldo
   do ano — com dezembro contado como recebido. Estes testes fixam o
   comportamento certo, com "hoje" injetado para não depender do dia. */
import test from "node:test";
import assert from "node:assert/strict";
import { refreshSummary, isRealized, currentMonthKey } from "../js/core/finance.js";

const HOJE = "2026-09-22";

/* salário de R$ 1.000 no dia 5 e aluguel de R$ 500 no dia 10, o ano todo,
   mais um freela de R$ 300 no dia 25 de setembro (ainda por vir) */
function estado() {
  const entries = [], expenses = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    entries.push({ id: `sal-${mm}`, date: `2026-${mm}-05`, source: "Salário", description: "", value: 1000 });
    expenses.push({ id: `alu-${mm}`, date: `2026-${mm}-10`, category: "Casa", type: "Gastos fixos", description: "", value: 500 });
  }
  entries.push({ id: "freela", date: "2026-09-25", source: "Freela", description: "", value: 300 });
  expenses.push({ id: "mercado-ago", date: "2026-08-15", category: "Mercado", type: "Gastos não fixos", description: "", value: 200 });
  return { entries, expenses, summary: {}, investments: { invested: 0 }, categories: [] };
}

test("realizado = data até hoje; depois disso é previsto", () => {
  assert.equal(isRealized({ date: "2026-09-22" }, HOJE), true);
  assert.equal(isRealized({ date: "2026-09-05" }, HOJE), true);
  assert.equal(isRealized({ date: "2026-09-25" }, HOJE), false);
  assert.equal(isRealized({ date: "2026-12-05" }, HOJE), false);
});

test("mês atual vem de hoje, não do último mês com lançamento", () => {
  assert.equal(currentMonthKey(HOJE), "2026-09");
});

test("cards: só o mês atual e só o realizado", () => {
  const s = refreshSummary(estado(), HOJE).summary;
  assert.equal(s.mes, "2026-09");
  assert.equal(s.receitas, 1000);      // não 12.300
  assert.equal(s.despesas, 500);       // não 6.200
  assert.equal(s.saldo, 500);
});

test("o que ainda vem no mês aparece como previsto, à parte", () => {
  const s = refreshSummary(estado(), HOJE).summary;
  assert.equal(s.previsto.receitas, 300);
  assert.equal(s.previsto.despesas, 0);
  assert.equal(s.previsto.saldoFimDoMes, 800); // 1000 + 300 − 500
});

test("distribuição das despesas: mês atual, realizado", () => {
  const cats = refreshSummary(estado(), HOJE).categories;
  assert.deepEqual(cats.map(c => [c.name, c.value]), [["Casa", 500]]);
});

test("fluxo do mês é setembro e para de subir depois de hoje", () => {
  const cf = refreshSummary(estado(), HOJE).cashFlow;
  assert.match(cf.labels[0], /Set/i);
  // marcos 1,5,10,15,20,25,30 → o freela do dia 25 é previsto e não entra
  assert.deepEqual(cf.receitas, [0, 1000, 1000, 1000, 1000, 1000, 1000]);
  assert.deepEqual(cf.despesas, [0, 0, 500, 500, 500, 500, 500]);
});

test("evolução do saldo termina no mês atual e ignora o futuro", () => {
  const nw = refreshSummary(estado(), HOJE).netWorth;
  assert.equal(nw.labels.length, 6);
  assert.match(nw.labels[5], /Set/i);
  // abr..set realizados: +500 por mês, agosto −200 do mercado; acumulado desde janeiro
  // jan..mar = 1500 antes da janela; abr 2000, mai 2500, jun 3000, jul 3500, ago 3800, set 4300
  assert.deepEqual(nw.values, [2000, 2500, 3000, 3500, 3800, 4300]);
});
