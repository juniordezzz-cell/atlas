/* Extrato colado do banco (pedido do dono, 24/10/2026).
   O arquivo de teste é o extrato real que ele mandou: 29 lançamentos
   de 24/09 a 24/10. Os totais abaixo foram somados à mão. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerExtrato, pareceExtrato } from "../js/core/extrato.js";
import { MERCADINHO } from "../js/core/categorias.js";

const HOJE = "2026-10-24";
const TEXTO = readFileSync(new URL("./dados/extrato-2026-10.txt", import.meta.url), "utf8");
const soma = (itens, pred) => itens.filter(pred).reduce((a, i) => a + i.centavos, 0);

test("reconhece o formato e lê os 29 lançamentos", () => {
  assert.equal(pareceExtrato(TEXTO), true);
  const r = lerExtrato(TEXTO, { hoje: HOJE });
  assert.deepEqual(r.erros, []);
  assert.equal(r.itens.length, 29);
});

test("totais batem ao centavo", () => {
  const { itens } = lerExtrato(TEXTO, { hoje: HOJE });
  assert.equal(soma(itens, (i) => i.tipo === "entrada"), 195000);
  assert.equal(soma(itens, (i) => i.tipo === "saida"), 96524);
  assert.equal(soma(itens, (i) => i.tipo === "transferencia"), 71300);
  assert.equal(itens.filter((i) => i.tipo === "entrada").length, 6);
  assert.equal(itens.filter((i) => i.tipo === "saida").length, 21);
  assert.ok(itens.filter((i) => i.tipo === "transferencia").every((i) => i.sentido === "saida"));
});

test("cada campo no lugar", () => {
  const { itens } = lerExtrato(TEXTO, { hoje: HOJE });
  assert.deepEqual(itens[0], { data: "2026-09-24", tipo: "saida", centavos: 190, descricao: "Cartao + Protegido", categoria: "Seguro/Tarifas" });
  assert.deepEqual([itens[1].tipo, itens[1].descricao, itens[1].categoria], ["entrada", "Jones Silveira", "Recebimento"]);
  assert.deepEqual([itens[3].descricao, itens[3].categoria], ["Marlene Stifft Seefeldt", MERCADINHO]);
  assert.equal(itens[4].categoria, "A definir");
  assert.equal(itens[10].descricao, "Vighor Empreendimentos Ltda (posto)");
  assert.equal(itens[10].categoria, "Moto - Combustível");
  assert.equal(itens[15].descricao, "Uber do Brasil");
  assert.equal(itens[2].descricao, "Claude (Google Brasil Pagamentos - Pix Automático)");
});

test("colado numa linha só (campo que junta as linhas) dá o mesmo resultado", () => {
  const umaLinha = TEXTO.replace(/\s*\n\s*/g, " ");
  const a = lerExtrato(TEXTO, { hoje: HOJE }).itens;
  const b = lerExtrato(umaLinha, { hoje: HOJE }).itens;
  assert.deepEqual(b, a);
});

test("separado por tabulação (copiado de planilha)", () => {
  const r = lerExtrato("2026-10-12\tUBER DO BRASIL\tPix enviado\tTransporte\t-11,96\n2026-10-16\tJONES\tPix recebido\tEntrada - Jones\t250,00", { hoje: HOJE });
  assert.deepEqual(r.itens.map((i) => [i.tipo, i.centavos]), [["saida", 1196], ["entrada", 25000]]);
});

test("data no formato brasileiro", () => {
  const r = lerExtrato("12/10/2026\nUBER DO BRASIL\nPix enviado\nTransporte\n-11.96", { hoje: HOJE });
  assert.equal(r.itens[0].data, "2026-10-12");
});

test("categoria aprendida preenche o 'a definir'", () => {
  const r = lerExtrato("2026-10-11\nCAROLINE GARCIA\nPix enviado\nA definir (pessoa)\n-5.00", { hoje: HOJE, aprendizado: { "caroline garcia": "Família e amigos" } });
  assert.equal(r.itens[0].categoria, "Família e amigos");
});

test("sem categoria no extrato: adivinha pelo nome ou fica a definir", () => {
  const r = lerExtrato("2026-10-12\nUBER DO BRASIL\nPix enviado\n-11.96\n2026-10-13\nFULANO\nPix enviado\n-3.00", { hoje: HOJE });
  assert.deepEqual(r.itens.map((i) => i.categoria), ["Transporte", "A definir"]);
});

test("data no futuro e valor estranho viram erro, sem derrubar o resto", () => {
  const r = lerExtrato("2026-12-01\nX\nPix enviado\nOutros\n-1.00\n2026-10-01\nY\nPix enviado\nOutros\n-abc\n2026-10-02\nZ\nPix enviado\nOutros\n-2.00", { hoje: HOJE });
  assert.equal(r.itens.length, 1);
  assert.equal(r.erros.length, 2);
});

test("frase normal não é extrato", () => {
  assert.equal(pareceExtrato("gastei 9,80 no uber"), false);
  assert.equal(pareceExtrato("recebi 500 em 15/10"), false);
  assert.equal(pareceExtrato("uber 10\npadaria 5"), false);
});
