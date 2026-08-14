/* ============================================================
   ATLAS · DeFi — dashboard.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;

  C.mountNav("dashboard");

  /* ---- Cards financeiros ----
     Uma função, chamada no load e de novo quando o mercado responde:
     o bloco estava escrito duas vezes, com os mesmos quatro cards, e
     mudar um rótulo exigia lembrar do outro lugar. */
  function pintarKpis() {
    var k = S.kpis();
    /* "vs. 7 dias" só aparece quando existem 7 dias MEDIDOS. Antes o
       card afirmava a comparação sempre, com 0,0% eterno — a série que
       ele lia nascia zerada e nunca era regravada. */
    var temSerie = S.snapshotCount() > 1;
    U.qs("#kpis").innerHTML = [
      C.finCard({ label: "Patrimônio Total", value: U.money(k.total), icon: "wallet", accent: "",
                  delta: temSerie ? +k.change.toFixed(1) : null,
                  sub: temSerie ? "vs. 7 dias" : "primeira medição" }),
      C.finCard({ label: "Resultado", value: U.signedMoney(k.profit), icon: "trend",
                  accent: k.profit >= 0 ? "green" : "", sub: "taxas + variação dos ativos" }),
      C.finCard({ label: "Pools Ativas", value: k.activeCount, icon: "pools", accent: "violet", sub: "em operação" }),
      C.finCard({ label: "APR Médio", value: U.pct(k.avgApr), icon: "gauge", accent: "cyan", sub: "ponderado pelo valor" })
    ].join("");
  }
  pintarKpis();
  U.reveal("#kpis .fin-card");

  /* ---- Gráfico de evolução ----
     A série é relida a cada troca de janela: ela é MEDIDA (um ponto
     por dia em que o sistema foi aberto), então pedir 90 dias não é
     fatiar um array de 45 — é pedir uma janela maior à origem. */
  var evoChart = null;
  var janelaAtual = 30;
  function drawEvo(days) {
    janelaAtual = days;
    var pts = S.portfolioHistory(days);
    if (evoChart) { evoChart.destroy(); evoChart = null; }
    var box = U.qs("#chartEvolution");
    if (!box) return;
    var aviso = U.qs("#evoAviso");
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = "evoAviso";
      aviso.className = "hint";
      box.parentNode.insertBefore(aviso, box.nextSibling);
    }
    /* ------------------------------------------------------------
       "dias medidos" TEM DE CONTAR MEDIÇÃO, NÃO PONTO

       Isto contava `pts.length`, que é o tamanho da série JÁ
       INTERPOLADA: entre duas medições a série preenche os dias
       vazios com o último valor conhecido (degrau). Com uma medição
       há três dias e outra hoje, `pts.length` é 4 — e a tela anunciava
       "4 dia(s) medidos" para 2 medições. Medido nesta verificação.

       O ponto interpolado é honesto no desenho (é o que se sabe do
       dia), mas contá-lo como medição transforma degrau em histórico.
       Cada ponto já diz se foi medido; basta perguntar.
       ------------------------------------------------------------ */
    var medidos = pts.filter(function (p) { return p.medido; }).length;

    /* Menos de duas MEDIÇÕES não é gráfico — é uma promessa vazia.
       Dizer quantos dias existem é mais útil que desenhar uma linha
       reta ligando um ponto a cópias dele mesmo. */
    if (medidos < 2) {
      aviso.textContent = medidos
        ? "Primeira medição registrada hoje. A curva aparece a partir do segundo dia de uso."
        : "Sem histórico ainda. O ATLAS mede o patrimônio uma vez por dia, a cada vez que você abre o módulo.";
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    aviso.textContent = medidos + " dia(s) medidos de " + days + " pedidos.";
    evoChart = Charts.line(box, pts, { color: "#5B9BFF", fill: "rgba(59,130,246,0.18)" });
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

    DeFiTokens.precosDetalhado(DeFiPerf.simbolos(pools)).then(function (d) {
      /* A cotação vira conhecimento do store ANTES de qualquer
         desenho: é dela que DeFiStore.statusDe tira o veredito da
         faixa, no card e em todo o resto. */
      S.setPrecos(d.valores, d.fonte);

      var mudou = false;

      pools.forEach(function (p) {
        var r = S.poolSummary(p.id) || {};
        var m = DeFiPerf.calcular({
          base: p.base, quote: p.quote,
          qtyBase: p.qtyBase, qtyQuote: p.qtyQuote,
          priceBase: p.priceBase, priceQuote: p.priceQuote,
          qtyBaseNow: p.qtyBaseNow, qtyQuoteNow: p.qtyQuoteNow,
          feesColetadas: r.taxasColetadas, feesPendentes: r.taxasPendentes,
          reinvestido: r.reinvestido,
          rangeLow: p.rangeLow, rangeHigh: p.rangeHigh,
          rangeDenom: p.rangeDenom || "base_por_quote"
        }, S.precos([p.base, p.quote]));

        /* Só grava com preço dos DOIS lados. Meio preço produziria um
           patrimônio menor que o real e assustaria à toa. */
        if (!m || !m.precoOk) return;

        /* Grava SÓ o valor de mercado. O lucro deixou de ser escrito
           aqui: quem calcula resultado é DeFiStore.poolSummary, a
           partir dos fluxos de capital e das taxas. Esta função
           gravava "mercado + taxa coletada", o modal de edição gravava
           "valor − capital", e o card mostrava o que tivesse sobrado
           por último. Uma métrica com três autores não é uma métrica.

           E NÃO grava mais status nem rangePos. O selo da faixa deixou
           de ser um campo persistido: é calculado na hora de desenhar,
           por DeFiStore.statusDe. Enquanto era gravado aqui, esta era
           a ÚNICA tela que o corrigia — a lista de Pools mostrava o
           valor antigo indefinidamente, e um token sem cotação (o `return`
           logo acima) congelava a escolha manual do wizard para sempre. */
        var novo = Math.round(m.valorAtual * 100) / 100;
        if (novo === p.currentValue) return;

        var fB = d.fonte[String(p.base).toUpperCase()];
        var fQ = d.fonte[String(p.quote).toUpperCase()];
        S.updatePool(p.id, {
          currentValue: novo,
          precoFonte: (fB === "manual" || fQ === "manual") ? "manual" : "api",
          precoEm: new Date().toISOString(),
          updatedAt: U.hoje()
        });
        mudou = true;
      });

      /* Repinta SEMPRE, mesmo sem mudança de valor: o veredito da
         faixa depende da cotação que acabou de chegar, e antes dela os
         cards estavam desenhados como "Faixa não avaliada". */
      var h = U.qs("#positions");
      if (h) h.innerHTML = S.activePools().map(C.poolCard).join("");

      if (mudou) {
        /* O valor de mercado mudou → a medição do dia tem de acompanhar,
           senão o snapshot guardaria o valor de antes da atualização e a
           curva ficaria um dia atrasada em relação aos cards. */
        S.recordSnapshot();
        pintarKpis();
        drawDist(U.qs("#dist-toggle .active") ? U.qs("#dist-toggle .active").dataset.d : "chain");
        drawEvo(janelaAtual);
      }

      if (d.erro) avisarMercado(d.erro);
      else if (d.faltando && d.faltando.length) avisarSemPreco(d.faltando);
      else if (d.vencidos && d.vencidos.length) avisarVencidos(d.vencidos);
    }).catch(function (err) {
      /* ---------------------------------------------------------
         API FALHA EM SILÊNCIO É PIOR QUE API FORA DO AR

         Este catch engolia tudo. Se o CoinGecko devolvesse 429
         (limite da versão gratuita), o dashboard seguia mostrando o
         último valor gravado — dias atrás, se preciso — com a mesma
         aparência de valor de agora. O usuário não tinha como saber
         que estava olhando um número velho.
         --------------------------------------------------------- */
      avisarMercado(err);
    });
  }

  /* Faixa de aviso sobre o estado da cotação. Aparece só quando há o
     que dizer: preço velho, limite atingido, sem rede, ou ativo que
     nenhuma fonte reconhece. */
  function faixaAviso() {
    var host = U.qs("#kpis");
    if (!host) return null;
    var el = U.qs("#mercadoAviso");
    if (!el) {
      el = document.createElement("div");
      el.id = "mercadoAviso";
      el.className = "hint";
      el.style.marginTop = "10px";
      host.parentNode.insertBefore(el, host.nextSibling);
    }
    return el;
  }

  function avisarMercado(err) {
    var el = faixaAviso();
    if (!el) return;
    var msg = (err && err.message) ? err.message : "Não consegui atualizar os preços agora.";
    var quando = S.ultimaCotacao();
    el.innerHTML = "⚠ " + msg + " Os valores abaixo são os da última atualização" +
      (quando ? " (" + U.date(quando.slice(0, 10)) + ")" : "") + ", não os de agora.";
  }

  /* ------------------------------------------------------------
     ATIVO QUE NENHUMA FONTE RECONHECE

     É o caso das ações tokenizadas (CRCLX, SKHYX, SPCXB) e de
     qualquer token novo demais para o catálogo. Antes isso não
     produzia aviso nenhum: a pool simplesmente parava de ser
     recalculada e continuava exibindo o selo escolhido no wizard.

     A regra do ATLAS é explícita — API primeiro, e quando nenhuma
     API reconhece, quem informa o preço é o usuário. Este aviso é o
     convite para fazer isso, com o nome dos tokens que faltam.
     ------------------------------------------------------------ */
  function avisarSemPreco(faltando) {
    var el = faixaAviso();
    if (!el) return;
    el.innerHTML = "⚠ Nenhuma fonte reconheceu <b>" + faltando.join("</b>, <b>") +
      "</b>. Abra a posição e informe o preço na mão em <b>Atualizar pool</b> — " +
      "enquanto isso, a faixa dessas posições fica sem veredito.";
  }

  function avisarVencidos(vencidos) {
    var el = faixaAviso();
    if (!el) return;
    el.innerHTML = "⚠ O preço de <b>" + vencidos.join("</b>, <b>") +
      "</b> foi informado por você há mais de " +
      (window.AtlasPrecos ? AtlasPrecos.VALIDADE_DIAS : 7) +
      " dias. Os números abaixo usam esse preço — vale conferir.";
  }

  atualizarMercado();
})();
