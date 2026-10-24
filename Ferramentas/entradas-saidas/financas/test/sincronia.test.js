/* Juntar o que está no celular com o que está no computador (24/10/2026).
   Regra: nada some sem o dono apagar, nada aparece duas vezes. */
import test from "node:test";
import assert from "node:assert/strict";
import { mesclar, iguais } from "../js/core/sincronia.js";
import { estadoVazio } from "../js/core/store.js";

const L = (id, extra = {}) => ({ id, data: "2026-10-12", tipo: "saida", centavos: 1000, descricao: "Uber", categoria: "Transporte", criadoEm: 1, ...extra });
const E = (lancs, extra = {}) => ({ ...estadoVazio(), lancamentos: lancs, ...extra });

test("celular vazio não apaga o computador (e vice-versa)", () => {
  const pc = E([L("a"), L("b", { centavos: 2000 })]);
  const cel = E([]);
  assert.equal(mesclar(cel, pc).lancamentos.length, 2);
  assert.equal(mesclar(pc, cel).lancamentos.length, 2);
});

test("lançamentos diferentes dos dois lados somam", () => {
  const m = mesclar(E([L("a")]), E([L("b", { descricao: "Padaria", centavos: 500 })]));
  assert.deepEqual(m.lancamentos.map((l) => l.id).sort(), ["a", "b"]);
});

test("apagado num aparelho some no outro", () => {
  const pc = E([L("a"), L("b")]);
  const cel = E([L("b")], { removidos: { a: 50 } });
  assert.deepEqual(mesclar(pc, cel).lancamentos.map((l) => l.id), ["b"]);
  assert.deepEqual(mesclar(cel, pc).lancamentos.map((l) => l.id), ["b"]);
  assert.equal(mesclar(pc, cel).removidos.a, 50);
});

test("corrigido num aparelho: vale a correção mais nova", () => {
  const pc = E([L("a", { tipo: "transferencia", sentido: "saida", editadoEm: 0 })]);
  const cel = E([L("a", { tipo: "saida", categoria: "Contas da casa", editadoEm: 99 })]);
  for (const m of [mesclar(pc, cel), mesclar(cel, pc)]) {
    assert.deepEqual([m.lancamentos[0].tipo, m.lancamentos[0].categoria], ["saida", "Contas da casa"]);
  }
});

test("mesmo extrato importado nos dois aparelhos não duplica", () => {
  const pc = E([L("p1", { origem: "extrato", criadoEm: 5 }), L("p2", { origem: "extrato", descricao: "Padaria", criadoEm: 6 })]);
  const cel = E([L("c1", { origem: "extrato", criadoEm: 9 }), L("c2", { origem: "extrato", descricao: "Padaria", criadoEm: 10 })]);
  const m1 = mesclar(pc, cel), m2 = mesclar(cel, pc);
  assert.equal(m1.lancamentos.length, 2);
  // os dois aparelhos escolhem o mesmo (o mais antigo) e marcam o outro como apagado
  assert.deepEqual(m1.lancamentos.map((l) => l.id).sort(), ["p1", "p2"]);
  assert.ok(iguais(m1, m2));
  assert.ok(m1.removidos.c1 && m1.removidos.c2);
});

test("dois iguais no mesmo extrato continuam dois", () => {
  const pc = E([L("p1", { origem: "extrato", criadoEm: 1 }), L("p2", { origem: "extrato", criadoEm: 2 })]);
  const cel = E([L("c1", { origem: "extrato", criadoEm: 3 }), L("c2", { origem: "extrato", criadoEm: 4 })]);
  assert.equal(mesclar(pc, cel).lancamentos.length, 2);
});

test("dois 'uber 10' lançados à mão em aparelhos diferentes são dois gastos", () => {
  const m = mesclar(E([L("a")]), E([L("b")]));
  assert.equal(m.lancamentos.length, 2);
});

test("aprendizado e metas: junta, e a meta mais nova vence", () => {
  const pc = E([], { aprendizado: { marlene: "Mercadinho" }, metas: { mensal: 80000, categorias: {} }, metasEm: 10 });
  const cel = E([], { aprendizado: { uber: "Transporte" }, metas: { mensal: 50000, categorias: { Lazer: 10000 } }, metasEm: 20 });
  const m = mesclar(pc, cel);
  assert.deepEqual(m.aprendizado, { marlene: "Mercadinho", uber: "Transporte" });
  assert.deepEqual(m.metas, { mensal: 50000, categorias: { Lazer: 10000 } });
});

test("mesclar é estável: mesclar de novo não muda nada", () => {
  const a = E([L("a"), L("b", { origem: "extrato" })], { removidos: { z: 1 } });
  const b = E([L("c", { origem: "extrato" })]);
  const m = mesclar(a, b);
  assert.ok(iguais(mesclar(m, b), m));
  assert.ok(iguais(mesclar(m, m), m));
});
