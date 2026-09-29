/* ============================================================
   ATLAS · DeFi — history.js
   Somente posições encerradas + filtros.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore, F = window.Filters, Sr = window.Search;
  C.mountNav("historico");

  var closed = S.closed();
  function resultado(c) { var h=DeFiPoolHistorico.registro(c); return h.resumo && h.resumo.resultado != null && h.resumo.resultado !== "" && Number.isFinite(Number(h.resumo.resultado)) ? Number(h.resumo.resultado) : null; }
  var conhecidos=closed.filter(function(c){return resultado(c)!=null;});

  /* KPIs */
  var totalProfit = conhecidos.reduce(function (a, c) { return a + resultado(c); }, 0);
  var wins = closed.filter(function (c) { return resultado(c) != null && resultado(c) > 0; }).length;
  var winRate = conhecidos.length ? (wins / conhecidos.length) * 100 : 0;
  U.qs("#histKpis").innerHTML = [
    C.finCard({ label: "Posições Encerradas", value: closed.length, icon: "clock", accent: "", sub: "no histórico" }),
    C.finCard({ label: "Resultado Acumulado", value: conhecidos.length ? U.signedMoney(totalProfit) : "Não informado", icon: "trend", accent: totalProfit >= 0 ? "green" : "", sub: "ciclos com resultado registrado; " + (closed.length - conhecidos.length) + " sem dados" }),
    C.finCard({ label: "Taxa de Acerto", value: conhecidos.length ? U.pct(winRate) : "Não informada", icon: "gauge", accent: "violet", sub: wins + " de " + conhecidos.length + " com resultado" })
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
    if (state.result === "gain") items = items.filter(function (c) { return resultado(c) != null && resultado(c) > 0; });
    if (state.result === "loss") items = items.filter(function (c) { return resultado(c) != null && resultado(c) < 0; });

    if (!items.length) {
      list.innerHTML = C.empty({ icon: "inbox", title: "Nada por aqui", text: "Nenhuma posição encerrada corresponde aos filtros." }).replace('empty"', 'empty" style="padding:48px 24px"');
      return;
    }
    list.innerHTML = items.map(function (c) {
      var w = window.AtlasWallets && AtlasWallets.get(c.walletId);
      return DeFiPoolHistorico.card(c, w ? w.name : c.walletId);
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
