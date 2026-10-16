/* Testes da cadeia de preço atual (core/atlas-precos.js + core/atlas-price.js
   + core/providers/defillama.js). DefiLlama em lote é a fonte principal;
   CoinGecko e DEX são reserva. Rodar: node core/testes/precos.test.js → "ok". */
"use strict";
var assert = require("assert");
var path = require("path");

global.window = global;
var mem = {};
global.localStorage = {
  getItem: function (k) { return k in mem ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};

/* ---------------- rede falsa ---------------- */
var pedidos = [];          // URLs pedidas à "rede"
var llama = {};            // id -> { price, confidence?, idadeS? } | ausente
var llamaFora = false;
function agoraS() { return Math.floor(Date.now() / 1000); }

global.AtlasHttp = {
  getJSON: function (url) {
    pedidos.push(url);
    if (url.indexOf("https://coins.llama.fi/prices/current/") === 0) {
      if (llamaFora) return Promise.reject(Object.assign(new Error("Serviço indisponível."), { status: 503 }));
      var refs = decodeURIComponent(url.slice("https://coins.llama.fi/prices/current/".length).split("?")[0]).split(",");
      if (url.length > 4600) return Promise.reject(Object.assign(new Error("400"), { status: 400 }));
      var coins = {};
      refs.forEach(function (r) {
        var c = llama[r.replace(/^coingecko:/, "")];
        if (c) coins[r] = { price: c.price, confidence: c.confidence != null ? c.confidence : 0.99,
                            timestamp: agoraS() - (c.idadeS || 30), symbol: "X" };
      });
      return Promise.resolve({ coins: coins });
    }
    return Promise.reject(new Error("URL inesperada: " + url));
  },
  clearCache: function () {}
};

require(path.join(__dirname, "../providers/registry.js"));

/* CoinGecko falsa: conta cada chamada */
var cg = { precos: {}, fora: false, buscas: {}, chamadas: [] };
window.AtlasProviders.register("coingecko", {
  capabilities: ["prices", "search"],
  pricesRaw: function (ids) {
    cg.chamadas.push(["pricesRaw", ids.slice()]);
    if (cg.fora) return Promise.reject(new Error("Limite de requisições atingido."));
    var o = {}; ids.forEach(function (id) { if (cg.precos[id]) o[id] = cg.precos[id]; });
    return Promise.resolve(o);
  },
  price: function (id) {
    cg.chamadas.push(["price", id]);
    if (cg.fora) return Promise.resolve(null);
    return Promise.resolve(cg.precos[id] || null);
  },
  search: function (q) {
    cg.chamadas.push(["search", q]);
    return Promise.resolve(cg.buscas[q.toLowerCase()] || []);
  }
});

/* DEX falsa (fonte secundária) */
var dex = {};
window.AtlasProviders.register("geckoterminal", {
  capabilities: [], secundario: true,
  pricesBySymbols: function (sims) {
    var o = {}; sims.forEach(function (s) { if (dex[s]) o[s] = { usd: dex[s], rede: "base", liquidez: 1e6 }; });
    return Promise.resolve(o);
  },
  priceBySymbol: function () { return Promise.resolve(null); }
});

require(path.join(__dirname, "../providers/defillama.js"));
require(path.join(__dirname, "../atlas-price.js"));
require(path.join(__dirname, "../atlas-precos.js"));
var P = window.AtlasPrecos;
var TABELA = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", PENDLE: "pendle" };
P.registrarRegistro(function (s) { return TABELA[s] || null; });

function zerar() {
  pedidos = []; llama = {}; llamaFora = false; dex = {};
  cg.precos = {}; cg.fora = false; cg.buscas = {}; cg.chamadas = [];
  mem = {};
  window.AtlasPrice.forget();
}
function cgPreco() { return cg.chamadas.filter(function (c) { return c[0] !== "search"; }); }

var testes = [];
function t(nome, fn) { testes.push([nome, fn]); }

t("DefiLlama responde tudo: nenhuma chamada de preço à CoinGecko", function () {
  llama = { bitcoin: { price: 100000 }, ethereum: { price: 4000 } };
  return P.deVarios(["BTC", "ETH"]).then(function (d) {
    assert.equal(d.valores.BTC, 100000);
    assert.equal(d.valores.ETH, 4000);
    assert.equal(d.fonte.BTC, "registro");
    assert.equal(d.provedor.BTC, "defillama");
    assert.equal(d.erro, null);
    assert.deepEqual(cgPreco(), []);
    assert.equal(pedidos.length, 1);
  });
});

t("manual vence a DefiLlama e stablecoin não vai à rede", function () {
  llama = { solana: { price: 104 } };
  P.definirManual("SOL", 99);
  return P.deVarios(["SOL", "USDC"]).then(function (d) {
    assert.equal(d.valores.SOL, 99);
    assert.equal(d.fonte.SOL, "manual");
    assert.equal(d.valores.USDC, 1);
    assert.equal(d.fonte.USDC, "stable");
    assert.equal(pedidos.length, 0);
    assert.deepEqual(cg.chamadas, []);
  });
});

t("id que a DefiLlama não conhece: só ele vai à CoinGecko, em lote", function () {
  llama = { bitcoin: { price: 100000 } };
  cg.precos = { pendle: 2.11 };
  return P.deVarios(["BTC", "PENDLE"]).then(function (d) {
    assert.equal(d.valores.PENDLE, 2.11);
    assert.equal(d.provedor.PENDLE, "coingecko");
    assert.equal(d.provedor.BTC, "defillama");
    assert.deepEqual(cgPreco(), [["pricesRaw", ["pendle"]]]);
  });
});

t("DefiLlama fora: o lote inteiro vai à CoinGecko, sem erro", function () {
  llamaFora = true;
  cg.precos = { bitcoin: 99000, ethereum: 3900 };
  return P.deVarios(["BTC", "ETH"]).then(function (d) {
    assert.equal(d.valores.BTC, 99000);
    assert.equal(d.provedor.ETH, "coingecko");
    assert.equal(d.erro, null);
    assert.deepEqual(cgPreco(), [["pricesRaw", ["bitcoin", "ethereum"]]]);
  });
});

t("as duas fora: erro preenchido e nada vira zero", function () {
  llamaFora = true; cg.fora = true;
  return P.deVarios(["BTC"]).then(function (d) {
    assert.ok(d.erro instanceof Error);
    assert.equal(d.valores.BTC, undefined);
    assert.deepEqual(d.faltando, ["BTC"]);
  });
});

t("confiança baixa ou preço velho na DefiLlama: vale a CoinGecko", function () {
  llama = { bitcoin: { price: 1, confidence: 0.5 }, ethereum: { price: 2, idadeS: 2 * 3600 } };
  cg.precos = { bitcoin: 100000, ethereum: 4000 };
  return P.deVarios(["BTC", "ETH"]).then(function (d) {
    assert.equal(d.valores.BTC, 100000);
    assert.equal(d.valores.ETH, 4000);
    assert.equal(d.provedor.BTC, "coingecko");
  });
});

t("lote grande: pedidos de no máximo 100 ids", function () {
  var ids = [];
  for (var i = 0; i < 230; i++) { ids.push("moeda-" + i); llama["moeda-" + i] = { price: i + 1 }; }
  return window.AtlasProviders.get("defillama").precosAtuais(ids).then(function (m) {
    assert.equal(Object.keys(m).length, 230);
    assert.equal(pedidos.length, 3);
    assert.equal(m["moeda-229"], 230);
  });
});

t("busca: CoinGecko só acha o id; o preço vem do mesmo lote da DefiLlama", function () {
  llama = { bitcoin: { price: 100000 }, "aerodrome-finance": { price: 0.9 } };
  cg.buscas = { aero: [{ id: "aerodrome-finance", symbol: "AERO", name: "Aerodrome", rank: 150 }] };
  return P.deVarios(["BTC", "AERO"]).then(function (d) {
    assert.equal(d.valores.AERO, 0.9);
    assert.equal(d.fonte.AERO, "busca");
    assert.equal(d.provedor.AERO, "defillama");
    assert.deepEqual(cgPreco(), []);
    assert.equal(pedidos.length, 1);
    assert.ok(pedidos[0].indexOf("aerodrome-finance") > 0 && pedidos[0].indexOf("bitcoin") > 0);
  });
});

t("busca × DEX acima de 3% continua indo para divergentes", function () {
  llama = { "aerodrome-finance": { price: 0.9 } };
  cg.buscas = { aero: [{ id: "aerodrome-finance", symbol: "AERO", name: "Aerodrome", rank: 150 }] };
  dex = { AERO: 1.2 };
  return P.deVarios(["AERO"]).then(function (d) {
    assert.equal(d.divergentes.length, 1);
    assert.equal(d.divergentes[0].simbolo, "AERO");
  });
});

t("ninguém conhece: DEX responde por último", function () {
  dex = { XYZ: 3 };
  return P.deVarios(["XYZ"]).then(function (d) {
    assert.equal(d.valores.XYZ, 3);
    assert.equal(d.fonte.XYZ, "dex");
  });
});

t("id informado (autocomplete/Hold) não passa pela busca", function () {
  llama = { "aerodrome-finance": { price: 0.9 } };
  return P.de("AERO", { id: "aerodrome-finance" }).then(function (r) {
    assert.equal(r.usd, 0.9);
    assert.equal(r.fonte, "registro");
    assert.deepEqual(cg.chamadas, []);
  });
});

t("id informado não passa por cima do manual", function () {
  llama = { "aerodrome-finance": { price: 0.9 } };
  P.definirManual("AERO", 1.5);
  return P.deVarios(["AERO"], { ids: { AERO: "aerodrome-finance" } }).then(function (d) {
    assert.equal(d.valores.AERO, 1.5);
    assert.equal(d.fonte.AERO, "manual");
    assert.equal(pedidos.length, 0);
  });
});

t("AtlasPrice.bySymbol: preço pela DefiLlama, sem simple/price da CoinGecko", function () {
  llama = { pendle: { price: 2.1 } };
  cg.buscas = { pendle: [{ id: "pendle", symbol: "PENDLE", name: "Pendle", rank: 90 }] };
  return window.AtlasPrice.bySymbol("PENDLE").then(function (r) {
    assert.equal(r.usd, 2.1);
    assert.equal(r.id, "pendle");
    assert.deepEqual(cgPreco(), []);
  });
});

t("AtlasPrice.bySymbol: DefiLlama sem o id, CoinGecko de reserva", function () {
  cg.buscas = { pendle: [{ id: "pendle", symbol: "PENDLE", name: "Pendle", rank: 90 }] };
  cg.precos = { pendle: 2.2 };
  return window.AtlasPrice.bySymbol("PENDLE").then(function (r) {
    assert.equal(r.usd, 2.2);
  });
});

(function rodar(i) {
  if (i >= testes.length) { console.log("ok"); return; }
  zerar();
  Promise.resolve().then(testes[i][1]).then(function () { rodar(i + 1); }, function (e) {
    console.error("FALHOU: " + testes[i][0] + "\n", e && e.stack || e);
    process.exitCode = 1;
  });
})(0);
