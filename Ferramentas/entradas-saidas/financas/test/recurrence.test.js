import test from "node:test";
import assert from "node:assert/strict";
import { payDates, incomeEntries, incomeInMonth, installmentsTotal } from "../js/core/recurrence.js";

test("payDates mensal cai no dia escolhido em cada mês do range", () => {
  const d = payDates({ frequency:"monthly", monthday:5 }, "2026-01-01", "2026-03-31");
  assert.deepEqual(d, ["2026-01-05","2026-02-05","2026-03-05"]);
});
test("payDates mensal ajusta dia 31 ao último dia do mês", () => {
  const d = payDates({ frequency:"monthly", monthday:31 }, "2026-02-01", "2026-02-28");
  assert.deepEqual(d, ["2026-02-28"]);
});
test("payDates semanal repete no weekday", () => {
  const d = payDates({ frequency:"weekly", weekday:1 }, "2026-01-01", "2026-01-31"); // segundas
  assert.ok(d.length >= 4);
  d.forEach(iso => { const [y,m,day]=iso.split("-").map(Number); assert.equal(new Date(y,m-1,day).getDay(), 1); });
});
test("incomeEntries custom soma parcelas no range", () => {
  const inc = { frequency:"custom", installments:[ {id:"p1",date:"2026-03-05",value:500}, {id:"p2",date:"2026-03-20",value:400}, {id:"p3",date:"2025-12-01",value:999} ] };
  const e = incomeEntries(inc, "2026-01-01", "2026-12-31");
  assert.equal(e.length, 2);
  assert.equal(installmentsTotal(inc), 1899);
});
test("incomeInMonth soma recebimentos regulares do mês", () => {
  const planner = { incomes:[ { id:"i1", frequency:"monthly", monthday:5, value:1000 } ] };
  assert.equal(incomeInMonth(planner, "2026-03"), 1000);
});
