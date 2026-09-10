/* ============================================================
   relatorios.js — controller da página "Relatórios" (VISUALIZAÇÃO)
   ------------------------------------------------------------
   Comparativo mensal / trimestral / anual (gráfico + tabela) e
   exportação em CSV (botão "Exportar Excel") e impressão/PDF
   (botão "Exportar PDF", via window.print()).

   Portado de js/relatorios.js (v1) sem mudanças de comportamento:
   já inicializava direto no DOMContentLoaded (sem depender de
   "finance-cloud-ready" — não havia esse listener nesta página).
   Cores dos gráficos já vinham de window.FinanceCharts.colors
   (verde/vermelho — tokens ATLAS), preservadas como estavam.

   Nota: os totais mensal/trimestral/anual abaixo são valores fixos
   de exemplo (mesma origem da v1) — esta página não lê state.*
   ainda; é o mesmo comportamento herdado da versão original.

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML (innerHTML) a
   partir de dados fixos deste arquivo (sem entrada de rede ou de
   terceiros) — mesmo padrão já usado em financas/js/app-bridge.js.
   ============================================================ */
(function () {
  const datasets = {
    mensal: {
      labels: ["Jan", "Fev", "Mar"],
      receitas: [1620, 1840, 2000],
      despesas: [1510, 1680, 1810]
    },
    trimestral: {
      labels: ["1T", "2T", "3T", "4T"],
      receitas: [5460, 0, 0, 0],
      despesas: [5000, 0, 0, 0]
    },
    anual: {
      labels: ["2024", "2025", "2026"],
      receitas: [18600, 21900, 5460],
      despesas: [17200, 20500, 5000]
    }
  };

  function renderChart(view) {
    const data = datasets[view] || datasets.mensal;
    FinanceCharts.barChart("#relatoriosComparativoChart", {
      labels: data.labels,
      datasets: [
        { label: "Receitas", color: FinanceCharts.colors.green, values: data.receitas },
        { label: "Despesas", color: FinanceCharts.colors.red, values: data.despesas }
      ]
    });
  }

  function renderTable(view) {
    const data = datasets[view] || datasets.mensal;
    const rows = data.labels.map((label, index) => {
      const receita = data.receitas[index];
      const despesa = data.despesas[index];
      return { label, receita, despesa, saldo: receita - despesa };
    });

    FinanceUtils.renderRows(document.querySelector("#relatoriosTableBody"), rows, (row) => `
      <tr>
        <td>${row.label}</td>
        <td class="fx-text-pos">${FinanceUtils.formatCurrency(row.receita)}</td>
        <td class="fx-text-neg">${FinanceUtils.formatCurrency(row.despesa)}</td>
        <td>${FinanceUtils.formatCurrency(row.saldo)}</td>
        <td><span class="fx-tag ${row.saldo >= 0 ? "fx-tag--green" : "fx-tag--red"}">${row.saldo >= 0 ? "Positivo" : "Atenção"}</span></td>
      </tr>
    `);
  }

  function bindSegments() {
    document.querySelectorAll("[data-report-view]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-report-view]").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        renderChart(button.dataset.reportView);
        renderTable(button.dataset.reportView);
      });
    });
  }

  function bindExports() {
    const excelButton = document.querySelector("#exportExcel");
    const pdfButton = document.querySelector("#exportPdf");

    if (excelButton) {
      excelButton.addEventListener("click", () => {
        const view = document.querySelector("[data-report-view].is-active")?.dataset.reportView || "mensal";
        const data = datasets[view] || datasets.mensal;
        const rows = [["Período", "Receitas", "Despesas", "Saldo"]];
        data.labels.forEach((label, index) => {
          rows.push([label, data.receitas[index], data.despesas[index], data.receitas[index] - data.despesas[index]]);
        });
        FinanceUtils.downloadText("relatorio-financeiro.csv", FinanceUtils.toCsv(rows), "text/csv;charset=utf-8");
        FinanceUtils.toast("Relatório exportado em CSV.");
      });
    }

    if (pdfButton) {
      pdfButton.addEventListener("click", () => window.print());
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "relatorios") {
      return;
    }

    renderChart("mensal");
    renderTable("mensal");
    bindSegments();
    bindExports();
  });
})();
