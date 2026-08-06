/* ============================================================
   ATLAS · DeFi — teses.js
   Teses do módulo DeFi. Fonte da verdade: AtlasTheses
   (core/entities/theses.js). Concluir envia ao Academy;
   reabertura acontece por lá.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, T = window.AtlasTheses;

  C.mountNav("teses");

  var STATUS = {
    planejada: { label: "Planejada",    chip: "chip-analise" },
    andamento: { label: "Em andamento", chip: "chip-ativa" },
    concluida: { label: "Concluída",    chip: "chip-encerrada" },
    arquivada: { label: "Arquivada",    chip: "chip-range" }
  };

  var editingId = null;
  var openDetail = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function ago(ts) {
    if (!ts) return "—";
    var d = Math.round((Date.now() - ts) / 86400000);
    if (d <= 0) return "hoje";
    if (d === 1) return "ontem";
    return "há " + d + " dias";
  }

  function list() {
    if (!T) return [];
    return T.byModule("defi");
  }

  /* ---------- KPIs ---------- */
  function renderKpis() {
    var all = T ? T.byModule("defi", { includeConcluded: true }) : [];
    var n = { planejada: 0, andamento: 0, concluida: 0, arquivada: 0 };
    all.forEach(function (t) { if (n[t.status] != null) n[t.status]++; });
    U.qs("#tKpis").innerHTML =
      C.finCard({ label: "Planejadas",   value: String(n.planejada),  icon: "clock",  accent: "blue" }) +
      C.finCard({ label: "Em andamento", value: String(n.andamento),  icon: "chart",  accent: "green" }) +
      C.finCard({ label: "Concluídas (Academy)", value: String(n.concluida), icon: "check", accent: "gold", sub: "na Biblioteca" }) +
      C.finCard({ label: "Arquivadas",   value: String(n.arquivada),  icon: "layers" });
  }

  /* ---------- Lista ---------- */
  function renderList() {
    var q = (U.qs("#tSearch").value || "").toLowerCase().trim();
    var st = U.qs("#tStatus").value;
    var items = list().filter(function (t) {
      if (st) { if (t.status !== st) return false; }
      else if (t.status === "arquivada") return false;
      if (q && (t.asset || "").toLowerCase().indexOf(q) === -1 &&
               (t.title || "").toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    var host = U.qs("#tList");
    if (!items.length) {
      host.innerHTML =
        '<div class="card" style="text-align:center;padding:48px 24px">' +
          '<h3 style="margin-bottom:8px">Nenhuma tese neste filtro</h3>' +
          '<p class="page-sub">Documente a próxima decisão do módulo DeFi. Concluídas ficam no Academy.</p>' +
        '</div>';
      return;
    }

    host.innerHTML = items.map(function (t) {
      var s = STATUS[t.status] || STATUS.planejada;
      var open = openDetail === t.id;
      var body = "";
      if (open) {
        var hist = (t.history || []).slice().sort(function (a, b) { return a.ts - b.ts; });
        body =
          '<div style="border-top:1px solid var(--line,rgba(255,255,255,.08));margin-top:16px;padding-top:16px">' +
            '<div class="eyebrow" style="margin-bottom:10px">Evolução da tese · versão ' + t.version + '</div>' +
            (hist.length ? hist.map(function (h) {
              return '<p style="margin:0 0 12px"><span class="page-sub" style="display:block;font-size:12px">' +
                new Date(h.ts).toLocaleString("pt-BR") + '</span>' + esc(h.text) + '</p>';
            }).join("") : '<p class="page-sub">Sem registros ainda.</p>') +
            '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
              '<textarea class="input" data-note="' + t.id + '" placeholder="Registrar nova visão…" style="flex:1;min-width:240px;min-height:70px"></textarea>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">' +
              '<button class="btn btn-primary" data-addnote="' + t.id + '">Registrar visão</button>' +
              '<button class="btn" data-edit="' + t.id + '">Editar</button>' +
              (t.status === "planejada" ? '<button class="btn" data-start="' + t.id + '">Iniciar</button>' : '') +
              (t.status === "andamento" ? '<button class="btn" data-done="' + t.id + '">Concluir → Academy</button>' : '') +
              (t.status !== "arquivada" ? '<button class="btn" data-arch="' + t.id + '">Arquivar</button>'
                                        : '<button class="btn" data-start="' + t.id + '">Reativar</button>') +
              '<button class="btn" data-del="' + t.id + '" style="margin-left:auto;color:var(--vermelho,#FF5470)">Excluir</button>' +
            '</div>' +
          '</div>';
      }
      return '' +
        '<div class="card" style="margin-bottom:14px;cursor:pointer" data-open="' + t.id + '">' +
          '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
            U.coin(t.asset || "?") +
            '<div style="flex:1;min-width:180px">' +
              '<b>' + esc(t.title) + '</b>' +
              '<div class="page-sub" style="font-size:12px">' + esc(t.asset) + ' · atualizada ' + ago(t.updatedAt) +
                (t.version > 1 ? ' · v' + t.version : '') + '</div>' +
            '</div>' +
            '<span class="status-chip ' + s.chip + '">' + s.label + '</span>' +
          '</div>' +
          (open ? "" : '<p class="page-sub" style="margin:12px 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(t.content || "Sem tese registrada.") + '</p>') +
          body +
        '</div>';
    }).join("");

    /* eventos */
    U.qsa("[data-open]", host).forEach(function (el) {
      el.addEventListener("click", function (ev) {
        if (ev.target.closest("button") || ev.target.closest("textarea")) return;
        openDetail = openDetail === el.dataset.open ? null : el.dataset.open;
        renderList();
      });
    });
    U.qsa("[data-addnote]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = U.qs('[data-note="' + b.dataset.addnote + '"]', host);
        var v = ta && ta.value.trim();
        if (!v) { if (ta) ta.focus(); return; }
        T.addUpdate(b.dataset.addnote, v);
        U.toast("Visão registrada.", "ok");
        refresh();
      });
    });
    U.qsa("[data-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { openForm(b.dataset.edit); });
    });
    U.qsa("[data-start]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = T.get(b.dataset.start);
        if (t && t.status === "arquivada") T.reopen(t.id);
        else T.setStatus(b.dataset.start, "andamento");
        U.toast("Tese em andamento.", "ok"); refresh();
      });
    });
    U.qsa("[data-done]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = T.get(b.dataset.done);
        if (!window.confirm("Concluir fecha a versão " + (t ? t.version : "") + " e envia a tese automaticamente para o Academy. Continuar?")) return;
        T.conclude(b.dataset.done);
        U.toast("Tese concluída — disponível no Academy.", "ok");
        openDetail = null; refresh();
      });
    });
    U.qsa("[data-arch]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        T.archive(b.dataset.arch);
        U.toast("Tese arquivada.", "ok"); refresh();
      });
    });
    U.qsa("[data-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        if (!window.confirm("Excluir esta tese apaga o histórico e as versões. Ação irreversível. Excluir?")) return;
        T.remove(b.dataset.del);
        openDetail = null; refresh();
      });
    });
  }

  /* ---------- Formulário (nova / editar) ---------- */
  function openForm(id) {
    editingId = id || null;
    var t = id ? T.get(id) : null;
    var host = U.qs("#tForm");
    host.style.display = "block";
    host.innerHTML =
      '<div class="card">' +
        '<div class="eyebrow" style="margin-bottom:14px">' + (t ? "Editar tese" : "Nova tese") + '</div>' +
        '<div style="display:grid;grid-template-columns:160px 1fr;gap:14px">' +
          '<label class="field"><span class="field-label">Ativo</span><input class="input" id="fAsset" maxlength="16" placeholder="Ex.: KMNO" value="' + (t ? esc(t.asset) : "") + '"></label>' +
          '<label class="field"><span class="field-label">Título</span><input class="input" id="fTitle" placeholder="Ex.: Loop conservador em Kamino Multiply" value="' + (t ? esc(t.title) : "") + '"></label>' +
        '</div>' +
        (t ? "" :
        '<label class="field" style="margin-top:14px;display:block"><span class="field-label">Tese inicial (opcional)</span>' +
          '<textarea class="input" id="fContent" style="min-height:90px" placeholder="Qual é a sua visão? Riscos, APY esperado, condições de saída…"></textarea></label>' +
        '<label class="field" style="margin-top:14px;display:block"><span class="field-label">Status inicial</span>' +
          '<select class="select" id="fStatus"><option value="planejada">Planejada (fila)</option><option value="andamento" selected>Em andamento</option></select></label>') +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
          '<button class="btn btn-primary" id="fSave">' + (t ? "Salvar" : "Criar tese") + '</button>' +
          '<button class="btn" id="fCancel">Cancelar</button>' +
        '</div>' +
      '</div>';

    U.qs("#fCancel").addEventListener("click", closeForm);
    U.qs("#fSave").addEventListener("click", function () {
      var asset = U.qs("#fAsset").value.trim().toUpperCase();
      var title = U.qs("#fTitle").value.trim();
      if (!asset || !title) { U.toast("Informe o ativo e o título da tese.", "warn"); return; }
      if (t) {
        T.update(t.id, { asset: asset, title: title }, "Metadados atualizados.");
        U.toast("Tese atualizada.", "ok");
      } else {
        T.create({
          module: "defi", asset: asset, title: title,
          content: (U.qs("#fContent").value || "").trim(),
          status: U.qs("#fStatus").value
        });
        U.toast("Tese criada.", "ok");
      }
      closeForm(); refresh();
    });
    host.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() {
    editingId = null;
    var host = U.qs("#tForm");
    host.style.display = "none";
    host.innerHTML = "";
  }

  /* ---------- refresh ---------- */
  function refresh() { renderKpis(); renderList(); }

  U.qs("#btnNova").addEventListener("click", function () { openForm(null); });
  U.qs("#tSearch").addEventListener("input", renderList);
  U.qs("#tStatus").addEventListener("change", renderList);
  if (T && T.onChange) T.onChange(refresh);

  refresh();
})();
