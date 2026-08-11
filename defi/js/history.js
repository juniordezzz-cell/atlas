/* ============================================================
   ATLAS · DeFi — history.js
   Somente posições encerradas + filtros.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore, F = window.Filters, Sr = window.Search;
  C.mountNav("historico");

  var closed = S.closed();

  /* KPIs */
  var totalProfit = closed.reduce(function (a, c) { return a + c.profit; }, 0);
  var wins = closed.filter(function (c) { return c.profit > 0; }).length;
  var winRate = closed.length ? (wins / closed.length) * 100 : 0;
  U.qs("#histKpis").innerHTML = [
    C.finCard({ label: "Posições Encerradas", value: closed.length, icon: "clock", accent: "", sub: "no histórico" }),
    C.finCard({ label: "Resultado Acumulado", value: U.signedMoney(totalProfit), icon: "trend", accent: totalProfit >= 0 ? "green" : "", sub: "realizado" }),
    C.finCard({ label: "Taxa de Acerto", value: U.pct(winRate), icon: "gauge", accent: "violet", sub: wins + " de " + closed.length })
  ].join("");
  U.reveal("#histKpis .fin-card");

  /* Filtros */
  F.populate(U.qs("#hChain"), closed, "chain", "Blockchain");
  F.populate(U.qs("#hProto"), closed, "protocol", "Protocolo");
  F.populate(U.qs("#hCat"), closed, "category", "Categoria");

  var state = { q: "", chain: "", protocol: "", category: "", result: "" };
  var list = U.qs("#histList");

  function render() {
    var items = closed.slice();
    items = Sr.match(items, state.q, ["base", "quote", "protocol", "chain", "category"]);
    items = F.apply(items, { chain: state.chain, protocol: state.protocol, category: state.category });
    if (state.result === "gain") items = items.filter(function (c) { return c.profit > 0; });
    if (state.result === "loss") items = items.filter(function (c) { return c.profit < 0; });

    if (!items.length) {
      list.innerHTML = C.empty({ icon: "inbox", title: "Nada por aqui", text: "Nenhuma posição encerrada corresponde aos filtros." }).replace('empty"', 'empty" style="padding:48px 24px"');
      return;
    }
    list.innerHTML = items.map(function (c) {
      var cls = c.profit > 0 ? "up" : (c.profit < 0 ? "down" : "flat");
      /* daysBetween devolve null quando falta uma das datas — antes
         virava NaN e a linha exibia "NaN dias". */
      var dur = U.daysBetween(c.openedAt, c.closedAt);
      var durTxt = dur == null ? "duração desconhecida" : dur + " dia(s)";
      return '<div class="hist-row" title="' + (c.reason || "") + '">' +
        '<div class="h-pair"><div class="pair-icons">' + U.coin(c.base) + U.coin(c.quote) + '</div>' +
        '<div><div class="h-name">' + c.base + ' / ' + c.quote + '</div>' +
        '<div class="h-meta">' + U.date(c.openedAt) + ' → ' + U.date(c.closedAt) + ' · ' + durTxt + '</div></div></div>' +
        '<div class="h-tags"><span class="tag tag-chain"><span class="dot" style="background:' + S.colorOf("chain", c.chain) + '"></span>' + c.chain + '</span>' +
        '<span class="tag tag-proto">' + c.protocol + '</span><span class="tag tag-cat">' + c.category + '</span></div>' +
        '<div class="h-result"><div class="r delta ' + cls + '">' + U.pct(c.profitPct, true) + '</div><div class="p">' + U.signedMoney(c.profit) + '</div></div>' +
        U.statusChip("encerrada") +
        '</div>';
    }).join("");
    U.reveal("#histList .hist-row");
  }

  Sr.bind(U.qs("#hSearch"), function (v) { state.q = v; render(); });
  U.qs("#hChain").addEventListener("change", function (e) { state.chain = e.target.value; render(); });
  U.qs("#hProto").addEventListener("change", function (e) { state.protocol = e.target.value; render(); });
  U.qs("#hCat").addEventListener("change", function (e) { state.category = e.target.value; render(); });
  U.qs("#hResult").addEventListener("change", function (e) { state.result = e.target.value; render(); });

  render();
})();
