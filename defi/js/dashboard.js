/* ============================================================
   ATLAS · DeFi — dashboard.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;

  C.mountNav("dashboard");

  var k = S.kpis();

  /* ---- Cards financeiros ---- */
  U.qs("#kpis").innerHTML = [
    C.finCard({ label: "Patrimônio Total", value: U.money(k.total), icon: "wallet", accent: "", delta: +k.change.toFixed(1), sub: "vs. 7 dias" }),
    C.finCard({ label: "Lucro Total", value: U.signedMoney(k.profit), icon: "trend", accent: "green", sub: "posições em pool" }),
    C.finCard({ label: "Pools Ativas", value: k.activeCount, icon: "pools", accent: "violet", sub: "em operação" }),
    C.finCard({ label: "APR Médio", value: U.pct(k.avgApr), icon: "gauge", accent: "cyan", sub: "posições ativas" })
  ].join("");
  U.reveal("#kpis .fin-card");

  /* ---- Gráfico de evolução ---- */
  var full = S.portfolioHistory();
  var evoChart = null;
  function drawEvo(days) {
    var pts = full.slice(-days);
    if (evoChart) evoChart.destroy();
    evoChart = Charts.line(U.qs("#chartEvolution"), pts, { color: "#5B9BFF", fill: "rgba(59,130,246,0.18)" });
  }
  drawEvo(30);
  U.qsa("#range-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      U.qsa("#range-toggle button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      drawEvo(parseInt(b.dataset.r, 10));
    });
  });

  /* ---- Donut de distribuição ---- */
  var distChart = null;
  function drawDist(by) {
    var items = S.distribution(by);
    if (distChart) distChart.destroy();
    distChart = Charts.donut(U.qs("#chartDist"), items);
    U.qs("#distLegend").innerHTML = items.map(function (i) {
      return '<div class="legend-item">' +
        '<span class="lg-l"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span>' +
        '<span class="lg-v">' + U.pct(i.pct) + '</span>' +
      '</div>';
    }).join("");
  }
  drawDist("chain");
  U.qsa("#dist-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      U.qsa("#dist-toggle button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      drawDist(b.dataset.d);
    });
  });

  /* ---- Posições ---- */
  var active = S.activePools();
  var host = U.qs("#positions");
  if (!active.length) {
    host.outerHTML = C.empty({
      icon: "pools", title: "Nenhuma posição ainda",
      text: "Crie sua primeira posição para começar a acompanhar seu patrimônio DeFi.",
      actionLabel: "Nova posição", actionHref: "pools.html?new=1"
    });
  } else {
    host.innerHTML = active.map(C.poolCard).join("");
    U.reveal("#positions .pos-card");
  }

  /* ============================================================
     ATUALIZAÇÃO DE MERCADO

     Sem isto, os KPIs eram calculados a partir de p.currentValue —
     um campo que era gravado na criação da pool e nunca mais mexido.
     Era a razão de "Lucro Total" viver em US$ 0 com posições abertas.

     Uma chamada em lote ao CoinGecko com os ids exatos de todos os
     tokens de todas as pools, e cada posição é recalculada pelo
     DeFiPerf. Redesenha só se algum valor mudou de fato — evitar
     repintar a tela sem motivo.
     ============================================================ */
  function atualizarMercado() {
    if (!window.DeFiPerf || !window.DeFiTokens) return;
    var pools = S.activePools();
    if (!pools.length) return;

    DeFiTokens.precos(DeFiPerf.simbolos(pools)).then(function (precos) {
      var mudou = false;

      pools.forEach(function (p) {
        var r = S.poolSummary(p.id) || {};
        var m = DeFiPerf.calcular({
          base: p.base, quote: p.quote,
          qtyBase: p.qtyBase, qtyQuote: p.qtyQuote,
          priceBase: p.priceBase, priceQuote: p.priceQuote,
          qtyBaseNow: p.qtyBaseNow, qtyQuoteNow: p.qtyQuoteNow,
          feesColetadas: r.taxasColetadas, feesPendentes: r.taxasPendentes,
          rangeLow: p.rangeLow, rangeHigh: p.rangeHigh,
          rangeDenom: p.rangeDenom || "base_por_quote"
        }, precos);

        /* Só grava com preço dos DOIS lados. Meio preço produziria um
           patrimônio menor que o real e assustaria à toa. */
        if (!m || !m.precoOk) return;

        var novo = Math.round(m.valorAtual * 100) / 100;
        var lucro = Math.round(m.pnlTotal * 100) / 100;
        if (novo === p.currentValue && lucro === p.profit) return;

        var patch = {
          currentValue: novo, profit: lucro,
          profitPct: Math.round(m.pnlTotalPct * 100) / 100,
          updatedAt: new Date().toISOString().slice(0, 10)
        };
        /* faixa cadastrada: o status acompanha a realidade do preço */
        if (m.temFaixa && m.dentroDaFaixa !== null && p.status !== "analise") {
          patch.status = m.dentroDaFaixa ? "ativa" : "range";
          patch.rangePos = m.posFaixa;
        }
        S.updatePool(p.id, patch);
        mudou = true;
      });

      if (!mudou) return;

      var k2 = S.kpis();
      U.qs("#kpis").innerHTML = [
        C.finCard({ label: "Patrimônio Total", value: U.money(k2.total), icon: "wallet", accent: "", delta: +k2.change.toFixed(1), sub: "vs. 7 dias" }),
        C.finCard({ label: "Lucro Total", value: U.signedMoney(k2.profit), icon: "trend", accent: "green", sub: "posições em pool" }),
        C.finCard({ label: "Pools Ativas", value: k2.activeCount, icon: "pools", accent: "violet", sub: "em operação" }),
        C.finCard({ label: "APR Médio", value: U.pct(k2.avgApr), icon: "gauge", accent: "cyan", sub: "posições ativas" })
      ].join("");

      var h = U.qs("#positions");
      if (h) h.innerHTML = S.activePools().map(C.poolCard).join("");
      drawDist(U.qs("#dist-toggle .active") ? U.qs("#dist-toggle .active").dataset.d : "chain");
    }).catch(function () { /* sem rede: segue com o último valor gravado */ });
  }

  atualizarMercado();
})();
