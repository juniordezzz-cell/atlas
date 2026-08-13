/* ============================================================
   ATLAS — Módulo Trades (Sprint 4)
   ------------------------------------------------------------
   A execução, que nasce de um RD "Entrar". Acompanha entrada,
   parciais, stop, gerenciamento e encerramento com resultado.
   Trades abertos há tempo demais entram no radar do Oráculo.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function REVIEW_H() { return ATLAS.app.pref("tradeReviewH") || 24; }
  var mountRef = null;
  var view = "list";        // list | detail | openForm | closeForm
  var selectedId = null;
  var filter = "abertos";   // abertos | encerrados | todos
  var pending = null;       // { rdId } vindo do módulo RD

  var STATUS = { aberto: { label: "Aberto", badge: "badge--azure" }, encerrado: { label: "Encerrado", badge: "badge--profit" } };
  var EVENT = {
    abertura:     { label: "Abertura",     color: "var(--azure)" },
    parcial:      { label: "Parcial",      color: "var(--cyan)" },
    gerenciamento:{ label: "Gerenciamento",color: "var(--warn)" },
    nota:         { label: "Nota",         color: "var(--text-mut)" },
    encerramento: { label: "Encerramento", color: "var(--profit)" }
  };

  function show(v) { view = v; render(mountRef); }
  function num(v) { return (v == null || v === "") ? "—" : v; }
  function sideBadge(side) {
    return side === "long"
      ? '<span class="badge badge--profit badge--dot">Long</span>'
      : '<span class="badge badge--loss badge--dot">Short</span>';
  }
  function pendingRds() {
    return ATLAS.app.rds().filter(function (r) { return r.decision === "entrar" && r.status !== "convertido"; });
  }

  // ---------- LISTA ----------
  function renderList(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var all = app.trades();
    var list = filter === "todos" ? all : all.filter(function (t) {
      return filter === "abertos" ? t.status === "aberto" : t.status === "encerrado";
    });

    var counts = {
      todos: all.length,
      abertos: all.filter(function (t) { return t.status === "aberto"; }).length,
      encerrados: all.filter(function (t) { return t.status === "encerrado"; }).length
    };
    var tabs = [["abertos", "Abertos"], ["encerrados", "Encerrados"], ["todos", "Todos"]]
      .map(function (t) {
        return '<button class="est__tab" data-filter="' + t[0] + '" aria-current="' + (filter === t[0]) + '">' +
          t[1] + '<span class="est__tab-n">' + counts[t[0]] + '</span></button>';
      }).join("");

    var pend = pendingRds();
    var banner = pend.length ?
      '<div class="rd__banner">' + u.icon("rd", 16) +
      '<span>' + pend.length + ' decisão(ões) de <b>Entrar</b> aguardando execução: <b>' +
      pend.map(function (r) { return u.escape(r.asset); }).join(", ") + '</b></span>' +
      '<button class="btn btn--accent" data-exec="' + pend[0].id + '">' + u.icon("trades", 15) + ' Executar</button></div>' : '';

    var cards = list.length ? list.map(function (t) {
      var up = t.pnl >= 0, age = app.tradeAgeHours(t), stale = t.status === "aberto" && age > REVIEW_H();
      return '<button class="est__card tr__card" data-open="' + t.id + '">' +
        '<div class="est__card-top"><span class="est__ticker">' + u.escape(t.asset) + '</span>' + sideBadge(t.side) + '</div>' +
        '<div class="tr__card-pnl mono ' + (up ? 'up' : 'down') + '">' + u.pct(t.pnl) + '</div>' +
        '<div class="tr__card-nums"><span>Entrada <b class="mono">' + num(t.entry) + '</b></span>' +
          '<span>Stop <b class="mono">' + num(t.stop) + '</b></span>' +
          '<span>' + (t.leverage ? 'Alav. <b class="mono">' + u.escape(t.leverage) + '</b>' : '') + '</span></div>' +
        '<div class="est__card-foot">' +
          '<span class="est__meta">' + u.icon("clock", 13) + (t.status === "aberto" ? u.dur(age) + " aberto" : "encerrado " + u.ago(t.closedAt)) + '</span>' +
          '<span class="badge ' + STATUS[t.status].badge + '">' + STATUS[t.status].label + '</span>' +
          (stale ? '<span class="badge badge--loss badge--dot">Revisar</span>' : '') +
        '</div>' +
      '</button>';
    }).join("") :
      '<div class="empty" style="min-height:34vh"><div class="empty__glyph">' + u.icon("trades", 28) + '</div>' +
      '<h2 style="font-size:1.2rem">Nenhum trade aqui</h2><p>Todo trade nasce de um Registro de Decisão. Aprove um RD "Entrar" e execute a partir dele.</p></div>';

    mount.innerHTML =
      '<div class="estudos">' +
        '<div class="est__head reveal">' +
          '<div><span class="eyebrow">Execução</span><h1>Trades</h1></div>' +
          '<button class="btn btn--accent" data-new>' + u.icon("plus", 16) + ' Novo trade</button>' +
        '</div>' + banner +
        '<div class="est__filters reveal">' + tabs + '</div>' +
        '<div class="est__list reveal">' + cards + '</div>' +
      '</div>';

    mount.querySelector("[data-new]").addEventListener("click", function () { pending = null; show("openForm"); });
    mount.querySelectorAll("[data-filter]").forEach(function (b) { b.addEventListener("click", function () { filter = b.dataset.filter; render(mount); }); });
    mount.querySelectorAll("[data-open]").forEach(function (c) { c.addEventListener("click", function () { selectedId = c.dataset.open; show("detail"); }); });
    var ex = mount.querySelector("[data-exec]");
    if (ex) ex.addEventListener("click", function () { pending = { rdId: ex.dataset.exec }; show("openForm"); });
  }

  // ---------- DETALHE ----------
  function statCell(label, value, cls) {
    return '<div class="tr__stat"><span>' + label + '</span><b class="mono ' + (cls || "") + '">' + value + '</b></div>';
  }

  function renderDetail(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var t = app.getTrade(selectedId);
    if (!t) { show("list"); return; }
    var up = t.pnl >= 0, age = app.tradeAgeHours(t), stale = t.status === "aberto" && age > REVIEW_H();
    var rd = t.rdId ? app.getRd(t.rdId) : null;
    var s = t.studyId ? app.getStudy(t.studyId) : null;

    // Linha do tempo (eventos)
    var events = t.events.slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (e) {
      var meta = EVENT[e.type] || EVENT.nota;
      return '<div class="tl__item"><span class="tl__dot" style="background:' + meta.color + ';box-shadow:0 0 0 3px var(--bg-deep)"></span>' +
        '<div class="tl__body"><span class="tl__time">' + u.dateTime(e.ts) + ' · ' + meta.label + '</span>' +
        '<p class="tl__text">' + u.escape(e.text) + '</p></div></div>';
    }).join("");

    var partials = t.partials.length ? '<div class="tr__partials"><span class="rd__field-lbl">Parciais realizadas</span>' +
      t.partials.map(function (p) {
        return '<div class="tr__partial"><b class="mono">' + u.escape(p.portion || "—") + '</b>' +
          '<span class="mono">@ ' + u.escape(String(p.price)) + '</span>' +
          '<span class="tr__partial-note">' + u.escape(p.note || "") + '</span>' +
          '<span class="est__meta">' + u.ago(p.ts) + '</span></div>';
      }).join("") + '</div>' : "";

    // Gerenciamento (só se aberto)
    var manage = t.status === "aberto" ?
      '<div class="card tr__manage"><div class="card__head"><span class="card__title">Gerenciamento</span></div>' +
        '<div class="tr__manage-row"><input class="input" data-note placeholder="Anotação de acompanhamento…"><button class="btn" data-add-note>Anotar</button></div>' +
        '<div class="tr__manage-row"><input class="input" data-p-price placeholder="Preço"><input class="input" data-p-portion placeholder="Porção (ex.: 50%)"><button class="btn" data-add-partial>Registrar parcial</button></div>' +
        '<div class="tr__manage-row"><input class="input" data-stop placeholder="Novo stop"><button class="btn" data-move-stop>Mover stop</button></div>' +
        '<button class="btn btn--profit tr__close" data-close>' + u.icon("check", 15) + ' Encerrar trade</button>' +
      '</div>' : "";

    var ADH = { total: "Seguiu o plano", parcial: "Seguiu parcialmente", nenhuma: "Não seguiu o plano" };
    var review = "";
    if (t.status === "encerrado") {
      if (t.review) {
        var rv = t.review, dots = "";
        for (var di = 1; di <= 5; di++) dots += '<span class="conf__dot' + (di <= rv.discipline ? ' conf__dot--on' : '') + '"></span>';
        review = '<div class="card"><div class="card__head"><span class="card__title">Pós-análise</span><button class="btn btn--ghost" data-review>' + u.icon("edit", 14) + ' Editar</button></div>' +
          '<div class="rd__field"><span class="rd__field-lbl">Aderência ao plano</span><p class="rd__field-val">' + ADH[rv.adherence] + '</p></div>' +
          '<div class="rd__field"><span class="rd__field-lbl">Disciplina</span><span class="conf">' + dots + '</span></div>' +
          (rv.worked ? '<div class="rd__field"><span class="rd__field-lbl">O que funcionou</span><p class="rd__field-val">' + u.escape(rv.worked) + '</p></div>' : '') +
          (rv.failed ? '<div class="rd__field"><span class="rd__field-lbl">O que falhou</span><p class="rd__field-val">' + u.escape(rv.failed) + '</p></div>' : '') +
          (rv.lesson ? '<div class="rd__field"><span class="rd__field-lbl">Lição aprendida</span><p class="rd__field-val">' + u.escape(rv.lesson) + '</p></div>' : '') +
          (rv.tags && rv.tags.length ? '<div class="an__tags">' + rv.tags.map(function (tg) { return '<span class="badge badge--azure">' + u.escape(tg) + '</span>'; }).join("") + '</div>' : '') +
        '</div>';
      } else {
        review = '<div class="card tr__review-cta"><span class="rd__field-lbl">Pós-análise pendente</span>' +
          '<p class="kpi__sub">Avalie este trade para alimentar suas métricas e o aprendizado do Oráculo.</p>' +
          '<button class="btn btn--accent" data-review>' + u.icon("spark", 15) + ' Fazer pós-análise</button></div>';
      }
    }

    mount.innerHTML =
      '<div class="estudos est__detail reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Trades</button>' +
        '<div class="est__detail-head">' +
          '<div class="est__detail-title"><span class="est__ticker est__ticker--lg">' + u.escape(t.asset) + '</span>' +
            '<div><h1>' + (t.side === "long" ? "Long" : "Short") + ' · ' + u.escape(t.asset) + '</h1>' +
            '<span class="est__sub">Aberto ' + u.ago(t.openedAt) + (t.status === "encerrado" ? ' · encerrado ' + u.ago(t.closedAt) : ' · ' + u.dur(age) + ' em curso') + '</span></div></div>' +
          '<div class="est__detail-badges"><span class="tr__pnl-big mono ' + (up ? 'up' : 'down') + '">' + u.pct(t.pnl) + '</span>' +
            '<span class="badge ' + STATUS[t.status].badge + '">' + STATUS[t.status].label + '</span></div>' +
        '</div>' +
        (stale ? '<div class="est__flag">' + u.icon("alert", 16) + ' Trade aberto há ' + u.dur(age) + '. O Oráculo recomenda revisar a operação.</div>' : '') +

        '<div class="tr__stats">' +
          statCell("Entrada", num(t.entry)) +
          statCell("Stop", num(t.stop), "down") +
          statCell("Alvo", num(t.target), "up") +
          statCell("Tamanho", u.escape(num(t.size))) +
          statCell("Alavancagem", u.escape(num(t.leverage))) +
          (t.status === "encerrado" ? statCell("Saída", num(t.exit)) : "") +
        '</div>' +

        '<div class="rd__grid">' +
          '<div class="card"><div class="card__head"><span class="card__title">Acompanhamento</span></div>' +
            '<div class="timeline">' + events + '</div>' + partials + '</div>' +
          '<div class="rd__side">' + manage + review +
            (rd ? '<button class="card rd__studylink" data-rd="' + rd.id + '"><span class="rd__field-lbl">Decisão de origem</span><b>RD: ' + (rd.decision === "entrar" ? "Entrar" : "Não entrar") + '</b><span class="est__meta">' + u.icon("rd", 13) + u.escape(rd.asset) + ' · ver RD →</span></button>' : "") +
            (s ? '<button class="card rd__studylink" data-study="' + s.id + '"><span class="rd__field-lbl">Tese de origem</span><b>' + u.escape(s.title) + '</b><span class="est__meta">' + u.icon("flask", 13) + u.escape(s.asset) + ' · ver tese →</span></button>' : "") +
          '</div>' +
        '</div>' +

        '<div class="est__actions"><button class="btn btn--ghost est__danger" data-del>' + u.icon("trash", 15) + ' Excluir</button></div>' +
      '</div>';

    mount.querySelector("[data-back]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-del]").addEventListener("click", function () {
      ATLAS.util.perguntar({
        title: "Excluir este trade?",
        message: "As parciais, as notas e o histórico da operação vão junto. Não há como desfazer.",
        confirmLabel: "Excluir",
        danger: true
      }, function () { app.removeTrade(t.id); show("list"); });
    });
    var rdl = mount.querySelector("[data-rd]");
    if (rdl) rdl.addEventListener("click", function () { if (ATLAS.rd) { ATLAS.rd.openDetail(rdl.dataset.rd); } ATLAS.router.go("rd"); });
    var sl = mount.querySelector("[data-study]");
    if (sl) sl.addEventListener("click", function () { if (ATLAS.estudos) ATLAS.estudos.request(sl.dataset.study); ATLAS.router.go("teses"); });

    if (t.status === "aberto") {
      var noteI = mount.querySelector("[data-note]");
      mount.querySelector("[data-add-note]").addEventListener("click", function () {
        var v = noteI.value.trim(); if (!v) return; app.addTradeEvent(t.id, "nota", v);
      });
      mount.querySelector("[data-add-partial]").addEventListener("click", function () {
        var price = mount.querySelector("[data-p-price]").value.trim();
        var portion = mount.querySelector("[data-p-portion]").value.trim();
        if (!price) return ATLAS.util.invalido(mount.querySelector("[data-p-price]"), "Informe o preço da parcial.");
        app.addPartial(t.id, { price: price, portion: portion });
      });
      mount.querySelector("[data-move-stop]").addEventListener("click", function () {
        var stop = mount.querySelector("[data-stop]").value.trim();
        if (!stop) return; app.manageTrade(t.id, { stop: stop });
      });
      mount.querySelector("[data-close]").addEventListener("click", function () { show("closeForm"); });
    }
    var rvBtn = mount.querySelector("[data-review]");
    if (rvBtn) rvBtn.addEventListener("click", function () { show("reviewForm"); });
  }

  // ---------- FORM: PÓS-ANÁLISE ----------
  function renderReviewForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var t = app.getTrade(selectedId);
    if (!t) { show("list"); return; }
    var rv = t.review || { adherence: "total", discipline: 3, worked: "", failed: "", lesson: "", tags: [] };
    var st = { adherence: rv.adherence, discipline: rv.discipline };

    var dots = "";
    for (var i = 1; i <= 5; i++) dots += '<span class="conf__dot' + (i <= st.discipline ? ' conf__dot--on' : '') + '" data-conf="' + i + '" role="button"></span>';

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">' + u.escape(t.asset) + ' · ' + u.pct(t.pnl) + '</span><h1>Pós-análise</h1></div></div>' +
        '<div class="card est__form-card">' +
          '<label class="field"><span>Aderência ao plano</span><div class="seg" data-f="adherence">' +
            '<button type="button" class="seg__opt" data-v="total" aria-current="' + (st.adherence === "total") + '">Seguiu</button>' +
            '<button type="button" class="seg__opt" data-v="parcial" aria-current="' + (st.adherence === "parcial") + '">Parcial</button>' +
            '<button type="button" class="seg__opt" data-v="nenhuma" aria-current="' + (st.adherence === "nenhuma") + '">Não seguiu</button>' +
          '</div></label>' +
          '<label class="field"><span>Disciplina na execução</span><span class="conf conf--edit">' + dots + '</span></label>' +
          '<label class="field"><span>O que funcionou</span><textarea class="textarea" data-f="worked" placeholder="Acertos desta operação…">' + u.escape(rv.worked) + '</textarea></label>' +
          '<label class="field"><span>O que falhou</span><textarea class="textarea" data-f="failed" placeholder="Erros ou desvios…">' + u.escape(rv.failed) + '</textarea></label>' +
          '<label class="field"><span>Lição aprendida</span><textarea class="textarea" data-f="lesson" placeholder="O que levar para os próximos trades…">' + u.escape(rv.lesson) + '</textarea></label>' +
          '<label class="field"><span>Tags <small>(separadas por vírgula)</small></span><input class="input" data-f="tags" placeholder="ex.: disciplina, antecipação" value="' + u.escape((rv.tags || []).join(", ")) + '"></label>' +
          '<div class="form-actions"><button class="btn btn--accent" data-save>' + u.icon("check", 15) + ' Salvar pós-análise</button>' +
            '<button class="btn btn--ghost" data-cancel>Cancelar</button></div>' +
        '</div></div>';

    mount.querySelectorAll('[data-f="adherence"] .seg__opt').forEach(function (o) {
      o.addEventListener("click", function () {
        st.adherence = o.dataset.v;
        mount.querySelectorAll('[data-f="adherence"] .seg__opt').forEach(function (x) { x.setAttribute("aria-current", x === o); });
      });
    });
    mount.querySelectorAll("[data-conf]").forEach(function (d) {
      d.addEventListener("click", function () {
        st.discipline = parseInt(d.dataset.conf, 10);
        mount.querySelectorAll("[data-conf]").forEach(function (x) { x.classList.toggle("conf__dot--on", parseInt(x.dataset.conf, 10) <= st.discipline); });
      });
    });
    function val(f) { var e = mount.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ""; }

    mount.querySelector("[data-back]").addEventListener("click", function () { show("detail"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show("detail"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var tags = val("tags").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      app.setTradeReview(t.id, { adherence: st.adherence, discipline: st.discipline, worked: val("worked"), failed: val("failed"), lesson: val("lesson"), tags: tags });
      show("detail");
    });
  }

  // ---------- FORM: ABRIR ----------
  function renderOpenForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var rdId = pending && pending.rdId ? pending.rdId : null;
    var rd = rdId ? app.getRd(rdId) : null;
    var studies = app.studies();
    var pend = pendingRds();

    var pre = {
      asset: rd ? rd.asset : "",
      studyId: rd ? rd.studyId : "",
      stop: rd ? (rd.risk.stop || "") : "",
      size: rd ? (rd.risk.size || "") : "",
      leverage: rd ? (rd.leverage || "") : "",
      side: "long"
    };
    var sideState = { side: pre.side };

    var rdOpts = '<option value="">Sem RD (avulso)</option>' + pend.concat(rd && pend.indexOf(rd) < 0 ? [rd] : []).map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === rdId ? " selected" : "") + '>' + u.escape(r.asset) + ' · Entrar (conf. ' + r.confidence + ')</option>';
    }).join("");
    var studyOpts = '<option value="">Sem tese</option>' + studies.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === pre.studyId ? " selected" : "") + '>' + u.escape(s.asset + " · " + s.title) + '</option>';
    }).join("");

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">Execução</span><h1>Abrir trade</h1></div></div>' +
        '<div class="card est__form-card">' +
          '<div class="field-row">' +
            '<label class="field"><span>RD de origem</span><select class="input" data-f="rdId">' + rdOpts + '</select></label>' +
            '<label class="field field--sm"><span>Ativo</span><input class="input" data-f="asset" value="' + u.escape(pre.asset) + '" placeholder="BTC" maxlength="12"></label>' +
          '</div>' +
          '<label class="field"><span>Tese de origem</span><select class="input" data-f="studyId">' + studyOpts + '</select></label>' +
          '<label class="field"><span>Direção</span><div class="seg" data-f="side">' +
            '<button type="button" class="seg__opt" data-v="long" aria-current="true">Long</button>' +
            '<button type="button" class="seg__opt" data-v="short" aria-current="false">Short</button></div></label>' +
          '<div class="field-row">' +
            '<label class="field"><span>Entrada</span><input class="input" data-f="entry" placeholder="Preço"></label>' +
            '<label class="field"><span>Stop</span><input class="input" data-f="stop" value="' + u.escape(pre.stop) + '" placeholder="Preço"></label>' +
            '<label class="field"><span>Alvo</span><input class="input" data-f="target" placeholder="Preço"></label>' +
          '</div>' +
          '<div class="field-row">' +
            /* ------------------------------------------------------------
               CAPITAL EM DÓLAR — o campo que faltava para o dinheiro voltar

               "Tamanho" era texto livre ("2% risco", "meia posição") e
               o resultado era gravado em PERCENTUAL. Com isso o Trade
               não tinha como devolver nada ao caixa ao fechar: não
               existia um valor em dólar em lugar nenhum. Era esse o
               "bug estrutural do Trade" do briefing — o saldo não sumia
               ao fechar, ele nunca existiu.

               "Tamanho" continua, porque descreve a REGRA de risco que
               a pessoa usou. O capital é outro campo, numérico, e é
               ele que sai do caixa.
               ------------------------------------------------------------ */
            '<label class="field"><span>Capital (US$)</span><input class="input" data-f="sizeUSD" type="number" step="any" min="0" placeholder="Quanto sai do caixa"></label>' +
            '<label class="field"><span>Tamanho</span><input class="input" data-f="size" value="' + u.escape(pre.size) + '" placeholder="Ex.: 2% risco"></label>' +
            '<label class="field field--sm"><span>Alavancagem</span><input class="input" data-f="leverage" value="' + u.escape(pre.leverage) + '" placeholder="2x"></label>' +
            '<label class="field"><span>Nota de abertura</span><input class="input" data-f="note" placeholder="Contexto da entrada"></label>' +
          '</div>' +
          '<div class="form-actions"><button class="btn btn--accent" data-save>' + u.icon("check", 15) + ' Abrir trade</button>' +
            '<button class="btn btn--ghost" data-cancel>Cancelar</button></div>' +
        '</div></div>';

    pending = null;

    /* Autocomplete de ativos + preço de mercado sugerido na Entrada.
       Passa pela cadeia única (core/atlas-precos.js) em vez de falar
       direto com a CoinGecko: assim o preço informado à mão pelo
       usuário vale aqui também, e um ativo que a CoinGecko não lista
       ainda pode ser cotado pela fonte secundária. A origem entra no
       placeholder — num campo que a pessoa vai editar, saber de onde
       veio o número sugerido é o que permite confiar ou corrigir. */
    if (window.AtlasAssets) {
      var assetInput = mount.querySelector('[data-f="asset"]');
      if (assetInput) AtlasAssets.attach(assetInput, { value: "symbol", onSelect: function (coin) {
        var entryEl = mount.querySelector('[data-f="entry"]');
        if (!entryEl || entryEl.value) return;

        var pedir = window.AtlasPrecos
          ? AtlasPrecos.de(coin.symbol)
          : (AtlasAssets.priceFull ? AtlasAssets.priceFull(coin.id) : Promise.resolve(null));

        pedir.then(function (r) {
          if (!r || r.usd == null || entryEl.value) return;
          entryEl.value = r.usd;
          var origem = (window.AtlasPrecos && r.fonte)
            ? AtlasPrecos.fonteLabel(r.fonte, true) : "mercado";
          entryEl.placeholder = "Preço (" + origem + ": " + r.usd + ")";
        }).catch(function () { /* silencioso: campo continua manual */ });
      } });
    }

    mount.querySelectorAll('[data-f="side"] .seg__opt').forEach(function (o) {
      o.addEventListener("click", function () {
        sideState.side = o.dataset.v;
        mount.querySelectorAll('[data-f="side"] .seg__opt').forEach(function (x) { x.setAttribute("aria-current", x === o); });
      });
    });
    var rdSel = mount.querySelector('[data-f="rdId"]');
    rdSel.addEventListener("change", function () {
      var r = app.getRd(rdSel.value);
      if (r) {
        mount.querySelector('[data-f="asset"]').value = r.asset;
        if (r.risk.stop) mount.querySelector('[data-f="stop"]').value = r.risk.stop;
        if (r.risk.size) mount.querySelector('[data-f="size"]').value = r.risk.size;
        if (r.leverage) mount.querySelector('[data-f="leverage"]').value = r.leverage;
        if (r.studyId) mount.querySelector('[data-f="studyId"]').value = r.studyId;
      }
    });

    function val(f) { var e = mount.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ""; }
    function numOr(f) { var v = val(f); return v === "" ? null : (isNaN(parseFloat(v)) ? v : parseFloat(v)); }

    mount.querySelector("[data-back]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show("list"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var asset = val("asset");
      if (!asset) return ATLAS.util.invalido(mount.querySelector('[data-f="asset"]'), "Informe o ativo.");

      var capital = parseFloat(String(val("sizeUSD")).replace(",", "."));
      if (!(capital > 0)) {
        return ATLAS.util.invalido(mount.querySelector('[data-f="sizeUSD"]'),
          "Informe quanto capital sai do caixa. É ele que volta quando o trade fecha.");
      }

      /* Sem caixa não abre. A mensagem diz quanto falta — mandar a
         pessoa procurar o saldo noutra tela é o que fazia o número
         parecer arbitrário. */
      if (window.AtlasCaixa && window.AtlasWallets) {
        var w = app.currentWallet();
        var conf = AtlasCaixa.podeGastar(w.id, capital);
        if (!conf.ok) {
          return ATLAS.util.invalido(mount.querySelector('[data-f="sizeUSD"]'),
            "Caixa insuficiente em " + w.name + ": há US$ " + conf.saldo.toFixed(2) +
            " e faltam US$ " + conf.falta.toFixed(2) + ".");
        }
      }

      var tr = app.openTrade({
        asset: asset, side: sideState.side, rdId: val("rdId") || null, studyId: val("studyId") || null,
        entry: numOr("entry"), stop: numOr("stop"), target: numOr("target"),
        sizeUSD: capital,
        size: val("size"), leverage: val("leverage"), note: val("note")
      });
      /* openTrade devolve null quando o caixa não cobre. A tela já
         checou acima e deu a mensagem com o valor que falta; este ramo
         cobre o caso de o saldo ter mudado noutra aba entre a
         verificação e o clique. */
      if (!tr) {
        return ATLAS.util.invalido(mount.querySelector('[data-f="sizeUSD"]'),
          "Caixa insuficiente para abrir esta operação.");
      }
      selectedId = tr.id; show("detail");
    });
  }

  // ---------- FORM: ENCERRAR ----------
  function renderCloseForm(mount) {
    var u = ATLAS.util, app = ATLAS.app;
    var t = app.getTrade(selectedId);
    if (!t) { show("list"); return; }

    mount.innerHTML =
      '<div class="estudos est__form reveal">' +
        '<button class="est__back" data-back>' + u.icon("back", 16) + ' Voltar</button>' +
        '<div class="est__head"><div><span class="eyebrow">' + u.escape(t.asset) + ' · ' + (t.side === "long" ? "Long" : "Short") + '</span><h1>Encerrar trade</h1></div></div>' +
        '<div class="card est__form-card">' +
          '<div class="field-row">' +
            '<label class="field"><span>Preço de saída</span><input class="input" data-f="exit" placeholder="Preço"></label>' +
            '<label class="field field--sm"><span>Resultado (%)</span><input class="input" data-f="pnl" placeholder="Ex.: 6.4 ou -1.8" value="' + t.pnl + '"></label>' +
          '</div>' +
          '<label class="field"><span>Nota de encerramento</span><textarea class="textarea" data-f="note" placeholder="Como foi conduzido, o que aprendeu…"></textarea></label>' +
          '<div class="form-actions"><button class="btn btn--profit" data-save>' + u.icon("check", 15) + ' Confirmar encerramento</button>' +
            '<button class="btn btn--ghost" data-cancel>Cancelar</button></div>' +
        '</div></div>';

    function val(f) { var e = mount.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ""; }

    mount.querySelector("[data-back]").addEventListener("click", function () { show("detail"); });
    mount.querySelector("[data-cancel]").addEventListener("click", function () { show("detail"); });
    mount.querySelector("[data-save]").addEventListener("click", function () {
      var pnl = parseFloat(val("pnl"));
      if (isNaN(pnl)) return ATLAS.util.invalido(mount.querySelector('[data-f="pnl"]'), "Informe o resultado em %.");
      var exitV = val("exit");
      app.closeTrade(t.id, { exit: exitV === "" ? null : (isNaN(parseFloat(exitV)) ? exitV : parseFloat(exitV)), pnl: pnl, note: val("note") });
      show("detail");
    });
  }

  // ---------- dispatcher ----------
  function render(mount) {
    mountRef = mount;
    if (pending && pending.rdId && view === "list") view = "openForm";
    if (view === "detail") return renderDetail(mount);
    if (view === "openForm") return renderOpenForm(mount);
    if (view === "closeForm") return renderCloseForm(mount);
    if (view === "reviewForm") return renderReviewForm(mount);
    return renderList(mount);
  }

  ATLAS.router.register("trades", { label: "Trades", icon: "trades", render: render });

  // Pedido externo (ex.: "Executar trade" no RD)
  ATLAS.trades = {
    request: function (opts) { pending = opts || {}; view = "openForm"; },
    openDetail: function (id) { selectedId = id; view = "detail"; }
  };

  ATLAS.app.subscribe(function () {
    if (ATLAS.router.current() !== "trades" || !mountRef) return;
    if (view === "detail" && !ATLAS.app.getTrade(selectedId)) view = "list";
    render(mountRef);
  });
})(window.ATLAS = window.ATLAS || {});
