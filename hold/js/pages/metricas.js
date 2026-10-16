/* HOLD · pages/metricas.js
   LABORATÓRIO DE RISCO (16/10/2026)

   A tela antiga repetia o Painel (alocação por setor, peso por posição)
   e Ativos (o universo). Agora responde uma pergunta só: quanto risco a
   carteira de hoje corre? Volatilidade, pior queda, pior dia, quem cai
   junto e de onde vem o risco — com os últimos 90 dias de preço de cada
   ativo aplicados às quantidades de hoje. As contas moram em
   core/atlas-risco.js (testadas: node hold/testes/risco.test.js); as
   séries, em core/atlas-series.js.
   Spec: docs/superpowers/specs/2026-10-16-ativos-metricas-design.md */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  /* Estado entre redesenhos: a tela se redesenha a cada série que chega. */
  var falhas = {}, limite = false, buscando = false, reagendado = null, tentativas = 0;

  function pct(x, dec) {
    var t = Math.abs(x * 100).toFixed(dec || 0);
    return (x < 0 && +t !== 0 ? "-" : "") + t.replace(".", ",") + "%";   // sem "-0%"
  }
  function data(d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : "—"; }
  function naTela() { return (location.hash || "").replace(/^#\/?/, "").split("?")[0] === "metricas"; }

  function itensDaCarteira() {
    var Sr = window.AtlasSeries, St = window.AtlasSetores;
    return S.get.walletPositions().slice().sort(function (x, y) {
      return S.get.positionValue(y) - S.get.positionValue(x);
    }).map(function (p) {
      var a = S.get.asset(p.ativo_id) || {};
      var id = Sr ? Sr.idDe(a) : null;
      return {
        label: a.ticker || "?", qtd: p.quantidade, id: id,
        serie: id ? (Sr.doCache(id) || []) : [],
        motivo: !id ? "não é cripto" : falhas[id] ? "sem histórico agora" : null,
        stable: !!(St && St.de(a).setor === "Stablecoin")
      };
    });
  }

  function buscar(itens) {
    var Sr = window.AtlasSeries;
    if (!Sr || buscando) return;
    var ids = itens.filter(function (it) { return it.id && !it.serie.length && !falhas[it.id]; })
      .map(function (it) { return it.id; });
    if (!ids.length) return;
    buscando = true;
    Sr.carregar(ids, function () { if (naTela()) window.Router.rerender(); }).then(function (r) {
      r.falhas.forEach(function (id) { falhas[id] = true; });
      limite = !!r.limite;
      buscando = false;
      /* limite da CoinGecko passa em cerca de um minuto: tenta de novo sozinho */
      if (limite && !reagendado && tentativas < 3) {
        tentativas++;
        reagendado = setTimeout(function () {
          reagendado = null; falhas = {}; limite = false;
          if (naTela()) window.Router.rerender();
        }, 65000);
      }
      if (naTela()) window.Router.rerender();
    });
  }

  function numero(rotulo, valor, frase, classe) {
    var c = U.el("div", { class: "risco-num" });
    c.appendChild(U.el("div", { class: "rn-rot", text: rotulo }));
    c.appendChild(U.el("div", { class: "rn-val num" + (classe ? " " + classe : ""), text: valor }));
    c.appendChild(U.el("div", { class: "rn-frase", text: frase }));
    return c;
  }

  function mapaCorrelacao(cor) {
    var n = Math.min(cor.labels.length, 8);
    var g = U.el("div", { class: "corr", style: "grid-template-columns: 64px repeat(" + n + ", minmax(0, 1fr))" });
    g.appendChild(U.el("span"));
    for (var j = 0; j < n; j++) g.appendChild(U.el("span", { class: "corr-cab", text: cor.labels[j] }));
    for (var i = 0; i < n; i++) {
      g.appendChild(U.el("span", { class: "corr-lin", text: cor.labels[i] }));
      for (j = 0; j < n; j++) {
        var v = cor.m[i][j];
        var alfa = Math.max(0, v);   // abaixo de zero: andam em sentidos opostos, sem cor
        var cel = U.el("span", { class: "corr-cel" + (i === j ? " diag" : ""),
          style: "--a:" + alfa.toFixed(2),
          title: cor.labels[i] + " × " + cor.labels[j] + ": " + v.toFixed(2).replace(".", ",") });
        cel.setAttribute("aria-label", cel.title);
        g.appendChild(cel);
      }
    }
    return g;
  }

  function barrasRisco(lista) {
    var box = U.el("div", { class: "risco-barras" });
    lista.slice().sort(function (a, b) { return b.risco - a.risco; }).forEach(function (c) {
      var l = U.el("div", { class: "rb-linha" });
      l.appendChild(U.el("span", { class: "rb-tick", text: c.label }));
      var trilho = U.el("span", { class: "rb-trilho" });
      trilho.appendChild(U.el("i", { style: "width:" + Math.max(0, Math.min(100, c.risco * 100)).toFixed(1) + "%" }));
      l.appendChild(trilho);
      l.appendChild(U.el("span", { class: "rb-val num", text: "risco " + pct(Math.max(0, c.risco)) + " · dinheiro " + pct(c.peso) }));
      box.appendChild(l);
    });
    return box;
  }

  window.Pages = window.Pages || {};
  window.Pages.metricas = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Métricas" }),
          U.el("p", { text: "Quanto risco a carteira de hoje corre: oscilação, pior queda, quem cai junto e de onde vem o risco." })
        ]),
        U.button("Ver ativos", { variant: "secondary", icon: "layers",
          onClick: function () { location.hash = "#/ativos"; } }),
        U.button("Relatório completo", { variant: "secondary", icon: "report",
          onClick: function () { location.hash = "#/relatorios"; } })
      ])
    ]));

    var itens = itensDaCarteira();
    buscar(itens);
    var comSerie = itens.filter(function (it) { return it.serie.length >= 2; });
    var esperando = itens.filter(function (it) { return it.id && !it.serie.length && !falhas[it.id]; });
    var r = comSerie.length ? window.AtlasRisco.calcular(comSerie) : null;

    /* ---- linha de base: de onde vêm os números ---- */
    var base;
    if (!itens.length) base = "Sem posições nesta carteira — os números aparecem com a primeira compra.";
    else if (r) base = "Últimos " + r.dias + " dias de preço (" + data(r.inicio) + " a " + data(r.fim) +
      "), com as quantidades de hoje — como esta carteira teria se comportado.";
    else base = "Buscando o histórico de preço dos ativos…";
    if (esperando.length && itens.length) {
      base += " Ainda chegando: " + esperando.map(function (it) { return it.label; }).join(", ") + ".";
    }
    view.appendChild(U.el("p", { class: "risco-base small dim", text: base }));

    if (limite) {
      var outra = U.el("button", { class: "link-btn", type: "button", text: "Tentar de novo" });
      outra.addEventListener("click", function () {
        if (reagendado) { clearTimeout(reagendado); reagendado = null; }
        falhas = {}; limite = false; tentativas = 0; window.Router.rerender();
      });
      view.appendChild(U.el("p", { class: "risco-base small" }, [
        document.createTextNode("A fonte de preços (CoinGecko) limitou as consultas — parte da carteira ficou fora da conta; tento de novo em 1 minuto. "),
        outra]));
    }

    /* ---- três números ---- */
    var faixa = U.el("div", { class: "risco-faixa" });
    faixa.appendChild(numero("Volatilidade", r ? pct(r.volatilidade) + " ao ano" : "—",
      r ? "Num ano típico, o valor da carteira oscila perto de " + pct(r.volatilidade) + " para cima ou para baixo."
        : "Quanto o valor da carteira costuma oscilar num ano."));
    faixa.appendChild(numero("Pior queda", r ? pct(r.piorQueda.pct) : "—",
      r ? (r.piorQueda.pct < 0 ? "Do pico em " + data(r.piorQueda.pico) + " ao fundo em " + data(r.piorQueda.fundo) +
            " — o quanto perderia quem entrasse no pior momento." : "Não houve queda a partir de um pico no período.")
        : "A maior perda do pico ao fundo no período.", r && r.piorQueda.pct < 0 ? "neg" : ""));
    faixa.appendChild(numero("Pior dia", r ? pct(r.piorDia.pct, 1) : "—",
      r ? (r.piorDia.pct < 0 ? "Em " + data(r.piorDia.d) + " — a maior queda num dia só." : "Nenhum dia de queda no período.")
        : "A maior queda num dia só.", r && r.piorDia.pct < 0 ? "neg" : ""));
    view.appendChild(faixa);

    var grade = U.el("div", { class: "grid g-12 mt-16" });

    /* ---- quem cai junto ---- */
    var corpoCorr;
    if (r && r.correlacao.labels.length >= 2) {
      corpoCorr = U.el("div", {}, [mapaCorrelacao(r.correlacao),
        U.el("p", { class: "small dim", style: "margin-top:10px",
          text: "Quanto mais forte o azul, mais os dois sobem e caem juntos. Dois ativos que andam juntos protegem pouco um ao outro." +
                (r.correlacao.labels.length > 8 ? " Mostrando as 8 maiores posições." : "") })]);
    } else {
      corpoCorr = U.el("p", { class: "small dim",
        text: "A correlação precisa de pelo menos dois ativos voláteis com histórico (stablecoin não entra)." });
    }
    var cCorr = U.card({ eyebrow: "Correlação", title: "Quem cai junto", body: [corpoCorr] });
    cCorr.classList.add("col-6");
    grade.appendChild(cCorr);

    /* ---- de onde vem o risco ---- */
    var corpoRisco;
    if (r && r.contribuicao.length >= 2) {
      corpoRisco = U.el("div", {}, [barrasRisco(r.contribuicao),
        U.el("p", { class: "small dim", style: "margin-top:10px",
          text: "Quanto da oscilação da carteira vem de cada ativo, ao lado de quanto do dinheiro ele é. Risco maior que o dinheiro: o ativo pesa mais do que parece." })]);
    } else if (r) {
      corpoRisco = U.el("p", { class: "small dim", text: "Todo o risco calculado vem de " + r.contribuicao[0].label + " — é o único ativo com histórico." });
    } else {
      corpoRisco = U.el("p", { class: "small dim", text: "Aparece quando o histórico de preço chegar." });
    }
    var cRisco = U.card({ eyebrow: "Contribuição", title: "De onde vem o risco", body: [corpoRisco] });
    cRisco.classList.add("col-6");
    grade.appendChild(cRisco);
    view.appendChild(grade);

    /* ---- quem ficou de fora, e por quê ---- */
    var fora = itens.filter(function (it) { return it.motivo; }).map(function (it) { return it.label + " (" + it.motivo + ")"; });
    if (r) r.fora.forEach(function (l) { fora.push(l + " (histórico curto)"); });
    if (fora.length) view.appendChild(U.el("p", { class: "risco-base small dim mt-16", text: "Fora do cálculo: " + fora.join(", ") + "." }));

    return { title: "Métricas", crumb: "Laboratório de risco", node: view };
  };
})();
