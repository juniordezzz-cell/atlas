/* ============================================================
   ATLAS — Módulo Estudos (Sprint 2)
   ------------------------------------------------------------
   Onde todo trade nasce. Estados (futuro · em andamento ·
   concluído), fila de pesquisas, regra das 72h e o HISTÓRICO
   de evolução da tese preservado ao longo do tempo.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function LIMIT() { return ATLAS.app.pref("studyLimitH") || 72; } // horas
  var mountRef = null;
  var view = "list";      // list | detail | form
  var selectedId = null;
  var editId = null;
  var filter = "todos";   // todos | futuro | andamento | concluido
  var pendingOpen = null; // pedido vindo de outra tela (ex.: Dashboard)

  var STATES = {
    futuro:    { label: "Futuro",       badge: "badge--azure" },
    andamento: { label: "Em andamento", badge: "badge--warn" },
    concluido: { label: "Concluído",    badge: "badge--profit" }
  };

  // ---------- helpers de render ----------
  function isStalled(s) { return s.state === "andamento" && ATLAS.app.studyOpenHours(s) > LIMIT(); }

  function show(v) { view = v; render(mountRef); }

  // ---------- LISTA ----------
  function renderList(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var all = app.studies();
    var list = filter === "todos" ? all : all.filter(function (s) { return s.state === filter; });

    var counts = {
      todos: all.length,
      futuro: all.filter(function (s) { return s.state === "futuro"; }).length,
      andamento: all.filter(function (s) { return s.state === "andamento"; }).length,
      concluido: all.filter(function (s) { return s.state === "concluido"; }).length
    };
    var tabs = [["todos", "Todos"], ["futuro", "Futuros"], ["andamento", "Em andamento"], ["concluido", "Concluídos"]]
      .map(function (t) {
        return '<button class="est__tab" data-filter="' + t[0] + '" aria-current="' + (filter === t[0]) + '">' +
          t[1] + '<span class="est__tab-n">' + counts[t[0]] + '</span></button>';
      }).join("");

    var cards = list.length ? list.map(function (s) {
      var open = app.studyOpenHours(s), stalled = isStalled(s);
      return '<button class="est__card" data-open="' + s.id + '">' +
        '<div class="est__card-top">' +
          '<span class="est__ticker">' + u.escape(s.asset) + '</span>' +
          '<span class="badge ' + STATES[s.state].badge + '">' + STATES[s.state].label + '</span>' +
        '</div>' +
        '<b class="est__card-title">' + u.escape(s.title) + '</b>' +
        '<p class="est__card-thesis">' + u.escape(s.thesis || "Sem tese registrada.") + '</p>' +
        '<div class="est__card-foot">' +
          '<span class="est__meta">' + u.icon("clock", 13) + (s.state === "andamento" ? u.dur(open) + " aberto" : "atualizado " + u.ago(s.updatedAt)) + '</span>' +
          (stalled ? '<span class="badge badge--loss badge--dot">Parado</span>' : '') +
        '</div>' +
      '</button>';
    }).join("") :
      '<div class="empty" style="min-height:38vh"><div class="empty__glyph">' + u.icon("flask", 28) + '</div>' +
      '<h2 style="font-size:1.2rem">Nada aqui ainda</h2><p>Nenhum estudo neste filtro. Comece um novo estudo — todo trade nasce daqui.</p></div>';

    mount.innerHTML =
      '<div class="estudos">' +
        '<div class="est__head reveal">' +
          '<div><span class="eyebrow">Pesquisa e teses</span><h1>Estudos</h1></div>' +
          '<button class="btn btn--accent" data-new>' + u.icon("plus", 16) + ' Novo estudo</button>' +
        '</div>' +
        '<div class="est__filters reveal">' + tabs + '</div>' +
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
    var s = app.getStudy(selectedId);
    if (!s) { show("list"); return; }
    var open = app.studyOpenHours(s), stalled = isStalled(s);

    var timeline = s.history.slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (h, i, arr) {
      var latest = i === arr.length - 1;
      return '<div class="tl__item' + (latest ? ' tl__item--now' : '') + '">' +
        '<span class="tl__dot"></span>' +
        '<div class="tl__body"><span class="tl__time">' + u.dateTime(h.ts) + (latest ? ' · tese atual' : '') + '</span>' +
        '<p class="tl__text">' + u.escape(h.text) + '</p></div></div>';
    }).join("") || '<p class="tl__empty">Ainda sem registros. Adicione a primeira visão abaixo.</p>';

    // Ações conforme estado
    var actions = "";
    if (s.state === "futuro")    actions += '<button class="btn btn--accent" data-act="andamento">' + u.icon("play", 15) + ' Iniciar estudo</button>';
    if (s.state === "andamento") actions += '<button class="btn btn--profit" data-act="concluido">' + u.icon("check", 15) + ' Concluir</button>';
    if (s.state === "concluido") {
      actions += '<button class="btn" data-act="andamento">' + u.icon("play", 15) + ' Reabrir</button>';
      actions += '<button class="btn btn--accent" data-rd>' + u.icon("rd", 15) + ' Criar RD</button>';
    }

    mount.innerHTML =
      '<div class="estudos est__detail reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Estudos</button>' +
        '<div class="est__detail-head">' +
          '<div class="est__detail-title">' +
            '<span class="est__ticker est__ticker--lg">' + u.escape(s.asset) + '</span>' +
            '<div><h1>' + u.escape(s.title) + '</h1>' +
            '<span class="est__sub">Criado ' + u.ago(s.createdAt) + ' · atualizado ' + u.ago(s.updatedAt) + '</span></div>' +
          '</div>' +
          '<div class="est__detail-badges">' +
            '<span class="badge ' + STATES[s.state].badge + '">' + STATES[s.state].label + '</span>' +
            (s.state === "andamento" ? '<span class="badge ' + (stalled ? 'badge--loss' : 'badge--azure') + ' badge--dot">' + u.dur(open) + ' / ' + LIMIT() + 'h</span>' : '') +
          '</div>' +
        '</div>' +
        (stalled ? '<div class="est__flag">' + u.icon("alert", 16) + ' Este estudo passou das ' + LIMIT() + 'h em andamento. O Oráculo recomenda concluir ou arquivar antes de abrir novos.</div>' : '') +
        '<div class="card est__timeline-card">' +
          '<div class="card__head"><span class="card__title">Evolução da tese</span>' +
            '<button class="btn btn--ghost" data-edit>' + u.icon("edit", 14) + ' Editar</button></div>' +
          '<div class="timeline">' + timeline + '</div>' +
          '<div class="est__compose">' +
            '<textarea class="textarea" data-note placeholder="Registrar nova visão sobre ' + u.escape(s.asset) + '…"></textarea>' +
            '<button class="btn btn--accent" data-add>' + u.icon("plus", 15) + ' Registrar visão</button>' +
          '</div>' +
        '</div>' +
        '<div class="est__actions">' + actions +
          '<button class="btn btn--ghost est__danger" data-del>' + u.icon("trash", 15) + ' Excluir</button>' +
        '</div>' +
      '</div>';

    mount.querySelector("[data-back]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-edit]").addEventListener("click", function () { editId = s.id; show("form"); });
    var ta = mount.querySelector("[data-note]");
    mount.querySelector("[data-add]").addEventListener("click", function () {
      var v = ta.value.trim(); if (!v) { ta.focus(); return; }
      app.addStudyUpdate(s.id, v); // dispara re-render via subscribe
    });
    mount.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () { app.setStudyState(s.id, b.dataset.act); });
    });
    mount.querySelector("[data-del]").addEventListener("click", function () {
      if (window.confirm("Excluir este estudo? Esta ação não pode ser desfeita.")) {
        app.removeStudy(s.id); show("list");
      }
    });
    var rdBtn = mount.querySelector("[data-rd]");
    if (rdBtn) rdBtn.addEventListener("click", function () {
      if (ATLAS.rd) ATLAS.rd.request({ studyId: s.id });
      ATLAS.router.go("rd");
    });
  }

  // ---------- FORMULÁRIO (novo / editar meta) ----------
  function renderForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var s = editId ? app.getStudy(editId) : null;
    var titleTxt = s ? "Editar estudo" : "Novo estudo";

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">Pesquisa</span><h1>' + titleTxt + '</h1></div></div>' +
        '<div class="card est__form-card">' +
          '<div class="field-row">' +
            '<label class="field field--sm"><span>Ativo</span>' +
              '<input class="input" data-f="asset" placeholder="Ex.: BTC" value="' + (s ? u.escape(s.asset) : "") + '" maxlength="12"></label>' +
            '<label class="field"><span>Título do estudo</span>' +
              '<input class="input" data-f="title" placeholder="Ex.: Rompimento da máxima semanal" value="' + (s ? u.escape(s.title) : "") + '"></label>' +
          '</div>' +
          (s ? '' :
          '<label class="field"><span>Estado inicial</span>' +
            '<div class="seg" data-f="state">' +
              '<button type="button" class="seg__opt" data-v="futuro" aria-current="true">Futuro (fila)</button>' +
              '<button type="button" class="seg__opt" data-v="andamento" aria-current="false">Em andamento</button>' +
            '</div></label>' +
          '<label class="field"><span>Tese inicial <small>(opcional)</small></span>' +
            '<textarea class="textarea" data-f="thesis" placeholder="Qual é a sua visão inicial sobre este ativo?"></textarea></label>') +
          '<div class="form-actions">' +
            '<button class="btn btn--accent" data-save>' + u.icon("check", 15) + (s ? ' Salvar' : ' Criar estudo') + '</button>' +
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

    mount.querySelector("[data-back]").addEventListener("click", function () { show(s ? "detail" : "list"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show(s ? "detail" : "list"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var asset = val("asset"), title = val("title");
      if (!asset || !title) { window.alert("Informe o ativo e o título do estudo."); return; }
      if (s) {
        app.updateStudyMeta(s.id, { asset: asset, title: title });
        selectedId = s.id; show("detail");
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

  ATLAS.router.register("estudos", { label: "Estudos", icon: "estudos", render: render });

  // Pedido externo (ex.: clique no Dashboard) para abrir um estudo específico
  ATLAS.estudos = {
    request: function (id) { pendingOpen = id; }
  };

  // Ao trocar de carteira estando no módulo, volta pra lista (dados mudam)
  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() !== "estudos" || !mountRef) return;
    if (view === "detail" && !ATLAS.app.getStudy(selectedId)) view = "list";
    render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
