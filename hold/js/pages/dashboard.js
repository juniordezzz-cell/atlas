/* HOLD · pages/dashboard.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, C = window.Charts, F = window.Forms;

  /* ============================================================
     A CURVA QUE O SISTEMA MEDIU

     Aqui morava perfSeries(): doze pontos rotulados Jan…Dez,
     interpolando do custo até o valor atual com uma ondulação de
     Math.sin() por cima — descrita no próprio comentário como "série
     sintética determinística". Uma carteira aberta ontem exibia um ano
     de história, com altos e baixos que nunca aconteceram, e o mesmo
     desenho virava o sparkline do KPI "Valor da carteira".

     Agora a série vem de Store.get.portfolioHistory(): uma medição por
     dia, por carteira, gravada quando o painel abre. Ver o bloco em
     hold/js/state.js. Enquanto não houver dois dias medidos ela vem
     vazia, e a tela diz isso em vez de desenhar.
     ============================================================ */
  function serieMedida(dias) {
    return S.get.portfolioHistory(dias || 90).map(function (p) {
      var d = p.date.split("-");
      return { label: d[2] + "/" + d[1], v: p.value, medido: p.medido };
    });
  }

  /* Quantos dias de medição a série tem de fato — é o que a tela conta
     para a pessoa saber a idade do gráfico que está olhando. */
  function diasMedidos(serie) {
    return serie.filter(function (p) { return p.medido; }).length;
  }

  /* A mesma remarcação do botão da tela de Ativos, disparada daqui.
     Chama o store direto — a alternativa (navegar até Ativos e mandar
     um clique sintético no botão de lá) é o tipo de atalho que quebra
     no dia em que alguém reordenar os botões daquela tela. */
  function atualizarPrecos() {
    if (!S.actions.refreshPrices) return;
    U.toast("Preços", "Consultando as fontes…");
    S.actions.refreshPrices().then(function (r) {
      var partes = [];
      if (r.atualizados) partes.push(r.atualizados + " preço(s) atualizado(s)");
      if (r.faltando.length) {
        partes.push("nenhuma fonte reconheceu " + r.faltando.join(", ") +
                    " — informe o preço em Ativos → o ativo → Editar");
      }
      U.toast("Preços", partes.join(" · ") || "Todos os preços já estavam atualizados.",
              r.atualizados ? "success" : "");
      window.Router.rerender();
    }).catch(function (e) {
      U.toast("Preços", (e && e.message) || "Não consegui buscar os preços agora.", "warning");
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = function () {
    var c = S.get.counts();
    var val = S.get.portfolioValue(), pnl = S.get.portfolioPnL(), pnlPct = S.get.portfolioPnLPct();
    var serie = serieMedida(90), medidos = diasMedidos(serie);
    var invested = S.state.ativos.filter(function (a) { return S.get.statusDe(a) === "invested"; });
    var avgConv = invested.length ? invested.reduce(function (s, a) { return s + a.conviccao; }, 0) / invested.length : 0;

    var carteira = S.wallets.active();
    var caixa = (window.AtlasCaixa && carteira) ? AtlasCaixa.saldo(carteira.id) : null;
    var custo = S.get.portfolioCost();

    var view = U.el("div");

    /* head */
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Painel" }),
          U.el("p", { text: "Visão consolidada da carteira, teses e decisões de longo prazo." })
        ]),
        U.button("Nova tese", { variant: "secondary", icon: "doc", onClick: function () { F.newThesis(); } })
        /* "Registrar operação" saiu daqui: ele abria a compra do
           PRIMEIRO ativo com tese da lista — `inv[0]` —, e não do ativo
           que a pessoa queria operar. Num painel, um botão que escolhe
           sozinho em qual ativo você vai colocar dinheiro é pior que
           nenhum. A compra continua onde ela tem contexto: na página do
           ativo (Ativos → o ativo → Comprar). */
      ])
    ]));

    /* ------------------------------------------------------------
       AÇÕES RÁPIDAS

       O painel tinha DOIS botões: "Nova tese" e "Ver histórico". Todo
       o resto — cadastrar ativo, comprar, atualizar preço, depositar —
       exigia navegar até outra tela para só então achar o botão. Um
       painel é onde se decide; se decidir custa três telas, ele vira
       um relatório.

       As quatro que estão aqui são as que começam alguma coisa.
       Nenhuma delas escolhe por você em QUE ativo mexer: "Comprar"
       leva à lista de ativos, onde o ativo é escolhido. Foi o defeito
       do antigo "Registrar operação", que abria a compra do primeiro
       ativo da lista.
       ------------------------------------------------------------ */
    var acoes = U.el("div", { class: "quick" });
    function rapida(icone, titulo, sub, onClick) {
      var b = U.el("button", { class: "quick-item", type: "button" });
      b.appendChild(U.el("span", { class: "qi-ico", html: U.icon(icone) }));
      b.appendChild(U.el("span", { class: "qi-txt" }, [
        U.el("span", { class: "qi-t", text: titulo }),
        U.el("span", { class: "qi-s", text: sub })
      ]));
      b.addEventListener("click", onClick);
      return b;
    }
    acoes.appendChild(rapida("plus", "Adicionar ativo", "cadastrar no universo",
      function () { F.newAsset(); }));
    acoes.appendChild(rapida("arrowUp", "Comprar",
      caixa > 0 ? "há " + U.money(caixa, 0) + " em caixa" : "sem caixa nesta carteira",
      function () { location.hash = "#/ativos"; }));
    acoes.appendChild(rapida("refresh", "Atualizar preços",
      c.ativos + (c.ativos === 1 ? " ativo" : " ativos") + " para remarcar",
      atualizarPrecos));
    acoes.appendChild(rapida("wallet", "Carteiras e caixa", "depositar, sacar, transferir",
      function () { location.href = "../carteiras.html"; }));
    view.appendChild(acoes);

    /* KPIs — quatro, não três. O caixa entrou porque é ele que decide
       se a próxima compra acontece, e o painel não o mostrava em lugar
       nenhum apesar de o módulo depender dele. */
    var kpis = U.el("div", { class: "grid g-4 mt-16" });
    /* O sparkline só aparece quando há duas medições. Com uma só, ele
       desenharia uma linha reta com cara de estabilidade — e o que
       existe é falta de histórico, não estabilidade. */
    kpis.appendChild(U.kpi({ icon: "wallet", label: "Valor da carteira", value: U.compact(val),
      sub: c.posicoes + (c.posicoes === 1 ? " posição · custo " : " posições · custo ") + U.compact(custo),
      spark: serie.length >= 2 ? C.sparkline(serie.map(function (p) { return p.v; }), { w: 84, h: 26 }) : null }));
    kpis.appendChild(U.kpi({ icon: "trendUp", label: "Resultado (PnL)", value: U.money(pnl, 0),
      delta: pnl, deltaText: U.pct(pnlPct) }));
    kpis.appendChild(U.kpi({ icon: "coins", label: "Caixa disponível",
      value: caixa == null ? "—" : U.money(caixa, 0),
      sub: carteira ? "em " + carteira.name : "sem carteira" }));
    kpis.appendChild(U.kpi({ icon: "target", label: "Convicção média", value: avgConv.toFixed(1) + " / 10", sub: c.teses_ativas + " teses ativas" }));
    view.appendChild(kpis);

    /* performance + allocation */
    var mid = U.el("div", { class: "grid g-12 mt-16" });

    var perfBody;
    if (serie.length >= 2) {
      perfBody = U.el("div", {}, [
        C.lineChart(serie),
        U.el("div", { class: "small dim", style: "margin-top:8px",
          text: medidos + (medidos === 1 ? " dia medido" : " dias medidos") +
                " · o traçado entre medições repete o último valor conhecido." })
      ]);
    } else {
      perfBody = U.empty("chart", "Ainda sem histórico medido",
        "O ATLAS registra o valor da carteira uma vez por dia, a partir de agora. " +
        "A curva aparece quando houver duas medições — ele não desenha o passado que não mediu.");
    }
    var perfCard = U.card({ eyebrow: "Evolução", title: "Performance da carteira",
      action: U.el("span", { class: "badge " + (pnl >= 0 ? "invested" : "invalid") }, [U.pct(pnlPct)]),
      body: [perfBody] });
    perfCard.classList.add("col-8");
    mid.appendChild(perfCard);

    // allocation donut
    var segs = S.get.walletPositions().map(function (p, i) {
      var a = S.get.asset(p.ativo_id);
      return { label: a ? a.ticker : "?", id: p.ativo_id, value: S.get.positionValue(p), color: C.color(i) };
    }).sort(function (x, y) { return y.value - x.value; });
    var allocBody = U.el("div");
    if (segs.length) {
      allocBody.appendChild(C.donut(segs, { centerTop: segs.length, centerBottom: "ativos" }));
      /* A legenda virou lista clicável com o valor em dólar ao lado.
         Antes trazia só "SOL · 21%" e não levava a lugar nenhum — o
         donut mostrava a concentração e deixava a pessoa procurar o
         ativo na outra tela para agir sobre ela. */
      var legend = U.el("div", { class: "legend-list" });
      segs.forEach(function (s) {
        var pctv = (s.value / (val || 1)) * 100;
        var li = U.el("button", { class: "ll-item" + (pctv > 40 ? " alto" : ""), type: "button",
          title: "Abrir " + s.label });
        li.appendChild(U.el("span", { class: "sw", style: "background:" + s.color }));
        li.appendChild(U.el("span", { class: "ll-tick", text: s.label }));
        li.appendChild(U.el("span", { class: "ll-val num", text: U.compact(s.value) }));
        li.appendChild(U.el("span", { class: "ll-pct num", text: pctv.toFixed(0) + "%" }));
        li.addEventListener("click", function () { location.hash = "#/ativos?id=" + s.id; });
        legend.appendChild(li);
      });
      allocBody.appendChild(legend);
    } else {
      allocBody.appendChild(U.empty("wallet", "Sem alocação",
        "Registre uma compra para ver a distribuição.",
        U.button("Ver ativos", { variant: "secondary", icon: "layers",
          onClick: function () { location.hash = "#/ativos"; } })));
    }
    var allocCard = U.card({ eyebrow: "Distribuição", title: "Alocação", body: [allocBody] });
    allocCard.classList.add("col-4");
    mid.appendChild(allocCard);
    view.appendChild(mid);

    /* alerts + recent */
    var bottom = U.el("div", { class: "grid g-12 mt-16" });

    /* ------------------------------------------------------------
       ALERTAS QUE LEVAM AO ATIVO

       Cada alerta já sabia de qual ativo fala (`a.asset`) e a
       informação era jogada fora: a linha era um <div> morto. "SOL
       está investido sem tese vinculada" e nenhum caminho para
       resolver — a pessoa lia, ia para Ativos, procurava SOL na lista
       e só então agia. Alerta que não leva à ação é decoração de
       gravidade.
       ------------------------------------------------------------ */
    var al = S.get.alerts();
    var alertBody = U.el("div");
    if (al.length) {
      al.slice(0, 6).forEach(function (a) {
        var nivel = a.level === "crit" ? "crit" : a.level === "warn" ? "warn" : "info";
        var alvo = a.asset && S.get.asset(a.asset);
        var row = U.el(alvo ? "button" : "div", {
          class: "alert-row " + nivel + (alvo ? " clicavel" : ""),
          type: alvo ? "button" : null,
          title: alvo ? "Abrir " + alvo.ticker : null
        });
        row.innerHTML = '<div class="ai">' + U.icon(nivel === "info" ? "target" : "alert") + '</div>';
        var col = U.el("div", { class: "grow" });
        col.appendChild(U.el("div", { class: "a-t", text: a.title }));
        col.appendChild(U.el("div", { class: "a-s", text: a.sub }));
        row.appendChild(col);
        if (alvo) {
          row.appendChild(U.el("span", { class: "a-go", html: U.icon("arrow") }));
          row.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.asset; });
        }
        alertBody.appendChild(row);
      });
    } else {
      alertBody.appendChild(U.empty("shield", "Tudo em ordem", "Nenhum alerta de tese ou concentração no momento."));
    }
    var alertCard = U.card({ eyebrow: "Monitoramento", title: "Alertas",
      action: al.length ? U.el("span", { class: "badge " + (al.some(function (x) { return x.level === "crit"; }) ? "invalid" : "review") },
        [U.el("span", { class: "dot" }), String(al.length)]) : null,
      body: [alertBody] });
    alertCard.classList.add("col-4");
    bottom.appendChild(alertCard);

    // recent history timeline
    var tl = U.el("div", { class: "timeline" });
    var recent = S.state.historico.slice(0, 5);
    if (recent.length) {
      recent.forEach(function (h) { tl.appendChild(historyItem(h)); });
    } else {
      tl = U.empty("history", "Sem histórico", "As decisões aparecem aqui conforme forem registradas.");
    }
    var histCard = U.card({ eyebrow: "Registro", title: "Atividade recente",
      action: U.button("Ver histórico", { variant: "ghost", size: "sm", onClick: function () { location.hash = "#/historico"; } }),
      body: [tl] });
    histCard.classList.add("col-8");
    bottom.appendChild(histCard);
    view.appendChild(bottom);

    /* ------------------------------------------------------------
       AS POSIÇÕES, NO PAINEL

       O painel mostrava quanto a carteira vale e como está distribuída
       — sem nunca dizer QUAIS são as posições e como cada uma vai. Era
       preciso ir até Ativos para ver a lista, e o painel virava um
       resumo de si mesmo. A tabela aqui é curta de propósito: as cinco
       maiores, com o caminho para o resto.
       ------------------------------------------------------------ */
    var posicoes = S.get.walletPositions().slice().sort(function (x, y) {
      return S.get.positionValue(y) - S.get.positionValue(x);
    });
    if (posicoes.length) {
      var cols = [
        { head: "Ativo", render: function (p) { return U.assetCell(S.get.asset(p.ativo_id)); } },
        { head: "Preço médio", right: true, render: function (p) {
          return U.el("span", { class: "num dim", text: U.money(p.preco_medio) }); } },
        { head: "Valor", right: true, render: function (p) {
          return U.el("span", { class: "num", text: U.money(S.get.positionValue(p), 0) }); } },
        { head: "Peso", right: true, render: function (p) {
          var w = S.get.positionWeight(p);
          var wrap = U.el("span", { class: "peso-mini" + (S.get.concentrada(w) ? " alto" : "") });
          var bar = U.el("span", { class: "bar" });
          bar.appendChild(U.el("i", { style: "width:" + w.toFixed(0) + "%" }));
          wrap.appendChild(bar);
          wrap.appendChild(U.el("span", { class: "n", text: w.toFixed(0) + "%" }));
          return wrap;
        } },
        { head: "Resultado", right: true, render: function (p) {
          var v = S.get.positionPnL(p);
          return U.el("div", { class: "stack", style: "align-items:flex-end;gap:2px" }, [
            U.el("span", { class: "num " + U.signClass(v), text: U.money(v, 0) }),
            U.el("span", { class: "small " + U.signClass(v), text: U.pct(S.get.positionPnLPct(p), 1) })
          ]);
        } }
      ];
      var posCard = U.card({ eyebrow: "Carteira · " + (carteira ? carteira.name : "—"),
        title: "Posições" + (posicoes.length > 5 ? " · 5 maiores" : ""), tight: true,
        action: U.button("Ver todas", { variant: "ghost", size: "sm",
          onClick: function () { location.hash = "#/ativos"; } }),
        body: [U.table(cols, posicoes.slice(0, 5), {
          onRow: function (p) { location.hash = "#/ativos?id=" + p.ativo_id; }
        })] });
      posCard.classList.add("mt-16");
      view.appendChild(posCard);
    }

    return { title: "Painel", crumb: "Visão geral", node: view };
  };

  function historyItem(h) {
    var a = S.get.asset(h.ativo_id);
    var kind = h.subtipo === "buy" ? "buy" : h.subtipo === "sell" ? "sell" : h.subtipo === "thesis" ? "thesis" : h.subtipo === "study" ? "study" : "";
    var item = U.el("div", { class: "tl-item " + kind });
    item.innerHTML = '<div class="tl-dot">' + U.icon(h.subtipo === "buy" ? "arrowUp" : h.subtipo === "sell" ? "arrowDown" : h.subtipo === "thesis" ? "doc" : "check") + '</div>';
    var head = U.el("div", { class: "tl-head" });
    head.appendChild(U.el("span", { class: "tl-title", text: (a ? a.ticker + " · " : "") + labelAction(h.tipo_acao) }));
    head.appendChild(U.el("span", { class: "tl-time", text: U.dateTime(h.data) }));
    item.appendChild(head);
    item.appendChild(U.el("div", { class: "tl-body", text: h.impacto || h.justificativa }));
    return item;
  }
  function labelAction(t) {
    return {
      TRADE_EXECUTED: "Operação executada", THESIS_CREATED: "Tese criada", THESIS_UPDATED: "Tese revisada",
      ASSET_CREATED: "Ativo adicionado", STUDY_CREATED: "Estudo criado", STUDY_CONVERTED: "Estudo convertido",
      POSITION_UPDATED: "Posição atualizada"
    }[t] || t;
  }
  window.Pages._historyItem = historyItem;
  window.Pages._labelAction = labelAction;
})();
