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
        U.button("Registrar compra", { variant: "primary", icon: "plus", onClick: function () { F.novaCompra(); } })
      ])
    ]));

    /* Carteira vazia mostra o painel inteiro ZERADO, não instruções:
       pedido do dono (08/10/2026) — os números e os gráficos ficam no
       lugar e se preenchem conforme as compras entram. */

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
       DUAS PIZZAS NO LUGAR DA TABELA

       Pedido do dono (16/10/2026): o Painel é a tela de olhar, não de
       ler linha a linha — a tabela de posições vive em Ativos. À
       esquerda, quanto cada token pesa em dólar; à direita, quanto
       cada setor (RWA, IA, DePIN, ZK…) pesa. O setor vem de
       core/atlas-setores.js: o que a pessoa escreveu em Editar vence,
       depois o catálogo, depois as categorias da CoinGecko.
       ------------------------------------------------------------ */
    {
      var pizzas = U.el("div", { class: "grid g-12 mt-16" });

      /* Os dados passam por Charts.fatias(): ordem de valor, no máximo
         sete fatias com um "Outros" só no fim, % sobre a soma das
         fatias, posição sem preço fora da pizza (testado em
         hold/testes/pizza.test.js). */
      var setorDe = function (a) {
        return window.AtlasSetores ? window.AtlasSetores.de(a).setor : (a.setor || "Outros");
      };
      var itensToken = [], porSetorMapa = {};
      posicoes.forEach(function (p) {
        var a = S.get.asset(p.ativo_id); if (!a) return;
        var v = S.get.positionValue(p);
        itensToken.push({ label: a.ticker, sub: a.nome || "", id: p.ativo_id, value: v });
        var k = setorDe(a);
        if (!porSetorMapa[k]) porSetorMapa[k] = { label: k, value: 0, tickers: [] };
        if (v > 0) { porSetorMapa[k].value += v; porSetorMapa[k].tickers.push(a.ticker); }
      });
      var dadosToken = C.fatias(itensToken);
      dadosToken.fatias.forEach(function (f, i) {
        f.color = C.pieColor(i, f.label);
        f.onClick = f.id ? function () { location.hash = "#/ativos?id=" + f.id; }
                         : function () { location.hash = "#/ativos"; };
      });
      var dadosSetor = C.fatias(Object.keys(porSetorMapa).map(function (k) {
        var m = porSetorMapa[k];
        return { label: k, value: m.value, sub: m.tickers.join(", ") };
      }));
      /* Quem está sem preço já é listado na pizza de token; aqui só a
         marca, para o disco dizer "sem preço" e não "sem posições". */
      dadosSetor.semPrecoNomes = dadosToken.semPreco;
      dadosSetor.semPreco = [];
      dadosSetor.fatias.forEach(function (f) {
        f.color = window.AtlasSetores ? C.tom(window.AtlasSetores.cor(f.label)) : C.pieColor(0, "Outros");
      });

      /* 16/10/2026: as pizzas 3D foram reprovadas como "infantis".
         Token = anel plano com o total no centro e uma lista com ícone,
         barra de peso, valor e %. Setor = barras horizontais em ordem,
         que comparam melhor do que fatias. */
      function pctTxt(f) { return (f.frac * 100).toFixed(1).replace(".", ",") + "%"; }
      function linhaPeso(f, o, extra) {
        var li = U.el("button", { class: "aloc-linha" + (o.alerta && S.get.concentrada(f.frac * 100) ? " alto" : ""), type: "button" });
        li.appendChild(extra);
        var nome = U.el("span", { class: "aloc-nome" }, [U.el("span", { class: "aloc-tick", text: f.label })]);
        if (f.sub) nome.appendChild(U.el("span", { class: "aloc-sub", text: f.sub }));
        li.appendChild(nome);
        li.appendChild(U.el("span", { class: "aloc-val num", text: U.money(f.value, 0) }));
        li.appendChild(U.el("span", { class: "aloc-pct num", text: pctTxt(f) }));
        var barra = U.el("span", { class: "aloc-barra" }, [U.el("span", {
          style: "width:" + Math.max(0.8, f.frac * 100).toFixed(2) + "%;background:" + f.color })]);
        li.appendChild(barra);
        li.addEventListener("click", f.onClick || function () { location.hash = "#/ativos"; });
        return li;
      }
      function semPrecoNota(dados, pai) {
        if (dados.semPreco.length) pai.appendChild(U.el("div", { class: "aloc-nota small dim",
          text: "sem preço: " + dados.semPreco.join(", ") }));
      }
      function vazio(dados) {
        var semTudo = dados.semPreco.length || (dados.semPrecoNomes || []).length;
        return U.el("div", { class: "aloc-vazio small dim", text: semTudo ? "Posições sem preço" : "Sem posições" });
      }

      function cartaoToken(dados, o) {
        var lista = dados.fatias, corpo;
        if (!lista.length) corpo = vazio(dados);
        else {
          corpo = U.el("div", { class: "aloc-corpo" });
          var g = C.anel(lista, {
            centro: U.money(dados.total, 0), rotuloSup: "Patrimônio",
            rotulo: lista.length + (lista.length === 1 ? " posição" : " posições"),
            fmt: function (v) { return U.money(v, 0); },
            ariaLabel: o.title + ": " + lista.map(function (f) { return f.label + " " + Math.round(f.frac * 100) + "%"; }).join(", ")
          });
          corpo.appendChild(U.el("div", { class: "aloc-anel" }, [g]));
          var lst = U.el("div", { class: "aloc-lista" });
          lista.forEach(function (f, i) {
            var marca = f.id
              ? U.el("span", { class: "ticker-badge sm", "data-atlas-token": f.label, text: f.label.slice(0, 3) })
              : U.el("span", { class: "aloc-sw", style: "background:" + f.color });
            var li = linhaPeso(f, o, marca);
            li.addEventListener("mouseenter", function () { g.destacar(i); });
            li.addEventListener("mouseleave", function () { g.destacar(-1); });
            lst.appendChild(li);
          });
          semPrecoNota(dados, lst);
          corpo.appendChild(lst);
        }
        var card = U.card({ eyebrow: o.eyebrow, title: o.title, action: o.action, body: [corpo] });
        card.classList.add("col-6");
        return card;
      }

      function cartaoSetor(dados, o) {
        var lista = dados.fatias, corpo;
        if (!lista.length) corpo = vazio(dados);
        else {
          corpo = U.el("div", { class: "aloc-lista aloc-setores" });
          lista.forEach(function (f) {
            corpo.appendChild(linhaPeso(f, o, U.el("span", { class: "aloc-sw", style: "background:" + f.color })));
          });
        }
        var card = U.card({ eyebrow: o.eyebrow, title: o.title, action: o.action, body: [corpo] });
        card.classList.add("col-6");
        return card;
      }

      var nSetores = dadosSetor.fatias.length;
      pizzas.appendChild(cartaoToken(dadosToken, {
        eyebrow: "Carteira · " + (carteira ? carteira.name : "—"), title: "Alocação por token", alerta: true,
        action: U.button("Ver posições", { variant: "ghost", size: "sm",
          onClick: function () { location.hash = "#/ativos"; } })
      }));
      pizzas.appendChild(cartaoSetor(dadosSetor, {
        eyebrow: "Exposição", title: "Alocação por setor",
        action: U.el("span", { class: "small dim", title: "O setor é automático. Para trocar, edite o ativo em Ativos.",
          text: nSetores + (nSetores === 1 ? " setor" : " setores") })
      }));
      view.appendChild(pizzas);

      /* Quem não está no catálogo vai à CoinGecko uma vez; se algum
         ganhou setor, a tela redesenha com a fatia certa. */
      if (window.AtlasSetores && porSetorMapa.Outros) {
        window.AtlasSetores.completar(posicoes.map(function (p) { return S.get.asset(p.ativo_id); }))
          .then(function (mudou) { if (mudou && location.hash.replace(/^#\/?/, "").split("?")[0] in { "": 1, dashboard: 1 }) window.Router.rerender(); });
      }
    }

    /* ------------------------------------------------------------
       QUEM VALORIZOU, QUEM DESVALORIZOU

       Barras horizontais com o resultado em aberto de cada posição,
       centradas no zero: verde para a direita, vermelho para a
       esquerda, valor e % escritos (a cor nunca é a única pista). É a
       resposta direta a "como vão os meus ativos", e existe desde o
       primeiro dia — a curva de evolução precisa de dias de medição.
       ------------------------------------------------------------ */
    {
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
      if (!porRes.length) {
        /* sem posição: o eixo do zero vazio, no lugar do gráfico */
        var linhaVazia = U.el("div", { class: "ganho-linha vazio" });
        linhaVazia.appendChild(U.el("span", { class: "gl-tick dim", text: "—" }));
        linhaVazia.appendChild(U.el("span", { class: "gl-trilho" }));
        linhaVazia.appendChild(U.el("span", { class: "gl-val num neu", text: U.money(0, 0) + " · " + U.pct(0, 1) }));
        lista.appendChild(linhaVazia);
      }
      var ganhoCard = U.card({ eyebrow: "Valorização", title: "Ganho ou perda por ativo",
        action: U.el("span", { class: "small dim", text: "em aberto, sobre o preço médio" }),
        body: [lista] });
      ganhoCard.classList.add("col-12");
      mid.appendChild(ganhoCard);
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
