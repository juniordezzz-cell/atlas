/* HOLD · pages/teses.js
   Teses agora vivem na entidade compartilhada AtlasTheses.
   Fluxo: Planejada → Em andamento → Concluída (vai pro Academy
   automaticamente) · Arquivada. Reabertura acontece no Academy. */
(function () {
  "use strict";
  var U = window.UI, S = window.Store, F = window.Forms;
  var filt = "open";

  var BADGE = {
    planejada: "planejada", andamento: "andamento",
    concluida: "concluida", arquivada: "arquivada"
  };
  var LABEL = {
    planejada: "Planejada", andamento: "Em andamento",
    concluida: "Concluída", arquivada: "Arquivada"
  };

  window.Pages = window.Pages || {};
  window.Pages.teses = function () {
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "row" }, [
        U.el("div", { class: "grow" }, [
          U.el("h1", { text: "Teses" }),
          U.el("p", { text: "Pesquisa, análise e decisão. Ao concluir, a tese vai automaticamente para o Academy — e pode ser reaberta de lá." })
        ]),
        U.button("Nova tese", { variant: "primary", icon: "plus", onClick: function () { F.newThesis(); } })
      ])
    ]));

    var c = S.get.counts();
    var strip = U.el("div", { class: "grid g-4" });
    strip.appendChild(U.kpi({ icon: "doc", label: "No módulo", value: String(c.teses) }));
    strip.appendChild(U.kpi({ icon: "target", label: "Em andamento", value: String(c.teses_andamento) }));
    strip.appendChild(U.kpi({ icon: "beaker", label: "Planejadas", value: String(c.teses_planejadas) }));
    strip.appendChild(U.kpi({ icon: "shield", label: "Concluídas (Academy)", value: String(c.teses_concluidas) }));
    view.appendChild(strip);

    var seg = U.el("div", { class: "segmented mt-16", style: "margin-bottom:16px" });
    [["open", "Abertas"], ["planejada", "Planejadas"], ["andamento", "Em andamento"], ["arquivada", "Arquivadas"]].forEach(function (o) {
      var b = U.el("button", { class: filt === o[0] ? "on" : "", text: o[1] });
      b.addEventListener("click", function () { filt = o[0]; window.Router.rerender(); });
      seg.appendChild(b);
    });
    view.appendChild(seg);

    var list = S.state.teses.filter(function (t) {
      if (t.status === "concluida") return false; // concluídas moram no Academy
      if (filt === "open") return t.status === "planejada" || t.status === "andamento";
      return t.status === filt;
    });

    if (!list.length) {
      view.appendChild(U.empty("doc", "Nenhuma tese aqui", "Crie uma tese para documentar sua próxima decisão. Concluídas ficam no Academy.",
        U.button("Nova tese", { variant: "primary", icon: "plus", onClick: function () { F.newThesis(); } })));
      return { title: "Teses", crumb: "Fundamentos", node: view };
    }

    var grid = U.el("div", { class: "grid g-2" });
    list.forEach(function (t) {
      var a = S.get.asset(t.ativo_id);
      var card = U.el("div", { class: "card hoverable pad" });
      var top = U.el("div", { class: "between" });
      if (a) top.appendChild(U.assetCell(a));
      else top.appendChild(U.el("h3", { text: t.titulo || "Tese" }));
      top.appendChild(U.badge(BADGE[t.status] || t.status, LABEL[t.status] || t.status));
      card.appendChild(top);

      card.appendChild(U.el("p", { class: "dim mt-16", style: "line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden", text: t.narrativa || "Sem narrativa registrada ainda." }));

      var meta = U.el("div", { class: "between mt-16" });
      meta.appendChild(U.conviction(t.conviccao));
      var right = U.el("span", { class: "small dim" });
      /* anyPositionOf, não positionOf: a tese é do MÓDULO inteiro, e
         positionOf só enxerga a carteira ativa. Uma tese de um ativo
         mantido em outra carteira aparecia como "Sem posição". */
      var pos = S.get.anyPositionOf(t.ativo_id);
      right.textContent = "v" + (t.version || 1) + (t.revisoes ? " · " + t.revisoes + " revisão(ões)" : "") + " · " + (pos ? "Investido" : "Sem posição");
      meta.appendChild(right);
      card.appendChild(meta);

      var actions = U.el("div", { class: "row-flex mt-16", style: "flex-wrap:wrap" });
      if (a) actions.appendChild(U.button("Ver ativo", { variant: "secondary", size: "sm", onClick: function () { location.hash = "#/ativos?id=" + t.ativo_id; } }));
      actions.appendChild(U.button("Revisar", { variant: "ghost", size: "sm", icon: "edit", onClick: function () { F.editThesis(t.id); } }));
      if (t.status === "planejada") {
        /* Passa por Store.actions, não por AtlasTheses direto: era daí
           que vinha a ausência no Histórico. Ver startThesis(). */
        actions.appendChild(U.button("Iniciar", { variant: "ghost", size: "sm", icon: "play", onClick: function () {
          S.actions.startThesis(t.id);
          U.toast("Tese em andamento", (a ? a.ticker : t.titulo) + " iniciada.", "success");
          window.Router.rerender();
        }}));
      }
      if (t.status === "andamento") {
        actions.appendChild(U.button("Concluir", { variant: "ghost", size: "sm", icon: "check", onClick: function () { confirmConclude(t, a); } }));
      }
      if (t.status !== "arquivada") {
        actions.appendChild(U.button("Arquivar", { variant: "ghost", size: "sm", onClick: function () { confirmArchive(t, a); } }));
      } else {
        actions.appendChild(U.button("Reativar", { variant: "ghost", size: "sm", icon: "refresh", onClick: function () {
          var r = S.actions.reopenThesis(t.id);
          U.toast("Tese reativada", "De volta ao andamento (versão " + (r ? r.version : "?") + ").", "success");
          window.Router.rerender();
        }}));
      }
      card.appendChild(actions);
      grid.appendChild(card);
    });
    view.appendChild(grid);

    return { title: "Teses", crumb: "Fundamentos", node: view };
  };

  function confirmConclude(t, a) {
    var body = U.el("div", {}, [
      U.el("p", { class: "dim", text: "Concluir fecha a versão " + (t.version || 1) + " desta tese e a envia automaticamente para o Academy. Ela sai da lista do módulo, mas pode ser reaberta de lá a qualquer momento — sem perder histórico." })
    ]);
    var confirm = U.button("Concluir tese", { variant: "primary", icon: "check", onClick: function () {
      S.actions.concludeThesis(t.id);
      U.closeModal(); U.toast("Tese concluída", (a ? a.ticker : t.titulo || "Tese") + " enviada ao Academy.", "success");
      window.Router.rerender();
    }});
    U.modal({ eyebrow: "Fechar versão " + (t.version || 1), title: "Concluir tese", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), confirm] });
  }

  function confirmArchive(t, a) {
    var motivo = U.textarea({ placeholder: "Descreva o motivo (ex.: critério de invalidação atingido).", style: "min-height:90px" });
    var body = U.el("div", {}, [
      U.el("p", { class: "dim", style: "margin-bottom:14px", text: "Arquivar a tese de " + (a ? a.ticker : t.titulo || "—") + " registra a decisão no histórico. Se houver posição, considere registrar a venda em seguida." }),
      U.field("Motivo", motivo, { required: true })
    ]);
    var confirm = U.button("Arquivar tese", { variant: "danger", icon: "alert", onClick: function () {
      if (!motivo.value.trim()) return U.toast("Motivo obrigatório", "Explique por que a tese está sendo arquivada.", "warning");
      S.actions.archiveThesis(t.id, motivo.value.trim());
      U.closeModal(); U.toast("Tese arquivada", (a ? a.ticker : "Tese") + " arquivada.", "danger"); window.Router.rerender();
    }});
    U.modal({ eyebrow: "Ação crítica", title: "Arquivar tese", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), confirm] });
  }
})();
