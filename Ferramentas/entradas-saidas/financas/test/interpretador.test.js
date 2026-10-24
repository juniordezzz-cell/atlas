/* O Oráculo do Finanças entende frases curtas, sem IA: regras locais.
   Hoje fixo em 23/10/2026 (sexta) para os testes não dependerem do dia. */
import test from "node:test";
import assert from "node:assert/strict";
import { interpretar, interpretarData } from "../js/core/interpretador.js";
import { MERCADINHO } from "../js/core/categorias.js";

const HOJE = "2026-10-23";
const um = (texto, ctx = {}) => {
  const r = interpretar(texto, { hoje: HOJE, aprendizado: {}, ...ctx });
  assert.equal(r.erro, undefined, r.erro);
  assert.equal(r.itens.length, 1, JSON.stringify(r.itens));
  return r.itens[0];
};

test("uber 9,80 sem verbo é saída em Transporte, hoje", () => {
  const i = um("uber 9,80");
  assert.deepEqual([i.tipo, i.centavos, i.data, i.categoria, i.descricao], ["saida", 980, HOJE, "Transporte", "Uber"]);
});

test("recebi 500 é entrada", () => {
  const i = um("hoje eu recebi R$500");
  assert.deepEqual([i.tipo, i.centavos, i.categoria], ["entrada", 50000, "Recebimento"]);
});

test("corrida no 99: o 99 é o aplicativo, não o valor", () => {
  const i = um("gastei 11 numa corrida no 99");
  assert.equal(i.centavos, 1100);
  assert.equal(i.categoria, "Transporte");
  assert.match(i.descricao, /99/);
});

test("99 sozinho é valor", () => {
  assert.equal(um("gastei 99 no mercado").centavos, 9900);
});

test("gasolina, bar, mercadinho, padaria e mercado", () => {
  assert.equal(um("botei 50 de gasolina").categoria, "Transporte");
  assert.equal(um("bar 30").categoria, MERCADINHO);
  assert.equal(um("gastei 45 no mercadinho").categoria, MERCADINHO);
  assert.equal(um("padaria 12,50").categoria, MERCADINHO);
  assert.equal(um("comprei 8 reais na venda").categoria, MERCADINHO);
  assert.equal(um("mercado 210").categoria, "Mercado");
  assert.equal(um("supermercado 210").categoria, "Mercado");
});

test("pagamento genérico fica sem categoria (o Oráculo pergunta)", () => {
  const i = um("fiz um pagamento de 300 reais");
  assert.deepEqual([i.tipo, i.centavos, i.categoria], ["saida", 30000, null]);
});

test("aprendido vale antes do dicionário", () => {
  const i = um("pastel da feira 7", { aprendizado: { pastel: "Mercadinho, bar e padaria" } });
  assert.equal(i.categoria, MERCADINHO);
});

test("tenho 500 em caixa é saldo", () => {
  const i = um("tenho 500 em caixa");
  assert.deepEqual([i.tipo, i.centavos], ["saldo", 50000]);
  assert.equal(um("meu saldo é 1.200,50").centavos, 120050);
});

test("mandei 100 pra Binance é investimento, não gasto", () => {
  const i = um("mandei 100 reais pra binance");
  assert.deepEqual([i.tipo, i.centavos, i.destino], ["investimento", 10000, "Binance"]);
});

test("tirei 200 da Binance é resgate", () => {
  const i = um("tirei 200 da binance");
  assert.deepEqual([i.tipo, i.centavos, i.destino], ["resgate", 20000, "Binance"]);
});

test("investi 300 sem destino vai para Investimentos", () => {
  const i = um("investi 300");
  assert.deepEqual([i.tipo, i.destino], ["investimento", "Investimentos"]);
});

test("várias numa frase só; o verbo passa adiante", () => {
  const r = interpretar("gastei 9,80 no uber e 45 no mercadinho", { hoje: HOJE, aprendizado: {} });
  assert.deepEqual(r.itens.map((i) => [i.tipo, i.centavos, i.categoria]),
    [["saida", 980, "Transporte"], ["saida", 4500, MERCADINHO]]);
  const r2 = interpretar("uber 9,80, padaria 6; recebi 500", { hoje: HOJE, aprendizado: {} });
  assert.deepEqual(r2.itens.map((i) => [i.tipo, i.centavos]), [["saida", 980], ["saida", 600], ["entrada", 50000]]);
});

test("'e' dentro da descrição não divide", () => {
  const r = interpretar("paguei luz e agua 150", { hoje: HOJE, aprendizado: {} });
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].centavos, 15000);
  assert.equal(r.itens[0].categoria, "Contas da casa");
});

test("datas: ontem, anteontem, dia N, N/M, dia da semana", () => {
  assert.equal(um("ontem uber 10").data, "2026-10-22");
  assert.equal(um("anteontem uber 10").data, "2026-10-21");
  assert.equal(um("dia 20 recebi 500").data, "2026-10-20");
  assert.equal(um("recebi 500 dia 27").data, "2026-09-27");
  assert.equal(um("recebi 500 dia 30").data, "2026-09-30");
  assert.equal(um("recebi 500 em 15/10").data, "2026-10-15");
  assert.equal(interpretarData("27/12", "2027-01-05").data, "2026-12-27");
  assert.equal(um("segunda paguei 20 de onibus").data, "2026-10-19");
  assert.equal(um("sexta uber 10").data, HOJE);
  assert.equal(um("sexta passada uber 10").data, "2026-10-16");
});

test("dia 31 num mês de 30 dias volta ao último mês com 31", () => {
  assert.equal(interpretarData("dia 31", "2026-10-15").data, "2026-08-31");
  assert.equal(interpretarData("dia 30", "2026-03-10").data, "2026-01-30");
});

test("data no futuro é recusada", () => {
  const r = interpretar("recebi 500 em 30/12/2026", { hoje: HOJE, aprendizado: {} });
  assert.match(r.erro, /ainda não chegou/);
  assert.match(interpretar("27/10 recebi 500", { hoje: HOJE, aprendizado: {} }).erro, /ainda não chegou/);
});

test("data impossível é recusada", () => {
  assert.match(interpretar("uber 10 em 31/02", { hoje: HOJE, aprendizado: {} }).erro, /data/i);
});

test("sem valor, ou dois valores soltos, não chuta", () => {
  assert.match(interpretar("gastei no uber", { hoje: HOJE, aprendizado: {} }).erro, /valor/);
  assert.match(interpretar("gastei 10 20 no uber", { hoje: HOJE, aprendizado: {} }).erro, /mais de um/);
});

test("sem verbo e sem categoria conhecida: pergunta o tipo", () => {
  const i = um("joaquim 50");
  assert.equal(i.tipo, null);
});

test("valores com mil e centavos", () => {
  assert.equal(um("recebi 2,5 mil").centavos, 250000);
  assert.equal(um("recebi 1.500").centavos, 150000);
  assert.equal(um("paguei R$ 1.234,56 de aluguel").centavos, 123456);
});
