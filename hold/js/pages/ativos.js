/* HOLD · pages/ativos.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;
  var filterState = "all";
  /* Ordenação e busca vivem FORA da função de render: a página se
     redesenha inteira a cada ação (rerender), e um estado guardado
     dentro dela voltaria ao padrão toda vez que você comprasse algo. */
  var termoBusca = "";

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
    var perdas = [{ icon: "layers", texto: "O ativo " + a.ticker + " (" + a.nome + ") sai da lista" }];
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
        U.toast("Ativo excluído", a.ticker + " removido.", "success");
        if (location.hash.indexOf("id=" + a.id) >= 0) location.hash = "#/ativos";
        else window.Router.rerender();
      }
    });
  }

  /* ============================================================
     DESFAZER — a saída para a operação digitada errado

     Não existia. Uma compra com a quantidade trocada só se corrigia
     vendendo (e gravando um resultado que nunca aconteceu) ou apagando
     o módulo inteiro. A regra de o que pode ser desfeito mora no
     store (undoLast); aqui só se mostra o que vai acontecer.
     ============================================================ */
  function textoOperacao(op, a) {
    return (op.tipo === "buy" ? "Compra" : "Venda") + " de " + S.fmt.qtd(op.quantidade) + " " + a.ticker +
      " a " + U.money(op.preco) + " em " + op.data.split("-").reverse().join("/");
  }
  function desfazerUltima(a) {
    var op = S.get.ultimaOperacao(a.id);
    if (!op) {
      return U.toast("Nada para desfazer",
        "Não há operação de " + a.ticker + " nesta carteira que possa ser desfeita " +
        "(operações anteriores a esta versão do Hold não guardavam o necessário).", "warning");
    }
    var itens = [
      { icon: "layers", texto: "A posição volta a ser o que era antes (quantidade e preço médio)" },
      { icon: "coins", texto: op.tipo === "buy"
          ? "O valor volta para o caixa — e o depósito automático, se houve, sai do extrato"
          : "O valor da venda sai do caixa e o resultado realizado deixa de contar" }
    ];
    U.confirmar({
      eyebrow: "Desfazer operação",
      titulo: "Desfazer a última operação de " + a.ticker + "?",
      mensagem: textoOperacao(op, a) + ".",
      itens: itens,
      nota: "O histórico mantém a linha original, riscada, e ganha um registro de que ela foi desfeita.",
      confirmar: "Desfazer",
      onConfirm: function () {
        var r = S.actions.undoLast(a.id);
        if (r && r.error) return U.toast("Não foi possível desfazer", r.error, "warning");
        U.toast("Operação desfeita", textoOperacao(op, a) + " foi desfeita.", "success");
        window.Router.rerender();
      }
    });
  }


  /* ============================================================
     MESA + FICHAS (16/10/2026)

     O dono mandou dois esboços e pediu "exatamente assim", os dois na
     tela: à esquerda a mesa "Posições e watchlist" (Ativo · Preço ·
     24h · 7d · Result. · Trade), à direita "Uma ficha por ativo" com o
     preço de 30 dias. A faixa de quatro números saiu: repetia o Painel.
     Quantidade, preço médio, editar e excluir continuam na página do
     ativo. Spec: docs/superpowers/specs/2026-10-16-ativos-metricas-design.md

     Variações (24h/7d) e séries chegam da CoinGecko depois que a tela
     já está desenhada; quando chegam, só os dois cartões se redesenham.
     ============================================================ */
  var variacoes = {}, variacoesEm = 0, variacoesErro = false, buscandoVar = false;
  var seriesFalhas = {}, buscandoSeries = false, reagendado = null, seriesLimite = false, tentativas = 0;
  /* A resposta da CoinGecko chega depois; se a página foi redesenhada
     no meio (atualização de preços, troca de carteira), ela tem de ir
     para a grade que está na tela, não para a da primeira chamada. */
  var redesenharAtual = function () {};
  function redesenhar() { if (aindaNaLista()) redesenharAtual(); }

  function fmtPreco(v) {
    if (!(v > 0)) return "—";
    var dec = v >= 1000 ? 0 : v >= 0.01 ? 2 : 6;
    return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtVar(x) {
    if (x == null || !isFinite(x)) return null;
    var dec = Math.abs(x) >= 10 ? 0 : 1;
    return (x > 0 ? "+" : x < 0 ? "-" : "") + Math.abs(x).toFixed(dec).replace(".", ",") + "%";
  }
  function varSpan(x) {
    var t = fmtVar(x);
    return t ? U.el("span", { class: "num " + U.signClass(x), text: t }) : U.el("span", { class: "dim", text: "—" });
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function botaoTrade(a) {
    var b = U.button("Trade", { variant: "secondary", size: "sm" });
    b.setAttribute("aria-label", "Comprar ou vender " + a.ticker);
    b.addEventListener("click", function (e) { e.stopPropagation(); F.trade(a.id, "buy"); });
    return b;
  }

  function linhaMesa(a) {
    var st = S.get.statusDe(a), p = S.get.positionOf(a.id);
    var id = window.AtlasSeries ? window.AtlasSeries.idDe(a) : null;
    var v = id && variacoes[id];
    var tr = U.el("tr", { class: "mesa-linha" + (st === "watchlist" ? " watch" : ""), tabindex: "0",
      title: "Abrir " + a.ticker });
    var c1 = U.el("td", { class: "m-ativo" });
    c1.appendChild(U.el("span", { class: "ticker-badge sm", "data-atlas-token": a.ticker,
      "data-atlas-token-busca": (a.tipo && a.tipo !== "Cripto") ? "nao" : null, text: a.ticker.slice(0, 3) }));
    c1.appendChild(U.el("span", { class: "m-tick", text: a.ticker }));
    tr.appendChild(c1);
    var c2 = U.el("td", { class: "m-preco num" });
    c2.appendChild(U.el("span", { text: fmtPreco(a.preco_atual) }));
    if (st === "watchlist") {
      c2.appendChild(U.el("span", { class: "dim", text: " · watchlist" }));
    } else if (!id) {
      c2.appendChild(U.el("span", { class: "dim", text: " · preço informado" }));
    } else {
      c2.appendChild(document.createTextNode(" "));
      c2.appendChild(varSpan(v ? v.h24 : null));
      c2.appendChild(document.createTextNode(" "));
      c2.appendChild(varSpan(v ? v.d7 : null));
    }
    tr.appendChild(c2);
    var c3 = U.el("td", { class: "m-res num" });
    if (p) {
      var r = S.get.positionPnLPct(p);
      c3.appendChild(U.el("span", { class: U.signClass(r), text: fmtVar(r) || "—" }));
    } else c3.appendChild(U.el("span", { class: "dim", text: "—" }));
    tr.appendChild(c3);
    var c4 = U.el("td", { class: "m-acao" });
    c4.appendChild(botaoTrade(a));
    tr.appendChild(c4);
    function abrir() { location.hash = "#/ativos?id=" + a.id; }
    tr.addEventListener("click", abrir);
    tr.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target === tr) abrir(); });
    return tr;
  }

  function linha30(pts) {
    var ps = pts.slice(-30).map(function (x) { return x.p; });
    var min = Math.min.apply(null, ps), max = Math.max.apply(null, ps), amp = max - min || 1;
    var subiu = ps[ps.length - 1] >= ps[0];
    var pontos = ps.map(function (y, i) {
      return (i * 100 / (ps.length - 1)).toFixed(1) + "," + (22 - (y - min) / amp * 18).toFixed(1);
    }).join(" ");
    var svgNS = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(svgNS, "svg");
    s.setAttribute("viewBox", "0 0 100 24"); s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("class", "f-linha");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", "Preço de 30 dias: " + (fmtVar((ps[ps.length - 1] / ps[0] - 1) * 100) || "—"));
    var pl = document.createElementNS(svgNS, "polyline");
    pl.setAttribute("points", pontos);
    pl.setAttribute("class", subiu ? "pos" : "neg");
    s.appendChild(pl);
    return s;
  }

  function ficha(p) {
    var a = S.get.asset(p.ativo_id); if (!a) return null;
    var r = S.get.positionPnLPct(p);
    var b = U.el("button", { class: "ficha", type: "button", title: "Abrir " + a.ticker });
    var topo = U.el("span", { class: "f-topo" });
    topo.appendChild(U.el("span", { class: "f-tick", text: a.ticker }));
    topo.appendChild(U.el("span", { class: "num " + U.signClass(r), text: fmtVar(r) || "—" }));
    b.appendChild(topo);
    var id = window.AtlasSeries ? window.AtlasSeries.idDe(a) : null;
    var pts = id && window.AtlasSeries.doCache(id);
    if (pts && pts.length >= 2) b.appendChild(linha30(pts));
    else b.appendChild(U.el("span", { class: "f-sem small dim",
      text: !id ? "preço informado" : seriesFalhas[id] ? "sem histórico agora" : "carregando…" }));
    b.appendChild(U.el("span", { class: "f-val small dim",
      text: U.money(S.get.positionValue(p), 0) + " · " + S.get.positionWeight(p).toFixed(0) + "%" }));
    b.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.id; });
    return b;
  }

  function aindaNaLista() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    return h.split("?")[0] === "ativos" && h.indexOf("id=") < 0;
  }

  /* Pede à CoinGecko o que falta e redesenha os cartões quando chega.
     Uma busca de cada tipo por vez; falha não repete em laço. */
  function buscarDados(ativos) {
    if (!window.AtlasSeries) return;
    var ids = [];
    ativos.forEach(function (a) { var id = window.AtlasSeries.idDe(a); if (id && ids.indexOf(id) < 0) ids.push(id); });
    if (!ids.length) return;
    var faltaVar = ids.some(function (id) { return !variacoes[id]; });
    if (!buscandoVar && !variacoesErro && (faltaVar || Date.now() - variacoesEm > 120000) &&
        Date.now() - variacoesEm > 5000) {
      buscandoVar = true;
      window.AtlasSeries.variacoes(ids).then(function (r) {
        Object.keys(r).forEach(function (k) { variacoes[k] = r[k]; });
      }, function () { variacoesErro = true; }).then(function () {
        variacoesEm = Date.now();
        buscandoVar = false;
        redesenhar();
      });
    }
    var abertos = ativos.filter(function (a) { return S.get.positionOf(a.id); })
      .sort(function (x, y) { return S.get.positionValue(S.get.positionOf(y.id)) - S.get.positionValue(S.get.positionOf(x.id)); });
    var semSerie = [];
    abertos.forEach(function (a) {
      var id = window.AtlasSeries.idDe(a);
      if (id && !window.AtlasSeries.doCache(id) && !seriesFalhas[id] && semSerie.indexOf(id) < 0) semSerie.push(id);
    });
    if (semSerie.length && !buscandoSeries) {
      buscandoSeries = true;
      window.AtlasSeries.carregar(semSerie, redesenhar)
        .then(function (r) {
          r.falhas.forEach(function (id) { seriesFalhas[id] = true; });
          buscandoSeries = false;
          seriesLimite = !!r.limite;
          /* limite passa em ~1 minuto: tenta sozinho, no máximo 3 vezes */
          if (r.limite && !reagendado && tentativas < 3) {
            tentativas++;
            reagendado = setTimeout(function () { reagendado = null; seriesFalhas = {}; redesenhar(); }, 65000);
          }
          redesenhar();
        });
    }
  }

  function listView() {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Ativos" }),
          U.el("p", { text: "Posições e watchlist para operar, e uma ficha por ativo." })]),
        botaoPrecos(),
        U.button("Watchlist", { variant: "ghost", icon: "eye", onClick: F.newAsset }),
        U.button("Registrar compra", { variant: "primary", icon: "plus", onClick: function () { F.novaCompra(); } })
      ])
    ]));

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
    searchWrap.appendChild(U.iconEl("search"));
    var searchInput = U.input({ placeholder: "Buscar por nome ou ticker…", value: termoBusca });
    searchWrap.appendChild(searchInput);
    view.appendChild(U.el("div", { class: "between mt-16", style: "margin-bottom:16px" }, [seg, searchWrap]));

    var grade = U.el("div", { class: "grid g-12" });
    view.appendChild(grade);

    var ORDEM = { invested: 0, watchlist: 1, sold: 2 };
    function render(term) {
      termoBusca = term || "";
      var t = termoBusca.toLowerCase();
      var busca = S.state.ativos.filter(function (a) {
        return !t || a.nome.toLowerCase().indexOf(t) >= 0 || a.ticker.toLowerCase().indexOf(t) >= 0;
      });
      var lista = busca.filter(function (a) { return filterState === "all" || S.get.statusDe(a) === filterState; })
        .sort(function (x, y) {
          var dx = ORDEM[S.get.statusDe(x)], dy = ORDEM[S.get.statusDe(y)];
          if (dx !== dy) return dx - dy;
          var px = S.get.positionOf(x.id), py = S.get.positionOf(y.id);
          return (py ? S.get.positionValue(py) : 0) - (px ? S.get.positionValue(px) : 0) || x.ticker.localeCompare(y.ticker);
        });

      /* ---- mesa ---- */
      var corpoMesa;
      if (lista.length) {
        var tab = U.el("table", { class: "mesa" });
        var cab = U.el("tr");
        ["Ativo", "Preço · 24h · 7d", "Result.", ""].forEach(function (h, i) {
          cab.appendChild(U.el("th", { class: ["m-ativo", "m-preco", "m-res", "m-acao"][i], text: h }));
        });
        tab.appendChild(U.el("thead", {}, [cab]));
        var tb = U.el("tbody");
        lista.forEach(function (a) { tb.appendChild(linhaMesa(a)); });
        tab.appendChild(tb);
        corpoMesa = U.el("div", { class: "mesa-wrap" }, [tab]);
      } else if (termoBusca) {
        corpoMesa = U.empty("search", "Nada encontrado para “" + termoBusca + "”",
          "Nenhum ativo com esse nome ou ticker no filtro atual.",
          U.button("Limpar busca", { variant: "secondary", icon: "x",
            onClick: function () { searchInput.value = ""; render(""); } }));
      } else if (S.state.ativos.length) {
        corpoMesa = U.empty("layers", "Nenhum ativo neste filtro", "Existem ativos cadastrados, mas nenhum com este status.",
          U.button("Ver todos", { variant: "secondary", icon: "layers",
            onClick: function () { filterState = "all"; window.Router.rerender(); } }));
      } else {
        corpoMesa = U.el("div", { class: "small dim", style: "padding:8px 0",
          text: "Nenhum ativo ainda — use \"Registrar compra\" para o primeiro." });
      }
      if (variacoesErro && lista.length) {
        var deNovo = U.el("button", { class: "link-btn", type: "button", text: "Tentar de novo" });
        deNovo.addEventListener("click", function () { variacoesErro = false; variacoesEm = 0; render(termoBusca); });
        corpoMesa = U.el("div", {}, [corpoMesa, U.el("div", { class: "small dim mesa-aviso" }, [
          document.createTextNode("Variações de 24h e 7d indisponíveis agora. "), deNovo])]);
      }
      var mesa = U.card({ eyebrow: "Ativos", title: "Posições e watchlist", body: [corpoMesa] });
      mesa.classList.add("col-7");

      /* ---- fichas: só posições abertas, seguindo a busca ---- */
      var corpoFichas;
      if (filterState === "watchlist" || filterState === "sold") {
        corpoFichas = U.el("div", { class: "small dim",
          text: filterState === "watchlist" ? "Watchlist não tem ficha: ainda não há posição." : "Ativos vendidos não têm posição aberta." });
      } else {
        var abertas = S.get.walletPositions().filter(function (p) {
          return busca.some(function (a) { return a.id === p.ativo_id; });
        }).sort(function (x, y) { return S.get.positionValue(y) - S.get.positionValue(x); });
        if (abertas.length) {
          corpoFichas = U.el("div", { class: "fichas" });
          abertas.forEach(function (p) { var f = ficha(p); if (f) corpoFichas.appendChild(f); });
        } else {
          corpoFichas = U.el("div", { class: "small dim",
            text: termoBusca ? "Nenhuma posição aberta nesta busca." : "Nenhuma posição aberta nesta carteira." });
        }
      }
      if (seriesLimite && corpoFichas.classList.contains("fichas")) {
        var outraVez = U.el("button", { class: "link-btn", type: "button", text: "Tentar de novo" });
        outraVez.addEventListener("click", function () {
          if (reagendado) { clearTimeout(reagendado); reagendado = null; }
          seriesFalhas = {}; seriesLimite = false; tentativas = 0; render(termoBusca);
        });
        corpoFichas = U.el("div", {}, [corpoFichas, U.el("div", { class: "small dim mesa-aviso" }, [
          document.createTextNode("A fonte de preços limitou as consultas; o resto dos gráficos vem em 1 minuto. "), outraVez])]);
      }
      var fichas = U.card({ eyebrow: "Ativos", title: "Uma ficha por ativo", body: [corpoFichas] });
      fichas.classList.add("col-5");

      limpar(grade);
      grade.appendChild(mesa);
      grade.appendChild(fichas);
      redesenharAtual = function () { render(termoBusca); };
      buscarDados(busca);
    }
    searchInput.addEventListener("input", function () { render(searchInput.value); });
    render(termoBusca);

    return { title: "Ativos", crumb: "Posições e watchlist", node: view };
  }

  /* Barra de peso na carteira dentro da célula de valor: "US$ 4.000" não
     diz se é muito. "US$ 4.000 · 62% da carteira" diz. */
  function pesoMini(pct) {
    var w = Math.max(0, Math.min(100, pct || 0));
    /* O "40" estava escrito à mão aqui, no selo da tela do ativo e no
       alerta do store — três cópias da mesma regra. Agora um dono só,
       e configurável. */
    var wrap = U.el("span", { class: "peso-mini" + (S.get.concentrada(w) ? " alto" : "") });
    var bar = U.el("span", { class: "bar" });
    bar.appendChild(U.el("i", { style: "width:" + w.toFixed(0) + "%" }));
    wrap.appendChild(bar);
    wrap.appendChild(U.el("span", { class: "n", text: w.toFixed(0) + "%" }));
    return wrap;
  }

  function detailView(id) {
    var a = S.get.asset(id), pos = S.get.positionOf(id);
    var view = U.el("div");

    var carteira = S.wallets.active();
    var caixa = S.wallets.caixa();   // a carteira em uso, ou a soma de todas

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.button("Voltar", { variant: "ghost", icon: "chevron", onClick: function () { location.hash = "#/ativos"; } }),
        U.el("div", { class: "grow" }),
        /* "Editar" não existia em lugar nenhum do Hold — e o aviso do
           botão "Atualizar preços" mandava a pessoa exatamente para
           cá quando nenhuma fonte reconhecia o ticker. */
        U.button("Editar", { variant: "ghost", icon: "edit", onClick: function () { F.editAsset(id); } }),
        pos ? U.button("Vender", { variant: "secondary", icon: "arrowDown", onClick: function () { F.trade(id, "sell"); } }) : null,
        U.button("Comprar", { variant: "primary", icon: "arrowUp", onClick: function () { F.trade(id, "buy"); } }),
        /* Excluir mora no menu, não ao lado de "Comprar". Ação que não
           tem volta não divide espaço com a que se usa todo dia. */
        U.menuBtn(function () {
          return [
            { icon: "refresh", label: "Atualizar preço deste ativo", onClick: function () { atualizarUm(a); } },
            { icon: "history", label: "Desfazer última operação",
              disabled: !S.get.ultimaOperacao(a.id),
              hint: "Nenhuma operação desfazível nesta carteira",
              onClick: function () { desfazerUltima(a); } },
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
    left.appendChild(U.el("div", { class: "ticker-badge", "data-atlas-token": a.ticker, "data-atlas-token-busca": (a.tipo && a.tipo !== "Cripto") ? "nao" : null, style: "width:48px;height:48px;font-size:15px", text: a.ticker.slice(0, 4) }));
    left.appendChild(U.el("div", {}, [
      U.el("h2", { text: a.nome }),
      U.el("div", { class: "dim small", text: a.ticker + " · " + a.tipo + (a.setor ? " · " + a.setor : "") })
    ]));
    hrow.appendChild(left);
    var selos = U.el("div", { class: "row-flex" });
    selos.appendChild(U.badge(S.get.statusDe(a)));
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
    stats.appendChild(miniStat("Setor", a.setor || "—"));
    header.appendChild(stats);
    view.appendChild(header);

    /* ------------------------------------------------------------
       O CARTÃO DA POSIÇÃO, E O CARTÃO DE QUANDO NÃO HÁ POSIÇÃO

       Antes, sem posição, simplesmente não havia nada aqui — a tela
       pulava do cabeçalho para o histórico. E é justamente o momento em que
       a pessoa está decidindo comprar: o número que ela precisa (o
       caixa) não estava em lugar nenhum.
       ------------------------------------------------------------ */
    var real = S.get.realizadoDoAtivo(id);
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
      /* Resultado em aberto = valorização (ou desvalorização) da
         posição sobre o preço médio. Se já houve venda, o realizado
         aparece embaixo e o total junta os dois — senão a tela de um
         ativo que você já realizou lucro mostrava só metade da conta. */
      var resNode = U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num " + U.signClass(pl), text: U.money(pl, 0) }),
        U.el("span", { class: "small " + U.signClass(pl), text: U.pct(plp) + " em aberto" })
      ]);
      if (real.vendas) {
        resNode.appendChild(U.el("span", { class: "small " + U.signClass(real.resultado),
          text: "realizado " + U.money(real.resultado, 0) + " · total " + U.money(pl + real.resultado, 0) }));
      }
      posGrid.appendChild(miniStatNode("Resultado", resNode));
      /* Na visão somada, a mesma moeda em duas carteiras vira uma
         linha só — e a pessoa precisa saber onde está cada parte. */
      var corpoPos = [posGrid];
      if (pos.partes && pos.partes.length > 1) {
        var nomes = {};
        S.wallets.list().forEach(function (w) { nomes[w.id] = w.name; });
        corpoPos.push(U.el("div", { class: "small dim", style: "margin-top:12px",
          text: "Dividida entre: " + pos.partes.map(function (pp) {
            return (nomes[pp.walletId] || pp.walletId) + " " + U.qty(pp.quantidade) + " (PM " + U.money(pp.preco_medio) + ")";
          }).join(" · ") }));
      }
      var posCard = U.card({ eyebrow: "Carteira · " + (carteira ? carteira.name : "—"),
        title: "Posição atual",
        action: S.get.concentrada(peso) ? U.el("span", { class: "badge review" }, [
          U.el("span", { class: "dot" }), "Concentração de " + peso.toFixed(0) + "%"
        ]) : null,
        body: corpoPos });
      posCard.classList.add("mt-16");
      view.appendChild(posCard);
    } else if (real.vendas) {
      /* ------------------------------------------------------------
         POSIÇÃO ENCERRADA — não "ainda não investido"

         Um ativo vendido com prejuízo mostrava "Ainda não investido",
         como se o dinheiro nunca tivesse passado por ali. O que importa
         depois de vender é quanto se ganhou ou perdeu no ciclo.
         ------------------------------------------------------------ */
      var pctReal = real.custo ? (real.resultado / real.custo) * 100 : 0;
      var encGrid = U.el("div", { class: "grid g-4" });
      encGrid.appendChild(miniStat("Custo vendido", U.money(real.custo, 0)));
      encGrid.appendChild(miniStat("Apurado nas vendas", U.money(real.apurado, 0)));
      encGrid.appendChild(miniStatNode("Resultado realizado", U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num " + U.signClass(real.resultado), text: U.money(real.resultado, 0) }),
        U.el("span", { class: "small " + U.signClass(real.resultado), text: U.pct(pctReal) + " sobre o custo" })
      ])));
      encGrid.appendChild(miniStatNode("Caixa disponível", U.el("div", { class: "stack", style: "gap:2px" }, [
        U.el("span", { class: "num", text: caixa == null ? "—" : U.money(caixa, 0) }),
        U.el("span", { class: "small dim", text: "em " + (carteira ? carteira.name : "—") })
      ])));
      var encCard = U.card({ eyebrow: "Carteira · " + (carteira ? carteira.name : "—"),
        title: "Posição encerrada",
        action: U.button("Comprar de novo", { variant: "secondary", size: "sm", icon: "arrowUp",
          onClick: function () { F.trade(id, "buy"); } }),
        body: [encGrid] });
      encCard.classList.add("mt-16");
      view.appendChild(encCard);
    } else {
      /* Sem caixa a compra continua possível: o que faltar entra como
         depósito automático na carteira escolhida (regra de 21/09).
         O botão mandava para Carteiras e dizia que era preciso
         depositar antes — instrução de uma regra que já não vale. */
      var semPos = U.el("div", { class: "sem-pos" });
      semPos.appendChild(U.el("div", { class: "stack" }, [
        U.el("div", { class: "eyebrow", text: "Caixa em " + (carteira ? carteira.name : "esta carteira") }),
        U.el("div", { class: "sp-caixa num", text: caixa == null ? "—" : U.money(caixa, 0) }),
        U.el("div", { class: "small dim",
          text: caixa > 0
            ? "é daqui que sai o valor da compra; o que faltar entra como depósito automático."
            : "sem caixa: ao comprar, o valor entra como depósito automático nesta carteira." })
      ]));
      semPos.appendChild(U.el("div", { class: "spacer" }));
      semPos.appendChild(U.button("Comprar " + a.ticker,
        { variant: "primary", icon: "arrowUp", onClick: function () { F.trade(id, "buy"); } }));
      var spCard = U.card({ eyebrow: "Carteira", title: "Ainda não investido", body: [semPos] });
      spCard.classList.add("mt-16");
      view.appendChild(spCard);
    }

    // history for this asset
    var hs = window.Pages._historicoOrdenado().filter(function (h) { return h.ativo_id === id; });
    var tl = U.el("div", { class: "timeline" });
    if (hs.length) hs.slice(0, 8).forEach(function (h) { tl.appendChild(window.Pages._historyItem(h)); });
    else tl = U.empty("history", "Sem histórico", "As decisões deste ativo aparecerão aqui.");
    var histCard = U.card({ eyebrow: "Registro", title: "Histórico do ativo", body: [tl] });
    histCard.classList.add("mt-16");
    view.appendChild(histCard);

    return { title: a.nome, crumb: "Ativos · " + a.ticker, node: view };
  }

  function miniStat(label, value) { return miniStatNode(label, U.el("span", { class: "num", text: value })); }
  function miniStatNode(label, node) {
    var d = U.el("div", { class: "stack" });
    d.appendChild(U.el("span", { class: "small dim", text: label }));
    d.appendChild(node);
    return d;
  }
})();
