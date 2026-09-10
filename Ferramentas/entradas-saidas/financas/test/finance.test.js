import test from "node:test";
import assert from "node:assert/strict";
import { summarizeEntries, summarizeExpenses, refreshSummary, monthOptions } from "../js/core/finance.js";

const state = () => ({
  entries: [ {id:"e1",date:"2026-03-05",source:"Salário",description:"",value:1000},
             {id:"e2",date:"2026-03-20",source:"Freela",description:"",value:500} ],
  expenses: [ {id:"d1",date:"2026-03-02",category:"Casa",type:"Gastos fixos",description:"",value:400},
              {id:"d2",date:"2026-03-11",category:"Mercado",type:"Gastos não fixos",description:"",value:300} ],
  summary:{}, investments:{ invested: 0 }, categories: []
});

test("summarizeEntries soma e agrupa por origem", () => {
  const r = summarizeEntries(state().entries);
  assert.equal(r.total, 1500);
  assert.equal(r.bySource["Salário"], 1000);
});
test("summarizeExpenses soma total, por tipo e por categoria", () => {
  const r = summarizeExpenses(state().expenses);
  assert.equal(r.total, 700);
  assert.equal(r.byType["Gastos fixos"], 400);
  assert.equal(r.byCategory["Mercado"], 300);
});
test("refreshSummary calcula receitas/despesas/saldo", () => {
  const s = refreshSummary(state());
  assert.equal(s.summary.receitas, 1500);
  assert.equal(s.summary.despesas, 700);
  assert.equal(s.summary.saldo, 800);
});
test("monthOptions lista meses com dados, mais recente primeiro", () => {
  const s = state(); s.entries.push({id:"e3",date:"2026-02-10",source:"x",description:"",value:10});
  assert.deepEqual(monthOptions(s), ["2026-03","2026-02"]);
});
