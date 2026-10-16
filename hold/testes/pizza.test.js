/* Testes das pizzas do Painel (hold/js/charts.js e core/atlas-setores.js).
   Rodar: node hold/testes/pizza.test.js  →  imprime "ok". */
"use strict";
var assert = require("assert");
var path = require("path");

global.window = global;
var mem = {};
global.localStorage = {
  getItem: function (k) { return k in mem ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); }
};
require(path.join(__dirname, "../js/charts.js"));
require(path.join(__dirname, "../../core/atlas-setores.js"));
var C = window.Charts, S = window.AtlasSetores;

/* ---- fatias ---- */
var doze = [];
for (var i = 1; i <= 12; i++) doze.push({ label: "T" + i, value: i * 10 });
var r = C.fatias(doze);
assert.equal(r.fatias.length, 7);
assert.equal(r.fatias[6].label, "Outros");
assert.equal(r.fatias[6].value, 10 + 20 + 30 + 40 + 50 + 60);
assert.equal(r.fatias[0].label, "T12");
assert.ok(Math.abs(r.fatias.reduce(function (t, f) { return t + f.frac; }, 0) - 1) < 1e-9);
assert.equal(r.fatias[6].sub, "T6, T5, T4, T3, T2, T1");

r = C.fatias([{ label: "A", value: 50 }, { label: "Outros", value: 10, sub: "X" },
              { label: "B", value: 40 }, { label: "C", value: 0 }]);
assert.deepEqual(r.fatias.map(function (f) { return f.label; }), ["A", "B", "Outros"]);
assert.equal(r.fatias[2].value, 10);
assert.deepEqual(r.semPreco, ["C"]);
assert.equal(r.total, 100);

r = C.fatias([{ label: "A", value: 0 }, { label: "B", value: -1 }]);
assert.equal(r.fatias.length, 0);
assert.equal(r.total, 0);
assert.deepEqual(r.semPreco, ["A", "B"]);

r = C.fatias([{ label: "SOL", value: 5, id: "x1" }]);
assert.equal(r.fatias.length, 1);
assert.equal(r.fatias[0].frac, 1);
assert.equal(r.fatias[0].id, "x1");

/* 8 itens: 6 + Outros com 2 dentro (o limite é 7 fatias no total) */
r = C.fatias([90, 80, 70, 60, 50, 40, 30, 20].map(function (v, i) { return { label: "K" + i, value: v }; }));
assert.equal(r.fatias.length, 7);
assert.equal(r.fatias[6].value, 50);

/* ---- rotulo ---- */
assert.deepEqual(C.rotulo(0.344, "ETH"), { modo: "nome", texto: "34,4%", fonte: 12 });
var p = C.rotulo(0.07, "SOL");
assert.equal(p.modo, "pct"); assert.equal(p.texto, "7%");
assert.equal(C.rotulo(0.03, "SUI").modo, "nenhum");
assert.equal(C.rotulo(0.12, "Reserva de valor").modo, "pct");
/* o nome tem de caber na corda da fatia, não só "ter poucas letras" */
assert.equal(C.rotulo(0.2, "Reserva de valor").modo, "pct");
p = C.rotulo(0.3, "Reserva de valor");
assert.equal(p.modo, "nome"); assert.equal(p.fonte, 10.5);
assert.equal(C.rotulo(0.12, "Oráculos").modo, "nome");

/* 7 fatias sem "Outros": nenhuma cor repete (a última encosta na primeira) */
var sete = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return C.pieColor(i, "T" + i); });
sete.push(C.pieColor(7, "Outros"));
assert.equal(new Set(sete).size, 8);
assert.equal(C.tom("#4C7BD9"), "#4C7BD9");
assert.equal(C.rotulo(0.09, "LINK").modo, "nome");
assert.equal(C.rotulo(0.045, "LINK").modo, "pct");

/* ---- cor por setor ---- */
if (S.cor) {
  assert.equal(S.cor("RWA"), "#8A6AD1");
  assert.equal(S.cor("DeFi"), "#4C7BD9");
  assert.equal(S.cor("Outros"), "#66707F");
  assert.equal(S.cor("xyz"), "#66707F");
  var cores = S.lista.filter(function (s) { return s !== "Outros"; }).map(S.cor);
  assert.equal(new Set(cores).size, cores.length);
  assert.ok(cores.indexOf("#66707F") < 0);
} else {
  throw new Error("AtlasSetores.cor não existe");
}

console.log("ok");
