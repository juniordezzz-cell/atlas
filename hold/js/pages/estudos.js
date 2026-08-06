/* HOLD · pages/estudos.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;
  var filt = "all";

  window.Pages = window.Pages || {};
  window.Pages.estudos = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [U.el("h1", { text: "Estudos" }), U.el("p", { text: "Pesquisa que antecede a tese. Macro, fundamentalista e narrativo — o primeiro passo do fluxo." })]),
        U.button("Novo estudo", { variant: "primary", icon: "plus", onClick: F.newStudy })
      ])
    ]));

    var seg = U.el("div", { class: "segmented", style: "margin-bottom:16px" });
    [["all", "Todos"], ["macro", "Macro"], ["fundamentalista", "Fundamentalista"], ["narrativo", "Narrativo"]].forEach(function (o) {
      var b = U.el("button", { class: filt === o[0] ? "on" : "", text: o[1] });
      b.addEventListener("click", function () { filt = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });
    view.appendChild(seg);

    var list = S.state.estudos.filter(function (e) { return filt === "all" || e.tipo === filt; });
    if (!list.length) {
      view.appendChild(U.empty("beaker", "Nenhum estudo", "Registre a pesquisa que fundamenta suas decisões.",
        U.button("Novo estudo", { variant: "primary", icon: "plus", onClick: F.newStudy })));
      return { title: "Estudos", crumb: "Pesquisa", node: view };
    }

    var grid = U.el("div", { class: "grid g-2" });
    list.forEach(function (e) {
      var a = e.ativo_id ? S.get.asset(e.ativo_id) : null;
      var card = U.el("div", { class: "card hoverable pad" });
      var top = U.el("div", { class: "between" });
      var titleWrap = U.el("div");
      titleWrap.appendChild(U.el("h3", { text: e.titulo }));
      titleWrap.appendChild(U.el("div", { class: "small dim mt-8", text: a ? a.ticker + " · " + a.nome : "Tema geral" }));
      top.appendChild(titleWrap);
      top.appendChild(U.el("div", { class: "stack", style: "align-items:flex-end;gap:6px" }, [U.typeBadge(e.tipo), U.badge(e.status)]));
      card.appendChild(top);

      if (e.conteudo) card.appendChild(U.el("p", { class: "dim mt-16", style: "line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden", text: e.conteudo }));
      if (e.insights) {
        card.appendChild(U.el("div", { class: "eyebrow mt-16", text: "Insight", style: "margin-bottom:4px" }));
        card.appendChild(U.el("div", { class: "small", style: "color:var(--accent)", text: e.insights }));
      }

      var actions = U.el("div", { class: "row-flex mt-16", style: "flex-wrap:nowrap" });
      actions.appendChild(U.button("Ver / editar", { variant: "secondary", size: "sm", icon: "edit", onClick: function () { editStudy(e); } }));
      var canConvert = e.ativo_id && !S.get.thesisOfAsset(e.ativo_id);
      if (canConvert) actions.appendChild(U.button("Converter em tese", { variant: "ghost", size: "sm", icon: "convert", onClick: function () { convert(e); } }));
      card.appendChild(actions);
      grid.appendChild(card);
    });
    view.appendChild(grid);

    return { title: "Estudos", crumb: "Pesquisa", node: view };
  };

  function editStudy(e) {
    var a = e.ativo_id ? S.get.asset(e.ativo_id) : null;
    var titulo = U.input({}); titulo.value = e.titulo;
    var conteudo = U.textarea({ style: "min-height:140px" }); conteudo.value = e.conteudo;
    var insights = U.textarea({ style: "min-height:80px" }); insights.value = e.insights;
    var status = U.select([{ value: "draft", label: "Rascunho" }, { value: "review", label: "Em revisão" }, { value: "done", label: "Concluído" }], e.status);
    var body = U.el("div", {}, [
      U.el("div", { class: "small dim", style: "margin-bottom:14px", text: (a ? a.ticker + " · " : "") + e.tipo }),
      U.field("Título", titulo),
      U.field("Conteúdo", conteudo),
      U.field("Insights", insights),
      U.field("Status", status)
    ]);
    var save = U.button("Salvar", { variant: "primary", icon: "check", onClick: function () {
      S.actions.updateStudy(e.id, { titulo: titulo.value.trim(), conteudo: conteudo.value.trim(), insights: insights.value.trim(), status: status.value });
      U.closeModal(); U.toast("Estudo atualizado", titulo.value.trim(), "success"); window.Router.rerender();
    }});
    U.modal({ wide: true, eyebrow: "Estudo", title: "Editar estudo", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });
  }

  // Conversão formal: cria a tese via action dedicada (emite STUDY_CONVERTED e fecha o estudo)
  function convert(e) {
    var a = S.get.asset(e.ativo_id);
    var narrativa = U.textarea({ style: "min-height:96px" }); narrativa.value = e.insights ? "Baseado no estudo: " + e.insights : "";
    var bull = U.textarea({ style: "min-height:60px" }), base = U.textarea({ style: "min-height:60px" }), bear = U.textarea({ style: "min-height:60px" });
    var riscos = U.textarea({ style: "min-height:60px" }), catalisadores = U.textarea({ style: "min-height:60px" });
    var inval = U.textarea({ style: "min-height:60px" });
    var conv = U.input({ type: "range", min: "0", max: "10", value: "6", style: "padding:0" });
    var convOut = U.el("span", { class: "num", text: "6" });
    conv.addEventListener("input", function () { convOut.textContent = conv.value; });

    var body = U.el("div", {}, [
      U.el("div", { class: "small dim", style: "margin-bottom:14px", text: "Convertendo \"" + e.titulo + "\" → tese de " + (a ? a.ticker : "ativo") }),
      U.field("Narrativa principal", narrativa, { required: true }),
      U.el("div", { class: "form-row-3" }, [U.field("Bull", bull), U.field("Base", base), U.field("Bear", bear)]),
      U.el("div", { class: "form-row" }, [U.field("Riscos", riscos), U.field("Catalisadores", catalisadores)]),
      U.field("Critérios de invalidação", inval, { required: true }),
      U.field(U.el("span", {}, ["Convicção — ", convOut, " / 10"]), conv)
    ]);
    var save = U.button("Converter em tese", { variant: "primary", icon: "convert", onClick: function () {
      if (!narrativa.value.trim() || !inval.value.trim()) return U.toast("Campos obrigatórios", "Narrativa e critérios de invalidação são necessários.", "warning");
      S.actions.convertStudyToThesis(e.id, {
        narrativa: narrativa.value.trim(), bull: bull.value.trim(), base: base.value.trim(), bear: bear.value.trim(),
        riscos: riscos.value, catalisadores: catalisadores.value, criterios_invalidacao: inval.value.trim(),
        conviccao: conv.value, status: "active"
      });
      U.closeModal(); U.toast("Estudo convertido", "Tese criada e estudo concluído.", "success"); window.Router.rerender();
    }});
    U.modal({ wide: true, eyebrow: "Estudo → Tese", title: "Converter em tese", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });
  }
})();
