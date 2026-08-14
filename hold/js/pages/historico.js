/* HOLD · pages/historico.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;
  var filt = "all";

  window.Pages = window.Pages || {};
  window.Pages.historico = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "grow" }, [U.el("h1", { text: "Histórico" }), U.el("p", { text: "Registro imutável de decisões. Toda ação do sistema deixa rastro aqui." })])
    ]));

    /* "Conversões" (STUDY_CONVERTED) saiu: Estudos deixaram de existir
       quando viraram Teses planejadas, e nada no sistema registra esse
       evento desde então. Era um filtro que só sabia devolver "Sem
       registros" — um botão que promete uma leitura que não existe.
       No lugar entrou "Preços", que tem lastro: toda atualização de
       preço, manual ou pela cadeia, já grava histórico. */
    var seg = U.el("div", { class: "segmented", style: "margin-bottom:18px" });
    [["all", "Tudo"], ["TRADE_EXECUTED", "Operações"], ["THESIS_CREATED", "Teses"], ["THESIS_UPDATED", "Revisões"], ["POSITION_UPDATED", "Preços"]].forEach(function (o) {
      var b = U.el("button", { class: filt === o[0] ? "on" : "", text: o[1] });
      b.addEventListener("click", function () { filt = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });
    view.appendChild(seg);

    var list = S.state.historico.filter(function (h) { return filt === "all" || h.tipo_acao === filt; });
    var body;
    if (list.length) {
      var tl = U.el("div", { class: "timeline" });
      list.forEach(function (h) { tl.appendChild(fullItem(h)); });
      body = tl;
    } else {
      body = U.empty("history", "Sem registros", "Nenhuma ação para este filtro ainda.");
    }
    view.appendChild(U.card({ pad: true, body: [body] }));

    return { title: "Histórico", crumb: "Registro de decisões", node: view };
  };

  function fullItem(h) {
    var a = S.get.asset(h.ativo_id);
    var kind = h.subtipo === "buy" ? "buy" : h.subtipo === "sell" ? "sell" : h.subtipo === "thesis" ? "thesis" : h.subtipo === "study" ? "study" : "";
    var item = U.el("div", { class: "tl-item " + kind });
    item.innerHTML = '<div class="tl-dot">' + U.icon(h.subtipo === "buy" ? "arrowUp" : h.subtipo === "sell" ? "arrowDown" : h.subtipo === "thesis" ? "doc" : "check") + '</div>';
    var head = U.el("div", { class: "tl-head" });
    head.appendChild(U.el("span", { class: "tl-title", text: window.Pages._labelAction(h.tipo_acao) }));
    if (a) head.appendChild(U.el("span", { class: "badge plain", text: a.ticker }));
    head.appendChild(U.el("span", { class: "tl-time", text: U.dateTime(h.data) }));
    item.appendChild(head);
    if (h.impacto) item.appendChild(U.el("div", { class: "tl-body", text: h.impacto }));
    if (h.justificativa) item.appendChild(U.el("div", { class: "tl-body", style: "color:var(--text-dim);font-style:italic", text: "“" + h.justificativa + "”" }));
    return item;
  }
})();
