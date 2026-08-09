/* ============================================================
   ATLAS — Academy · Central de Conhecimento
   SPA leve (hash router) sobre a entidade AtlasTheses.
   ============================================================ */
(function () {
  "use strict";
  var T = window.AtlasTheses;

  /* ---------- helpers ---------- */
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function ago(ts) {
    if (!ts) return "—";
    var d = Math.round((Date.now() - ts) / 86400000);
    if (d <= 0) return "hoje"; if (d === 1) return "ontem"; return "há " + d + " dias";
  }
  function dateTime(ts) { return ts ? new Date(ts).toLocaleString("pt-BR") : "—"; }
  function fmtDur(ms) {
    if (ms == null) return "—";
    var d = Math.round(ms / 86400000);
    if (d < 1) return "menos de 1 dia";
    if (d === 1) return "1 dia";
    return d + " dias";
  }
  function coinColor(sym) {
    var palette = ["#00BFFF", "#00F0FF", "#00E28A", "#FFD700", "#9B8CFF", "#FF8FA3", "#5B9BFF"];
    var h = 0; sym = sym || "?";
    for (var i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % palette.length;
    return palette[h];
  }
  function coin(sym) {
    sym = (sym || "?").toUpperCase();
    return '<span class="coin" style="background:' + coinColor(sym) + '">' + esc(sym.slice(0, 3)) + '</span>';
  }
  function toast(msg, kind) {
    var wrap = qs("#toasts");
    var t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 250); }, 2800);
  }
  var STATUS = { planejada: "Planejada", andamento: "Em andamento", concluida: "Concluída", arquivada: "Arquivada" };
  function chip(status) { return '<span class="chip ' + status + '">' + (STATUS[status] || status) + '</span>'; }
  function modChip(m) { return '<span class="chip mod">' + (T.moduleLabel(m) || m) + '</span>'; }

  var MODULE_HREF = {
    hold: "../hold/index.html#/teses",
    trade: "../trade/index.html#/teses",
    defi: "../defi/teses.html",
    /* apontava para a home do RWA porque rota de teses não existia lá.
       Agora existe, e o Academy leva à tese como leva nos outros três. */
    rwa: "../RWA/index.html#/teses"
  };

  /* ---------- menu ---------- */
  var MENU = [
    { id: "dashboard", label: "Dashboard", icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>' },
    { id: "andamento", label: "Em andamento", icon: '<path d="M3 17l6-6 4 4 7-8"/><path d="M21 7v5M21 7h-5"/>' },
    { id: "concluidas", label: "Concluídas", icon: '<path d="M20 6L9 17l-5-5"/>' },
    { id: "futuros", label: "Estudos futuros", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>' },
    { id: "biblioteca", label: "Biblioteca", icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
    { id: "pesquisar", label: "Pesquisar teses", icon: '<circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>' },
    { id: "relatorios", label: "Relatórios", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>' }
  ];

  function renderNav(active) {
    var stats = T.stats();
    var counts = {
      andamento: stats.andamento, concluidas: stats.concluidas, futuros: stats.futuros,
      biblioteca: stats.concluidas
    };
    qs("#nav").innerHTML = MENU.map(function (m) {
      var n = counts[m.id];
      return '<a class="nav-item' + (m.id === active ? " active" : "") + '" data-route="' + m.id + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">' + m.icon + '</svg>' +
        '<span>' + m.label + '</span>' +
        (n ? '<span class="badge-n">' + n + '</span>' : '') +
      '</a>';
    }).join("");
    qsa("[data-route]").forEach(function (a) {
      a.addEventListener("click", function () { location.hash = "#/" + a.dataset.route; });
    });
  }

  /* ============================================================
     VIEWS
     ============================================================ */
  var TITLES = {
    dashboard: ["Dashboard", "Central de conhecimento — todas as teses do ATLAS."],
    andamento: ["Em andamento", "Teses que ainda estão sendo trabalhadas nos módulos."],
    concluidas: ["Concluídas", "Teses fechadas. Reabra qualquer uma para voltar ao módulo de origem."],
    futuros: ["Estudos futuros", "Ativos na fila de pesquisa — ainda sem tese."],
    biblioteca: ["Biblioteca", "Todo o conhecimento acumulado, pesquisável e versionado."],
    pesquisar: ["Pesquisar teses", "Busque em títulos, ativos e conteúdo de todas as teses."],
    relatorios: ["Relatórios", "Produção de teses por módulo e evolução do conhecimento."]
  };

  function setHead(route) {
    qs("#pageTitle").textContent = (TITLES[route] || ["Academy", ""])[0];
    qs("#pageSub").textContent = (TITLES[route] || ["", ""])[1];
  }

  /* ---------- Dashboard ---------- */
  function viewDashboard() {
    var s = T.stats();
    var kpis = [
      { rotulo: "Em andamento", valor: s.andamento, sub: "sendo trabalhadas" },
      { rotulo: "Concluídas", valor: s.concluidas, cls: "pos", sub: "na biblioteca" },
      { rotulo: "Revisões", valor: s.revisoes, sub: "iterações registradas" },
      { rotulo: "Estudos futuros", valor: s.futuros, sub: "na fila" },
      { rotulo: "Tempo médio p/ concluir", valor: fmtDur(s.tempoMedioConclusaoMs), gold: true, big: false },
      { rotulo: "Última atualização", valor: ago(s.ultimaAtualizacao), sub: dateTime(s.ultimaAtualizacao) }
    ];
    var cards = kpis.map(function (k) {
      var vcls = k.cls === "pos" ? " pos" : (k.gold ? " gold" : "");
      var val = typeof k.valor === "number" ? k.valor : esc(k.valor);
      return '<div class="card kpi gradient-border"><div class="rotulo">' + k.rotulo + '</div>' +
        '<div class="valor' + vcls + '"' + (k.big === false ? ' style="font-size:18px"' : '') + '>' + val + '</div>' +
        (k.sub ? '<div class="sub">' + esc(k.sub) + '</div>' : '') + '</div>';
    }).join("");

    var recent = T.all().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 5);
    var recentHtml = recent.length ? recent.map(thesisRow).join("") :
      '<div class="empty"><h2>Nenhuma tese ainda</h2><p>Crie teses nos módulos Hold, Trade ou DeFi — elas aparecem aqui automaticamente.</p></div>';

    return '<div class="grid g-3">' + cards + '</div>' +
      '<div class="section-title">Atividade recente</div>' + recentHtml;
  }

  /* ---------- linha de tese (clicável → detalhe) ---------- */
  function thesisRow(t) {
    return '<div class="card thesis-card gradient-border mt-14" data-detail="' + t.id + '">' +
      '<div class="thesis-top">' + coin(t.asset) +
        '<div style="flex:1;min-width:0">' +
          '<div class="thesis-title">' + esc(t.title) + '</div>' +
          '<div class="thesis-meta">' + esc(t.asset) + ' · atualizada ' + ago(t.updatedAt) +
            (t.version > 1 ? ' · v' + t.version : '') + '</div>' +
        '</div>' +
        modChip(t.module) + chip(t.status) +
      '</div>' +
      (t.content ? '<p class="thesis-body">' + esc(t.content) + '</p>' : '') +
    '</div>';
  }

  function listCards(items, emptyMsg) {
    if (!items.length) return '<div class="empty"><h2>Nada por aqui</h2><p>' + esc(emptyMsg) + '</p></div>';
    return items.map(thesisRow).join("");
  }

  /* ---------- Em andamento ---------- */
  function viewAndamento() {
    var items = T.open().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return listCards(items, "Nenhuma tese em andamento ou planejada no momento.");
  }

  /* ---------- Concluídas ---------- */
  function viewConcluidas() {
    var items = T.concluded().sort(function (a, b) { return (b.concludedAt || 0) - (a.concludedAt || 0); });
    return listCards(items, "Nenhuma tese concluída ainda. Ao concluir uma tese num módulo, ela aparece aqui.");
  }

  /* ---------- Biblioteca (tudo, com filtro) ---------- */
  var libFilter = "todas";
  function viewBiblioteca() {
    var seg = ["todas", "concluida", "andamento", "planejada", "arquivada"].map(function (f) {
      var lbl = f === "todas" ? "Todas" : STATUS[f];
      return '<button class="' + (libFilter === f ? "on" : "") + '" data-lib="' + f + '">' + lbl + '</button>';
    }).join("");
    var items = T.all().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (libFilter !== "todas") items = items.filter(function (t) { return t.status === libFilter; });
    return '<div class="filterbar"><div class="seg">' + seg + '</div></div>' +
      listCards(items, "Nenhuma tese neste filtro.");
  }

  /* ---------- Pesquisar ---------- */
  var searchQuery = "";
  function viewPesquisar() {
    var results = searchQuery ? T.search(searchQuery) : [];
    var body = !searchQuery
      ? '<div class="empty"><h2>Busque em todo o conhecimento</h2><p>Digite acima para pesquisar por ativo, título ou conteúdo das teses.</p></div>'
      : (results.length ? results.map(thesisRow).join("")
        : '<div class="empty"><h2>Nada encontrado</h2><p>Nenhuma tese corresponde a “' + esc(searchQuery) + '”.</p></div>');
    return '<div class="field"><input class="input" id="pesqInput" placeholder="Ex.: SOL, Kamino, range…" value="' + esc(searchQuery) + '"></div>' +
      (searchQuery ? '<div class="thesis-meta" style="margin:4px 0 10px">' + results.length + ' resultado(s)</div>' : '') +
      body;
  }

  /* ---------- Estudos futuros ---------- */
  function viewFuturos() {
    var items = T.futures();
    var cards = items.length ? items.map(function (f) {
      return '<div class="card gradient-border mt-14">' +
        '<div class="thesis-top">' + coin(f.asset) +
          '<div style="flex:1;min-width:0"><div class="thesis-title">' + esc(f.asset) + '</div>' +
          '<div class="thesis-meta">' + (f.note ? esc(f.note) : "Sem tese ainda") + '</div></div>' +
        '</div>' +
        '<div class="row mt-14">' +
          '<select class="select" data-promote-mod="' + f.id + '">' +
            '<option value="hold">Hold</option><option value="trade">Trade</option>' +
            '<option value="defi" selected>DeFi</option><option value="rwa">RWA</option>' +
          '</select>' +
          '<button class="btn btn-primary btn-sm" data-promote="' + f.id + '">Criar tese</button>' +
          '<button class="btn btn-sm btn-danger" data-rmfut="' + f.id + '" style="margin-left:auto">Remover</button>' +
        '</div>' +
      '</div>';
    }).join("") : '<div class="empty"><h2>Fila vazia</h2><p>Adicione ativos que você quer estudar no futuro.</p></div>';

    return '<div class="card gradient-border">' +
        '<div class="eyebrow">Adicionar à fila</div>' +
        '<div class="row mt-14">' +
          '<input class="input" id="futAsset" placeholder="Ativo (ex.: Pendle)" style="max-width:220px">' +
          '<input class="input" id="futNote" placeholder="Nota rápida (opcional)" style="flex:1;min-width:200px">' +
          '<button class="btn btn-primary" id="futAdd">Adicionar</button>' +
        '</div>' +
      '</div>' + cards;
  }

  /* ---------- Relatórios ---------- */
  function viewRelatorios() {
    var s = T.stats();
    var mods = Object.keys(s.porModulo);
    if (!mods.length) return '<div class="empty"><h2>Sem dados ainda</h2><p>Crie teses nos módulos para ver os relatórios de produção.</p></div>';
    var max = Math.max.apply(null, mods.map(function (m) { return s.porModulo[m].total; }).concat([1]));
    var bars = mods.map(function (m) {
      var pm = s.porModulo[m];
      var w = Math.round((pm.total / max) * 100);
      return '<div class="bar-row"><span class="bar-label">' + esc(T.moduleLabel(m)) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w + '%"></span></span>' +
        '<span class="bar-val">' + pm.total + '</span></div>';
    }).join("");

    var rows = mods.map(function (m) {
      var pm = s.porModulo[m];
      return '<div class="card mt-14"><div class="between">' +
        '<b>' + esc(T.moduleLabel(m)) + '</b><span class="thesis-meta">últ. revisão ' + ago(pm.ultimaRevisao) + '</span></div>' +
        '<div class="row mt-14" style="gap:18px;font-size:13px;color:var(--texto-suave)">' +
          '<span>Planejadas: <b style="color:var(--texto)">' + pm.planejadas + '</b></span>' +
          '<span>Em andamento: <b style="color:var(--texto)">' + pm.andamento + '</b></span>' +
          '<span>Concluídas: <b style="color:var(--verde)">' + pm.concluidas + '</b></span>' +
          '<span>Arquivadas: <b style="color:var(--texto)">' + pm.arquivadas + '</b></span>' +
          '<span>Revisões: <b style="color:var(--texto)">' + pm.revisoes + '</b></span>' +
        '</div></div>';
    }).join("");

    return '<div class="card gradient-border"><div class="eyebrow">Teses por módulo</div><div class="mt-18">' + bars + '</div></div>' +
      '<div class="section-title">Detalhe por módulo</div>' + rows;
  }

  /* ---------- Detalhe da tese ---------- */
  function viewDetail(id) {
    var t = T.get(id);
    if (!t) { location.hash = "#/dashboard"; return ""; }
    setHead("dashboard");
    qs("#pageTitle").textContent = t.title;
    qs("#pageSub").textContent = T.moduleLabel(t.module) + " · " + esc(t.asset) + " · versão " + t.version;

    var hist = (t.history || []).slice().sort(function (a, b) { return a.ts - b.ts; });
    var timeline = hist.length ? hist.map(function (h) {
      return '<div class="tl-item"><span class="tl-dot"></span>' +
        '<div class="tl-time">' + dateTime(h.ts) + '</div><p class="tl-text">' + esc(h.text) + '</p></div>';
    }).join("") : '<p class="thesis-meta">Sem registros de evolução.</p>';

    var versions = (t.versions || []).length ? '<div class="card mt-14"><div class="eyebrow">Versões concluídas</div>' +
      '<div class="timeline">' + t.versions.slice().reverse().map(function (v) {
        return '<div class="tl-item"><span class="tl-dot"></span>' +
          '<div class="tl-time">Versão ' + v.version + ' · ' + dateTime(v.concludedAt) + '</div>' +
          '<p class="tl-text">' + esc((v.snapshot && v.snapshot.content) || "—") + '</p></div>';
      }).join("") + '</div></div>' : '';

    var actions = '<div class="row mt-18">';
    if (t.status === "concluida") {
      actions += '<button class="btn btn-primary" data-reopen="' + t.id + '">Reabrir no módulo ' + T.moduleLabel(t.module) + '</button>';
    }
    actions += '<a class="btn" href="' + (MODULE_HREF[t.module] || "#") + '">Abrir módulo de origem</a>';
    actions += '<button class="btn" data-editthesis="' + t.id + '">Editar</button>';
    actions += '</div>';

    var log = (t.log || []).slice().reverse().slice(0, 8).map(function (l) {
      return '<div class="tl-item"><span class="tl-dot" style="background:var(--texto-fraco);box-shadow:none"></span>' +
        '<div class="tl-time">' + dateTime(l.ts) + '</div><p class="tl-text" style="font-size:12.5px;color:var(--texto-suave)">' + esc(l.detail || l.action) + '</p></div>';
    }).join("");

    return '<button class="btn btn-sm" data-back style="margin-bottom:16px">← Voltar</button>' +
      '<div class="grid g-2" style="align-items:start">' +
        '<div class="card gradient-border">' +
          '<div class="between"><div class="thesis-top">' + coin(t.asset) +
            '<div><div class="thesis-title">' + esc(t.title) + '</div><div class="thesis-meta">' + esc(t.asset) + '</div></div></div>' +
            chip(t.status) + '</div>' +
          '<div class="section-title" style="margin-top:20px">Evolução da tese</div>' +
          '<div class="timeline">' + timeline + '</div>' +
          actions +
        '</div>' +
        '<div>' + versions +
          '<div class="card mt-14"><div class="eyebrow">Auditoria</div><div class="timeline mt-14">' + (log || '<p class="thesis-meta">Sem eventos.</p>') + '</div></div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- edição inline (modal simples) ---------- */
  function editThesis(id) {
    var t = T.get(id); if (!t) return;
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(2,6,15,.7);display:grid;place-items:center;z-index:1000;padding:20px";
    overlay.innerHTML =
      '<div class="card gradient-border" style="max-width:560px;width:100%">' +
        '<div class="eyebrow">Editar tese</div>' +
        '<label class="field mt-14"><span class="field-label">Título</span><input class="input" id="edTitle" value="' + esc(t.title) + '"></label>' +
        '<label class="field"><span class="field-label">Ativo</span><input class="input" id="edAsset" value="' + esc(t.asset) + '"></label>' +
        '<label class="field"><span class="field-label">Nova visão (entra no histórico)</span><textarea class="input" id="edNote" placeholder="Registrar uma atualização da tese…"></textarea></label>' +
        '<div class="row" style="justify-content:flex-end"><button class="btn" id="edCancel">Cancelar</button><button class="btn btn-primary" id="edSave">Salvar</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    qs("#edCancel", overlay).addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    qs("#edSave", overlay).addEventListener("click", function () {
      var title = qs("#edTitle", overlay).value.trim();
      var asset = qs("#edAsset", overlay).value.trim().toUpperCase();
      var note = qs("#edNote", overlay).value.trim();
      T.update(id, { title: title || t.title, asset: asset || t.asset }, "Editada pelo Academy.");
      if (note) T.addUpdate(id, note);
      overlay.remove(); toast("Tese atualizada.", "ok");
      render();
    });
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  function currentRoute() {
    var raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
    var parts = raw.split("/");
    return { name: parts[0] || "dashboard", param: parts[1] || null };
  }

  function render() {
    var r = currentRoute();
    var host = qs("#view");

    if (r.name === "detail" && r.param) {
      renderNav("biblioteca");
      host.innerHTML = viewDetail(r.param);
      bindDetail();
      return;
    }

    renderNav(r.name);
    setHead(r.name);
    var map = {
      dashboard: viewDashboard, andamento: viewAndamento, concluidas: viewConcluidas,
      futuros: viewFuturos, biblioteca: viewBiblioteca, pesquisar: viewPesquisar, relatorios: viewRelatorios
    };
    host.innerHTML = (map[r.name] || viewDashboard)();
    bindCommon();
    if (r.name === "biblioteca") bindLib();
    if (r.name === "pesquisar") bindPesquisar();
    if (r.name === "futuros") bindFuturos();
  }

  function bindCommon() {
    qsa("[data-detail]").forEach(function (el) {
      el.addEventListener("click", function () { location.hash = "#/detail/" + el.dataset.detail; });
    });
  }
  function bindDetail() {
    var b = qs("[data-back]"); if (b) b.addEventListener("click", function () { history.length > 1 ? history.back() : (location.hash = "#/dashboard"); });
    qsa("[data-reopen]").forEach(function (el) {
      el.addEventListener("click", function () {
        var t = T.reopen(el.dataset.reopen);
        toast("Tese reaberta — voltou para " + T.moduleLabel(t.module) + " (v" + t.version + ").", "ok");
        location.hash = "#/andamento";
      });
    });
    qsa("[data-editthesis]").forEach(function (el) {
      el.addEventListener("click", function () { editThesis(el.dataset.editthesis); });
    });
  }
  function bindLib() {
    qsa("[data-lib]").forEach(function (b) {
      b.addEventListener("click", function () { libFilter = b.dataset.lib; render(); });
    });
  }
  function bindPesquisar() {
    var inp = qs("#pesqInput");
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
      inp.addEventListener("input", function () {
        searchQuery = inp.value.trim();
        var host = qs("#view");
        var field = host.querySelector(".field");
        var results = searchQuery ? T.search(searchQuery) : [];
        var body = !searchQuery
          ? '<div class="empty"><h2>Busque em todo o conhecimento</h2><p>Digite acima para pesquisar por ativo, título ou conteúdo das teses.</p></div>'
          : (results.length ? results.map(thesisRow).join("")
            : '<div class="empty"><h2>Nada encontrado</h2><p>Nenhuma tese corresponde a "' + esc(searchQuery) + '".</p></div>');
        // reescreve tudo abaixo do campo, preservando o input (e seu foco)
        Array.prototype.slice.call(host.children).forEach(function (c) { if (c !== field) c.remove(); });
        field.insertAdjacentHTML("afterend",
          (searchQuery ? '<div class="thesis-meta" style="margin:4px 0 10px">' + results.length + ' resultado(s)</div>' : '') + body);
        bindCommon();
      });
    }
    bindCommon();
  }
  function bindFuturos() {
    var add = qs("#futAdd");
    if (add) add.addEventListener("click", function () {
      var a = qs("#futAsset").value.trim();
      if (!a) { qs("#futAsset").focus(); return; }
      T.addFuture(a, qs("#futNote").value.trim());
      toast("Adicionado à fila de estudos.", "ok"); render();
    });
    qsa("[data-promote]").forEach(function (b) {
      b.addEventListener("click", function () {
        var mod = qs('[data-promote-mod="' + b.dataset.promote + '"]').value;
        var t = T.promoteFuture(b.dataset.promote, mod);
        toast("Tese criada em " + T.moduleLabel(mod) + " (planejada).", "ok");
        render();
      });
    });
    qsa("[data-rmfut]").forEach(function (b) {
      b.addEventListener("click", function () { T.removeFuture(b.dataset.rmfut); render(); });
    });
    bindCommon();
  }

  /* ---------- busca global (topbar) ---------- */
  qs("#globalSearch").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      searchQuery = this.value.trim();
      location.hash = "#/pesquisar";
    }
  });

  /* ---------- boot ---------- */
  if (!T) {
    qs("#view").innerHTML = '<div class="empty"><h2>Entidade de teses não carregada</h2><p>Verifique se core/entities/theses.js está acessível.</p></div>';
    return;
  }
  window.addEventListener("hashchange", render);
  T.onChange(function () { render(); });
  if (!location.hash) location.hash = "#/dashboard";
  render();
})();
