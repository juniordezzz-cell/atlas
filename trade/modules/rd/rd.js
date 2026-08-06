/* ============================================================
   ATLAS — Módulo Registro de Decisão (Sprint 3)
   ------------------------------------------------------------
   O elo entre a tese e a execução. Documenta racionalmente a
   decisão de ENTRAR ou NÃO ENTRAR: motivo, confiança, justificativa
   técnica, gestão de risco, alavancagem e observações.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var mountRef = null;
  var view = "list";       // list | detail | form
  var selectedId = null;
  var editId = null;
  var filter = "todos";    // todos | entrar | nao_entrar
  var pending = null;      // pedido externo: { studyId }

  var DECISION = {
    entrar:     { label: "Entrar",     badge: "badge--profit" },
    nao_entrar: { label: "Não entrar", badge: "badge--loss" }
  };

  function show(v) { view = v; render(mountRef); }
  function studyLabel(s) { return s ? (s.asset + " · " + s.title) : null; }

  function confidenceDots(n, interactive) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      var on = i <= n;
      out += '<span class="conf__dot' + (on ? ' conf__dot--on' : '') + '"' +
        (interactive ? ' data-conf="' + i + '" role="button"' : '') + '></span>';
    }
    return '<span class="conf' + (interactive ? ' conf--edit' : '') + '">' + out + '</span>';
  }

  // ---------- LISTA ----------
  function renderList(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var all = app.rds();
    var list = filter === "todos" ? all : all.filter(function (r) { return r.decision === filter; });

    var counts = {
      todos: all.length,
      entrar: all.filter(function (r) { return r.decision === "entrar"; }).length,
      nao_entrar: all.filter(function (r) { return r.decision === "nao_entrar"; }).length
    };
    var tabs = [["todos", "Todos"], ["entrar", "Entrar"], ["nao_entrar", "Não entrar"]]
      .map(function (t) {
        return '<button class="est__tab" data-filter="' + t[0] + '" aria-current="' + (filter === t[0]) + '">' +
          t[1] + '<span class="est__tab-n">' + counts[t[0]] + '</span></button>';
      }).join("");

    var awaiting = app.studiesAwaitingRd();
    var banner = awaiting.length ?
      '<div class="rd__banner">' + u.icon("alert", 16) +
      '<span>' + awaiting.length + ' tese(s) concluída(s) aguardando decisão: <b>' +
      awaiting.map(function (s) { return u.escape(s.asset); }).join(", ") + '</b></span>' +
      '<button class="btn btn--accent" data-new>' + u.icon("plus", 15) + ' Registrar decisão</button></div>' : '';

    var cards = list.length ? list.map(function (r) {
      var s = r.studyId ? app.getStudy(r.studyId) : null;
      return '<button class="est__card rd__card" data-open="' + r.id + '">' +
        '<div class="est__card-top">' +
          '<span class="est__ticker">' + u.escape(r.asset) + '</span>' +
          '<span class="badge ' + DECISION[r.decision].badge + '">' + DECISION[r.decision].label + '</span>' +
        '</div>' +
        '<div class="rd__card-conf">' + confidenceDots(r.confidence, false) + '<span class="rd__conf-lbl">confiança</span></div>' +
        '<p class="est__card-thesis">' + u.escape(r.rationale || "Sem racional registrado.") + '</p>' +
        '<div class="est__card-foot">' +
          '<span class="est__meta">' + u.icon(s ? "flask" : "dot", 13) + (s ? u.escape(studyLabel(s)) : "avulso") + '</span>' +
          (r.status === "convertido" ? '<span class="badge badge--azure badge--dot">Virou trade</span>' : '') +
        '</div>' +
      '</button>';
    }).join("") :
      '<div class="empty" style="min-height:34vh"><div class="empty__glyph">' + u.icon("rd", 28) + '</div>' +
      '<h2 style="font-size:1.2rem">Nenhum registro ainda</h2><p>O RD documenta por que você entra — ou não — em uma operação. Toda entrada passa por aqui.</p></div>';

    mount.innerHTML =
      '<div class="estudos">' +
        '<div class="est__head reveal">' +
          '<div><span class="eyebrow">Decisão documentada</span><h1>Registro de Decisão</h1></div>' +
          '<button class="btn btn--accent" data-new>' + u.icon("plus", 16) + ' Novo RD</button>' +
        '</div>' +
        banner +
        '<div class="est__filters reveal">' + tabs + '</div>' +
        '<div class="est__list reveal">' + cards + '</div>' +
      '</div>';

    mount.querySelectorAll("[data-new]").forEach(function (b) {
      b.addEventListener("click", function () { editId = null; pending = null; show("form"); });
    });
    mount.querySelectorAll("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.dataset.filter; render(mount); });
    });
    mount.querySelectorAll("[data-open]").forEach(function (c) {
      c.addEventListener("click", function () { selectedId = c.dataset.open; show("detail"); });
    });
  }

  // ---------- DETALHE ----------
  function field(label, value) {
    if (!value) return "";
    return '<div class="rd__field"><span class="rd__field-lbl">' + label + '</span>' +
      '<p class="rd__field-val">' + ATLAS.util.escape(value) + '</p></div>';
  }

  function renderDetail(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var r = app.getRd(selectedId);
    if (!r) { show("list"); return; }
    var s = r.studyId ? app.getStudy(r.studyId) : null;
    var rationaleLabel = r.decision === "entrar" ? "Por que entrar" : "Por que não entrar";

    var riskBits = [];
    if (r.risk.stop) riskBits.push('<div class="rd__risk-cell"><span>Stop</span><b class="mono">' + u.escape(r.risk.stop) + '</b></div>');
    if (r.risk.size) riskBits.push('<div class="rd__risk-cell"><span>Tamanho</span><b class="mono">' + u.escape(r.risk.size) + '</b></div>');
    if (r.risk.rr)   riskBits.push('<div class="rd__risk-cell"><span>Risco/Retorno</span><b class="mono">' + u.escape(r.risk.rr) + '</b></div>');
    if (r.leverage)  riskBits.push('<div class="rd__risk-cell"><span>Alavancagem</span><b class="mono">' + u.escape(r.leverage) + '</b></div>');

    mount.innerHTML =
      '<div class="estudos est__detail reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Registros de Decisão</button>' +
        '<div class="est__detail-head">' +
          '<div class="est__detail-title">' +
            '<span class="est__ticker est__ticker--lg">' + u.escape(r.asset) + '</span>' +
            '<div><h1>Decisão: ' + DECISION[r.decision].label + '</h1>' +
            '<span class="est__sub">Registrado ' + u.ago(r.createdAt) +
              (s ? ' · a partir da tese de ' + u.escape(s.asset) : ' · avulso') + '</span></div>' +
          '</div>' +
          '<div class="est__detail-badges">' +
            '<span class="badge ' + DECISION[r.decision].badge + '">' + DECISION[r.decision].label + '</span>' +
            (r.status === "convertido" ? '<span class="badge badge--azure badge--dot">Virou trade</span>' : '') +
          '</div>' +
        '</div>' +

        '<div class="rd__grid">' +
          '<div class="card rd__main">' +
            '<div class="rd__conf-row"><span class="rd__field-lbl">Confiança da operação</span>' +
              confidenceDots(r.confidence, false) + '<span class="rd__conf-num mono">' + r.confidence + '/5</span></div>' +
            field(rationaleLabel, r.rationale) +
            field("Justificativa técnica", r.technical) +
            field("Observações", r.notes) +
          '</div>' +
          '<div class="rd__side">' +
            (riskBits.length ? '<div class="card"><div class="card__head"><span class="card__title">Gestão de risco</span></div>' +
              '<div class="rd__risk">' + riskBits.join("") + '</div></div>' : '') +
            (s ? '<button class="card rd__studylink" data-study="' + s.id + '">' +
              '<span class="rd__field-lbl">Tese de origem</span>' +
              '<b>' + u.escape(s.title) + '</b><span class="est__meta">' + u.icon("flask", 13) + u.escape(s.asset) + ' · ver tese →</span></button>' : '') +
          '</div>' +
        '</div>' +

        '<div class="est__actions">' +
          (r.decision === "entrar" ? '<button class="btn btn--profit" data-trade>' + u.icon("trades", 15) + ' Executar trade</button>' : '') +
          '<button class="btn" data-edit>' + u.icon("edit", 15) + ' Editar</button>' +
          '<button class="btn btn--ghost est__danger" data-del>' + u.icon("trash", 15) + ' Excluir</button>' +
        '</div>' +
      '</div>';

    mount.querySelector("[data-back]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-edit]").addEventListener("click", function () { editId = r.id; show("form"); });
    mount.querySelector("[data-del]").addEventListener("click", function () {
      if (window.confirm("Excluir este registro de decisão?")) { app.removeRd(r.id); show("list"); }
    });
    var sl = mount.querySelector("[data-study]");
    if (sl) sl.addEventListener("click", function () {
      if (ATLAS.estudos) ATLAS.estudos.request(sl.dataset.study);
      ATLAS.router.go("teses");
    });
    var tb = mount.querySelector("[data-trade]");
    if (tb) tb.addEventListener("click", function () {
      var linked = app.trades().filter(function (t) { return t.rdId === r.id; })[0];
      if (linked) { if (ATLAS.trades) ATLAS.trades.openDetail(linked.id); }
      else { if (ATLAS.trades) ATLAS.trades.request({ rdId: r.id }); }
      ATLAS.router.go("trades");
    });
  }

  // ---------- FORMULÁRIO ----------
  function renderForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var r = editId ? app.getRd(editId) : null;
    var prefillStudy = pending && pending.studyId ? pending.studyId : (r ? r.studyId : null);
    var studies = app.studies();

    var stateObj = {
      studyId: prefillStudy,
      decision: r ? r.decision : "entrar",
      confidence: r ? r.confidence : 3
    };

    var studyOpts = '<option value="">Sem tese (avulso)</option>' + studies.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === prefillStudy ? " selected" : "") + '>' + u.escape(studyLabel(s)) + '</option>';
    }).join("");

    var preAsset = r ? r.asset : (prefillStudy && app.getStudy(prefillStudy) ? app.getStudy(prefillStudy).asset : "");

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">Decisão</span><h1>' + (r ? "Editar RD" : "Novo Registro de Decisão") + '</h1></div></div>' +
        '<div class="card est__form-card">' +

          '<div class="field-row">' +
            '<label class="field"><span>Tese de origem</span>' +
              '<select class="input" data-f="studyId">' + studyOpts + '</select></label>' +
            '<label class="field field--sm"><span>Ativo</span>' +
              '<input class="input" data-f="asset" placeholder="BTC" value="' + u.escape(preAsset) + '" maxlength="12"></label>' +
          '</div>' +

          '<label class="field"><span>Decisão</span>' +
            '<div class="seg" data-f="decision">' +
              '<button type="button" class="seg__opt" data-v="entrar" aria-current="' + (stateObj.decision === "entrar") + '">Entrar</button>' +
              '<button type="button" class="seg__opt" data-v="nao_entrar" aria-current="' + (stateObj.decision === "nao_entrar") + '">Não entrar</button>' +
            '</div></label>' +

          '<label class="field"><span>Confiança da operação</span>' +
            confidenceDots(stateObj.confidence, true) + '</label>' +

          '<label class="field"><span data-rationale-lbl>' + (stateObj.decision === "entrar" ? "Por que entrar" : "Por que não entrar") + '</span>' +
            '<textarea class="textarea" data-f="rationale" placeholder="Racional da decisão…">' + (r ? u.escape(r.rationale) : "") + '</textarea></label>' +

          '<label class="field"><span>Justificativa técnica</span>' +
            '<textarea class="textarea" data-f="technical" placeholder="Estrutura, níveis, confluências…">' + (r ? u.escape(r.technical) : "") + '</textarea></label>' +

          '<div class="field-row">' +
            '<label class="field"><span>Stop</span><input class="input" data-f="stop" placeholder="Ex.: 60.2k" value="' + (r ? u.escape(r.risk.stop) : "") + '"></label>' +
            '<label class="field"><span>Tamanho</span><input class="input" data-f="size" placeholder="Ex.: 2% da banca" value="' + (r ? u.escape(r.risk.size) : "") + '"></label>' +
            '<label class="field"><span>Risco/Retorno</span><input class="input" data-f="rr" placeholder="Ex.: 1:3" value="' + (r ? u.escape(r.risk.rr) : "") + '"></label>' +
            '<label class="field field--sm"><span>Alavancagem</span><input class="input" data-f="leverage" placeholder="Ex.: 2x" value="' + (r ? u.escape(r.leverage) : "") + '"></label>' +
          '</div>' +

          '<label class="field"><span>Observações <small>(opcional)</small></span>' +
            '<textarea class="textarea" data-f="notes" placeholder="Invalidação, contexto, lembretes…">' + (r ? u.escape(r.notes) : "") + '</textarea></label>' +

          '<div class="form-actions">' +
            '<button class="btn btn--accent" data-save>' + u.icon("check", 15) + (r ? " Salvar" : " Registrar decisão") + '</button>' +
            '<button class="btn btn--ghost" data-cancel>Cancelar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    pending = null; // consumido

    // decisão (segmentado) + label do racional
    mount.querySelectorAll('[data-f="decision"] .seg__opt').forEach(function (o) {
      o.addEventListener("click", function () {
        stateObj.decision = o.dataset.v;
        mount.querySelectorAll('[data-f="decision"] .seg__opt').forEach(function (x) { x.setAttribute("aria-current", x === o); });
        mount.querySelector("[data-rationale-lbl]").textContent = stateObj.decision === "entrar" ? "Por que entrar" : "Por que não entrar";
      });
    });
    // confiança
    mount.querySelectorAll("[data-conf]").forEach(function (d) {
      d.addEventListener("click", function () {
        stateObj.confidence = parseInt(d.dataset.conf, 10);
        mount.querySelectorAll("[data-conf]").forEach(function (x) {
          x.classList.toggle("conf__dot--on", parseInt(x.dataset.conf, 10) <= stateObj.confidence);
        });
      });
    });
    // tese -> auto-preenche ativo
    var sel = mount.querySelector('[data-f="studyId"]');
    sel.addEventListener("change", function () {
      var s = app.getStudy(sel.value);
      if (s) mount.querySelector('[data-f="asset"]').value = s.asset;
    });

    function val(f) { var e = mount.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ""; }

    // Autocomplete de ativos (CoinGecko)
    if (window.AtlasAssets) {
      var assetInput = mount.querySelector('[data-f="asset"]');
      if (assetInput) AtlasAssets.attach(assetInput, { value: "symbol" });
    }

    mount.querySelector("[data-back]").addEventListener("click", function () { show(r ? "detail" : "list"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show(r ? "detail" : "list"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var asset = val("asset");
      if (!asset) { window.alert("Informe o ativo da operação."); return; }
      if (!val("rationale")) { window.alert("Registre o racional da decisão."); return; }
      var payload = {
        studyId: val("studyId") || null,
        asset: asset,
        decision: stateObj.decision,
        confidence: stateObj.confidence,
        rationale: val("rationale"),
        technical: val("technical"),
        risk: { stop: val("stop"), size: val("size"), rr: val("rr") },
        leverage: val("leverage"),
        notes: val("notes")
      };
      if (r) { app.updateRd(r.id, payload); selectedId = r.id; }
      else { selectedId = app.addRd(payload).id; }
      show("detail");
    });
  }

  // ---------- dispatcher ----------
  function render(mount) {
    mountRef = mount;
    if (pending && pending.studyId && view === "list") { editId = null; view = "form"; }
    if (view === "detail") return renderDetail(mount);
    if (view === "form") return renderForm(mount);
    return renderList(mount);
  }

  ATLAS.router.register("rd", { label: "Registro de Decisão", icon: "rd", render: render });

  // Pedido externo (ex.: "Criar RD" no detalhe de uma tese)
  ATLAS.rd = {
    request: function (opts) { pending = opts || {}; view = "form"; editId = null; },
    openDetail: function (id) { selectedId = id; view = "detail"; }
  };

  // Troca de carteira estando no módulo → volta pra lista
  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() !== "rd" || !mountRef) return;
    if (view === "detail" && !ATLAS.app.getRd(selectedId)) view = "list";
    render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
