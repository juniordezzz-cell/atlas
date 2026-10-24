/* O livro-caixa: o caixa corrido, o resumo do mês e o investido.
   Tudo em centavos. Os casos abaixo são as regras combinadas com o
   dono em 23/10/2026 (docs/superpowers/specs/2026-10-23-…). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  caixaAte, resumoMes, serieDiaria, investidoPorDestino, mesesComDados, ordenar
} from "../js/core/livro.js";

let seq = 0;
const L = (data, tipo, centavos, extra = {}) =>
  ({ id: "l" + ++seq, data, tipo, centavos, descricao: "", categoria: null, criadoEm: seq, ...extra });

test("centavos somam exato (0,10 + 0,20 = 0,30)", () => {
  assert.equal(caixaAte([L("2026-10-01", "entrada", 10), L("2026-10-01", "entrada", 20)]), 30);
});

test("caixa pode ficar negativo", () => {
  const l = [L("2026-10-01", "saldo", 20000), L("2026-10-02", "saida", 30000)];
  assert.equal(caixaAte(l), -10000);
});

test("saldo é ponto de partida: o caixa passa a ser exatamente ele", () => {
  const l = [
    L("2026-10-01", "entrada", 99900),
    L("2026-10-05", "saldo", 50000),
    L("2026-10-06", "saida", 980)
  ];
  assert.equal(caixaAte(l), 49020);
});

test("lançamento retroativo antes do saldo não muda o caixa depois dele", () => {
  const l = [L("2026-10-10", "saldo", 50000), L("2026-10-02", "saida", 4500, { criadoEm: 999 })];
  assert.equal(caixaAte(l), 50000);
  assert.equal(caixaAte(l, "2026-10-05"), -4500);
});

test("mesmo dia: vale a ordem em que foi lançado", () => {
  const l = [L("2026-10-10", "saida", 1000), L("2026-10-10", "saldo", 50000), L("2026-10-10", "saida", 500)];
  assert.equal(caixaAte(l), 49500);
  assert.deepEqual(ordenar(l).map((x) => x.centavos), [1000, 50000, 500]);
});

test("caixaAte(data) para no fim daquele dia", () => {
  const l = [L("2026-10-01", "entrada", 50000), L("2026-10-20", "saida", 1000)];
  assert.equal(caixaAte(l, "2026-10-19"), 50000);
  assert.equal(caixaAte(l, "2026-10-20"), 49000);
});

test("investimento sai do caixa mas não é gasto; resgate volta", () => {
  const l = [
    L("2026-10-01", "saldo", 50000),
    L("2026-10-02", "investimento", 10000, { destino: "Binance" }),
    L("2026-10-03", "saida", 980, { categoria: "Transporte" }),
    L("2026-10-04", "resgate", 3000, { destino: "Binance" })
  ];
  assert.equal(caixaAte(l), 50000 - 10000 - 980 + 3000);
  const r = resumoMes(l, "2026-10");
  assert.equal(r.entrou, 0);
  assert.equal(r.saiu, 980);
  assert.equal(r.investido, 10000);
  assert.equal(r.resgatado, 3000);
  assert.deepEqual(r.porCategoria, { Transporte: 980 });
  const inv = investidoPorDestino(l);
  assert.equal(inv.total, 7000);
  assert.deepEqual(inv.destinos, { Binance: 7000 });
});

test("resumo do mês só pega aquele mês e ignora o saldo", () => {
  const l = [
    L("2026-09-30", "entrada", 50000),
    L("2026-10-01", "saldo", 12345),
    L("2026-10-23", "entrada", 50000),
    L("2026-10-23", "saida", 4500, { categoria: "Mercadinho, bar e padaria" }),
    L("2026-10-24", "saida", 500, { categoria: "Mercadinho, bar e padaria" }),
    L("2026-11-01", "saida", 777)
  ];
  const r = resumoMes(l, "2026-10");
  assert.equal(r.entrou, 50000);
  assert.equal(r.saiu, 5000);
  assert.equal(r.quantos.saidas, 2);
  assert.deepEqual(r.porCategoria, { "Mercadinho, bar e padaria": 5000 });
});

test("série diária: um ponto por dia do mês com o caixa no fim do dia", () => {
  const l = [
    L("2026-09-30", "saldo", 10000),
    L("2026-10-02", "entrada", 50000),
    L("2026-10-02", "saida", 1000),
    L("2026-10-05", "investimento", 2000)
  ];
  const s = serieDiaria(l, "2026-10");
  assert.equal(s.length, 31);
  assert.deepEqual(s[0], { dia: 1, entrou: 0, saiu: 0, investiu: 0, caixa: 10000 });
  assert.deepEqual(s[1], { dia: 2, entrou: 50000, saiu: 1000, investiu: 0, caixa: 59000 });
  assert.equal(s[4].investiu, 2000);
  assert.equal(s[4].caixa, 57000);
  assert.equal(s[30].caixa, 57000);
  assert.equal(serieDiaria(l, "2026-02").length, 28);
});

test("meses com dados, do mais novo ao mais velho", () => {
  assert.deepEqual(mesesComDados([L("2026-09-01", "entrada", 1), L("2026-10-03", "saida", 1), L("2026-09-09", "saida", 1)]), ["2026-10", "2026-09"]);
});

test("valores inválidos não contaminam a soma", () => {
  const l = [L("2026-10-01", "entrada", 1000), L("2026-10-02", "saida", 1.5), L("2026-10-02", "saida", -50), L("2026-10-02", "xyz", 70)];
  assert.equal(caixaAte(l), 1000);
});
