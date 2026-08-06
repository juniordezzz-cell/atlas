/* ============================================================
   ATLAS — Módulo Teses (substitui o antigo Estudos)
   ------------------------------------------------------------
   Onde todo trade nasce. Teses vivem na entidade compartilhada
   AtlasTheses (module: "trade").

   Status oficiais: Planejada · Em andamento · Concluída · Arquivada
   - Concluir → a tese sai daqui e vai automaticamente pro Academy
   - Reabrir acontece no Academy (volta como nova versão)
   - Regra das 72h preservada para teses em andamento
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function LIMIT() { return ATLAS.app.pref("studyLimitH") || 72; } // horas
  var mountRef = null;
  var view = "list";      // list | detail | form
  var selectedId = null;
  var editId = null;
  var filter = "todas";   // todas | planejada | andamento | arquivada
  var pendingOpen = null; // pedido vindo de outra tela (ex.: Dashboard)

  var STATES = {
    planejada: { label: "Planejada",    badge: "badge--azure" },
    andamento: { label: "Em andamento", badge: "badge--warn" },
    concluida: { label: "Concluída",    badge: "badge--profit" },
    arquivada: { label: "Arquivada",    badge: "badge--loss" }
  };

  function theses(includeConcluded) {
    if (!window.AtlasTheses) return [];
    return window.AtlasTheses.byModule("trade", { includeConcluded: !!includeConcluded });
  }
  function getThesis(id) {
    var t = window.AtlasTheses ? window.AtlasTheses.get(id) : null;
    return (t && t.module === "trade") ? t : null;
  }

  // ---------- helpers ----------
  function openHours(t) {
    return Math.max(0, Math.round((Date.now() - (t.createdAt || Date.now())) / 3600000));
  }
  function isStalled(t) { return t.status === "andamento" && openHours(t) > LIMIT(); }
  function show(v) { view = v; render(mountRef); }

  // ---------- LISTA ----------
  function renderList(mount) {
    var u = ATLAS.util;
    var all = theses(false); // concluídas moram no Academy
    var list = filter === "todas"
      ? all.filter(function (t) { return t.status !== "arquivada"; })
      : all.filter(function (t) { return t.status === filter; });

    var concludedN = theses(true).filter(function (t) { return t.status === "concluida"; }).length;

    var counts = {
      todas: all.filter(function (t) { return t.status !== "arquivada"; }).length,
      planejada: all.filter(function (t) { return t.status === "planejada"; }).length,
      andamento: all.filter(function (t) { return t.status === "andamento"; }).length,
      arquivada: all.filter(function (t) { return t.status === "arquivada"; }).length
    };
    var tabs = [["todas", "Abertas"], ["planejada", "Planejadas"], ["andamento", "Em andamento"], ["arquivada", "Arquivadas"]]
      .map(function (t) {
        return '<button class="est__tab" data-filter="' + t[0] + '" aria-current="' + (filter === t[0]) + '">' +
          t[1] + '<span class="est__tab-n">' + counts[t[0]] + '</span></button>';
      }).join("");

    var cards = list.length ? list.map(function (t) {
      var open = openHours(t), stalled = isStalled(t);
      return '<button class="est__card" data-open="' + t.id + '">' +
        '<div class="est__card-top">' +
          '<span class="est__ticker">' + u.escape(t.asset) + '</span>' +
          '<span class="badge ' + STATES[t.status].badge + '">' + STATES[t.status].label + '</span>' +
        '</div>' +
        '<b class="est__card-title">' + u.escape(t.title) + '</b>' +
        '<p class="est__card-thesis">' + u.escape(t.content || "Sem tese registrada.") + '</p>' +
        '<div class="est__card-foot">' +
          '<span class="est__meta">' + u.icon("clock", 13) + (t.status === "andamento" ? u.dur(open) + " aberta" : "atualizada " + u.ago(t.updatedAt)) + '</span>' +
          (t.version > 1 ? '<span class="badge badge--azure">v' + t.version + '</span>' : '') +
          (stalled ? '<span class="badge badge--loss badge--dot">Parada</span>' : '') +
        '</div>' +
      '</button>';
    }).join("") :
      '<div class="empty" style="min-height:38vh"><div class="empty__glyph">' + u.icon("flask", 28) + '</div>' +
      '<h2 style="font-size:1.2rem">Nada aqui ainda</h2><p>Nenhuma tese neste filtro. Comece uma nova tese — todo trade nasce daqui.</p></div>';

    mount.innerHTML =
      '<div class="estudos">' +
        '<div class="est__head reveal">' +
          '<div><span class="eyebrow">Pesquisa e decisão</span><h1>Teses</h1></div>' +
          '<button class="btn btn--accent" data-new>' + u.icon("plus", 16) + ' Nova tese</button>' +
        '</div>' +
        '<div class="est__filters reveal">' + tabs + '</div>' +
        (concludedN ? '<p class="est__meta reveal" style="margin:-6px 0 14px">' + u.icon("check", 13) + ' ' + concludedN +
          ' tese(s) concluída(s) estão na Biblioteca do <a href="../academy/index.html" style="color:inherit;text-decoration:underline">Academy</a>.</p>' : '') +
        '<div class="est__list reveal">' + cards + '</div>' +
      '</div>';

    mount.querySelector("[data-new]").addEventListener("click", function () { editId = null; show("form"); });
    mount.querySelectorAll("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.dataset.filter; render(mount); });
    });
    mount.querySelectorAll("[data-open]").forEach(function (c) {
      c.addEventListener("click", function () { selectedId = c.dataset.open; show("detail"); });
    });
  }

  // ---------- DETALHE ----------
  function renderDetail(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var t = getThesis(selectedId);
    if (!t) { show("list"); return; }
    var open = openHours(t), stalled = isStalled(t);

    var timeline = (t.history || []).slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (h, i, arr) {
      var latest = i === arr.length - 1;
      return '<div class="tl__item' + (latest ? ' tl__item--now' : '') + '">' +
        '<span class="tl__dot"></span>' +
        '<div class="tl__body"><span class="tl__time">' + u.dateTime(h.ts) + (latest ? ' · visão atual' : '') + '</span>' +
        '<p class="tl__text">' + u.escape(h.text) + '</p></div></div>';
    }).join("") || '<p class="tl__empty">Ainda sem registros. Adicione a primeira visão abaixo.</p>';

    var versions = (t.versions || []).length
      ? '<div class="card est__timeline-card"><div class="card__head"><span class="card__title">Versões concluídas</span></div>' +
        '<div class="timeline">' + t.versions.slice().reverse().map(function (v) {
          return '<div class="tl__item"><span class="tl__dot"></span><div class="tl__body">' +
            '<span class="tl__time">Versão ' + v.version + ' · concluída em ' + u.dateTime(v.concludedAt) + '</span>' +
            '<p class="tl__text">' + u.escape((v.snapshot && v.snapshot.content) || "—") + '</p></div></div>';
        }).join("") + '</div></div>'
      : '';

    // Ações conforme status
    var actions = "";
    if (t.status === "planejada") actions += '<button class="btn btn--accent" data-act="andamento">' + u.icon("play", 15) + ' Iniciar tese</button>';
    if (t.status === "andamento") actions += '<button class="btn btn--profit" data-act="concluida">' + u.icon("check", 15) + ' Concluir → Academy</button>';
    if (t.status === "andamento" || t.status === "planejada") actions += '<button class="btn" data-act="arquivada">' + u.icon("alert", 15) + ' Arquivar</button>';
    if (t.status === "arquivada") actions += '<button class="btn" data-act="andamento">' + u.icon("play", 15) + ' Reativar</button>';
    if (t.status === "concluida") actions += '<button class="btn btn--accent" data-rd>' + u.icon("rd", 15) + ' Criar RD</button>';

    mount.innerHTML =
      '<div class="estudos est__detail reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Teses</button>' +
        '<div class="est__detail-head">' +
          '<div class="est__detail-title">' +
            '<span class="est__ticker est__ticker--lg">' + u.escape(t.asset) + '</span>' +
            '<div><h1>' + u.escape(t.title) + '</h1>' +
            '<span class="est__sub">Criada ' + u.ago(t.createdAt) + ' · atualizada ' + u.ago(t.updatedAt) + ' · versão ' + t.version + '</span></div>' +
          '</div>' +
          '<div class="est__detail-badges">' +
            '<span class="badge ' + STATES[t.status].badge + '">' + STATES[t.status].label + '</span>' +
            (t.status === "andamento" ? '<span class="badge ' + (stalled ? 'badge--loss' : 'badge--azure') + ' badge--dot">' + u.dur(open) + ' / ' + LIMIT() + 'h</span>' : '') +
          '</div>' +
        '</div>' +
        (stalled ? '<div class="est__flag">' + u.icon("alert", 16) + ' Esta tese passou das ' + LIMIT() + 'h em andamento. O Oráculo recomenda concluir ou arquivar antes de abrir novas.</div>' : '') +
        '<div class="card est__timeline-card">' +
          '<div class="card__head"><span class="card__title">Evolução da tese</span>' +
            '<button class="btn btn--ghost" data-edit>' + u.icon("edit", 14) + ' Editar</button></div>' +
          '<div class="timeline">' + timeline + '</div>' +
          '<div class="est__compose">' +
            '<textarea class="textarea" data-note placeholder="Registrar nova visão sobre ' + u.escape(t.asset) + '…"></textarea>' +
            '<button class="btn btn--accent" data-add>' + u.icon("plus", 15) + ' Registrar visão</button>' +
          '</div>' +
        '</div>' +
        versions +
        '<div class="est__actions">' + actions +
          '<button class="btn btn--ghost est__danger" data-del>' + u.icon("trash", 15) + ' Excluir</button>' +
        '</div>' +
      '</div>';

    mount.querySelector("[data-back]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-edit]").addEventListener("click", function () { editId = t.id; show("form"); });
    var ta = mount.querySelector("[data-note]");
    mount.querySelector("[data-add]").addEventListener("click", function () {
      var v = ta.value.trim(); if (!v) { ta.focus(); return; }
      app.addStudyUpdate(t.id, v); // dispara re-render via subscribe
    });
    mount.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = b.dataset.act;
        if (target === "concluida") {
          if (!window.confirm("Concluir fecha a versão " + t.version + " e envia a tese automaticamente para o Academy. Continuar?")) return;
          app.setStudyState(t.id, "concluido");
          show("list");
          return;
        }
        if (target === "arquivada") { window.AtlasTheses.archive(t.id); return; }
        app.setStudyState(t.id, target === "andamento" ? "andamento" : target);
      });
    });
    mount.querySelector("[data-del]").addEventListener("click", function () {
      if (window.confirm("Excluir esta tese apaga também o histórico e as versões. Esta ação não pode ser desfeita. Excluir?")) {
        app.removeStudy(t.id); show("list");
      }
    });
    var rdBtn = mount.querySelector("[data-rd]");
    if (rdBtn) rdBtn.addEventListener("click", function () {
      if (ATLAS.rd) ATLAS.rd.request({ studyId: t.id });
      ATLAS.router.go("rd");
    });
  }

  // ---------- FORMULÁRIO (nova / editar meta) ----------
  function renderForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var t = editId ? getThesis(editId) : null;
    var titleTxt = t ? "Editar tese" : "Nova tese";

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">Pesquisa e decisão</span><h1>' + titleTxt + '</h1></div></div>' +
        '<div class="card est__form-card">' +
          '<div class="field-row">' +
            '<label class="field field--sm"><span>Ativo</span>' +
              '<input class="input" data-f="asset" placeholder="Ex.: BTC" value="' + (t ? u.escape(t.asset) : "") + '" maxlength="12"></label>' +
            '<label class="field"><span>Título da tese</span>' +
              '<input class="input" data-f="title" placeholder="Ex.: Rompimento da máxima semanal" value="' + (t ? u.escape(t.title) : "") + '"></label>' +
          '</div>' +
          (t ? '' :
          '<label class="field"><span>Status inicial</span>' +
            '<div class="seg" data-f="state">' +
              '<button type="button" class="seg__opt" data-v="futuro" aria-current="true">Planejada (fila)</button>' +
              '<button type="button" class="seg__opt" data-v="andamento" aria-current="false">Em andamento</button>' +
            '</div></label>' +
          '<label class="field"><span>Tese inicial <small>(opcional)</small></span>' +
            '<textarea class="textarea" data-f="thesis" placeholder="Qual é a sua visão inicial sobre este ativo?"></textarea></label>') +
          '<div class="form-actions">' +
            '<button class="btn btn--accent" data-save>' + u.icon("check", 15) + (t ? ' Salvar' : ' Criar tese') + '</button>' +
            '<button class="btn btn--ghost" data-cancel>Cancelar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var chosenState = "futuro";
    mount.querySelectorAll(".seg__opt").forEach(function (o) {
      o.addEventListener("click", function () {
        chosenState = o.dataset.v;
        mount.querySelectorAll(".seg__opt").forEach(function (x) { x.setAttribute("aria-current", x === o); });
      });
    });

    function val(f) { var e = mount.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ""; }

    // Autocomplete de ativos (CoinGecko)
    if (window.AtlasAssets) {
      var assetInput = mount.querySelector('[data-f="asset"]');
      if (assetInput) AtlasAssets.attach(assetInput, { value: "symbol" });
    }

    mount.querySelector("[data-back]").addEventListener("click", function () { show(t ? "detail" : "list"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show(t ? "detail" : "list"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var asset = val("asset"), title = val("title");
      if (!asset || !title) { window.alert("Informe o ativo e o título da tese."); return; }
      if (t) {
        app.updateStudyMeta(t.id, { asset: asset, title: title });
        selectedId = t.id; show("detail");
      } else {
        var created = app.addStudy({ asset: asset, title: title, state: chosenState, thesis: val("thesis") });
        selectedId = created.id; show("detail");
      }
    });
  }

  // ---------- dispatcher ----------
  function render(mount) {
    mountRef = mount;
    if (pendingOpen) { selectedId = pendingOpen; pendingOpen = null; view = "detail"; }
    if (view === "detail") return renderDetail(mount);
    if (view === "form") return renderForm(mount);
    return renderList(mount);
  }

  ATLAS.router.register("teses", { label: "Teses", icon: "estudos", render: render });

  // Pedido externo (ex.: clique no Dashboard) para abrir uma tese específica
  ATLAS.teses = { request: function (id) { pendingOpen = id; } };
  ATLAS.estudos = ATLAS.teses; // compat com chamadas antigas

  // Re-render quando dados mudam estando no módulo
  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() !== "teses" || !mountRef) return;
    if (view === "detail" && !getThesis(selectedId)) view = "list";
    render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
