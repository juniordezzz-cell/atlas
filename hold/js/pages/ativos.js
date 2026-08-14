/* HOLD · pages/ativos.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;
  var filterState = "all";
  /* Ordenação e busca vivem FORA da função de render: a página se
     redesenha inteira a cada ação (rerender), e um estado guardado
     dentro dela voltaria ao padrão toda vez que você comprasse algo. */
  var sortKey = "Valor", sortDesc = true, termoBusca = "";

  window.Pages = window.Pages || {};
  window.Pages.ativos = function (ctx) {
    var id = ctx && ctx.query && ctx.query.id;
    if (id && S.get.asset(id)) return detailView(id);
    return listView();
  };

  /* Botão "Atualizar preços": busca pela cadeia única do ATLAS e
     relata o que não foi reconhecido, em vez de deixar o preço velho
     com aparência de preço de agora. */
  function botaoPrecos() {
    var b = U.button("Atualizar preços", { icon: "refresh" });
    b.addEventListener("click", function () {
      if (!S.actions.refreshPrices) return;
      b.disabled = true;
      var rotulo = b.textContent;
      b.textContent = "Buscando…";
      S.actions.refreshPrices().then(function (r) {
        b.disabled = false; b.textContent = rotulo;
        var partes = [];
        if (r.atualizados) partes.push(r.atualizados + " preço(s) atualizado(s)");
        if (r.faltando.length) {
          partes.push("nenhuma fonte reconheceu " + r.faltando.join(", ") +
                      " — informe o preço na mão em Editar");
        }
        /* U.toast do Hold é (título, mensagem, tipo) — assinatura
           diferente da do DeFi, que é (mensagem, tipo). */
        (r.divergentes || []).forEach(function (x) {
          U.toast("Preços divergentes em " + x.simbolo,
                  "API US$ " + x.primaria.toFixed(2) + " x DEX US$ " + x.secundaria.toFixed(2) +
                  " (" + x.pct.toFixed(1) + "% de diferença). Confira antes de usar.", "warn");
        });
        U.toast("Preços",
                partes.join(" · ") || "Todos os preços já estavam atualizados.",
                r.atualizados ? "ok" : "");
        window.Router.rerender();
      }).catch(function (e) {
        b.disabled = false; b.textContent = rotulo;
        U.toast("Preços", (e && e.message) || "Não consegui buscar os preços agora.", "warn");
      });
    });
    return b;
  }

  /* Busca o preço de UM ativo. A tela de detalhe não deveria obrigar a
     atualizar os quarenta para conferir um. Passa pela mesma cadeia
     (manual → id curado → busca → DEX), então o preço informado à mão
     continua vencendo — o que ela relata, quando ninguém reconhece, é
     que o ativo depende de você. */
  function atualizarUm(a) {
    if (!window.AtlasPrecos) return U.toast("Preços", "Camada de preços não carregada nesta página.", "warning");
    U.toast("Buscando preço", "Consultando as fontes para " + a.ticker + "…");
    window.AtlasPrecos.deVarios([a.ticker]).then(function (d) {
      var p = d.valores[String(a.ticker).toUpperCase()];
      if (p == null || !(p > 0)) {
        return U.toast("Nenhuma fonte reconheceu " + a.ticker,
          "Informe o preço na mão em Editar — ele passa a valer sobre a API.", "warning");
      }
      if (p === a.preco_atual) return U.toast("Preço", a.ticker + " já estava em " + U.money(p) + ".");
      S.actions.updateAsset(a.id, {
        preco_atual: p,
        precoFonte: d.fonte[String(a.ticker).toUpperCase()] || null,
        precoEm: new Date().toISOString()
      });
      U.toast("Preço atualizado", a.ticker + " marcado a " + U.money(p) + ".", "success");
      window.Router.rerender();
    }).catch(function (e) {
      U.toast("Preço indisponível", (e && e.message) || "Não consegui buscar agora.", "warning");
    });
  }

  /* Preço + procedência. `origemPreco` responde a pergunta da auditoria
     — qual a fonte deste número e de quando ele é. Sem preço nenhum,
     diz isso em vez de imprimir US$ 0,00 com cara de cotação. */
  function origemPreco(a) {
    if (!(a.preco_atual > 0)) return "sem preço — informe em Editar";
    var fonte = a.precoFonte === "manual" ? "informado por você"
      : a.precoFonte ? "fonte: " + a.precoFonte
      : "digitado no cadastro";
    if (!a.precoEm) return fonte;
    var dias = Math.floor((Date.now() - new Date(a.precoEm).getTime()) / 86400000);
    var quando = dias <= 0 ? "hoje" : dias === 1 ? "ontem" : "há " + dias + " dias";
    return fonte + " · " + quando;
  }
  function celulaPreco(a) {
    var wrap = U.el("div", { class: "stack", style: "align-items:flex-end;gap:2px" });
    wrap.appendChild(U.el("span", { class: "num", text: a.preco_atual > 0 ? U.money(a.preco_atual) : "—" }));
    wrap.appendChild(U.el("span", { class: "small dim", text: origemPreco(a) }));
    return wrap;
  }

  /* ============================================================
     AS AÇÕES DE UM ATIVO, NUM LUGAR SÓ

     A lista e a tela de detalhe precisam oferecer os mesmos verbos, e
     a regra de quando cada um vale é a mesma nos dois lugares: vender
     só existe com posição, excluir só sem ela. Escrever isso duas
     vezes é como as duas telas passam a discordar.
     ============================================================ */
  function excluirAtivo(a) {
    var pos = S.get.anyPositionOf(a.id);
    if (pos) {
      return U.toast("Não dá para excluir",
        a.ticker + " tem posição aberta. Venda primeiro — o apurado volta ao caixa da carteira.", "warning");
    }
    var t = S.get.thesisOfAsset(a.id);
    var perdas = [{ icon: "layers", texto: "O ativo " + a.ticker + " (" + a.nome + ") sai da lista" }];
    if (t) perdas.push({ icon: "doc", texto: "A tese vinculada é arquivada, com o motivo registrado" });
    if (a.precoFonte === "manual") perdas.push({ icon: "coins", texto: "O preço que você informou à mão é esquecido" });

    U.confirmar({
      eyebrow: "Excluir ativo",
      titulo: "Excluir " + a.ticker + "?",
      mensagem: "Não há posição aberta, então nenhum dinheiro está preso neste ativo.",
      itens: perdas,
      nota: "O histórico das decisões continua — um livro que se reescreve deixa de ser livro. As linhas passam a mostrar o ativo como removido.",
      confirmar: "Excluir " + a.ticker,
      onConfirm: function () {
        var r = S.actions.deleteAsset(a.id);
        if (r && r.error) return U.toast("Não foi possível", r.error, "warning");
        U.toast("Ativo excluído", a.ticker + (r.teseArquivada ? " removido e tese arquivada." : " removido."), "success");
        if (location.hash.indexOf("id=" + a.id) >= 0) location.hash = "#/ativos";
        else window.Router.rerender();
      }
    });
  }

  function acoesDoAtivo(a, opts) {
    opts = opts || {};
    var pos = S.get.positionOf(a.id);
    var t = S.get.thesisOfAsset(a.id);
    return [
      U.actionBtn("arrowUp", "Comprar " + a.ticker, function () { F.trade(a.id, "buy"); }, { primary: true }),
      U.actionBtn("arrowDown", "Vender " + a.ticker, pos ? function () { F.trade(a.id, "sell"); } : null,
        { disabled: !pos, disabledHint: "Sem posição de " + a.ticker + " nesta carteira" }),
      U.menuBtn(function () {
        return [
          { icon: "edit", label: "Editar ativo", onClick: function () { F.editAsset(a.id); } },
          t ? { icon: "doc", label: "Revisar tese", onClick: function () { F.editThesis(t.id); } }
            : { icon: "doc", label: "Criar tese", onClick: function () { F.newThesis(a.id); } },
          opts.semAbrir ? null : { icon: "eye", label: "Abrir ativo", onClick: function () { location.hash = "#/ativos?id=" + a.id; } },
          { sep: true },
          { icon: "trash", label: "Excluir ativo", danger: true,
            disabled: !!S.get.anyPositionOf(a.id),
            hint: "Venda a posição antes de excluir",
            onClick: function () { excluirAtivo(a); } }
        ];
      }, "Mais ações em " + a.ticker)
    ];
  }

  /* Faixa de leitura da tela: quatro números que respondem "como está
     a carteira" antes de a pessoa ler uma linha da tabela. */
  function faixaResumo() {
    var c = S.get.counts();
    var val = S.get.portfolioValue(), custo = S.get.portfolioCost();
    var pnl = val - custo, pnlPct = custo ? (pnl / custo) * 100 : 0;
    var carteira = S.wallets.active();
    var caixa = (window.AtlasCaixa && carteira) ? AtlasCaixa.saldo(carteira.id) : null;

    var semTese = S.state.ativos.filter(function (a) {
      return S.get.statusDe(a) === "invested" && !S.get.thesisOfAsset(a.id);
    }).length;

    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "wallet", label: "Valor investido", value: U.compact(val),
      sub: c.posicoes + (c.posicoes === 1 ? " posição" : " posições") }));
    strip.appendChild(U.kpi({ icon: "trendUp", label: "Resultado", value: U.money(pnl, 0),
      delta: pnl, deltaText: U.pct(pnlPct) }));
    /* O caixa aparece aqui porque é ele que decide se a próxima compra
       acontece — e esta é a tela de onde as compras partem. */
    strip.appendChild(U.kpi({ icon: "coins", label: "Caixa disponível",
      value: caixa == null ? "—" : U.money(caixa, 0),
      sub: carteira ? "em " + carteira.name : "sem carteira" }));
    strip.appendChild(U.kpi({ icon: semTese ? "alert" : "shield", label: "Posições sem tese",
      value: String(semTese),
      sub: semTese ? "documente para silenciar o alerta" : "toda posição tem fundamento" }));
    return strip;
  }

  function listView() {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Ativos" }), U.el("p", { text: "Universo completo de ativos do sistema, de watchlist a investidos." })]),
        /* O Hold nunca teve como atualizar preço: a ação existia no
           store e não era chamada por tela nenhuma. Sem ela, todo
           valor de posição do módulo era calculado com o preço
           digitado no dia do cadastro. */
        botaoPrecos(),
        U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: F.newAsset })
      ])
    ]));

    view.appendChild(faixaResumo());

    /* Contagem em cada filtro: sem ela, "Vendidos" é uma aposta — a
       pessoa clica para descobrir se há algo do outro lado. */
    var porStatus = { all: S.state.ativos.length, invested: 0, watchlist: 0, sold: 0 };
    S.state.ativos.forEach(function (a) { porStatus[S.get.statusDe(a)]++; });

    var seg = U.el("div", { class: "segmented" });
    [["all", "Todos"], ["invested", "Investidos"], ["watchlist", "Watchlist"], ["sold", "Vendidos"]].forEach(function (o) {
      var b = U.el("button", { class: filterState === o[0] ? "on" : "" });
      b.appendChild(document.createTextNode(o[1]));
      b.appendChild(U.el("span", { class: "seg-count", text: String(porStatus[o[0]] || 0) }));
      b.addEventListener("click", function () { filterState = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });

    var searchWrap = U.el("div", { class: "search" });
    searchWrap.innerHTML = U.icon("search");
    var searchInput = U.input({ placeholder: "Buscar por nome ou ticker…", value: termoBusca });
    searchWrap.appendChild(searchInput);

    var toolbar = U.el("div", { class: "between mt-16", style: "margin-bottom:16px" }, [seg, searchWrap]);
    view.appendChild(toolbar);

    var tableHolder = U.el("div");
    view.appendChild(tableHolder);

    function render(term) {
      termoBusca = term || "";
      var t = termoBusca.toLowerCase();
      var list = S.state.ativos.filter(function (a) {
        return (filterState === "all" || S.get.statusDe(a) === filterState) &&
          (!t || a.nome.toLowerCase().indexOf(t) >= 0 || a.ticker.toLowerCase().indexOf(t) >= 0);
      });

      function valorDe(a) { var p = S.get.positionOf(a.id); return p ? S.get.positionValue(p) : 0; }
      function pnlDe(a)   { var p = S.get.positionOf(a.id); return p ? S.get.positionPnL(p) : 0; }

      var cols = [
        { key: "Ativo", head: "Ativo", sort: function (a) { return a.ticker || ""; },
          render: function (a) { return U.assetCell(a); } },
        /* O preço vinha sozinho na coluna, sem dizer de onde veio nem
           de quando é. Um valor buscado há um minuto e um digitado há
           seis meses tinham exatamente a mesma aparência — e é a
           carteira inteira que se calcula em cima dele. */
        { key: "Preço", head: "Preço", right: true, sort: function (a) { return +a.preco_atual || 0; },
          render: function (a) { return celulaPreco(a); } },
        /* Posição, valor e resultado NÃO existiam nesta tabela. Para
           saber quanto valia cada ativo era preciso abrir um por um —
           numa tela chamada "Ativos". */
        { key: "Posição", head: "Posição", right: true,
          sort: function (a) { var p = S.get.positionOf(a.id); return p ? p.quantidade : 0; },
          render: function (a) {
            var p = S.get.positionOf(a.id);
            if (!p) return U.el("span", { class: "dim", text: "—" });
            return U.el("div", { class: "stack", style: "align-items:flex-end;gap:2px" }, [
              U.el("span", { class: "num", text: U.qty(p.quantidade) }),
              U.el("span", { class: "small dim", text: "PM " + U.money(p.preco_medio) })
            ]);
          } },
        { key: "Valor", head: "Valor", right: true, sort: valorDe,
          render: function (a) {
            var p = S.get.positionOf(a.id);
            if (!p) return U.el("span", { class: "dim", text: "—" });
            return U.el("div", { class: "stack", style: "align-items:flex-end;gap:3px" }, [
              U.el("span", { class: "num", text: U.money(valorDe(a), 0) }),
              pesoMini(S.get.positionWeight(p))
            ]);
          } },
        { key: "Resultado", head: "Resultado", right: true, sort: pnlDe,
          render: function (a) {
            var p = S.get.positionOf(a.id);
            if (!p) return U.el("span", { class: "dim", text: "—" });
            var v = S.get.positionPnL(p);
            return U.el("div", { class: "stack", style: "align-items:flex-end;gap:2px" }, [
              U.el("span", { class: "num " + U.signClass(v), text: U.money(v, 0) }),
              U.el("span", { class: "small " + U.signClass(v), text: U.pct(S.get.positionPnLPct(p), 1) })
            ]);
          } },
        { key: "Convicção", head: "Convicção", sort: function (a) { return +a.conviccao || 0; },
          render: function (a) { return U.convictionMini(a.conviccao); } },
        { key: "Tese", head: "Tese", sort: function (a) { return S.get.thesisOfAsset(a.id) ? 1 : 0; },
          render: function (a) { return S.get.thesisOfAsset(a.id) ? U.badge("andamento", "Documentada") : U.el("span", { class: "badge plain", text: "Pendente" }); } },
        { key: "Status", head: "Status", sort: function (a) { return S.get.statusDe(a); },
          render: function (a) { return U.badge(S.get.statusDe(a)); } },
        { key: "acoes", head: "", actions: true,
          render: function (a) { return U.rowActions(acoesDoAtivo(a)); } }
      ];

      tableHolder.innerHTML = "";
      var body;
      if (list.length) {
        body = U.table(cols, list, {
          onRow: function (a) { location.hash = "#/ativos?id=" + a.id; },
          sortKey: sortKey, sortDesc: sortDesc,
          onSort: function (k, d) { sortKey = k; sortDesc = d; render(termoBusca); }
        });
      } else if (termoBusca) {
        body = U.empty("search", "Nada encontrado para “" + termoBusca + "”",
          "Nenhum ativo com esse nome ou ticker no filtro atual.",
          U.button("Limpar busca", { variant: "secondary", icon: "x",
            onClick: function () { searchInput.value = ""; render(""); } }));
      } else if (S.state.ativos.length) {
        body = U.empty("layers", "Nenhum ativo neste filtro",
          "Existem ativos cadastrados, mas nenhum com este status.",
          U.button("Ver todos", { variant: "secondary", icon: "layers",
            onClick: function () { filterState = "all"; window.Router.rerender(); } }));
      } else {
        /* Primeiro uso: o estado vazio ensina o caminho inteiro em vez
           de só constatar que não há nada. */
        body = U.empty("layers", "Nenhum ativo ainda",
          "Cadastre o ativo, deposite na carteira e registre a compra — nessa ordem. " +
          "Sem caixa na carteira o Hold não abre posição.",
          U.button("Adicionar o primeiro ativo", { variant: "primary", icon: "plus", onClick: F.newAsset }));
      }
      tableHolder.appendChild(U.card({ tight: true, body: [body] }));
    }
    searchInput.addEventListener("input", function () { render(searchInput.value); });
    render(termoBusca);

    return { title: "Ativos", crumb: "Universo de ativos", node: view };
  }

  /* Barra de peso na carteira dentro da célula de valor: "US$ 4.000" não
     diz se é muito. "US$ 4.000 · 62% da carteira" diz. */
  function pesoMini(pct) {
    var w = Math.max(0, Math.min(100, pct || 0));
    var wrap = U.el("span", { class: "peso-mini" + (w > 40 ? " alto" : "") });
    var bar = U.el("span", { class: "bar" });
    bar.appendChild(U.el("i", { style: "width:" + w.toFixed(0) + "%" }));
    wrap.appendChild(bar);
    wrap.appendChild(U.el("span", { class: "n", text: w.toFixed(0) + "%" }));
    return wrap;
  }

  function detailView(id) {
    var a = S.get.asset(id), t = S.get.thesisOfAsset(id), pos = S.get.positionOf(id);
    var view = U.el("div");

    var carteira = S.wallets.active();
    var caixa = (window.AtlasCaixa && carteira) ? AtlasCaixa.saldo(carteira.id) : null;

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.button("Voltar", { variant: "ghost", icon: "chevron", onClick: function () { location.hash = "#/ativos"; } }),
        U.el("div", { class: "grow" }),
        /* "Editar" não existia em lugar nenhum do Hold — e o aviso do
           botão "Atualizar preços" mandava a pessoa exatamente para
           cá quando nenhuma fonte reconhecia o ticker. */
        U.button("Editar", { variant: "ghost", icon: "edit", onClick: function () { F.editAsset(id); } }),
        t ? U.button("Revisar tese", { variant: "secondary", icon: "edit", onClick: function () { F.editThesis(t.id); } }) : U.button("Criar tese", { variant: "secondary", icon: "doc", onClick: function () { F.newThesis(id); } }),
        pos ? U.button("Vender", { variant: "secondary", icon: "arrowDown", onClick: function () { F.trade(id, "sell"); } }) : null,
        U.button("Comprar", { variant: "primary", icon: "arrowUp", onClick: function () { F.trade(id, "buy"); } }),
        /* Excluir mora no menu, não ao lado de "Comprar". Ação que não
           tem volta não divide espaço com a que se usa todo dia. */
        U.menuBtn(function () {
          return [
            { icon: "refresh", label: "Atualizar preço deste ativo", onClick: function () { atualizarUm(a); } },
            { sep: true },
            { icon: "trash", label: "Excluir ativo", danger: true,
              disabled: !!S.get.anyPositionOf(a.id),
              hint: "Venda a posição antes de excluir",
              onClick: function () { excluirAtivo(a); } }
          ];
        }, "Mais ações")
      ])
    ]));

    // header card
    var header = U.el("div", { class: "card pad" });
    var hrow = U.el("div", { class: "between" });
    var left = U.el("div", { class: "asset-cell" });
    left.appendChild(U.el("div", { class: "ticker-badge", style: "width:48px;height:48px;font-size:15px", text: a.ticker.slice(0, 4) }));
    left.appendChild(U.el("div", {}, [
      U.el("h2", { text: a.nome }),
      U.el("div", { class: "dim small", text: a.ticker + " · " + a.tipo + (a.setor ? " · " + a.setor : "") })
    ]));
    hrow.appendChild(left);
    var selos = U.el("div", { class: "row-flex" });
    selos.appendChild(U.badge(S.get.statusDe(a)));
    if (t) selos.appendChild(U.badge(t.status));
    else selos.appendChild(U.el("span", { class: "badge plain", text: "Sem tese" }));
    hrow.appendChild(selos);
    header.appendChild(hrow);

    var stats = U.el("div", { class: "grid g-4 mt-16" });
    var precoNode = U.el("div", { class: "stack", style: "gap:2px" }, [
      U.el("span", { class: "num", text: a.preco_atual > 0 ? U.money(a.preco_atual) : "—" }),
      U.el("span", { class: "small dim", text: origemPreco(a) })
    ]);
    stats.appendChild(miniStatNode("Preço atual", precoNode));
    stats.appendChild(miniStat("Market cap", U.compact(a.market_cap)));
    stats.appendChild(miniStat("Categoria", a.categoria || "—"));
    var convWrap = U.el("div"); convWrap.appendChild(U.conviction(a.conviccao));
    stats.appendChild(miniStatNode("Convicção", convWrap));
    header.appendChild(stats);
    view.appendChild(header);

    /* ------------------------------------------------------------
       O CARTÃO DA POSIÇÃO, E O CARTÃO DE QUANDO NÃO HÁ POSIÇÃO

       Antes, sem posição, simplesmente não havia nada aqui — a tela
       pulava do cabeçalho para a tese. E é justamente o momento em que
       a pessoa está decidindo comprar: o número que ela precisa (o
       caixa) não estava em lugar nenhum.
       ------------------------------------------------------------ */
    if (pos) {
      var pv = S.get.positionValue(pos), pl = S.get.positionPnL(pos), plp = S.get.positionPnLPct(pos);
      var peso = S.get.positionWeight(pos);
      var posGrid = U.el("div", { class: "grid g-4" });
      posGrid.appendChild(miniStatNode("Quantidade", U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num", text: U.qty(pos.quantidade) }),
        U.el("span", { class: "small dim", text: "PM " + U.money(pos.preco_medio) })
      ])));
      posGrid.appendChild(miniStatNode("Custo", U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num", text: U.money(S.get.positionCost(pos), 0) }),
        U.el("span", { class: "small dim", text: "saiu do caixa em " + (carteira ? carteira.name : "—") })
      ])));
      posGrid.appendChild(miniStatNode("Valor hoje", U.el("div", { class: "stack", style: "gap:3px" }, [
        U.el("span", { class: "num", text: U.money(pv, 0) }),
        pesoMini(peso)
      ])));
      posGrid.appendChild(miniStatNode("Resultado", U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num " + U.signClass(pl), text: U.money(pl, 0) }),
        U.el("span", { class: "small " + U.signClass(pl), text: U.pct(plp) })
      ])));
      var posCard = U.card({ eyebrow: "Carteira · " + (carteira ? carteira.name : "—"),
        title: "Posição atual",
        action: peso > 40 ? U.el("span", { class: "badge review" }, [
          U.el("span", { class: "dot" }), "Concentração de " + peso.toFixed(0) + "%"
        ]) : null,
        body: [posGrid] });
      posCard.classList.add("mt-16");
      view.appendChild(posCard);
    } else {
      var semPos = U.el("div", { class: "sem-pos" });
      semPos.appendChild(U.el("div", { class: "stack" }, [
        U.el("div", { class: "eyebrow", text: "Sem posição em " + (carteira ? carteira.name : "esta carteira") }),
        U.el("div", { class: "sp-caixa num", text: caixa == null ? "—" : U.money(caixa, 0) }),
        U.el("div", { class: "small dim",
          text: caixa > 0
            ? "é o caixa disponível — é daqui que sai o valor da compra."
            : "sem caixa nesta carteira. Registre um depósito em Carteiras & Movimentações antes de comprar." })
      ]));
      semPos.appendChild(U.el("div", { class: "spacer" }));
      semPos.appendChild(U.button(caixa > 0 ? "Comprar " + a.ticker : "Ver carteiras",
        { variant: "primary", icon: caixa > 0 ? "arrowUp" : "wallet",
          onClick: caixa > 0
            ? function () { F.trade(id, "buy"); }
            : function () { location.href = "../carteiras.html"; } }));
      var spCard = U.card({ eyebrow: "Carteira", title: "Ainda não investido", body: [semPos] });
      spCard.classList.add("mt-16");
      view.appendChild(spCard);
    }

    // thesis card
    var thesisCard = U.card({ eyebrow: "Fundamento", title: "Tese de investimento",
      action: t ? U.badge(t.status) : null,
      /* O texto dizia "Documente a tese para habilitar a operação" —
         a compra deixou de depender dela (quem barra é o caixa). O
         convite continua; a falsa condição sai. */
      body: [t ? thesisContent(t) : U.empty("doc", "Sem tese", "Este ativo não tem tese documentada. A compra não fica travada por isso, mas o alerta vai cobrar até ela existir.",
        U.button("Criar tese", { variant: "primary", icon: "plus", onClick: function () { F.newThesis(id); } }))] });
    thesisCard.classList.add("mt-16");
    view.appendChild(thesisCard);

    // history for this asset
    var hs = S.state.historico.filter(function (h) { return h.ativo_id === id; });
    var tl = U.el("div", { class: "timeline" });
    if (hs.length) hs.slice(0, 8).forEach(function (h) { tl.appendChild(window.Pages._historyItem(h)); });
    else tl = U.empty("history", "Sem histórico", "As decisões deste ativo aparecerão aqui.");
    var histCard = U.card({ eyebrow: "Registro", title: "Histórico do ativo", body: [tl] });
    histCard.classList.add("mt-16");
    view.appendChild(histCard);

    return { title: a.nome, crumb: "Ativos · " + a.ticker, node: view };
  }

  function thesisContent(t) {
    var wrap = U.el("div");
    wrap.appendChild(U.el("p", { style: "line-height:1.65", text: t.narrativa }));

    wrap.appendChild(U.el("div", { class: "eyebrow mt-24", text: "Cenários", style: "margin-bottom:10px" }));
    var sc = U.el("div", { class: "scenarios" });
    [["bull", "Bull"], ["base", "Base"], ["bear", "Bear"]].forEach(function (o) {
      sc.appendChild(U.el("div", { class: "scenario " + o[0] }, [
        U.el("h4", { text: o[1] }), U.el("p", { text: t.cenarios[o[0]] || "—" })
      ]));
    });
    wrap.appendChild(sc);

    var two = U.el("div", { class: "grid g-2 mt-24" });
    two.appendChild(chipBlock("Riscos", t.riscos, "risk"));
    two.appendChild(chipBlock("Catalisadores", t.catalisadores, "cat"));
    wrap.appendChild(two);

    wrap.appendChild(U.el("div", { class: "eyebrow mt-24", text: "Critérios de invalidação", style: "margin-bottom:6px" }));
    wrap.appendChild(U.el("p", { class: "dim", text: t.criterios_invalidacao || "—" }));

    var conv = U.el("div", { class: "row-flex mt-24" });
    conv.appendChild(U.el("span", { class: "eyebrow", text: "Convicção" }));
    conv.appendChild(U.conviction(t.conviccao));
    wrap.appendChild(conv);
    return wrap;
  }
  function chipBlock(title, items, cls) {
    var b = U.el("div");
    b.appendChild(U.el("div", { class: "eyebrow", text: title, style: "margin-bottom:8px" }));
    var chips = U.el("div", { class: "chips" });
    (items && items.length ? items : ["—"]).forEach(function (i) { chips.appendChild(U.el("span", { class: "chip " + cls, text: i })); });
    b.appendChild(chips);
    return b;
  }
  function miniStat(label, value) { return miniStatNode(label, U.el("span", { class: "num", text: value })); }
  function miniStatNode(label, node) {
    var d = U.el("div", { class: "stack" });
    d.appendChild(U.el("span", { class: "small dim", text: label }));
    d.appendChild(node);
    return d;
  }
})();
