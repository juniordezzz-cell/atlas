/* ============================================================
   ATLAS · core/atlas-risco.js
   ------------------------------------------------------------
   LABORATÓRIO DE RISCO: contas puras, sem tela e sem rede.

   Pergunta: quanto risco a carteira DE HOJE corre? A base são os
   últimos dias de preço de cada ativo aplicados às quantidades de
   hoje — "como esta carteira teria se comportado". Funciona desde o
   primeiro dia, sem esperar o ATLAS medir. Spec:
   docs/superpowers/specs/2026-10-16-ativos-metricas-design.md

     V_t  = Σ qᵢ · Pᵢ,t          r_t = V_t / V_{t-1} − 1
     volatilidade   = desvio padrão de r_t × √365 (cripto negocia todo dia)
     pior queda     = menor V_t / pico anterior − 1
     correlação     = Pearson dos retornos diários de cada par
     risco do ativo = wᵢ · (Σw)ᵢ / (wᵀΣw)  — soma 1

   Só entram os dias presentes em TODAS as séries. Se a janela comum
   ficar abaixo de 31 dias (30 retornos), sai o ativo de histórico mais
   curto e ele vai para `fora`. Stablecoin entra em tudo, menos no mapa
   de correlação: correlação de algo parado é ruído.

   Testes: node hold/testes/risco.test.js
   Exposto em: window.AtlasRisco
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasRisco) return;

  var MIN_DIAS = 31;

  function media(xs) { return xs.reduce(function (t, x) { return t + x; }, 0) / xs.length; }
  function cov(a, b) {
    if (a.length < 2) return 0;
    var ma = media(a), mb = media(b), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (a.length - 1);
  }
  function retornos(xs) {
    var r = [];
    for (var i = 1; i < xs.length; i++) r.push(xs[i - 1] > 0 ? xs[i] / xs[i - 1] - 1 : 0);
    return r;
  }

  /* Datas presentes em todas as séries, em ordem. */
  function comuns(itens) {
    var conta = {};
    itens.forEach(function (it) {
      var vistos = {};
      it.serie.forEach(function (pt) {
        if (pt.p > 0 && !vistos[pt.d]) { vistos[pt.d] = 1; conta[pt.d] = (conta[pt.d] || 0) + 1; }
      });
    });
    return Object.keys(conta).filter(function (d) { return conta[d] === itens.length; }).sort();
  }

  function calcular(entrada) {
    var itens = (entrada || []).filter(function (it) { return it && it.serie && it.serie.length >= 2 && it.qtd > 0; });
    var fora = (entrada || []).filter(function (it) { return itens.indexOf(it) < 0; }).map(function (it) { return it.label; });
    var datas = comuns(itens);
    while (itens.length > 1 && datas.length < MIN_DIAS) {
      var curto = itens.slice().sort(function (a, b) { return a.serie.length - b.serie.length; })[0];
      itens.splice(itens.indexOf(curto), 1);
      fora.push(curto.label);
      datas = comuns(itens);
    }
    /* um ativo só também precisa da janela mínima — 10 dias não dizem risco */
    if (!itens.length || datas.length < MIN_DIAS) return null;

    var precos = itens.map(function (it) {
      var m = {};
      it.serie.forEach(function (pt) { m[pt.d] = pt.p; });
      return datas.map(function (d) { return m[d]; });
    });
    var V = datas.map(function (d, t) {
      return itens.reduce(function (s, it, i) { return s + it.qtd * precos[i][t]; }, 0);
    });
    var rp = retornos(V);
    var vol = Math.sqrt(Math.max(0, cov(rp, rp))) * Math.sqrt(365);

    var pico = V[0], picoD = datas[0], queda = { pct: 0, pico: datas[0], fundo: datas[0] };
    for (var t = 1; t < V.length; t++) {
      if (V[t] > pico) { pico = V[t]; picoD = datas[t]; }
      var dd = V[t] / pico - 1;
      if (dd < queda.pct) queda = { pct: dd, pico: picoD, fundo: datas[t] };
    }
    var piorDia = { pct: 0, d: datas[1] };
    rp.forEach(function (r, i) { if (r < piorDia.pct) piorDia = { pct: r, d: datas[i + 1] }; });

    var R = precos.map(retornos);
    var n = itens.length;
    var S = [];
    for (var i = 0; i < n; i++) { S.push([]); for (var j = 0; j < n; j++) S[i].push(cov(R[i], R[j])); }

    var ultimo = V[V.length - 1];
    var w = itens.map(function (it, i) { return ultimo > 0 ? it.qtd * precos[i][datas.length - 1] / ultimo : 0; });
    var Sw = w.map(function (_, i) { return S[i].reduce(function (s, x, j) { return s + x * w[j]; }, 0); });
    var varP = w.reduce(function (s, wi, i) { return s + wi * Sw[i]; }, 0);
    var contribuicao = itens.map(function (it, i) {
      return { label: it.label, peso: w[i], risco: varP > 0 ? w[i] * Sw[i] / varP : 0 };
    });

    var idx = [];
    itens.forEach(function (it, i) { if (!it.stable) idx.push(i); });
    var m = idx.map(function (a) {
      return idx.map(function (b) {
        if (a === b) return 1;
        var den = Math.sqrt(S[a][a] * S[b][b]);
        return den > 0 ? S[a][b] / den : 0;
      });
    });

    return {
      dias: datas.length, inicio: datas[0], fim: datas[datas.length - 1],
      volatilidade: vol, piorQueda: queda, piorDia: piorDia,
      correlacao: { labels: idx.map(function (i) { return itens[i].label; }), m: m },
      contribuicao: contribuicao, fora: fora
    };
  }

  global.AtlasRisco = { calcular: calcular, MIN_DIAS: MIN_DIAS };
})(typeof window !== "undefined" ? window : globalThis);
