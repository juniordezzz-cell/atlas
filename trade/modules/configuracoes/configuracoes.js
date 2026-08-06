/* ============================================================
   ATLAS — Módulo Configurações (Sprint 6)
   ------------------------------------------------------------
   Preferências (que afetam o sistema de verdade), gestão de
   carteiras e backup/arquivamento de dados. Fecha a estrutura.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var mountRef = null;
  var editWallet = null;   // id em edição
  var adding = false;
  var COLORS = ["#4C9AFF", "#22D3EE", "#2DD4BF", "#FBBF24", "#8B9AFF", "#F87171", "#8595B2"];

  function swatches(sel, attr) {
    return '<div class="cfg__swatches" data-swatches="' + attr + '">' + COLORS.map(function (c) {
      return '<button type="button" class="cfg__swatch" data-color="' + c + '" aria-current="' + (c === sel) + '" style="background:' + c + '"></button>';
    }).join("") + '</div>';
  }

  function walletRow(w) {
    var u = ATLAS.util, app = ATLAS.app;
    var bal = u.money(app.getState().data[w.id] ? (app.getState().data[w.id].equity.slice(-1)[0] || 0) : 0);
    var active = app.currentWallet().id === w.id;
    if (editWallet === w.id) {
      return '<div class="cfg__wallet cfg__wallet--edit" data-wid="' + w.id + '">' +
        '<div class="field-row">' +
          '<label class="field field--sm"><span>Nome</span><input class="input" data-e="name" value="' + u.escape(w.name) + '"></label>' +
          '<label class="field field--sm"><span>Categoria</span><input class="input" data-e="tag" value="' + u.escape(w.tag) + '"></label>' +
        '</div>' +
        '<label class="field"><span>Cor</span>' + swatches(w.color, "edit") + '</label>' +
        '<div class="form-actions"><button class="btn btn--accent" data-save-w>' + u.icon("check", 14) + ' Salvar</button>' +
          '<button class="btn btn--ghost" data-cancel-w>Cancelar</button></div>' +
      '</div>';
    }
    return '<div class="cfg__wallet" data-wid="' + w.id + '">' +
      '<span class="wallet__swatch" style="background:' + w.color + '">' + w.name.slice(0, 2).toUpperCase() + '</span>' +
      '<div class="cfg__wallet-meta"><b>' + u.escape(w.name) + (active ? ' <span class="badge badge--azure">ativa</span>' : '') + '</b>' +
        '<span>' + u.escape(w.tag) + ' · ' + bal + '</span></div>' +
      '<div class="cfg__wallet-actions">' +
        '<button class="btn btn--ghost" data-edit-w="' + w.id + '">' + u.icon("edit", 14) + '</button>' +
        '<button class="btn btn--ghost cfg__del" data-del-w="' + w.id + '">' + u.icon("trash", 14) + '</button>' +
      '</div></div>';
  }

  function render(mount) {
    mountRef = mount;
    var u = ATLAS.util, app = ATLAS.app;
    var p = app.prefs();
    var eph = ATLAS.store.ephemeral;
    var archived = app.archivedCount();

    var wallets = app.wallets().map(walletRow).join("");
    var addForm = adding ?
      '<div class="cfg__wallet cfg__wallet--edit">' +
        '<div class="field-row">' +
          '<label class="field field--sm"><span>Nome</span><input class="input" data-a="name" placeholder="Ex.: Futuros"></label>' +
          '<label class="field field--sm"><span>Saldo inicial</span><input class="input" data-a="balance" placeholder="0"></label>' +
        '</div>' +
        '<label class="field"><span>Tipo de carteira</span>' +
          '<select class="input" data-a="type">' +
            '<option value="global">Global — soma no patrimônio total do Atlas</option>' +
            '<option value="isolada">Isolada — fica só no Trade, fora do total</option>' +
          '</select>' +
        '</label>' +
        '<label class="field"><span>Cor</span>' + swatches(COLORS[0], "add") + '</label>' +
        '<div class="form-actions"><button class="btn btn--accent" data-save-add>' + u.icon("check", 14) + ' Criar carteira</button>' +
          '<button class="btn btn--ghost" data-cancel-add>Cancelar</button></div>' +
      '</div>' :
      '<button class="btn" data-add-w>' + u.icon("plus", 15) + ' Adicionar carteira</button>';

    mount.innerHTML =
      '<div class="estudos cfg">' +
        '<div class="est__head reveal"><div><span class="eyebrow">Ajustes do sistema</span><h1>Configurações</h1></div></div>' +

        '<div class="card reveal"><div class="card__head"><span class="card__title">Preferências</span></div>' +
          '<div class="field-row">' +
            '<label class="field"><span>Nome do operador</span><input class="input" data-p="operatorName" value="' + u.escape(p.operatorName) + '" placeholder="Como o Oráculo te chama"></label>' +
            '<label class="field field--sm"><span>Limite da tese (h)</span><input class="input" data-p="studyLimitH" type="number" min="1" value="' + p.studyLimitH + '"></label>' +
            '<label class="field field--sm"><span>Revisar trade após (h)</span><input class="input" data-p="tradeReviewH" type="number" min="1" value="' + p.tradeReviewH + '"></label>' +
          '</div>' +
          '<div class="form-actions"><button class="btn btn--accent" data-save-prefs>' + u.icon("check", 15) + ' Salvar preferências</button></div>' +
          '<p class="cfg__hint">Esses limites alimentam os alertas do Dashboard e do Oráculo.</p>' +
        '</div>' +

        '<div class="card reveal"><div class="card__head"><span class="card__title">Carteiras</span><span class="est__meta">' + app.wallets().length + ' no total</span></div>' +
          '<div class="cfg__wallets">' + wallets + '</div>' +
          '<div class="cfg__add">' + addForm + '</div>' +
        '</div>' +

        '<div class="card reveal"><div class="card__head"><span class="card__title">Dados e backup</span>' +
          '<span class="badge ' + (eph ? 'badge--warn' : 'badge--profit') + ' badge--dot">' + (eph ? 'memória (sessão)' : 'localStorage') + '</span></div>' +
          '<p class="cfg__hint">Seus dados ficam ' + (eph ? 'apenas nesta sessão (sem persistência neste ambiente)' : 'salvos neste navegador') + '. Faça backups regularmente.</p>' +
          '<div class="cfg__actions">' +
            '<button class="btn btn--accent" data-export>' + u.icon("archive", 15) + ' Exportar backup (.json)</button>' +
            '<button class="btn" data-import>' + u.icon("back", 15) + ' Importar backup</button>' +
            '<input type="file" accept="application/json,.json" data-file style="display:none">' +
          '</div>' +
          '<div class="cfg__arch">' +
            '<div class="cfg__arch-row"><input class="input" data-days type="number" min="1" value="90" style="max-width:110px">' +
              '<button class="btn" data-archive>Arquivar encerrados mais antigos que (dias)</button></div>' +
            '<div class="cfg__arch-info"><span class="est__meta">' + u.icon("clock", 13) + archived + ' item(ns) arquivado(s)</span>' +
              (archived ? '<button class="btn btn--ghost" data-restore>Restaurar arquivados</button>' : '') + '</div>' +
            '<p class="cfg__hint">Dados arquivados continuam salvos e podem ser restaurados a qualquer momento.</p>' +
          '</div>' +
          '<div class="cfg__danger"><button class="btn btn--ghost est__danger" data-reset>' + u.icon("trash", 15) + ' Redefinir para os dados de exemplo</button></div>' +
        '</div>' +
      '</div>';

    // ---- Preferências ----
    mount.querySelector("[data-save-prefs]").addEventListener("click", function () {
      var name = mount.querySelector('[data-p="operatorName"]').value.trim();
      var sl = parseInt(mount.querySelector('[data-p="studyLimitH"]').value, 10);
      var tr = parseInt(mount.querySelector('[data-p="tradeReviewH"]').value, 10);
      app.setPrefs({ operatorName: name || "operador", studyLimitH: sl > 0 ? sl : 72, tradeReviewH: tr > 0 ? tr : 24 });
      ATLAS.topbar.mount(document.querySelector(".topbar"));
    });

    // ---- Swatches ----
    mount.querySelectorAll("[data-swatches]").forEach(function (grp) {
      grp.querySelectorAll(".cfg__swatch").forEach(function (sw) {
        sw.addEventListener("click", function () {
          grp.querySelectorAll(".cfg__swatch").forEach(function (x) { x.setAttribute("aria-current", x === sw); });
        });
      });
    });
    function chosenColor(attr, fallback) {
      var grp = mount.querySelector('[data-swatches="' + attr + '"]');
      if (!grp) return fallback;
      var on = grp.querySelector('.cfg__swatch[aria-current="true"]');
      return on ? on.dataset.color : fallback;
    }

    // ---- Carteiras ----
    mount.querySelectorAll("[data-edit-w]").forEach(function (b) { b.addEventListener("click", function () { editWallet = b.dataset.editW; adding = false; render(mount); }); });
    mount.querySelectorAll("[data-del-w]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (app.wallets().length <= 1) { window.alert("É preciso manter ao menos uma carteira."); return; }
        var w = app.wallets().filter(function (x) { return x.id === b.dataset.delW; })[0];
        if (window.confirm('Excluir a carteira "' + w.name + '" e todos os seus dados? Esta ação não pode ser desfeita.')) app.removeWallet(b.dataset.delW);
      });
    });
    var saveW = mount.querySelector("[data-save-w]");
    if (saveW) saveW.addEventListener("click", function () {
      var row = mount.querySelector('.cfg__wallet--edit[data-wid]');
      app.updateWallet(editWallet, {
        name: row.querySelector('[data-e="name"]').value.trim(),
        tag: row.querySelector('[data-e="tag"]').value.trim(),
        color: chosenColor("edit", null)
      });
      editWallet = null; render(mount);
    });
    var cancelW = mount.querySelector("[data-cancel-w]");
    if (cancelW) cancelW.addEventListener("click", function () { editWallet = null; render(mount); });

    var addBtn = mount.querySelector("[data-add-w]");
    if (addBtn) addBtn.addEventListener("click", function () { adding = true; editWallet = null; render(mount); });
    var saveAdd = mount.querySelector("[data-save-add]");
    if (saveAdd) saveAdd.addEventListener("click", function () {
      var name = mount.querySelector('[data-a="name"]').value.trim();
      if (!name) { window.alert("Dê um nome à carteira."); return; }
      var typeSel = mount.querySelector('[data-a="type"]');
      app.addWallet({ name: name, type: typeSel ? typeSel.value : "global", color: chosenColor("add", COLORS[0]), balance: mount.querySelector('[data-a="balance"]').value.trim() });
      adding = false; render(mount);
    });
    var cancelAdd = mount.querySelector("[data-cancel-add]");
    if (cancelAdd) cancelAdd.addEventListener("click", function () { adding = false; render(mount); });

    // ---- Backup ----
    mount.querySelector("[data-export]").addEventListener("click", function () {
      try {
        var blob = new Blob([app.exportData()], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "atlas-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (e) { window.alert("Não foi possível exportar neste ambiente."); }
    });
    var fileI = mount.querySelector("[data-file]");
    mount.querySelector("[data-import]").addEventListener("click", function () { fileI.click(); });
    fileI.addEventListener("change", function () {
      var f = fileI.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { app.importData(r.result); window.alert("Backup importado com sucesso."); render(mount); }
        catch (e) { window.alert("Arquivo inválido: " + e.message); }
      };
      r.readAsText(f);
    });

    mount.querySelector("[data-archive]").addEventListener("click", function () {
      var days = parseInt(mount.querySelector("[data-days]").value, 10) || 90;
      var moved = app.archiveOld(days);
      window.alert(moved ? (moved + " item(ns) arquivado(s).") : "Nada a arquivar nesse período.");
      render(mount);
    });
    var restore = mount.querySelector("[data-restore]");
    if (restore) restore.addEventListener("click", function () { var n = app.restoreArchived(); window.alert(n + " item(ns) restaurado(s)."); render(mount); });

    mount.querySelector("[data-reset]").addEventListener("click", function () {
      if (window.confirm("Redefinir TODOS os dados para o exemplo inicial? Seus registros serão apagados.")) { app.resetAll(); render(mount); }
    });
  }

  ATLAS.router.register("configuracoes", { label: "Configurações", icon: "config", render: render });

  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() === "configuracoes" && mountRef) render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
