/* A conversa do Oráculo do Finanças: lança, pergunta o que não
   entendeu, aprende com a resposta e desfaz. */
import test from "node:test";
import assert from "node:assert/strict";
import { criarConversa } from "../js/core/conversa.js";
import { estadoVazio } from "../js/core/store.js";
import { caixaAte } from "../js/core/livro.js";

const HOJE = "2026-10-23";
function nova(estado = estadoVazio()) {
  let s = estado;
  const c = criarConversa({ ler: () => JSON.parse(JSON.stringify(s)), salvar: (x) => { s = x; }, hoje: () => HOJE });
  return { c, estado: () => s };
}

test("lança e responde com o caixa", () => {
  const { c, estado } = nova();
  c.responder("tenho 500 em caixa");
  const r = c.responder("gastei 9,80 no uber");
  assert.equal(estado().lancamentos.length, 2);
  assert.equal(caixaAte(estado().lancamentos), 49020);
  assert.match(r.texto, /R\$\s9,80/);
  assert.match(r.texto, /Transporte/);
  assert.match(r.texto, /Caixa agora: R\$\s490,20/);
  assert.ok(r.sugestoes.includes("Desfazer"));
});

test("não entendeu a categoria: pergunta, lança com a resposta e aprende", () => {
  const { c, estado } = nova();
  const p = c.responder("gastei 7 no tacacá");
  assert.equal(estado().lancamentos.length, 0);
  assert.match(p.texto, /categoria/i);
  assert.ok(p.sugestoes.includes("Outros"));
  c.responder("comer fora");
  assert.equal(estado().lancamentos.length, 1);
  assert.equal(estado().lancamentos[0].categoria, "Comer fora");
  assert.equal(estado().aprendizado.tacaca, "Comer fora");
  // da segunda vez não pergunta
  const r = c.responder("tacacá 8");
  assert.equal(estado().lancamentos.length, 2);
  assert.equal(estado().lancamentos[1].categoria, "Comer fora");
  assert.doesNotMatch(r.texto, /categoria\?/i);
});

test("categoria nova digitada pelo dono vale", () => {
  const { c, estado } = nova();
  c.responder("paguei 300 pro joaquim");
  c.responder("pedreiro");
  assert.equal(estado().lancamentos[0].categoria, "Pedreiro");
});

test("palavra genérica não é aprendida", () => {
  const { c, estado } = nova();
  c.responder("fiz um pagamento de 300");
  c.responder("Contas da casa");
  assert.equal(estado().lancamentos[0].categoria, "Contas da casa");
  assert.equal(estado().aprendizado.pagamento, undefined);
});

test("sem tipo: pergunta se é ganho, despesa ou investimento", () => {
  const { c, estado } = nova();
  const p = c.responder("joaquim 50");
  assert.deepEqual(p.sugestoes.slice(0, 3), ["Ganho", "Despesa", "Investimento"]);
  c.responder("Ganho");
  assert.equal(estado().lancamentos[0].tipo, "entrada");
});

test("mensagem nova com valor no meio da pergunta: a pendente fica de fora", () => {
  const { c, estado } = nova();
  c.responder("gastei 7 no xpto");
  const r = c.responder("recebi 500");
  assert.equal(estado().lancamentos.length, 1);
  assert.equal(estado().lancamentos[0].tipo, "entrada");
  assert.match(r.texto, /não lancei/i);
});

test("desfazer tira o último lote inteiro", () => {
  const { c, estado } = nova();
  c.responder("recebi 500");
  c.responder("uber 10 e padaria 5");
  assert.equal(estado().lancamentos.length, 3);
  const r = c.responder("desfazer");
  assert.equal(estado().lancamentos.length, 1);
  assert.match(r.texto, /Desfeito/);
});

test("caixa negativo avisa", () => {
  const { c } = nova();
  c.responder("tenho 200 em caixa");
  const r = c.responder("fiz um pagamento de 300 de aluguel");
  assert.match(r.texto, /negativo/);
  assert.match(r.texto, /-R\$\s100,00/);
});

test("investimento não conta como gasto", () => {
  const { c, estado } = nova();
  c.responder("tenho 500 em caixa");
  c.responder("mandei 100 pra binance");
  const r = c.responder("quanto gastei esse mês?");
  assert.match(r.texto, /R\$\s0,00/);
  assert.equal(caixaAte(estado().lancamentos), 40000);
  assert.match(c.responder("quanto investi?").texto, /Binance/);
});

test("perguntas: quanto tenho, gastei com X, recebi", () => {
  const { c } = nova();
  c.responder("recebi 1.000");
  c.responder("uber 10, gasolina 50, padaria 5");
  assert.match(c.responder("quanto tenho?").texto, /R\$\s935,00/);
  assert.match(c.responder("quanto gastei com transporte?").texto, /R\$\s60,00/);
  assert.match(c.responder("quanto gastei esse mês").texto, /R\$\s65,00/);
  assert.match(c.responder("quanto recebi?").texto, /R\$\s1\.000,00/);
  // os botões do Oráculo usam os termos novos (ganhos e despesas)
  assert.match(c.responder("Despesas do mês").texto, /^Despesas em .*R\$\s65,00/);
  assert.match(c.responder("meus ganhos").texto, /^Ganhos em .*R\$\s1\.000,00/);
});

test("lançamento de antes do acerto de caixa avisa que não muda o caixa", () => {
  const { c, estado } = nova();
  c.responder("tenho 800 em caixa");
  const r = c.responder("ontem recebi 500");
  assert.equal(caixaAte(estado().lancamentos), 80000);
  assert.match(r.texto, /antes do seu acerto de caixa/);
  assert.doesNotMatch(c.responder("uber 10").texto, /acerto/);
});

test("extrato colado: importa tudo, não repete, aprende e desfaz", async () => {
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(new URL("./dados/extrato-2026-10.txt", import.meta.url), "utf8");
  let s = estadoVazio();
  const c = criarConversa({ ler: () => JSON.parse(JSON.stringify(s)), salvar: (x) => { s = x; }, hoje: () => "2026-10-24" });
  const r = c.responder(texto);
  assert.equal(s.lancamentos.length, 29);
  // sem acerto de caixa: 1.950,00 − 965,24 − 713,00
  assert.equal(caixaAte(s.lancamentos), 27176);
  assert.match(r.texto, /Importei 29/);
  assert.match(r.texto, /Ganhos: R\$\s1\.950,00 \(6\)/);
  assert.match(r.texto, /Despesas: R\$\s965,24 \(21\)/);
  assert.match(r.texto, /Transferências entre contas suas: R\$\s713,00 saíram/);
  assert.match(r.texto, /6 ficaram em "A definir"/);
  assert.equal(s.aprendizado["marlene stifft seefeldt"], "Mercadinho, bar e padaria");
  assert.equal(s.aprendizado.marlene, "Mercadinho, bar e padaria");
  // colar de novo não duplica
  const r2 = c.responder(texto);
  assert.equal(s.lancamentos.length, 29);
  assert.match(r2.texto, /já estava lançado/);
  // o que aprendeu vale na frase normal
  c.responder("pix marlene 40");
  assert.equal(s.lancamentos[29].categoria, "Mercadinho, bar e padaria");
  c.responder("desfazer");
  assert.equal(s.lancamentos.length, 29);
});

test("reimportar depois de corrigir o tipo não duplica", async () => {
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(new URL("./dados/extrato-2026-10.txt", import.meta.url), "utf8");
  let s = estadoVazio();
  const c = criarConversa({ ler: () => JSON.parse(JSON.stringify(s)), salvar: (x) => { s = x; }, hoje: () => "2026-10-24" });
  c.responder(texto);
  const pai = s.lancamentos.find((l) => l.centavos === 50000 && l.data === "2026-10-12");
  // o dono troca no lápis: transferência → despesa
  Object.assign(pai, { tipo: "saida", categoria: "Contas da casa" });
  delete pai.sentido;
  const r = c.responder(texto);
  assert.equal(s.lancamentos.length, 29);
  assert.match(r.texto, /já estava lançado/);
  assert.equal(caixaAte(s.lancamentos), 27176);
});

test("erro de leitura não lança nada", () => {
  const { c, estado } = nova();
  const r = c.responder("recebi 500 em 30/12/2026");
  assert.equal(estado().lancamentos.length, 0);
  assert.match(r.texto, /ainda não chegou/);
});
