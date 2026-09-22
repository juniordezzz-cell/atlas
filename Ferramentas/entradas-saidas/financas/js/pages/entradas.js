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
   partir de `state`. Esse estado NÃO é confiável só por ser local:
   ele também chega por importação de backup (Configurações). Todo
   texto livre passa por FinanceUtils.escapeHtml e a data por
   FinanceUtils.formatDate, que só devolve DD/MM/AAAA ou "—" (SEC-001).
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

  /* Cards: o período do filtro de mês, e só o que JÁ foi recebido —
     o rótulo diz "Total recebido". Somavam state.entries inteiro, com o
     salário de dezembro gerado pelo Planejar contado como recebido.

     "Fontes de renda" contava LANÇAMENTOS: o salário recebido 9 vezes
     virava 9 fontes, e a média por fonte saía dividida por 9. Agora
     conta origens distintas. */
  function renderCards(state) {
    const month = document.querySelector("#entradaMonth")?.value || "all";
    const hoje = FinanceUtils.todayKey();
    const rows = state.entries.filter((r) =>
      FinanceUtils.isRealized(r, hoje) && (month === "all" || FinanceUtils.getMonthKey(r.date) === month));
    const total = rows.reduce((acc, r) => acc + r.value, 0);
    const maior = rows.reduce((best, r) => (r.value > (best ? best.value : 0) ? r : best), null);
    const fontes = new Set(rows.map((r) => r.source)).size;

    FinanceUtils.countUpCurrency("[data-entradas-total]", total);
    FinanceUtils.countUpCurrency("[data-entradas-maior]", maior ? maior.value : 0);
    FinanceUtils.setText("[data-entradas-maior-nome]", maior ? maior.source : "—");
    FinanceUtils.setText("[data-entradas-fontes]", String(fontes));
    FinanceUtils.countUpCurrency("[data-entradas-media]", fontes ? total / fontes : 0);
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
    /* Status: o Planejar gera o ano inteiro; o que ainda não chegou
       aparece como "Prevista", apagado, e não entra nos cards. */
    const hoje = FinanceUtils.todayKey();
    FinanceUtils.renderRows(tbody, rows, (item) => {
      const feito = FinanceUtils.isRealized(item, hoje);
      return `
      <tr${feito ? "" : ' class="fx-row-previsto"'}>
        <td>${FinanceUtils.formatDate(item.date)}</td>
        <td>${FinanceUtils.escapeHtml(item.source)}</td>
        <td>${FinanceUtils.escapeHtml(item.description)}</td>
        <td>${feito ? '<span class="fx-tag fx-tag--green">Recebida</span>' : '<span class="fx-tag fx-tag--neutral">Prevista</span>'}</td>
        <td class="fx-text-pos">${FinanceUtils.formatCurrency(item.value)}</td>
      </tr>
    `;
    });
  }

  function renderChart(state) {
    /* Top origens pelo valor (funciona com qualquer rótulo do planejamento) */
    const porOrigem = {};
    const hoje = FinanceUtils.todayKey();
    state.entries.filter((r) => FinanceUtils.isRealized(r, hoje)).forEach((r) => {
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
        element.addEventListener("input", () => {
          const s = FinanceUtils.getState();
          renderCards(s);   // os cards seguem o filtro de mês
          renderTable(s);
        });
      }
    });
  }

  /* O filtro abre no mês atual, quando ele tem lançamento: os cards
     mostram "este mês", que é a pergunta de quem abre a página. */
  function mesAtualNoFiltro(selector) {
    const el = document.querySelector(selector);
    const atual = FinanceUtils.currentMonthKey();
    if (el && [...el.options].some((o) => o.value === atual)) el.value = atual;
  }

  function boot() {
    const state = FinanceUtils.refreshSummary(FinanceUtils.getState());
    FinanceUtils.saveState(state);
    FinanceUtils.fillMonthSelect("#entradaMonth", state);
    mesAtualNoFiltro("#entradaMonth");
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
