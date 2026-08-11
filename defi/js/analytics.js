/* ============================================================
   ATLAS · DeFi — analytics.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;
  C.mountNav("analytics");

  /* ------------------------------------------------------------
     Séries MEDIDAS, não geradas

     As duas curvas liam portfolioHistory/profitHistory, que eram 45
     pontos de um gerador com valor inicial zero e drift zero — 45
     zeros. Os gráficos desenhavam uma linha reta rente ao eixo, com
     moldura, título e legenda: aparência completa de gráfico, conteúdo
     nenhum. Agora leem o snapshot diário real, e dizem quando ainda
     não há o que desenhar.
     ------------------------------------------------------------ */
  function serieOuAviso(canvasId, serie, opts) {
    var cv = U.qs(canvasId);
    if (!cv) return;
    if (serie.length < 2) {
      var aviso = document.createElement("div");
      aviso.className = "hint";
      aviso.textContent = serie.length
        ? "Só há uma medição até agora. A curva aparece a partir do segundo dia de uso."
        : "Sem histórico ainda — o ATLAS mede o patrimônio uma vez por dia, quando você abre o módulo.";
      cv.parentNode.replaceChild(aviso, cv);
      return;
    }
    Charts.line(cv, serie, opts);
  }

  serieOuAviso("#aEvo", S.portfolioHistory(90), { color: "#5B9BFF", fill: "rgba(59,130,246,0.18)" });
  serieOuAviso("#aProfit", S.profitHistory(90), { color: "#34D399", fill: "rgba(52,211,153,0.16)" });

  /* ------------------------------------------------------------
     APR REALIZADO por posição (ativas + encerradas)

     O gráfico se chamava "APR Realizado" e plotava p.apr — que é o APR
     DECLARADO, copiado da corretora na criação da pool. Ou seja: o
     painel de resultado mostrava a promessa, não o resultado. Uma pool
     anunciada a 300% que rendeu 4% aparecia como 300%.

     O realizado sai de poolSummary.aprReal: taxa efetivamente gerada
     sobre o capital médio no tempo, anualizada. Ao lado, em tom mais
     fraco, fica o declarado — a comparação entre os dois é justamente
     o que essa tela deveria mostrar desde o início.
     ------------------------------------------------------------ */
  var all = S.pools().concat(S.closed()).map(function (p) {
    var r = S.poolSummary(p);
    return { p: p, apr: r ? r.aprReal : 0, declarado: Number(p.apr) || 0 };
  }).filter(function (x) { return x.apr > 0 || x.declarado > 0; })
    .sort(function (a, b) { return b.apr - a.apr; });

  var elApr = U.qs("#aApr");
  if (!all.length && elApr) {
    var vazio = document.createElement("div");
    vazio.className = "hint";
    vazio.textContent = "Nenhuma taxa registrada ainda — sem taxa não há APR realizado para comparar.";
    elApr.parentNode.replaceChild(vazio, elApr);
  } else if (elApr) {
    Charts.bar(elApr,
      all.map(function (x) { return x.p.base + "/" + x.p.quote; }),
      all.map(function (x) { return +x.apr.toFixed(1); }),
      all.map(function (x) { return S.colorOf("proto", x.p.protocol); }));

    var legenda = document.createElement("div");
    legenda.className = "hint";
    legenda.style.marginTop = "8px";
    legenda.innerHTML = "Barras = APR <b>realizado</b> (taxa gerada sobre o capital médio, anualizada). " +
      "Declarado na criação: " + all.map(function (x) {
        return x.p.base + "/" + x.p.quote + " " + U.pct(x.declarado);
      }).join(" · ") + ".";
    elApr.parentNode.appendChild(legenda);
  }

  /* Distribuições */
  var donut = null;
  var titleMap = { protocol: "Por protocolo", chain: "Por blockchain", token: "Por token", category: "Por categoria" };

  function drawDist(by) {
    var items = S.distribution(by);
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (donut) donut.destroy();
    donut = Charts.donut(U.qs("#aDonut"), items);
    /* Sem dec:0 forçado — numa carteira de US$ 27,21 o centro do donut
       dizia "US$ 27" ao lado da barra que dizia "US$ 27,21". */
    U.qs("#dcVal").textContent = U.money(total);
    U.qs("#aLegend").innerHTML = items.map(function (i) {
      return '<div class="legend-item"><span class="lg-l"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span><span class="lg-v">' + U.pct(i.pct) + '</span></div>';
    }).join("");
    U.qs("#aBarTitle").textContent = titleMap[by];
    U.qs("#aBars").innerHTML = items.map(function (i) {
      return '<div class="dist-item"><div class="dist-top">' +
        '<span class="dist-label"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span>' +
        '<span class="dist-val">' + U.money(i.value) + '</span></div>' +
        '<div class="dist-bar"><i style="width:' + i.pct + '%;background:' + i.color + '"></i></div></div>';
    }).join("");
  }
  drawDist("protocol");

  U.qsa("#aDistToggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      U.qsa("#aDistToggle button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      drawDist(b.dataset.d);
    });
  });
})();
