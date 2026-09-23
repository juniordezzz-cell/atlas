/* HOLD · pages/metricas.js
   Leitura quantitativa do portfólio. Nenhum número aqui é digitado:
   todos saem das posições e dos preços. */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, C = window.Charts;

  window.Pages = window.Pages || {};
  window.Pages.metricas = function () {
    var view = U.el("div");
    var val = S.get.portfolioValue();
    var carteira = S.wallets.active();
    var posicoes = S.get.walletPositions();

    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Métricas" }),
          U.el("p", { text: "Leitura quantitativa do portfólio: exposição, concentração e peso de cada posição." })
        ]),
        /* A tela não tinha controle nenhum — nem um botão. Era a única
           do módulo que só se podia olhar. As duas saídas daqui são as
           duas coisas que se faz depois de ler uma métrica ruim: mexer
           na carteira ou ler o relatório completo. */
        U.button("Ver ativos", { variant: "secondary", icon: "layers",
          onClick: function () { location.hash = "#/ativos"; } }),
        U.button("Relatório completo", { variant: "secondary", icon: "report",
          onClick: function () { location.hash = "#/relatorios"; } })
      ])
    ]));

    /* ------------------------------------------------------------
       CARTEIRA VAZIA NÃO PRODUZ MÉTRICA

       Sem posição, a tela desenhava tudo com zeros: concentração 0%,
       índice 0,00 (que a própria legenda lê como "diverso"). Zero não
       é diversificação — é ausência de
       carteira, e apresentar isso como leitura quantitativa é dar nota
       a uma prova em branco.
       ------------------------------------------------------------ */
    if (!posicoes.length) {
      view.appendChild(U.empty("chart", "Ainda não há o que medir",
        "As métricas descrevem uma carteira: concentração, exposição por setor e peso " +
        "das posições. Registre a primeira compra e elas passam a existir." +
        (carteira ? " Carteira ativa: " + carteira.name + "." : ""),
        U.button("Ir para Ativos", { variant: "primary", icon: "layers",
          onClick: function () { location.hash = "#/ativos"; } })));
      return { title: "Métricas", crumb: "Análise quantitativa", node: view };
    }

    /* ---- exposição por setor ---- */
    var porSetor = {};
    posicoes.forEach(function (p) {
      var a = S.get.asset(p.ativo_id); if (!a) return;
      var k = a.setor || "Sem setor";
      if (!porSetor[k]) porSetor[k] = { valor: 0, ativos: [] };
      porSetor[k].valor += S.get.positionValue(p);
      porSetor[k].ativos.push(a.ticker);
    });
    var setores = Object.keys(porSetor).map(function (k) {
      return { label: k, value: porSetor[k].valor, ativos: porSetor[k].ativos };
    }).sort(function (a, b) { return b.value - a.value; });

    /* ---- concentração ---- */
    var pesos = posicoes.map(function (p) { return S.get.positionWeight(p); })
      .sort(function (a, b) { return b - a; });
    var top1 = pesos[0] || 0;
    var top3 = pesos.slice(0, 3).reduce(function (s, w) { return s + w; }, 0);
    var hhi = pesos.reduce(function (s, w) { return s + (w / 100) * (w / 100); }, 0);

    /* ---- faixa de KPIs ---- */
    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "target", label: "Posições",
      value: String(posicoes.length),
      sub: U.compact(val) + " investidos" + (carteira ? " em " + carteira.name : "") }));
    /* "as 3 maiores somam 100%" com exatamente 3 posições é verdade
       trivial ocupando espaço de leitura. Só aparece quando há mais de
       três e a soma diz alguma coisa. */
    strip.appendChild(U.kpi({ icon: "zap", label: "Maior posição", value: top1.toFixed(0) + "%",
      sub: posicoes.length > 3
        ? "as 3 maiores somam " + top3.toFixed(0) + "%"
        : posicoes.length + (posicoes.length === 1 ? " posição na carteira" : " posições na carteira") }));
    strip.appendChild(U.kpi({ icon: "layers", label: "Índice de concentração",
      value: hhi.toFixed(2), sub: leituraHHI(hhi, posicoes.length) }));
    strip.appendChild(U.kpi({ icon: "shield", label: "Setores", value: String(setores.length),
      sub: setores.length ? "maior: " + setores[0].label : "—" }));
    view.appendChild(strip);

    var mid = U.el("div", { class: "grid g-12 mt-16" });

    /* ---- alocação por setor ---- */
    var medidorSetor = U.el("div", { class: "meter" });
    setores.forEach(function (s) {
      var pctv = val ? (s.value / val) * 100 : 0;
      var row = U.el("div", { class: "m-row" });
      row.appendChild(U.el("span", { class: "m-label", title: s.ativos.join(", "),
        text: s.label }));
      var track = U.el("div", { class: "m-track" });
      track.appendChild(U.el("i", { style: "width:" + pctv.toFixed(0) + "%" }));
      row.appendChild(track);
      /* O medidor mostrava só a porcentagem. Numa tela cujo assunto é
         exposição, quanto isso vale em dólar é metade da resposta. */
      row.appendChild(U.el("span", { class: "m-val", text: U.compact(s.value) }));
      row.appendChild(U.el("span", { class: "m-val", text: pctv.toFixed(0) + "%" }));
      medidorSetor.appendChild(row);
    });
    var cardSetor = U.card({ eyebrow: "Exposição", title: "Alocação por setor",
      action: U.el("span", { class: "small dim",
        text: setores.length + (setores.length === 1 ? " setor" : " setores") }),
      body: [medidorSetor] });
    cardSetor.classList.add("col-6");
    mid.appendChild(cardSetor);

    /* ---- peso por posição, clicável ---- */
    var medidorPeso = U.el("div", { class: "meter" });
    var ordenadas = posicoes.slice().sort(function (x, y) {
      return S.get.positionValue(y) - S.get.positionValue(x);
    });
    var acima = 0;
    ordenadas.forEach(function (p) {
      var a = S.get.asset(p.ativo_id); if (!a) return;
      var w = S.get.positionWeight(p);
      if (S.get.concentrada(w)) acima++;
      /* Linha clicável: ler "esta posição pesa demais" só vale alguma
         coisa se der para ir resolver dali. */
      var row = U.el("button", { class: "m-row clicavel", type: "button",
        title: "Abrir " + a.ticker });
      row.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.id; });
      row.appendChild(U.el("span", { class: "m-label", text: a.ticker }));
      var track = U.el("div", { class: "m-track" });
      track.appendChild(U.el("i", { style: "width:" + Math.max(0, Math.min(100, w)).toFixed(0) + "%" }));
      row.appendChild(track);
      row.appendChild(U.el("span", { class: "m-val", text: U.compact(S.get.positionValue(p)) }));
      row.appendChild(U.el("span", { class: "m-val", text: w.toFixed(0) + "%" }));
      medidorPeso.appendChild(row);
    });
    var cardPeso = U.card({ eyebrow: "Concentração", title: "Peso por posição",
      action: acima
        ? U.el("span", { class: "badge review" }, [U.el("span", { class: "dot" }),
            acima + " acima de " + S.get.config("limite_concentracao") + "%"])
        : U.el("span", { class: "badge invested" }, [U.el("span", { class: "dot" }),
            "nenhuma acima de " + S.get.config("limite_concentracao") + "%"]),
      body: [medidorPeso] });
    cardPeso.classList.add("col-6");
    mid.appendChild(cardPeso);
    view.appendChild(mid);

    /* ------------------------------------------------------------
       COMPOSIÇÃO DO UNIVERSO — três leituras, não um funil

       Watchlist, com posição e vendidos são estados de um mesmo
       ativo, contados contra o mesmo universo. Somam o universo, e
       nenhuma é etapa da outra — por isso barras independentes, não
       um funil normalizado pelo maior valor.
       ------------------------------------------------------------ */
    var universo = S.state.ativos.length;
    var contagem = { watchlist: 0, invested: 0, sold: 0 };
    S.state.ativos.forEach(function (a) { contagem[S.get.statusDe(a)] = (contagem[S.get.statusDe(a)] || 0) + 1; });

    var comp = U.el("div", { class: "funil" });
    [
      { rot: "Ativos no universo", n: universo, pct: 100,
        dica: "tudo que está cadastrado no módulo — a base das linhas abaixo" },
      { rot: "Com posição aberta", n: contagem.invested, destaque: true,
        dica: "têm dinheiro alocado hoje, em alguma carteira" },
      { rot: "Na watchlist", n: contagem.watchlist,
        dica: "cadastrados e ainda não comprados" },
      { rot: "Vendidos", n: contagem.sold,
        dica: "já tiveram posição e hoje não têm mais" }
    ].forEach(function (linhaDado, i) {
      var pctv = linhaDado.pct != null ? linhaDado.pct : (universo ? (linhaDado.n / universo) * 100 : 0);
      var linha = U.el("div", { class: "fn-linha" + (linhaDado.destaque ? " destaque" : "") });
      linha.appendChild(U.el("div", { class: "fn-topo" }, [
        U.el("span", { class: "fn-rot", text: linhaDado.rot }),
        U.el("span", { class: "fn-n num", text: String(linhaDado.n) }),
        U.el("span", { class: "fn-pct num", text: i === 0 ? "" : pctv.toFixed(0) + "%" })
      ]));
      var barra = U.el("div", { class: "fn-barra" });
      barra.appendChild(U.el("i", { style: "width:" + (linhaDado.n ? Math.max(2, pctv) : 0).toFixed(0) + "%" }));
      linha.appendChild(barra);
      linha.appendChild(U.el("div", { class: "fn-dica", text: linhaDado.dica }));
      comp.appendChild(linha);
    });
    var cardFunil = U.card({ eyebrow: "Composição", title: "O universo e a carteira",
      action: U.el("span", { class: "small dim", text: "% sobre " + universo + " ativos" }),
      body: [comp] });
    cardFunil.classList.add("col-12", "mt-16");

    var bottom = U.el("div", { class: "grid g-12" });
    bottom.appendChild(cardFunil);
    view.appendChild(bottom);

    return { title: "Métricas", crumb: "Análise quantitativa", node: view };
  };

  /* O índice sozinho não diz nada a quem não conhece HHI. A legenda
     antiga ("0 = diverso, 1 = concentrado") explicava a escala e não o
     RESULTADO — e sugeria que zero é o ideal, quando zero só acontece
     sem carteira. O piso real é 1/n. */
  function leituraHHI(hhi, n) {
    if (!n) return "sem posições";
    var piso = 1 / n;
    if (hhi >= 0.5) return "muito concentrado (piso possível: " + piso.toFixed(2) + ")";
    if (hhi >= 0.25) return "concentrado (piso possível: " + piso.toFixed(2) + ")";
    if (hhi - piso < 0.05) return "quase perfeitamente distribuído entre " + n;
    return "distribuição saudável (piso possível: " + piso.toFixed(2) + ")";
  }
})();
