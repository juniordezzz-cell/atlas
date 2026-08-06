/* HOLD · pages/configuracoes.js */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  window.Pages = window.Pages || {};
  window.Pages.configuracoes = function () {
    var cfg = S.state.config;
    var view = U.el("div");
    view.appendChild(U.el("div", { class: "view-head" }, [
      U.el("div", { class: "grow" }, [U.el("h1", { text: "Configurações" }), U.el("p", { text: "Preferências do sistema, alertas e gestão dos dados locais." })])
    ]));

    var grid = U.el("div", { class: "grid g-2" });

    /* perfil */
    var nome = U.input({ value: cfg.nome_gestor || "" });
    var moeda = U.select([{ value: "USD", label: "USD — Dólar" }, { value: "BRL", label: "BRL — Real" }, { value: "EUR", label: "EUR — Euro" }], cfg.moeda || "USD");
    var profileCard = U.card({ eyebrow: "Perfil", title: "Identidade do gestor",
      body: [U.field("Nome do gestor", nome), U.field("Moeda de referência", moeda, { hint: "Usada como rótulo. Os valores seguem em USD nesta versão." }),
        U.button("Salvar perfil", { variant: "primary", icon: "check", onClick: function () {
          S.actions.updateConfig({ nome_gestor: nome.value.trim(), moeda: moeda.value });
          U.toast("Perfil salvo", "Preferências atualizadas.", "success"); window.Router.rerender();
        }})] });
    grid.appendChild(profileCard);

    /* alertas */
    var tInval = toggle("Alertar teses invalidadas", cfg.alerta_invalidacao);
    var tRev = toggle("Alertar teses em revisão", cfg.alerta_revisao);
    var tConv = toggle("Mostrar convicção nas listas", cfg.mostrar_conviccao);
    var alertCard = U.card({ eyebrow: "Monitoramento", title: "Alertas e exibição",
      body: [U.el("div", { class: "stack", style: "gap:14px" }, [tInval.node, tRev.node, tConv.node]),
        U.button("Salvar alertas", { variant: "primary", icon: "check", onClick: function () {
          S.actions.updateConfig({ alerta_invalidacao: tInval.input.checked, alerta_revisao: tRev.input.checked, mostrar_conviccao: tConv.input.checked });
          U.toast("Alertas salvos", "Preferências de monitoramento atualizadas.", "success");
        }})] });
    alertCard.querySelector(".card-body").firstChild.style.marginBottom = "16px";
    grid.appendChild(alertCard);
    view.appendChild(grid);

    /* dados */
    var importArea = U.textarea({ placeholder: "Cole aqui um JSON exportado para restaurar o estado…", style: "min-height:90px" });
    var dataCard = U.card({ eyebrow: "Dados locais", title: "Backup e restauração",
      body: [
        U.el("p", { class: "dim small", style: "margin-bottom:14px", text: "O estado é salvo no seu navegador (localStorage). Exporte para fazer backup ou mover entre máquinas." }),
        U.el("div", { class: "row-flex", style: "margin-bottom:16px" }, [
          U.button("Exportar estado", { variant: "secondary", icon: "download", onClick: function () {
            var blob = new Blob([S.actions.exportJSON()], { type: "application/json" });
            var url = URL.createObjectURL(blob); var a = document.createElement("a");
            a.href = url; a.download = "hold-backup-" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            U.toast("Backup gerado", "Arquivo JSON salvo.", "success");
          }})
        ]),
        U.field("Importar estado", importArea),
        U.el("div", { class: "row-flex" }, [
          U.button("Importar", { variant: "secondary", icon: "refresh", onClick: function () {
            var res = S.actions.importJSON(importArea.value.trim());
            if (res.error) return U.toast("Falha na importação", res.error, "warning");
            U.toast("Estado importado", "Dados restaurados.", "success"); window.Router.rerender();
          }}),
          U.button("Restaurar dados de exemplo", { variant: "danger", icon: "trash", onClick: confirmReset })
        ])
      ] });
    dataCard.classList.add("mt-16");
    view.appendChild(dataCard);

    return { title: "Configurações", crumb: "Preferências", node: view };
  };

  function toggle(label, checked) {
    var input = U.el("input", { type: "checkbox" }); input.checked = !!checked;
    var node = U.el("label", { class: "toggle" }, [input, U.el("span", { class: "track" }), U.el("span", { text: label })]);
    return { node: node, input: input };
  }

  function confirmReset() {
    var body = U.el("div", {}, [U.el("p", { class: "dim", text: "Isto apaga todas as suas alterações locais e recarrega os dados de exemplo. A ação não pode ser desfeita." })]);
    var confirm = U.button("Apagar e restaurar", { variant: "danger", icon: "trash", onClick: function () {
      S.actions.resetToSeed(); U.closeModal(); U.toast("Dados restaurados", "Sistema voltou ao estado de exemplo.", "danger"); window.Router.rerender();
    }});
    U.modal({ eyebrow: "Ação irreversível", title: "Restaurar dados de exemplo", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), confirm] });
  }
})();
