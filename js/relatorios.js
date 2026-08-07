/* ============================================================
   ATLAS · js/relatorios.js   (Etapa 4)
   ------------------------------------------------------------
   Página de Relatórios — POR CARTEIRA. Escolhe-se uma carteira
   (global ou local) e uma granularidade (mês/trim/sem/ano); tudo
   vem do AtlasMovements. Gráfico (Chart.js), comparação entre
   períodos, projeção por tendência e calendário do mês.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- i18n ---------- */
  if (window.AtlasI18n) {
    AtlasI18n.add("en", {
      "Escolha a carteira do relatório": "Choose the report wallet",
      "Carteira": "Wallet", "Período": "Period",
      "Mensal": "Monthly", "Trimestral": "Quarterly", "Semestral": "Half-year", "Anual": "Yearly",
      "Entradas": "Inflows", "Saídas": "Outflows", "Resultado": "Result", "Fluxo líquido": "Net flow",
      "no período": "in the period", "aportes": "contributions", "realizações": "realizations",
      "performance realizada": "realized performance", "entradas − saídas": "inflows − outflows",
      "Fluxo por período": "Flow by period", "Comparação entre períodos": "Period comparison",
      "Calendário do mês": "Month calendar", "Movimentos recentes": "Recent movements",
      "vs. anterior": "vs. previous", "Projeção do próximo período": "Next-period projection",
      "estimativa por tendência linear": "linear-trend estimate",
      "Sem movimentos nesta carteira": "No movements in this wallet",
      "Os relatórios aparecem quando houver entradas, saídas ou resultados registrados.":
        "Reports appear once there are recorded inflows, outflows or results.",
      "Net": "Net", "Projeção": "Projection", "Global": "Global", "Local": "Local"
    });
  }
  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }
  function locale() { return (window.AtlasSettings && AtlasSettings.get("lang") === "en") ? "en-US" : "pt-BR"; }

  /* ---------- helpers ---------- */
  /* Dinheiro — delegado ao AtlasCurrency. O valor está sempre em USD
     (regra de armazenamento); a conversão é camada de exibição. */
  function money(v) {
    if (window.AtlasCurrency) return AtlasCurrency.format(v, { decimals: 0 });
    var sign = v < 0 ? "-" : "";
    return sign + "US$ " + Math.abs(Math.round(v)).toLocaleString(locale());
  }
  function pct(v) { return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function tok(name, fb) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
    catch (e) { return fb; }
  }
  function el(id) { return document.getElementById(id); }

  var PERIODS = { month: "Mensal", quarter: "Trimestral", semester: "Semestral", year: "Anual" };
  var state = { walletId: null, period: "month" };
  var chart = null, calInst = null;

  /* ---------- projeção (regressão linear no net dos buckets) ---------- */
  function projectNext(nets) {
    var n = nets.length;
    if (n < 2) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var x = 0; x < n; x++) { sx += x; sy += nets[x]; sxx += x * x; sxy += x * nets[x]; }
    var d = n * sxx - sx * sx;
    if (!d) return null;
    var b = (n * sxy - sx * sy) / d, a = (sy - b * sx) / n;
    return a + b * n;
  }

  /* ---------- seletores ---------- */
  /* Carteira: MESMO componente compartilhado do Dashboard e dos
     módulos (wallets/walletSelector.*), com as mesmas funções —
     trocar, criar global, criar local, renomear, excluir. Era um
     <select> nativo, que além de destoar de tudo não deixava criar
     nada. scope "all" porque o relatório pode ser sobre qualquer
     carteira, inclusive as locais de outros módulos. */
  function fillWallets() {
    var host = el("repWallet");
    if (!host || !window.AtlasWallets || !window.WalletSelector) return;
    var all = AtlasWallets.all();
    var keep = state.walletId && all.some(function (w) { return w.id === state.walletId; });
    if (!keep) state.walletId = (AtlasWallets.activeGlobalId && AtlasWallets.activeGlobalId()) || (all[0] && all[0].id);

    window.WalletSelector.render(host, {
      module: "relatorios",
      scope: "all",
      getActive: function () { return AtlasWallets.get(state.walletId) || AtlasWallets.activeGlobal(); },
      onSelect: function (id) { state.walletId = id; render(); },
      afterChange: function (w, acao) {
        state.walletId = (acao === "remove") ? AtlasWallets.activeGlobalId() : w.id;
        render();
      }
    });
  }
  function fillPeriods() {
    var sel = el("repPeriod");
    if (!sel) return;
    sel.innerHTML = Object.keys(PERIODS).map(function (k) {
      return '<option value="' + k + '">' + t(PERIODS[k]) + "</option>";
    }).join("");
    sel.value = state.period;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- render principal ---------- */
  function render() {
    if (!window.AtlasMovements) return;
    var list = AtlasMovements.list({ walletId: state.walletId });
    var body = el("repBody"), empty = el("repEmpty");

    if (!list.length) {
      if (body) body.style.display = "none";
      if (empty) empty.style.display = "block";
      if (chart) { chart.destroy(); chart = null; }
      return;
    }
    if (body) body.style.display = "";
    if (empty) empty.style.display = "none";

    var sum = AtlasMovements.summarize(list);
    var buckets = AtlasMovements.compareBuckets(AtlasMovements.groupByPeriod(list, state.period));

    renderKPIs(sum);
    renderChart(buckets);
    renderCompare(buckets);
    renderProjection(buckets);
    renderCalendar();
    renderMoves(list);
  }

  function renderKPIs(sum) {
    var host = el("repKpis");
    if (!host) return;
    var net = sum.net;
    host.innerHTML =
      kpi("Entradas", money(sum.entrada), t("aportes"), "pos") +
      kpi("Saídas", money(sum.saida), t("realizações"), "neg") +
      kpi("Resultado", money(sum.resultado), t("performance realizada"), sum.resultado >= 0 ? "pos" : "neg") +
      kpi("Fluxo líquido", money(net), t("entradas − saídas"), net >= 0 ? "pos" : "neg");
  }
  function kpi(label, value, sub, sign) {
    var cls = sign === "pos" ? " is-pos" : sign === "neg" ? " is-neg" : "";
    return '<div class="rep-kpi' + cls + '">' +
      '<div class="rep-kpi__label">' + escapeHtml(t(label)) + "</div>" +
      '<div class="rep-kpi__value">' + escapeHtml(value) + "</div>" +
      '<div class="rep-kpi__sub">' + escapeHtml(sub) + "</div></div>";
  }

  function renderChart(buckets) {
    var canvas = el("repChart");
    if (!canvas || !window.Chart || !canvas.getContext) return;

    var pos = tok("--atlas-pos", "#22c55e"), neg = tok("--atlas-neg", "#ef4444"),
        acc = tok("--atlas-accent", "#00BFFF"), txt = tok("--atlas-text-mut", "#9fb0c9"),
        grid = tok("--atlas-hairline", "rgba(150,170,200,.12)");

    var labels = buckets.map(function (b) { return b.label; });
    var entradas = buckets.map(function (b) { return Math.round(b.entrada); });
    var saidas = buckets.map(function (b) { return Math.round(b.saida); });
    var nets = buckets.map(function (b) { return Math.round(b.net); });

    // projeção: adiciona 1 rótulo e uma linha tracejada do último net até a projeção
    var proj = projectNext(nets);
    var projData = null;
    if (proj != null) {
      labels = labels.concat([t("Projeção")]);
      entradas = entradas.concat([null]); saidas = saidas.concat([null]); nets = nets.concat([null]);
      projData = nets.map(function () { return null; });
      projData[buckets.length - 1] = Math.round(buckets[buckets.length - 1].net);
      projData[buckets.length] = Math.round(proj);
    }

    var datasets = [
      { type: "bar", label: t("Entradas"), data: entradas, backgroundColor: pos, borderRadius: 4, maxBarThickness: 28 },
      { type: "bar", label: t("Saídas"), data: saidas, backgroundColor: neg, borderRadius: 4, maxBarThickness: 28 },
      { type: "line", label: t("Net"), data: nets, borderColor: acc, backgroundColor: acc, tension: 0.3, pointRadius: 3, borderWidth: 2, spanGaps: false }
    ];
    if (projData) datasets.push({
      type: "line", label: t("Projeção"), data: projData, borderColor: acc, borderDash: [5, 4],
      pointRadius: 2, borderWidth: 2, tension: 0
    });

    if (chart) chart.destroy();
    chart = new Chart(canvas.getContext("2d"), {
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: txt, usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: function (c) { return c.dataset.label + ": " + money(c.parsed.y || 0); } }
          }
        },
        scales: {
          x: { grid: { color: grid }, ticks: { color: txt, font: { size: 11 } } },
          y: { grid: { color: grid }, ticks: { color: txt, font: { size: 11 }, callback: function (v) { return money(v); } } }
        }
      }
    });
  }

  function renderCompare(buckets) {
    var host = el("repCompare");
    if (!host) return;
    var rows = buckets.map(function (b) {
      var deltaCell = "—";
      if (b.deltaNet != null) {
        var up = b.deltaNet >= 0;
        var arrow = up
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 15 6-6 6 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>';
        var txt = b.deltaPct != null ? pct(b.deltaPct) : money(b.deltaNet);
        deltaCell = '<span class="rep-delta ' + (up ? "val-pos" : "val-neg") + '">' + arrow + escapeHtml(txt) + "</span>";
      }
      return "<tr><td>" + escapeHtml(b.label) + "</td>" +
        '<td class="val-pos">' + escapeHtml(money(b.entrada)) + "</td>" +
        '<td class="val-neg">' + escapeHtml(money(b.saida)) + "</td>" +
        '<td class="' + (b.net >= 0 ? "val-pos" : "val-neg") + '">' + escapeHtml(money(b.net)) + "</td>" +
        "<td>" + deltaCell + "</td></tr>";
    }).join("");
    host.innerHTML =
      "<thead><tr><th>" + t("Período") + "</th><th>" + t("Entradas") + "</th><th>" + t("Saídas") +
      "</th><th>" + t("Net") + "</th><th>" + t("vs. anterior") + "</th></tr></thead><tbody>" + rows + "</tbody>";
  }

  function renderProjection(buckets) {
    var host = el("repProj");
    if (!host) return;
    var proj = projectNext(buckets.map(function (b) { return b.net; }));
    if (proj == null) { host.style.display = "none"; return; }
    host.style.display = "flex";
    host.querySelector(".rep-proj__value").textContent = money(proj);
  }

  function renderCalendar() {
    var host = el("repCal");
    if (!host || !window.AtlasCalendar) return;
    if (calInst) { calInst.destroy(); calInst = null; }
    calInst = AtlasCalendar.month({ walletId: state.walletId, value: new Date().toISOString().slice(0, 10) });
    host.innerHTML = "";
    host.appendChild(calInst.el);
  }

  function renderMoves(list) {
    var host = el("repMoves");
    if (!host) return;
    var recent = list.slice().reverse().slice(0, 8);
    host.innerHTML = recent.map(function (m) {
      var signCls = m.tipo === "entrada" ? "entrada" : m.tipo === "saida" ? "saida" : "resultado";
      var prefix = m.tipo === "saida" ? "-" : m.tipo === "entrada" ? "+" : "";
      return '<div class="rep-move"><span class="rep-move__dot ' + signCls + '"></span>' +
        '<div class="rep-move__main"><div class="rep-move__label">' + escapeHtml(m.label || t(PERIODS[state.period])) + "</div>" +
        '<div class="rep-move__meta">' + escapeHtml((m.module || "").toUpperCase()) + " · " +
        escapeHtml(AtlasCalendar ? AtlasCalendar._fmtDisplay(m.date) : m.date) + "</div></div>" +
        '<div class="rep-move__val ' + signCls + '">' + prefix + escapeHtml(money(m.valorUSD)) + "</div></div>";
    }).join("");
  }

  /* ---------- eventos ---------- */
  function wire() {
    var p = el("repPeriod");
    /* a carteira não tem listener aqui: quem trata o clique é o
       componente compartilhado, que devolve por onSelect/afterChange */
    if (p) p.addEventListener("change", function () { state.period = p.value; render(); });
    if (window.AtlasSettings && AtlasSettings.on) {
      AtlasSettings.on(function () { fillPeriods(); render(); });
    }
    // novos movimentos gravados em outra aba/módulo
    document.addEventListener("atlas:movement", render);
    /* Carteira criada/removida em qualquer lugar: o seletor se repinta
       sozinho (assinatura própria dele). Aqui só refazemos o relatório,
       e garantimos que state.walletId não ficou apontando para uma
       carteira excluída. */
    if (window.AtlasWallets && AtlasWallets.subscribe) {
      AtlasWallets.subscribe(function () {
        if (!AtlasWallets.get(state.walletId)) state.walletId = AtlasWallets.activeGlobalId();
        render();
      });
    }
  }

  function init() {
    fillWallets();
    fillPeriods();
    wire();
    render();

    /* Trocar a moeda repinta os valores do relatório. */
    if (window.AtlasBoot && AtlasBoot.onRepaint) {
      AtlasBoot.onRepaint(function () {
        try { fillPeriods(); render(); }
        catch (e) { if (window.console) console.error(e); }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
