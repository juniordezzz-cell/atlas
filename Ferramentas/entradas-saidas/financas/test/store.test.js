import test from "node:test";
import assert from "node:assert/strict";

// shim de localStorage p/ Node
class LS { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} }
globalThis.localStorage = new LS();

const { getState, saveState, updateState, freshState, migrateState, resetState, STORAGE_KEY } = await import("../js/core/store.js");

test("estado inicial é vazio (freshState) quando não há nada salvo", () => {
  const s = getState();
  assert.deepEqual(s.entries, []);
  assert.deepEqual(s.expenses, []);
  assert.equal(s.summary.saldo, 0);
});
test("saveState persiste no localStorage e getState relê", () => {
  saveState({ ...freshState(), entries: [{ id: "e1", date: "2026-03-01", source: "Salário", description: "x", value: 100 }] });
  const s = getState();
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].value, 100);
  assert.ok(localStorage.getItem(STORAGE_KEY));
});
test("updateState aplica o updater e salva", () => {
  updateState((cur) => { cur.profile.name = "Ana"; return cur; });
  assert.equal(getState().profile.name, "Ana");
});
test("migrateState renomeia tipos legados", () => {
  const s = migrateState({ expenses: [{ type: "Essenciais" }], categories: [{ type: "Não essenciais" }] });
  assert.equal(s.expenses[0].type, "Gastos fixos");
  assert.equal(s.categories[0].type, "Gastos não fixos");
});
test("resetState limpa para o estado vazio", () => {
  resetState();
  assert.deepEqual(getState().entries, []);
});
