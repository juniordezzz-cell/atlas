/* HOLD · pages/metricas.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, C = window.Charts;

  window.Pages = window.Pages || {};
  window.Pages.metricas = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "grow" }, [U.el("h1", { text: "Métricas" }), U.el("p", { text: "Leitura quantitativa do portfólio: exposição, concentração e disciplina de convicção." })])
    ]));

    var val = S.get.portfolioValue();

    // exposição por setor
    var bySector = {};
    S.get.walletPositions().forEach(function (p) {
      var a = S.get.asset(p.ativo_id); if (!a) return;
      var key = a.setor || "Outro";
      bySector[key] = (bySector[key] || 0) + S.get.positionValue(p);
    });
    var sectors = Object.keys(bySector).map(function (k) { return { label: k, value: bySector[k] }; }).sort(function (a, b) { return b.value - a.value; });

    // concentração
    var weights = S.get.walletPositions().map(function (p) { return S.get.positionWeight(p); }).sort(function (a, b) { return b - a; });
    var top1 = weights[0] || 0;
    var hhi = weights.reduce(function (s, w) { return s + (w / 100) * (w / 100); }, 0);

    // convicção — investido é quem tem posição, não quem foi marcado
    var invested = S.state.ativos.filter(function (a) { return S.get.statusDe(a) === "invested"; });
    var avgConv = invested.length ? invested.reduce(function (s, a) { return s + a.conviccao; }, 0) / invested.length : 0;

    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "target", label: "Convicção média", value: avgConv.toFixed(1) + " / 10" }));
    strip.appendChild(U.kpi({ icon: "zap", label: "Maior posição", value: top1.toFixed(0) + "%" }));
    strip.appendChild(U.kpi({ icon: "layers", label: "Índice de concentração", value: hhi.toFixed(2), sub: "HHI (0 = diverso, 1 = concentrado)" }));
    strip.appendChild(U.kpi({ icon: "shield", label: "Setores", value: String(sectors.length) }));
    view.appendChild(strip);

    var mid = U.el("div", { class: "grid g-12 mt-16" });

    // exposição por setor (meter)
    var sectorMeter = U.el("div", { class: "meter" });
    if (sectors.length) {
      sectors.forEach(function (s) {
        var pctv = val ? (s.value / val) * 100 : 0;
        var row = U.el("div", { class: "m-row" });
        row.appendChild(U.el("span", { class: "m-label", text: s.label }));
        var track = U.el("div", { class: "m-track" }); track.appendChild(U.el("i", { style: "width:" + pctv.toFixed(0) + "%" }));
        row.appendChild(track);
        row.appendChild(U.el("span", { class: "m-val", text: pctv.toFixed(0) + "%" }));
        sectorMeter.appendChild(row);
      });
    } else sectorMeter = U.empty("chart", "Sem exposição", "Registre posições para ver a exposição por setor.");
    var sectorCard = U.card({ eyebrow: "Exposição", title: "Alocação por setor", body: [sectorMeter] });
    sectorCard.classList.add("col-6");
    mid.appendChild(sectorCard);

    // distribuição de convicção por ativo
    var convMeter = U.el("div", { class: "meter" });
    if (invested.length) {
      invested.slice().sort(function (a, b) { return b.conviccao - a.conviccao; }).forEach(function (a) {
        var row = U.el("div", { class: "m-row" });
        row.appendChild(U.el("span", { class: "m-label", text: a.ticker }));
        var track = U.el("div", { class: "m-track" }); track.appendChild(U.el("i", { style: "width:" + (a.conviccao * 10) + "%" }));
        row.appendChild(track);
        row.appendChild(U.el("span", { class: "m-val", text: a.conviccao + "/10" }));
        convMeter.appendChild(row);
      });
    } else convMeter = U.empty("target", "Sem dados", "Convicção aparece quando há ativos investidos.");
    var convCard = U.card({ eyebrow: "Disciplina", title: "Convicção por ativo", body: [convMeter] });
    convCard.classList.add("col-6");
    mid.appendChild(convCard);
    view.appendChild(mid);

    /* ------------------------------------------------------------
       O DONUT CONTAVA STATUS QUE NÃO EXISTEM MAIS

       Ele somava "active", "review" e "invalid" — o vocabulário
       anterior. Desde que Teses viraram entidade compartilhada, os
       status são planejada, andamento, concluida e arquivada. As três
       contagens davam ZERO sempre, os segmentos eram filtrados por
       value > 0, e a tela exibia "Sem teses · Documente teses para
       acompanhar sua saúde" para quem tinha teses documentadas.

       Mentira ao contrário da do relatório ao lado, mesma origem:
       vocabulário velho lido contra dado novo.
       ------------------------------------------------------------ */
    var st = {};
    S.state.teses.forEach(function (t) { st[t.status] = (st[t.status] || 0) + 1; });
    var segs = [
      { label: "Em andamento", value: st.andamento || 0, color: C.color(0) },
      { label: "Planejadas", value: st.planejada || 0, color: C.color(4) },
      { label: "Concluídas", value: st.concluida || 0, color: C.color(3) },
      { label: "Arquivadas", value: st.arquivada || 0, color: C.color(5) }
    ].filter(function (s) { return s.value > 0; });
    var thBody = U.el("div");
    if (segs.length) {
      thBody.appendChild(C.donut(segs, { centerTop: S.state.teses.length, centerBottom: "teses" }));
      var legend = U.el("div", { class: "legend" });
      segs.forEach(function (s) {
        var li = U.el("div", { class: "li" });
        li.appendChild(U.el("span", { class: "sw", style: "background:" + s.color }));
        li.appendChild(document.createTextNode(s.label + " · " + s.value));
        legend.appendChild(li);
      });
      thBody.appendChild(legend);
    } else thBody = U.empty("doc", "Sem teses", "Documente teses para acompanhar sua saúde.");
    var thCard = U.card({ eyebrow: "Saúde", title: "Status das teses", body: [thBody] });
    thCard.classList.add("col-4", "mt-16");

    // watchlist vs investido
    var c = S.get.counts();
    var funnelBody = U.el("div", { class: "meter" });
    [["Planejadas", c.teses_planejadas, "beaker"], ["Teses", c.teses, "doc"], ["Watchlist", c.watchlist, "eye"], ["Investidos", c.investidos, "wallet"]].forEach(function (o) {
      var maxv = Math.max(c.teses_planejadas, c.teses, c.watchlist, c.investidos, 1);
      var row = U.el("div", { class: "m-row" });
      row.appendChild(U.el("span", { class: "m-label", text: o[0] }));
      var track = U.el("div", { class: "m-track" }); track.appendChild(U.el("i", { style: "width:" + ((o[1] / maxv) * 100).toFixed(0) + "%" }));
      row.appendChild(track);
      row.appendChild(U.el("span", { class: "m-val", text: o[1] }));
      funnelBody.appendChild(row);
    });
    var funnelCard = U.card({ eyebrow: "Fluxo", title: "Funil de decisão", body: [funnelBody] });
    funnelCard.classList.add("col-8", "mt-16");

    var bottom = U.el("div", { class: "grid g-12" });
    bottom.appendChild(funnelCard); bottom.appendChild(thCard);
    view.appendChild(bottom);

    return { title: "Métricas", crumb: "Análise quantitativa", node: view };
  };
})();
