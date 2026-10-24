/* Dinheiro em centavos inteiros. Em float, 0,1 + 0,2 dá
   0,30000000000000004 — numa ferramenta de dinheiro isso vira um
   centavo sumido no fim do mês. Aqui cada valor entra e sai como
   inteiro; só a tela divide por 100. */
import test from "node:test";
import assert from "node:assert/strict";
import { paraCentavos, formatarCentavos, centavosDeReais } from "../js/core/dinheiro.js";

test("vírgula é decimal, ponto de três casas é milhar", () => {
  assert.equal(paraCentavos("9,80"), 980);
  assert.equal(paraCentavos("9,8"), 980);
  assert.equal(paraCentavos("9.80"), 980);
  assert.equal(paraCentavos("1.500"), 150000);
  assert.equal(paraCentavos("1.500,50"), 150050);
  assert.equal(paraCentavos("12.345.678,90"), 1234567890);
  assert.equal(paraCentavos("1,500.50"), 150050);
  assert.equal(paraCentavos("500"), 50000);
  assert.equal(paraCentavos("R$ 45"), 4500);
  assert.equal(paraCentavos("r$45,00"), 4500);
});

test("mil e k", () => {
  assert.equal(paraCentavos("2 mil"), 200000);
  assert.equal(paraCentavos("2,5 mil"), 250000);
  assert.equal(paraCentavos("1k"), 100000);
});

test("lixo, zero e negativo não viram dinheiro", () => {
  assert.equal(paraCentavos(""), null);
  assert.equal(paraCentavos("abc"), null);
  assert.equal(paraCentavos("0"), null);
  assert.equal(paraCentavos("0,00"), null);
  assert.equal(paraCentavos("9,805"), null);
});

test("reais antigos (float) arredondam ao centavo", () => {
  assert.equal(centavosDeReais(9.8), 980);
  assert.equal(centavosDeReais(0.1 + 0.2), 30);
  assert.equal(centavosDeReais(1550), 155000);
  assert.equal(centavosDeReais("x"), 0);
});

test("formato brasileiro", () => {
  const sem = (s) => s.replace(/\s/g, " ");
  assert.equal(sem(formatarCentavos(128440)), "R$ 1.284,40");
  assert.equal(sem(formatarCentavos(-10000)), "-R$ 100,00");
  assert.equal(sem(formatarCentavos(5, { sinal: true })), "+R$ 0,05");
  assert.equal(sem(formatarCentavos(0)), "R$ 0,00");
});
