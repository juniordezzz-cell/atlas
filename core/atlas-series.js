/* ============================================================
   ATLAS · core/atlas-series.js
   ------------------------------------------------------------
   SÉRIES DE PREÇO DIÁRIAS (90 dias) E VARIAÇÕES 24h/7d.

   Uma série serve às duas abas do Hold: a ficha de Ativos desenha os
   últimos 30 dias, Métricas calcula o risco com os 90. A CoinGecko
   devolve um ponto por HORA em 90 dias (~2.160 pontos, ~150 KB com
   market cap e volume); guardar isso no cache compartilhado do
   AtlasHttp encheria o localStorage — o mesmo defeito que a
   Calculadora de Market Cap evitou. Por isso a busca vai com ttl 0 e
   aqui se guarda só o último ponto de cada dia (UTC), por 6 horas.

   A versão grátis da CoinGecko limita chamadas: a busca é em
   sequência, com uma pausa entre as que não vieram do cache, e a tela
   recebe cada série assim que chega (onParcial). Erro de um ativo não
   para os outros — ele volta em `falhas` e a tela diz isso.

   Testes: node hold/testes/risco.test.js
   Exposto em: window.AtlasSeries
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasSeries) return;

  var CHAVE = "atlas.series.v1", VALIDADE = 6 * 3600 * 1000, DIAS = 90;
  var cache = {};
  try { cache = JSON.parse(global.localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { cache = {}; }
  function gravar() {
    /* só o que ainda vale: uma série de ativo vendido não fica para sempre */
    var agora = Date.now();
    Object.keys(cache).forEach(function (id) { if (agora - cache[id].em > VALIDADE) delete cache[id]; });
    try { global.localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) {}
  }

  function prov() {
    var P = global.AtlasProviders;
    return P && P.get ? P.get("coingecko") : null;
  }

  /* [[ms, preço], …] → [{ d: "YYYY-MM-DD", p }] com o último ponto de cada dia UTC */
  function diaria(points) {
    var porDia = {}, ordem = [];
    (points || []).forEach(function (pt) {
      var d = new Date(pt[0]).toISOString().slice(0, 10);
      if (!(d in porDia)) ordem.push(d);
      porDia[d] = pt[1];
    });
    return ordem.sort().map(function (d) { return { d: d, p: porDia[d] }; });
  }

  function idDe(a) {
    if (!a || (a.tipo && a.tipo !== "Cripto")) return null;
    if (a.cg_id) return a.cg_id;
    var T = global.AtlasTokens;
    return (T && T.cgId && T.cgId(a.ticker)) || null;
  }

  function doCache(id) {
    var c = cache[id];
    return c && Date.now() - c.em < VALIDADE ? c.pts : null;
  }

  /* ------------------------------------------------------------
     UMA FILA SÓ PARA O SITE INTEIRO

     Ativos e Métricas pedem as mesmas séries. Com uma fila por tela,
     quem abria Ativos e ia para Métricas antes de terminar disparava
     dois pedidos por ativo e o limite da CoinGecko vinha mais cedo.
     Aqui: um pedido em andamento por id (quem chega depois espera o
     mesmo), pausa entre pedidos contada desde o último de QUALQUER
     tela e, depois de um limite (429 — que chega ao navegador como
     "sem conexão", sem CORS), um minuto sem pedir nada.
     ------------------------------------------------------------ */
  var fila = Promise.resolve(), ultimoEm = 0, pendentes = {}, bloqueadoAte = 0;
  function pedir(id) {
    if (pendentes[id]) return pendentes[id];
    var p = prov();
    var pr = fila = fila.then(function () {
      if (!p || !p.chart) return { erro: true };
      if (Date.now() < bloqueadoAte) return { erro: true, limite: true };
      var pausa = ultimoEm ? Math.max(0, ultimoEm + api._espera - Date.now()) : 0;
      return new Promise(function (ok) { setTimeout(ok, pausa); }).then(function () {
        ultimoEm = Date.now();
        return p.chart(id, DIAS, { ttl: 0, retries: 0 }).then(function (r) {
          var pts = diaria(r && r.points);
          if (pts.length < 2) return { erro: true };
          cache[id] = { em: Date.now(), pts: pts };
          gravar();
          return { pts: pts };
        }, function (e) {
          var lim = !e || !e.status || e.status === 429;
          if (lim) bloqueadoAte = Date.now() + api._pausaLimite;
          return { erro: true, limite: lim };
        });
      });
    });
    pendentes[id] = pr;
    pr.then(function () { delete pendentes[id]; });
    return pr;
  }

  var api = {
    _espera: 4000,        // a versão grátis aceita poucas consultas por minuto
    _pausaLimite: 60000,  // depois de um 429, um minuto sem pedir
    diaria: diaria,
    idDe: idDe,
    doCache: doCache,

    carregar: function (ids, onParcial) {
      var series = {}, falhas = [], limite = false;
      var lista = [];
      (ids || []).forEach(function (id) { if (id && lista.indexOf(id) < 0) lista.push(id); });
      lista.forEach(function (id) { var c = doCache(id); if (c) series[id] = c; });
      var cadeia = Promise.resolve();
      lista.filter(function (id) { return !series[id]; }).forEach(function (id) {
        cadeia = cadeia.then(function () {
          if (limite) { falhas.push(id); return; }
          return pedir(id).then(function (r) {
            if (r.pts) { series[id] = r.pts; if (onParcial) onParcial(series); return; }
            falhas.push(id);
            if (r.limite) limite = true;
          });
        });
      });
      return cadeia.then(function () { return { series: series, falhas: falhas, limite: limite }; });
    },

    /* { id: { h24, d7 } } em uma chamada; rejeita se a fonte falhar */
    variacoes: function (ids) {
      var p = prov();
      if (!p || !p.variacoes) return Promise.reject(new Error("Fonte de preços não carregada."));
      return ids && ids.length ? p.variacoes(ids) : Promise.resolve({});
    }
  };

  global.AtlasSeries = api;
})(typeof window !== "undefined" ? window : globalThis);
