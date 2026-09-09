/* HOLD · pages/metricas.js
   Leitura quantitativa do portfólio. Nenhum número aqui é digitado:
   todos saem das posições, dos preços e das teses. */
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
          U.el("p", { text: "Leitura quantitativa do portfólio: exposição, concentração e disciplina de convicção." })
        ]),
        /* A tela não tinha controle nenhum — nem um botão. Era a única
           do módulo que só se podia olhar. As duas saídas daqui são as
           duas coisas que se faz depois de ler uma métrica ruim: mexer
           na carteira ou documentar a decisão. */
        U.button("Ver ativos", { variant: "secondary", icon: "layers",
          onClick: function () { location.hash = "#/ativos"; } }),
        U.button("Relatório completo", { variant: "secondary", icon: "report",
          onClick: function () { location.hash = "#/relatorios"; } })
      ])
    ]));

    /* ------------------------------------------------------------
       CARTEIRA VAZIA NÃO PRODUZ MÉTRICA

       Sem posição, a tela desenhava tudo com zeros: concentração 0%,
       índice 0,00 (que a própria legenda lê como "diverso"), convicção
       0,0/10. Zero não é diversificação nem disciplina — é ausência de
       carteira, e apresentar isso como leitura quantitativa é dar nota
       a uma prova em branco.
       ------------------------------------------------------------ */
    if (!posicoes.length) {
      view.appendChild(U.empty("chart", "Ainda não há o que medir",
        "As métricas descrevem uma carteira: concentração, exposição por setor e convicção " +
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

    /* ------------------------------------------------------------
       CONVICÇÃO MÉDIA — a conta estava contaminada

       Ela somava `conviccao` de TODOS os ativos investidos e dividia
       pelo total. Só que convicção só existe quando há tese: ativo sem
       tese tem o campo em zero, que não significa "convicção nenhuma",
       significa "não perguntado". Medido com uma tese de convicção 9 e
       duas posições sem tese, a tela dizia "3,0 / 10" — um número que
       não descreve nem a disciplina nem a falta dela.

       Agora a média é só entre quem tem tese, e a tela diz sobre
       quantas posições ela fala. O resto vira o aviso ao lado.
       ------------------------------------------------------------ */
    var comTese = [], semTese = [];
    posicoes.forEach(function (p) {
      var a = S.get.asset(p.ativo_id); if (!a) return;
      (S.get.thesisOfAsset(a.id) ? comTese : semTese).push(a);
    });
    var mediaConv = comTese.length
      ? comTese.reduce(function (s, a) { return s + (+a.conviccao || 0); }, 0) / comTese.length
      : null;

    /* ---- faixa de KPIs ---- */
    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "target", label: "Convicção média",
      value: mediaConv == null ? "—" : mediaConv.toFixed(1) + " / 10",
      sub: mediaConv == null
        ? "nenhuma posição tem tese"
        : "entre " + comTese.length + " de " + posicoes.length + " posições com tese" }));
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

    /* ---- convicção por posição, agora clicável ---- */
    var medidorConv = U.el("div", { class: "meter" });
    var ordenadas = posicoes.slice().sort(function (x, y) {
      var ax = S.get.asset(x.ativo_id), ay = S.get.asset(y.ativo_id);
      return ((+ay.conviccao || 0) - (+ax.conviccao || 0)) || (S.get.positionValue(y) - S.get.positionValue(x));
    });
    ordenadas.forEach(function (p) {
      var a = S.get.asset(p.ativo_id); if (!a) return;
      var tem = !!S.get.thesisOfAsset(a.id);
      /* Linha clicável: a leitura "esta posição não tem tese" só vale
         alguma coisa se der para ir resolver dali. */
      var row = U.el("button", { class: "m-row clicavel", type: "button",
        title: "Abrir " + a.ticker });
      row.addEventListener("click", function () { location.hash = "#/ativos?id=" + a.id; });
      row.appendChild(U.el("span", { class: "m-label", text: a.ticker }));
      var track = U.el("div", { class: "m-track" + (tem ? "" : " vazio") });
      track.appendChild(U.el("i", { style: "width:" + (tem ? (+a.conviccao || 0) * 10 : 0) + "%" }));
      row.appendChild(track);
      row.appendChild(U.el("span", { class: "m-val" + (tem ? "" : " dim"),
        text: tem ? a.conviccao + "/10" : "sem tese" }));
      medidorConv.appendChild(row);
    });
    var cardConv = U.card({ eyebrow: "Disciplina", title: "Convicção por posição",
      action: semTese.length
        ? U.el("span", { class: "badge review" }, [U.el("span", { class: "dot" }),
            semTese.length + " sem tese"])
        : U.el("span", { class: "badge invested" }, [U.el("span", { class: "dot" }), "todas com tese"]),
      body: [medidorConv] });
    cardConv.classList.add("col-6");
    mid.appendChild(cardConv);
    view.appendChild(mid);

    /* ---- status das teses ---- */
    var st = {};
    S.state.teses.forEach(function (t) { st[t.status] = (st[t.status] || 0) + 1; });
    var segs = [
      { label: "Em andamento", chave: "andamento", value: st.andamento || 0, color: C.color(0) },
      { label: "Planejadas",   chave: "planejada", value: st.planejada || 0, color: C.color(4) },
      { label: "Concluídas",   chave: "concluida", value: st.concluida || 0, color: C.color(3) },
      { label: "Arquivadas",   chave: "arquivada", value: st.arquivada || 0, color: C.color(5) }
    ].filter(function (s) { return s.value > 0; });

    var corpoTeses = U.el("div");
    if (segs.length) {
      corpoTeses.appendChild(C.donut(segs, { centerTop: S.state.teses.length, centerBottom: "teses" }));
      var leg = U.el("div", { class: "legend-list" });
      segs.forEach(function (s) {
        var li = U.el("button", { class: "ll-item", type: "button", title: "Ver teses" });
        li.appendChild(U.el("span", { class: "sw", style: "background:" + s.color }));
        li.appendChild(U.el("span", { class: "ll-tick", style: "font-family:var(--font)", text: s.label }));
        li.appendChild(U.el("span", { class: "ll-pct num", text: String(s.value) }));
        li.addEventListener("click", function () { location.href = "../academy/index.html#/andamento"; });
        leg.appendChild(li);
      });
      corpoTeses.appendChild(leg);
    } else {
      corpoTeses = U.empty("doc", "Sem teses", "Acompanhe os estudos diretamente no Academy.",
        U.button("Abrir Academy", { variant: "primary", icon: "plus",
          onClick: function () { location.href = "../academy/index.html#/andamento"; } }));
    }
    var cardTeses = U.card({ eyebrow: "Saúde", title: "Status das teses", body: [corpoTeses] });
    cardTeses.classList.add("col-4", "mt-16");

    /* ------------------------------------------------------------
       COMPOSIÇÃO DO UNIVERSO — e por que isto NÃO é um funil

       O desenho antigo empilhava Planejadas, Teses, Watchlist e
       Investidos como etapas de um caminho. Não eram: "Planejadas" é
       SUBCONJUNTO de "Teses" (o mesmo ativo contado duas vezes), e
       Watchlist/Investidos contam ATIVOS, não teses — duas unidades no
       mesmo gráfico. E a barra era normalizada pelo MAIOR valor da
       lista, então qualquer conjunto de números virava um funil de
       aparência convincente.

       A primeira tentativa de conserto aqui foi outro funil: universo →
       com tese → virou posição. Também errado, e pelo mesmo motivo de
       fundo. Desde que o caixa (e não a tese) passou a liberar a
       compra, "com posição" DEIXOU de ser subconjunto de "com tese" —
       medido nesta própria tela: 1 ativo com tese e 3 com posição. Um
       funil cujo segundo degrau é menor que o terceiro está mentindo
       sobre a relação entre eles.

       Então não é funil. São três leituras independentes contra o
       mesmo universo, mais a interseção — que é o número que interessa:
       quantas posições têm fundamento escrito.
       ------------------------------------------------------------ */
    var universo = S.state.ativos.length;
    var comTeseTotal = S.state.ativos.filter(function (a) { return !!S.get.thesisOfAsset(a.id); }).length;
    var investidosTotal = S.state.ativos.filter(function (a) { return S.get.statusDe(a) === "invested"; }).length;
    var ambos = S.state.ativos.filter(function (a) {
      return S.get.statusDe(a) === "invested" && !!S.get.thesisOfAsset(a.id);
    }).length;

    var comp = U.el("div", { class: "funil" });
    [
      { rot: "Ativos no universo", n: universo, pct: 100,
        dica: "tudo que está cadastrado no módulo — a base das linhas abaixo" },
      { rot: "Com tese documentada", n: comTeseTotal,
        dica: "receberam um fundamento escrito, investidos ou não" },
      { rot: "Com posição aberta", n: investidosTotal,
        dica: "têm dinheiro alocado hoje" },
      { rot: "Com posição E tese", n: ambos, destaque: true,
        dica: "o que a disciplina do módulo persegue: dinheiro alocado com fundamento" }
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
    if (semTese.length) {
      comp.appendChild(U.el("div", { class: "small", style: "margin-top:14px;color:var(--warning)",
        text: semTese.length + " posição(ões) com dinheiro dentro e sem tese: " +
              semTese.map(function (a) { return a.ticker; }).join(", ") + "." }));
    }
    var cardFunil = U.card({ eyebrow: "Composição", title: "O universo e a carteira",
      action: U.el("span", { class: "small dim", text: "% sobre " + universo + " ativos" }),
      body: [comp] });
    cardFunil.classList.add("col-8", "mt-16");

    var bottom = U.el("div", { class: "grid g-12" });
    bottom.appendChild(cardFunil); bottom.appendChild(cardTeses);
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
