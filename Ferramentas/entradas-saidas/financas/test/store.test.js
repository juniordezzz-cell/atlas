/* Armazenamento v2 (23/10/2026) e migração do formato antigo. */
import test from "node:test";
import assert from "node:assert/strict";

// shim de localStorage p/ Node
class LS { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} }
globalThis.localStorage = new LS();

const {
  lerEstado, salvarEstado, estadoVazio, migrarEstado, adicionar, atualizar, remover,
  getState, resetState, STORAGE_KEY, BACKUP_KEY
} = await import("../js/core/store.js");

const HOJE = "2026-10-23";

test("sem nada salvo, o estado é vazio v2", () => {
  const s = lerEstado();
  assert.equal(s.versao, 2);
  assert.deepEqual(s.lancamentos, []);
  assert.deepEqual(s.aprendizado, {});
  assert.deepEqual(s.metas, { mensal: null, categorias: {} });
});

test("migra entries/expenses antigos: só o que já aconteceu, em centavos", () => {
  const antigo = {
    entries: [
      { id: "e1", date: "2026-10-05", source: "Salário", description: "", value: 1550 },
      { id: "e2", date: "2026-12-05", source: "Salário", description: "previsto", value: 1550 }
    ],
    expenses: [{ id: "d1", date: "2026-10-07", category: "Transporte", type: "Gastos fixos", description: "Uber", value: 9.8 }],
    planner: { incomes: [] },
    profile: { name: "Ana" },
    settings: { animations: true }
  };
  const s = migrarEstado(antigo, HOJE);
  assert.equal(s.versao, 2);
  assert.equal(s.lancamentos.length, 2);
  const [a, b] = s.lancamentos;
  assert.deepEqual([a.tipo, a.centavos, a.data, a.categoria], ["entrada", 155000, "2026-10-05", "Salário"]);
  assert.deepEqual([b.tipo, b.centavos, b.descricao, b.categoria], ["saida", 980, "Uber", "Transporte"]);
  assert.equal(s.planner, undefined);
  assert.equal(s.entries, undefined);
  assert.equal(s.profile.name, "Ana");
});

test("migrar de novo não duplica (idempotente)", () => {
  const s = migrarEstado({ entries: [{ id: "e1", date: "2026-10-05", source: "S", value: 10 }] }, HOJE);
  const de_novo = migrarEstado(JSON.parse(JSON.stringify(s)), HOJE);
  assert.deepEqual(de_novo, s);
});

test("lerEstado guarda o formato antigo inteiro antes de migrar", () => {
  const antigo = { entries: [{ id: "e1", date: "2026-10-01", source: "S", value: 10 }], expenses: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(antigo));
  const s = lerEstado(HOJE);
  assert.equal(s.lancamentos.length, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem(BACKUP_KEY)), antigo);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).versao, 2);
});

test("lixo no armazenamento vira estado vazio, sem quebrar", () => {
  localStorage.setItem(STORAGE_KEY, "{oops");
  assert.deepEqual(lerEstado().lancamentos, []);
});

test("lançamento inválido de um backup é descartado na migração", () => {
  const s = migrarEstado({ versao: 2, lancamentos: [
    { id: "a", data: "2026-10-01", tipo: "saida", centavos: 980, criadoEm: 1 },
    { id: "b", data: "ontem", tipo: "saida", centavos: 980 },
    { id: "c", data: "2026-10-01", tipo: "saida", centavos: 9.8 },
    { id: "d", data: "2026-10-01", tipo: "roubo", centavos: 100 }
  ] }, HOJE);
  assert.deepEqual(s.lancamentos.map((l) => l.id), ["a"]);
});

test("adicionar, atualizar e remover", () => {
  let s = estadoVazio();
  s = adicionar(s, { data: "2026-10-23", tipo: "saida", centavos: 980, descricao: "Uber", categoria: "Transporte" });
  const id = s.lancamentos[0].id;
  assert.ok(id);
  assert.ok(Number.isFinite(s.lancamentos[0].criadoEm));
  s = atualizar(s, id, { centavos: 1100 });
  assert.equal(s.lancamentos[0].centavos, 1100);
  s = remover(s, id);
  assert.equal(s.lancamentos.length, 0);
});

test("salvar e reler; resetState zera", () => {
  salvarEstado(adicionar(estadoVazio(), { data: "2026-10-23", tipo: "entrada", centavos: 50000 }));
  assert.equal(getState().lancamentos.length, 1);
  resetState();
  assert.equal(getState().lancamentos.length, 0);
});
