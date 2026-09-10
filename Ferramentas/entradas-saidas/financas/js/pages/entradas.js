/* ============================================================
   entradas.js — controller da página "Entradas" (VISUALIZAÇÃO)
   ------------------------------------------------------------
   Não existe cadastro aqui. Os lançamentos vêm da página
   "Planejar" (fonte única). Esta página só mostra: totais,
   gráfico por origem e o histórico das ENTRADAS.

   Portado de js/entradas.js (v1), adaptado para:
   - Inicializar direto no DOMContentLoaded (sem o evento
     "finance-cloud-ready" — local-first, sem nuvem).
   - Link do estado vazio aponta para planejar.html (nova página
     de lançamento no shell ATLAS).
   - Cor do gráfico lida de window.FinanceCharts.colors.green
     (tokens ATLAS), como já era na v1.

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML (innerHTML) a
   partir de `state` (lido do localStorage pelo próprio app, via
   FinanceUtils.getState -- mesma origem, sem rede ou terceiros) e
   de textos fixos deste arquivo. Não há entrada de rede sendo
   injetada; mesmo padrão ja usado em financas/js/app-bridge.js.
   ============================================================ */
(function () {
  function filteredEntries(state) {
    const query = document.querySelector("#entradaSearch")?.value.trim().toLowerCase() || "";
    const month = document.querySelector("#entradaMonth")?.value || "all";

    return state.entries.filter((item) => {
      const matchesQuery = `${item.source} ${item.description}`.toLowerCase().includes(query);
      const matchesMonth = month === "all" || FinanceUtils.getMonthKey(item.date) === month;
      return matchesQuery && matchesMonth;
    });
  }

  function renderCards(state) {
    const rows = state.entries;
    const total = rows.reduce((acc, r) => acc + r.value, 0);
    const maior = rows.reduce((best, r) => (r.value > (best ? best.value : 0) ? r : best), null);

    FinanceUtils.countUpCurrency("[data-entradas-total]", total);
    FinanceUtils.countUpCurrency("[data-entradas-maior]", maior ? maior.value : 0);
    FinanceUtils.setText("[data-entradas-maior-nome]", maior ? maior.source : "—");
    FinanceUtils.setText("[data-entradas-fontes]", String(rows.length));
    FinanceUtils.countUpCurrency("[data-entradas-media]", rows.length ? total / rows.length : 0);
  }

  function renderTable(state) {
    const rows = filteredEntries(state);
    const tbody = document.querySelector("#entradasTableBody");
    if (!rows.length) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="fx-empty-cell">Nenhuma entrada ainda. Lance seus valores na página <a href="planejar.html">Planejar</a>.</td></tr>';
      }
      return;
    }
    FinanceUtils.renderRows(tbody, rows, (item) => `
      <tr>
        <td>${FinanceUtils.formatDate(item.date)}</td>
        <td>${item.source}</td>
        <td>${item.description}</td>
        <td><span class="fx-tag fx-tag--green">Receita</span></td>
        <td class="fx-text-pos">${FinanceUtils.formatCurrency(item.value)}</td>
      </tr>
    `);
  }

  function renderChart(state) {
    /* Top origens pelo valor (funciona com qualquer rótulo do planejamento) */
    const porOrigem = {};
    state.entries.forEach((r) => {
      porOrigem[r.source] = (porOrigem[r.source] || 0) + r.value;
    });
    const top = Object.entries(porOrigem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    FinanceCharts.barChart("#entradasFonteChart", {
      labels: top.length ? top.map(([nome]) => (nome.length > 14 ? nome.slice(0, 13) + "…" : nome)) : ["Sem dados"],
      datasets: [
        {
          label: "Receitas",
          color: FinanceCharts.colors.green,
          values: top.length ? top.map(([, valor]) => valor) : [0]
        }
      ]
    });
  }

  function bindFilters() {
    ["#entradaSearch", "#entradaMonth"].forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.addEventListener("input", () => renderTable(FinanceUtils.getState()));
      }
    });
  }

  function boot() {
    const state = FinanceUtils.refreshSummary(FinanceUtils.getState());
    FinanceUtils.saveState(state);
    FinanceUtils.fillMonthSelect("#entradaMonth", state);
    renderCards(state);
    renderTable(state);
    renderChart(state);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "entradas") {
      return;
    }
    boot();
    bindFilters();
  });
})();
