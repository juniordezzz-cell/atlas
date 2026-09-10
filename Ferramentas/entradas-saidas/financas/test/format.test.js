import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, parseMoney, formatDate, getMonthKey, monthLabel, yearMonthKeys } from "../js/core/format.js";

test("formatCurrency formata em BRL", () => {
  assert.equal(formatCurrency(1550).replace(/\u00A0/g, " "), "R$ 1.550,00");
  assert.equal(formatCurrency(0).replace(/\u00A0/g, " "), "R$ 0,00");
});
test("parseMoney entende pt-BR", () => {
  assert.equal(parseMoney("R$ 1.550,50"), 1550.5);
  assert.equal(parseMoney(1200), 1200);
  assert.equal(parseMoney("abc"), 0);
});
test("formatDate inverte ISO", () => {
  assert.equal(formatDate("2026-03-05"), "05/03/2026");
});
test("getMonthKey e monthLabel", () => {
  assert.equal(getMonthKey("2026-03-05"), "2026-03");
  assert.equal(monthLabel("2026-03"), "Março / 2026");
});
test("yearMonthKeys gera 12 chaves", () => {
  const ks = yearMonthKeys(2026);
  assert.equal(ks.length, 12);
  assert.equal(ks[0], "2026-01");
  assert.equal(ks[11], "2026-12");
});
