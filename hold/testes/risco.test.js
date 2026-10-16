/* Testes do laboratório de risco (core/atlas-risco.js) e das séries
   (core/atlas-series.js). Rodar: node hold/testes/risco.test.js → "ok". */
"use strict";
var assert = require("assert");
var path = require("path");

global.window = global;
var mem = {};
global.localStorage = {
  getItem: function (k) { return k in mem ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); }
};
require(path.join(__dirname, "../../core/atlas-risco.js"));
var R = window.AtlasRisco;

function dia(i) {   // 2026-07-01 + i dias
  var d = new Date(Date.UTC(2026, 6, 1 + i));
  return d.toISOString().slice(0, 10);
}
function serie(precos, desde) {
  return precos.map(function (p, i) { return { d: dia((desde || 0) + i), p: p }; });
}
function quase(a, b, tol) { assert.ok(Math.abs(a - b) < (tol || 1e-9), a + " ≉ " + b); }

/* A alterna +10%/-10%; B parado (stablecoin) */
var pa = [100], pb = [];
for (var i = 1; i < 40; i++) pa.push(pa[i - 1] * (i % 2 ? 1.1 : 0.9));
for (i = 0; i < 40; i++) pb.push(1);
var soA = R.calcular([{ label: "A", qtd: 1, serie: serie(pa) }]);
var r = R.calcular([{ label: "A", qtd: 1, serie: serie(pa) },
                    { label: "B", qtd: 100, serie: serie(pb), stable: true }]);
assert.equal(r.dias, 40);
assert.deepEqual(r.fora, []);
assert.deepEqual(r.correlacao.labels, ["A"]);
quase(r.contribuicao.filter(function (c) { return c.label === "B"; })[0].risco, 0);
quase(r.contribuicao.filter(function (c) { return c.label === "A"; })[0].risco, 1);
quase(r.contribuicao.reduce(function (t, c) { return t + c.peso; }, 0), 1);
assert.ok(r.volatilidade > 0 && r.volatilidade < soA.volatilidade);
/* um ativo só: vol = desvio dos retornos × √365 */
var rets = []; for (i = 1; i < 40; i++) rets.push(pa[i] / pa[i - 1] - 1);
var med = rets.reduce(function (t, x) { return t + x; }, 0) / rets.length;
var dp = Math.sqrt(rets.reduce(function (t, x) { return t + (x - med) * (x - med); }, 0) / (rets.length - 1));
quase(soA.volatilidade, dp * Math.sqrt(365), 1e-12);

/* pior queda e pior dia */
var pq = [100, 120, 90, 95]; while (pq.length < 40) pq.push(110);
var q = R.calcular([{ label: "Q", qtd: 1, serie: serie(pq) }]);
quase(q.piorQueda.pct, 90 / 120 - 1);
assert.equal(q.piorQueda.pico, dia(1));
assert.equal(q.piorQueda.fundo, dia(2));
quase(q.piorDia.pct, 90 / 120 - 1);
assert.equal(q.piorDia.d, dia(2));

/* histórico curto sai do cálculo */
var c = R.calcular([{ label: "A", qtd: 1, serie: serie(pa) },
                    { label: "C", qtd: 1, serie: serie(pa.slice(0, 12), 28) }]);
assert.deepEqual(c.fora, ["C"]);
assert.equal(c.dias, 40);

/* buraco: só dias presentes em todas */
var comBuraco = serie(pa).filter(function (x, i) { return i !== 10; });
var b = R.calcular([{ label: "A", qtd: 1, serie: comBuraco }, { label: "D", qtd: 1, serie: serie(pa) }]);
assert.equal(b.dias, 39);

/* correlação: idênticas = 1, opostas = -1 */
var po = [100]; for (i = 1; i < 40; i++) po.push(po[i - 1] * (i % 2 ? 0.9 : 1.1));
var k = R.calcular([{ label: "A", qtd: 1, serie: serie(pa) }, { label: "E", qtd: 1, serie: serie(pa) },
                    { label: "O", qtd: 1, serie: serie(po) }]);
quase(k.correlacao.m[0][1], 1);
quase(k.correlacao.m[0][2], -1, 1e-6);
quase(k.correlacao.m[0][0], 1);

/* um ativo só com histórico curto também não vira número */
assert.equal(R.calcular([{ label: "C", qtd: 1, serie: serie(pa.slice(0, 12)) }]), null);

/* sem dados */
assert.equal(R.calcular([]), null);
assert.equal(R.calcular([{ label: "Z", qtd: 1, serie: [{ d: dia(0), p: 1 }] }]), null);

/* ---------------- séries ---------------- */
var chamadas = [];
global.AtlasProviders = { get: function () { return {
  chart: function (id, days, o) {
    chamadas.push(id);
    if (id === "ruim") return Promise.reject({ status: 429, message: "Limite" });
    var t0 = Date.UTC(2026, 6, 1);
    var pts = [];
    for (var h = 0; h < 72; h += 6) pts.push([t0 + h * 3600000, 10 + h]);
    return Promise.resolve({ days: days, points: pts });
  }
}; } };
require(path.join(__dirname, "../../core/atlas-series.js"));
var AS = window.AtlasSeries;
AS._espera = 0;
AS._pausaLimite = 0;

var dd = AS.diaria([[Date.UTC(2026, 6, 1, 1), 1], [Date.UTC(2026, 6, 1, 23), 2], [Date.UTC(2026, 6, 2, 5), 3]]);
assert.deepEqual(dd, [{ d: "2026-07-01", p: 2 }, { d: "2026-07-02", p: 3 }]);
assert.equal(AS.idDe({ ticker: "X", tipo: "Ação", cg_id: "x" }), null);
assert.equal(AS.idDe({ ticker: "X", tipo: "Cripto", cg_id: "x" }), "x");

var parciais = 0;
AS.carregar(["bom", "ruim"], function () { parciais++; }).then(function (res) {
  assert.deepEqual(res.falhas, ["ruim"]);
  assert.deepEqual(res.series.bom, [{ d: "2026-07-01", p: 28 }, { d: "2026-07-02", p: 52 }, { d: "2026-07-03", p: 76 }]);
  assert.ok(parciais >= 1);
  var antes = chamadas.length;
  return AS.carregar(["bom"]).then(function (res2) {
    assert.equal(chamadas.length, antes);        // veio do cache
    assert.equal(res2.series.bom.length, 3);
    /* limite da CoinGecko: para no primeiro 429 e não chama o resto */
    var n0 = chamadas.length;
    return AS.carregar(["ruim", "outro1", "outro2"]).then(function (res3) {
      assert.equal(chamadas.length, n0 + 1);
      assert.equal(res3.limite, true);
      assert.deepEqual(res3.falhas, ["ruim", "outro1", "outro2"]);
      /* duas telas pedindo o mesmo id ao mesmo tempo: uma chamada só */
      var n1 = chamadas.length;
      return Promise.all([AS.carregar(["novo"]), AS.carregar(["novo"])]).then(function (rs) {
        assert.equal(chamadas.length, n1 + 1);
        assert.equal(rs[0].series.novo.length, 3);
        assert.equal(rs[1].series.novo.length, 3);
        console.log("ok");
      });
    });
  });
}).catch(function (e) { console.error(e); process.exit(1); });
