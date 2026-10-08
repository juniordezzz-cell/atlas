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
      /* Fonte principal fora do ar não é "ativo desconhecido": sem
         este aviso a pessoa ia digitar preço manual — que depois
         vence a API por sete dias — por causa de uma queda de rede. */
      if (r.erro) {
        partes.push("a fonte principal não respondeu (" + (r.erro.message || "erro de rede") +
                   ") — tente de novo antes de digitar preço na mão");
      } else if (r.faltando.length) {
        partes.push("nenhuma fonte reconheceu " + r.faltando.join(", ") +
                    " — informe o preço na mão em Editar");
      }
      if (r.soManual && r.soManual.length) {
        partes.push(r.soManual.join(", ") + " não é cripto: o preço é o que você informar em Editar");
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
    var realizado = S.get.realizado ? S.get.realizado() : 0;

    var carteira = S.wallets.active();
    var caixa = S.wallets.caixa();   // a carteira em uso, ou a soma de todas
    var custo = S.get.portfolioCost();
    var posicoes = S.get.walletPositions().slice().sort(function (x, y) {
      return S.get.positionValue(y) - S.get.positionValue(x);
    });

    var view = U.el("div");

    /* ------------------------------------------------------------
       CABEÇALHO COM AS AÇÕES

       Os quatro cartões de atalho ficavam ANTES dos números: a primeira
       coisa da tela era um menu, e o patrimônio ficava abaixo da dobra
       no notebook. As ações continuam a um clique, no cabeçalho, como
       nas outras telas do módulo.
       ------------------------------------------------------------ */
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Painel" }),
          U.el("p", { text: (carteira ? carteira.name : "Carteira") + " · " +
            c.posicoes + (c.posicoes === 1 ? " posição" : " posições") })
        ]),
        U.button("Atualizar preços", { icon: "refresh", onClick: atualizarPrecos }),
        U.button("Carteiras e caixa", { variant: "ghost", icon: "wallet",
          onClick: function () { location.href = "../pages/carteiras.html"; } }),
        U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: function () { F.newAsset(); } })
      ])
    ]));

    /* ------------------------------------------------------------
       OS QUATRO NÚMEROS, EXATOS

       "US$ 9,6 mil" arredondava o número principal de um painel de
       dinheiro — com 9.615 na carteira, a tela escondia 15 dólares no
       maior número dela. Abaixo de um milhão, o valor vai inteiro.
       E o primeiro número passa a ser o PATRIMÔNIO (posições + caixa):
       o que você tem no Hold, não só o que está aplicado.
       ------------------------------------------------------------ */
    function exato(v) { return Math.abs(v) >= 1e6 ? U.compact(v) : U.money(v, 0); }
    var kpis = U.el("div", { class: "grid g-4" });
    kpis.appendChild(U.kpi({ icon: "wallet", label: "Patrimônio no Hold",
      value: exato(val + (caixa || 0)),
      sub: "posições " + exato(val) + " · caixa " + exato(caixa || 0),
      spark: serie.length >= 2 ? C.sparkline(serie.map(function (p) { return p.v; }), { w: 84, h: 26 }) : null }));
    kpis.appendChild(U.kpi({ icon: "trendUp", label: "Resultado em aberto", value: U.money(pnl, 0),
      delta: pnl, deltaText: U.pct(pnlPct), sub: "sobre " + exato(custo) + " de custo" }));
    kpis.appendChild(U.kpi({ icon: "target", label: "Resultado realizado", value: U.money(realizado, 0),
      sub: "total com o aberto: " + U.money(pnl + realizado, 0) }));
    kpis.appendChild(U.kpi({ icon: "coins", label: "Caixa disponível",
      value: caixa == null ? "—" : U.money(caixa, 0),
      sub: carteira ? "em " + carteira.name : "sem carteira" }));
    view.appendChild(kpis);

    /* ------------------------------------------------------------
       POSIÇÕES LOGO ABAIXO DOS NÚMEROS

       A tabela das posições era o ÚLTIMO bloco da página. Num painel
       de hold, é a leitura principal: o que eu tenho, quanto paguei,
       quanto vale hoje. O preço atual fica ao lado do preço médio —
       a valorização se lê na própria linha, sem fazer conta.
       ------------------------------------------------------------ */
    if (posicoes.length) {
      var cols = [
        { head: "Ativo", render: function (p) { return U.assetCell(S.get.asset(p.ativo_id)); } },
        { head: "Quantidade", right: true, render: function (p) {
          return U.el("span", { class: "num", text: U.qty(p.quantidade) }); } },
        { head: "Preço médio → atual", right: true, render: function (p) {
          var a = S.get.asset(p.ativo_id) || {};
          var varp = p.preco_medio > 0 ? (a.preco_atual / p.preco_medio - 1) * 100 : 0;
          return U.el("div", { class: "stack", style: "align-items:flex-end;gap:2px" }, [
            U.el("span", { class: "num" }, [
              U.el("span", { class: "dim", text: U.money(p.preco_medio) + " → " }),
              document.createTextNode(a.preco_atual > 0 ? U.money(a.preco_atual) : "—")
            ]),
            U.el("span", { class: "small " + U.signClass(varp), text: U.pct(varp, 1) + " no preço" })
          ]);
        } },
        { head: "Valor", right: true, render: function (p) {
          var wrap = U.el("div", { class: "stack", style: "align-items:flex-end;gap:3px" }, [
            U.el("span", { class: "num", text: U.money(S.get.positionValue(p), 0) })
          ]);
          var w = S.get.positionWeight(p);
          var peso = U.el("span", { class: "peso-mini" + (S.get.concentrada(w) ? " alto" : "") });
          var bar = U.el("span", { class: "bar" });
          bar.appendChild(U.el("i", { style: "width:" + w.toFixed(0) + "%" }));
          peso.appendChild(bar);
          peso.appendChild(U.el("span", { class: "n", text: w.toFixed(0) + "%" }));
          wrap.appendChild(peso);
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
        title: "Posições" + (posicoes.length > 8 ? " · 8 maiores" : ""), tight: true,
        action: U.button("Ver todas", { variant: "ghost", size: "sm",
          onClick: function () { location.hash = "#/ativos"; } }),
        body: [U.table(cols, posicoes.slice(0, 8), {
          onRow: function (p) { location.hash = "#/ativos?id=" + p.ativo_id; }
        })] });
      posCard.classList.add("mt-16");
      view.appendChild(posCard);
    } else {
      var vazio = U.card({ body: [U.empty("wallet", "Sua carteira de hold começa aqui",
        "Cadastre o ativo e registre a compra com a quantidade, o preço que você pagou, a taxa e a data.",
        U.button("Adicionar e comprar", { variant: "primary", icon: "plus", onClick: function () { F.newAsset(); } }))] });
      vazio.classList.add("mt-16");
      view.appendChild(vazio);
    }

    /* ------------------------------------------------------------
       QUEM VALORIZOU, QUEM DESVALORIZOU

       Barras horizontais com o resultado em aberto de cada posição,
       centradas no zero: verde para a direita, vermelho para a
       esquerda, valor e % escritos (a cor nunca é a única pista). É a
       resposta direta a "como vão os meus ativos", e existe desde o
       primeiro dia — a curva de evolução precisa de dias de medição.
       ------------------------------------------------------------ */
    if (posicoes.length) {
      var mid = U.el("div", { class: "grid g-12 mt-16" });
      var porRes = posicoes.slice().sort(function (x, y) { return S.get.positionPnL(y) - S.get.positionPnL(x); });
      var maxAbs = porRes.reduce(function (m, p) { return Math.max(m, Math.abs(S.get.positionPnL(p))); }, 0) || 1;
      var lista = U.el("div", { class: "ganho-lista" });
      porRes.forEach(function (p) {
        var a = S.get.asset(p.ativo_id) || {};
        var v = S.get.positionPnL(p), pc = S.get.positionPnLPct(p);
        var largura = Math.max(1, Math.abs(v) / maxAbs * 50);
        var linha = U.el("button", { class: "ganho-linha", type: "button", title: "Abrir " + (a.ticker || "") });
        linha.addEventListener("click", function () { location.hash = "#/ativos?id=" + p.ativo_id; });
        linha.appendChild(U.el("span", { class: "gl-tick", text: a.ticker || "?" }));
        var trilho = U.el("span", { class: "gl-trilho" });
        trilho.appendChild(U.el("i", { class: v >= 0 ? "pos" : "neg",
          style: (v >= 0 ? "left:50%;" : "right:50%;") + "width:" + largura.toFixed(1) + "%" }));
        linha.appendChild(trilho);
        linha.appendChild(U.el("span", { class: "gl-val num " + U.signClass(v),
          text: U.money(v, 0) + " · " + U.pct(pc, 1) }));
        lista.appendChild(linha);
      });
      var ganhoCard = U.card({ eyebrow: "Valorização", title: "Ganho ou perda por ativo",
        action: U.el("span", { class: "small dim", text: "em aberto, sobre o preço médio" }),
        body: [lista] });
      ganhoCard.classList.add("col-8");
      mid.appendChild(ganhoCard);

      var segs = posicoes.map(function (p, i) {
        var a = S.get.asset(p.ativo_id);
        return { label: a ? a.ticker : "?", id: p.ativo_id, value: S.get.positionValue(p), color: C.color(i) };
      });
      var allocBody = U.el("div");
      allocBody.appendChild(C.donut(segs, { centerTop: segs.length, centerBottom: segs.length === 1 ? "ativo" : "ativos" }));
      var legend = U.el("div", { class: "legend-list" });
      segs.forEach(function (sg) {
        var pctv = (sg.value / (val || 1)) * 100;
        var li = U.el("button", { class: "ll-item" + (S.get.concentrada(pctv) ? " alto" : ""), type: "button",
          title: "Abrir " + sg.label });
        li.appendChild(U.el("span", { class: "sw", style: "background:" + sg.color }));
        li.appendChild(U.el("span", { class: "ll-tick", text: sg.label }));
        li.appendChild(U.el("span", { class: "ll-val num", text: U.money(sg.value, 0) }));
        li.appendChild(U.el("span", { class: "ll-pct num", text: pctv.toFixed(0) + "%" }));
        li.addEventListener("click", function () { location.hash = "#/ativos?id=" + sg.id; });
        legend.appendChild(li);
      });
      allocBody.appendChild(legend);
      var allocCard = U.card({ eyebrow: "Distribuição", title: "Alocação", body: [allocBody] });
      allocCard.classList.add("col-4");
      mid.appendChild(allocCard);
      view.appendChild(mid);
    }

    /* Evolução: a curva medida. Sem duas medições, uma linha curta em
       vez de meia tela vazia. */
    var perfBody;
    if (serie.length >= 2) {
      perfBody = U.el("div", {}, [
        C.lineChart(serie),
        U.el("div", { class: "small dim", style: "margin-top:8px",
          text: medidos + (medidos === 1 ? " dia medido" : " dias medidos") +
                " · entre medições a linha repete o último valor conhecido." })
      ]);
    } else {
      perfBody = U.el("div", { class: "small dim",
        text: "O ATLAS mede o valor da carteira uma vez por dia. A curva aparece a partir da segunda medição — " +
              "ele não desenha o passado que não mediu." });
    }
    var perfCard = U.card({ eyebrow: "Evolução", title: "Performance da carteira",
      action: U.el("span", { class: "badge " + (pnl >= 0 ? "invested" : "invalid") }, [U.pct(pnlPct)]),
      body: [perfBody] });
    perfCard.classList.add("mt-16");
    view.appendChild(perfCard);

    /* alertas + atividade */
    var bottom = U.el("div", { class: "grid g-12 mt-16" });
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
        row.appendChild(U.el("div", { class: "ai" }, [U.iconEl(nivel === "info" ? "target" : "alert")]));
        var col = U.el("div", { class: "grow" });
        col.appendChild(U.el("div", { class: "a-t", text: a.title }));
        col.appendChild(U.el("div", { class: "a-s", text: a.sub }));
        row.appendChild(col);
        if (alvo) row.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.asset; });
        alertBody.appendChild(row);
      });
    } else {
      alertBody.appendChild(U.empty("shield", "Tudo em ordem", "Nenhuma posição acima do limite de concentração."));
    }
    var alertCard = U.card({ eyebrow: "Monitoramento", title: "Alertas",
      action: al.length ? U.el("span", { class: "badge " + (al.some(function (x) { return x.level === "crit"; }) ? "invalid" : "review") },
        [U.el("span", { class: "dot" }), String(al.length)]) : null,
      body: [alertBody] });
    alertCard.classList.add("col-4");
    bottom.appendChild(alertCard);

    /* Atividade: só o que mexeu em dinheiro ou preço. "Ativo
       adicionado" ocupava as cinco linhas logo depois de um cadastro e
       empurrava a compra para fora da lista. */
    var tl = U.el("div", { class: "timeline" });
    var recent = historicoOrdenado().filter(function (h) {
      return h.tipo_acao === "TRADE_EXECUTED" || h.subtipo === "price";
    }).slice(0, 5);
    if (recent.length) {
      recent.forEach(function (h) { tl.appendChild(historyItem(h)); });
    } else {
      tl = U.empty("history", "Sem operações ainda", "Compras, vendas e preços informados aparecem aqui.");
    }
    var histCard = U.card({ eyebrow: "Registro", title: "Atividade recente",
      action: U.button("Ver histórico", { variant: "ghost", size: "sm", onClick: function () { location.hash = "#/historico"; } }),
      body: [tl] });
    histCard.classList.add("col-8");
    bottom.appendChild(histCard);
    view.appendChild(bottom);

    return { title: "Painel", crumb: "Visão geral", node: view };
  };

  function historyItem(h) {
    var a = S.get.asset(h.ativo_id);
    var kind = h.subtipo === "buy" ? "buy" : h.subtipo === "sell" ? "sell" : "";
    var item = U.el("div", { class: "tl-item " + kind + (h.desfeita ? " desfeita" : "") });
    item.innerHTML = '<div class="tl-dot">' + U.icon(h.subtipo === "buy" ? "arrowUp" : h.subtipo === "sell" ? "arrowDown" : h.subtipo === "undo" ? "history" : "check") + '</div>';
    var head = U.el("div", { class: "tl-head" });
    head.appendChild(U.el("span", { class: "tl-title", text: (a ? a.ticker + " · " : "") + labelAction(h.tipo_acao, h) }));
    head.appendChild(U.el("span", { class: "tl-time", text: U.dateTime(h.data) }));
    item.appendChild(head);
    item.appendChild(U.el("div", { class: "tl-body", text: h.impacto || h.justificativa }));
    return item;
  }
  /* "Operação executada" para compra e venda igualmente obrigava a ler
     o corpo para saber o que aconteceu. O subtipo já dizia. */
  function labelAction(t, h) {
    var sub = h && h.subtipo;
    if (t === "TRADE_EXECUTED" && sub) {
      var r = { buy: "Compra", sell: "Venda", undo: "Operação desfeita" }[sub];
      if (r) return r + (h.desfeita ? " (desfeita)" : "");
    }
    if (t === "POSITION_UPDATED" && sub === "price") return "Preço informado";
    if (t === "ASSET_CREATED" && h && /exclu/.test(h.justificativa || "")) return "Ativo excluído";
    return {
      TRADE_EXECUTED: "Operação executada", ASSET_CREATED: "Ativo adicionado",
      POSITION_UPDATED: "Posição atualizada"
    }[t] || t;
  }
  /* A data de uma operação pode ser passada (compra registrada hoje,
     feita em março). A lista segue a data do fato, não a do cadastro. */
  function historicoOrdenado() {
    return S.state.historico.slice().sort(function (x, y) {
      return String(y.data).localeCompare(String(x.data));
    });
  }
  window.Pages._historicoOrdenado = historicoOrdenado;
  window.Pages._historyItem = historyItem;
  window.Pages._labelAction = labelAction;
})();
