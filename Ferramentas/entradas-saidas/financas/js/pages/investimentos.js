/* ============================================================
   investimentos.js — controller da página "Investimentos"
   ------------------------------------------------------------
   Reformulada como acompanhamento pessoal do APORTE MENSAL:
   quanto você guardou/investiu em cada mês. Não é uma
   mini-carteira — sem preços de ativos, sem alocação, sem
   rentabilidade. Isso conflitava com os módulos de cripto do
   ATLAS (Hold/Trade/DeFi/RWA), que já cobrem isso de verdade.

   state.investments = { monthly: [{ id, month: "YYYY-MM", value }], invested }
   `invested` = soma de todos os aportes. O campo é mantido com
   este nome porque a Visão geral (financas/js/core/finance.js,
   refreshSummary) lê state.investments.invested para preencher
   o card "Investido" do dashboard — não pode quebrar.

   MIGRAÇÃO (leve, idempotente, só nesta página — não em
   financas/js/core/store.js, que é testado e fica enxuto):
   o formato antigo (mini-carteira com `assets`/`invested`/
   `emergencyReserve`/`availableCash`/`profitability`/
   `allocation`) vira um único aporte no mês atual, somando o
   total investido; o resto (reserva, caixa, rentabilidade) é
   descartado. Roda no boot(). Se o estado já é o formato novo
   (ou está vazio), só normaliza números/ids — sem duplicar nada
   ao recarregar.

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: assim como em financas/js/pages/despesas.js
   e entradas.js, as funções abaixo montam HTML (via innerHTML)
   estritamente a partir de `state` local (lido do localStorage
   pelo próprio app — mesma origem, sem rede/terceiros) e de
   templates fixos deste arquivo. Não há entrada de rede sendo
   injetada; é o mesmo padrão já auditado no restante do módulo
   financas/js/pages/*.js e financas/js/app-bridge.js.
   ============================================================ */
(function () {
  function currentMonthKey() {
    return new Date().toISOString().slice(0, 7);
  }

  function sumMonthly(monthly) {
    return monthly.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  }

  function sortedMonthly(monthly) {
    return [...monthly].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  }

  function shortMonthLabel(key) {
    const [year, month] = String(key).split("-");
    const names = FinanceUtils.MONTH_NAMES || [];
    const name = names[Number(month) - 1] || key;
    return `${name.slice(0, 3)}/${String(year).slice(2)}`;
  }

  /* Migra o formato antigo (mini-carteira) para { monthly, invested }.
     Idempotente: se já é o formato novo, só normaliza números/ids;
     se é vazio, só zera. Nunca duplica um aporte já migrado. */
  function migrateInvestments(inv) {
    inv = inv || {};

    if (Array.isArray(inv.monthly)) {
      const monthly = inv.monthly.map((item) => ({
        id: item.id || FinanceUtils.uid("aporte"),
        month: item.month || currentMonthKey(),
        value: Number(item.value) || 0
      }));
      return { monthly, invested: sumMonthly(monthly) };
    }

    let total = 0;
    if (Array.isArray(inv.assets) && inv.assets.length) {
      total = inv.assets.reduce((acc, asset) => acc + (Number(asset.value) || 0), 0);
    } else if (Number(inv.invested) > 0) {
      total = Number(inv.invested);
    }

    const monthly = total > 0 ? [{ id: FinanceUtils.uid("aporte"), month: currentMonthKey(), value: total }] : [];
    return { monthly, invested: sumMonthly(monthly) };
  }

  function getMonthly(state) {
    if (!state.investments || !Array.isArray(state.investments.monthly)) {
      state.investments = migrateInvestments(state.investments);
    }
    return state.investments.monthly;
  }

  function persist(monthly) {
    return FinanceUtils.updateState((state) => {
      state.investments = { monthly, invested: sumMonthly(monthly) };
      return FinanceUtils.refreshSummary(state);
    });
  }

  function renderTotals(state) {
    const monthly = getMonthly(state);
    const mesAtual = currentMonthKey();
    const aporteMes = monthly
      .filter((item) => item.month === mesAtual)
      .reduce((acc, item) => acc + (Number(item.value) || 0), 0);

    FinanceUtils.countUpCurrency("[data-inv-total]", state.investments.invested);
    FinanceUtils.countUpCurrency("[data-inv-mes]", aporteMes);
    FinanceUtils.setText("[data-inv-mes-label]", FinanceUtils.monthLabel(mesAtual));
  }

  function rowTemplate(item) {
    return `
      <div class="fx-row fx-row--aporte" data-aporte-id="${item.id}">
        <input type="month" class="fx-row-month" value="${item.month}" aria-label="Mês do aporte">
        <input type="number" class="fx-row-value" value="${item.value || ""}" min="0" step="0.01" inputmode="decimal" placeholder="0,00" aria-label="Valor guardado no mês">
        <button class="fx-row-remove" type="button" title="Remover aporte" aria-label="Remover aporte">✕</button>
      </div>
    `;
  }

  function renderList(state) {
    const container = document.querySelector("[data-aporte-list]");
    if (!container) {
      return;
    }
    const monthly = sortedMonthly(getMonthly(state));
    container.innerHTML = monthly.length
      ? monthly.map(rowTemplate).join("")
      : '<p class="fx-empty">Nenhum aporte ainda. Clique em "+ Adicionar aporte" para registrar quanto você guardou este mês.</p>';
  }

  function renderChart(state) {
    const monthly = sortedMonthly(getMonthly(state));
    FinanceCharts.barChart("#aporteMesChart", {
      labels: monthly.length ? monthly.map((item) => shortMonthLabel(item.month)) : ["Sem dados"],
      datasets: [
        {
          label: "Aporte",
          color: FinanceCharts.colors.green,
          values: monthly.length ? monthly.map((item) => Number(item.value) || 0) : [0]
        }
      ]
    });
  }

  function renderAll(state) {
    renderTotals(state);
    renderList(state);
    renderChart(state);
  }

  function bindList() {
    const container = document.querySelector("[data-aporte-list]");
    if (!container) {
      return;
    }

    container.addEventListener("input", (event) => {
      const row = event.target.closest("[data-aporte-id]");
      if (!row) {
        return;
      }
      const state = FinanceUtils.getState();
      const monthly = getMonthly(state);
      const item = monthly.find((entry) => entry.id === row.dataset.aporteId);
      if (!item) {
        return;
      }
      if (event.target.classList.contains("fx-row-month")) {
        item.month = event.target.value || currentMonthKey();
      }
      if (event.target.classList.contains("fx-row-value")) {
        item.value = Number(event.target.value) || 0;
      }
      const saved = persist(monthly);
      renderTotals(saved);
      renderChart(saved);
    });

    container.addEventListener("click", (event) => {
      const button = event.target.closest(".fx-row-remove");
      if (!button) {
        return;
      }
      const row = button.closest("[data-aporte-id]");
      const state = FinanceUtils.getState();
      const monthly = getMonthly(state).filter((entry) => entry.id !== row.dataset.aporteId);
      const saved = persist(monthly);
      renderAll(saved);
    });
  }

  function bindAdd() {
    const button = document.querySelector("#aporteAdd");
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      const state = FinanceUtils.getState();
      const monthly = getMonthly(state);
      const newItem = { id: FinanceUtils.uid("aporte"), month: currentMonthKey(), value: 0 };
      monthly.push(newItem);
      const saved = persist(monthly);
      renderAll(saved);
      document.querySelector(`[data-aporte-id="${newItem.id}"] .fx-row-value`)?.focus();
    });
  }

  function boot() {
    let state = FinanceUtils.getState();
    state.investments = migrateInvestments(state.investments);
    state = FinanceUtils.refreshSummary(state);
    FinanceUtils.saveState(state);
    renderAll(state);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "investimentos") {
      return;
    }
    boot();
    bindList();
    bindAdd();
  });
})();
