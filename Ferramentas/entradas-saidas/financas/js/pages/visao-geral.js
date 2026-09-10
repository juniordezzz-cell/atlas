/* ============================================================
   visao-geral.js — controller da página "Visão geral" (dashboard)
   ------------------------------------------------------------
   Layout "foco no essencial": herói (Saldo do mês) + 3 mini-cards
   (Entradas / Saídas / Investido) + card grande (Fluxo financeiro
   do mês) + três seções reveladas ao rolar (Distribuição das
   despesas, Últimas movimentações, Desempenho mês a mês).

   Portado de js/dashboard.js (v1), adaptado para:
   - Apenas os dois canvases que o layout "foco" usa
     (#cashFlowHero e #cashFlowChart) — sem o donut de despesas,
     a área de saldo e o donut de investimentos da v1 (a
     distribuição já aparece em barras em [data-expense-detail]).
   - Cores lidas de window.FinanceCharts.colors (tokens ATLAS:
     verde/vermelho/ciano), nada hardcoded.
   - Sem nuvem: local-first, roda direto no DOMContentLoaded
     (não existe mais o evento "finance-cloud-ready").

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML a partir de
   `state` (lido do localStorage pelo próprio app, via
   FinanceUtils.getState — mesma origem, sem rede/terceiros) e de
   textos fixos deste arquivo. Não há entrada de usuário vinda de
   rede sendo injetada; mesmo padrão já usado em
   financas/js/app-bridge.js.
   ============================================================ */
(function () {
  /* Boas-vindas (Task 12): estado vazio = sem lançamentos e sem
     planejamento ainda salvo. É o mesmo critério usado por
     FinanceUtils.freshState (financas/js/core/store.js), que
     remove state.planner por completo em vez de deixá-lo vazio. */
  function isEmptyState(state) {
    const noEntries = !state.entries || state.entries.length === 0;
    const noExpenses = !state.expenses || state.expenses.length === 0;
    const noPlanner = !state.planner;
    return noEntries && noExpenses && noPlanner;
  }

  function bindWelcome() {
    const button = document.querySelector("[data-fx-load-example]");
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      const demoState = FinanceUtils.refreshSummary(structuredClone(FinanceUtils.defaultState));
      FinanceUtils.saveState(demoState);
      location.reload();
    });
  }

  function renderSummary(state) {
    FinanceUtils.countUpCurrency("[data-total-entradas]", state.summary.receitas);
    FinanceUtils.countUpCurrency("[data-total-despesas]", state.summary.despesas);
    FinanceUtils.countUpCurrency("[data-saldo-mes]", state.summary.saldo);
    FinanceUtils.countUpCurrency("[data-total-investimentos]", state.summary.investimentos);
    renderMonthNotes(state);
  }

  function monthTotals(state, key) {
    const sumBy = (rows) =>
      rows.filter((item) => FinanceUtils.getMonthKey(item.date) === key).reduce((acc, item) => acc + item.value, 0);
    return { in: sumBy(state.entries), out: sumBy(state.expenses) };
  }

  function deltaLabel(current, previous, invert) {
    if (!previous) {
      return "Sem dados do mês anterior";
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    const arrow = pct >= 0 ? "↑" : "↓";
    const good = invert ? pct <= 0 : pct >= 0;
    const cls = good ? "fx-text-pos" : "fx-text-neg";
    return `<span class="${cls}">${arrow} ${Math.abs(pct)}%</span> vs mês anterior`;
  }

  function renderMonthNotes(state) {
    const keys = FinanceUtils.monthOptions(state);
    const setNote = (selector, html) => {
      const element = document.querySelector(selector);
      if (element) {
        element.innerHTML = html;
      }
    };

    if (!keys.length) {
      setNote("[data-note-entradas]", "Sem lançamentos ainda");
      setNote("[data-note-despesas]", "Sem lançamentos ainda");
      setNote("[data-note-saldo]", "Sem lançamentos ainda");
      return;
    }

    const current = monthTotals(state, keys[0]);
    const previous = keys[1] ? monthTotals(state, keys[1]) : null;

    setNote("[data-note-entradas]", deltaLabel(current.in, previous?.in, false));
    setNote("[data-note-despesas]", deltaLabel(current.out, previous?.out, true));

    const saldoCurrent = current.in - current.out;
    const saldoPrevious = previous ? previous.in - previous.out : null;
    setNote(
      "[data-note-saldo]",
      saldoPrevious === null || saldoPrevious === 0
        ? "Sem dados do mês anterior"
        : deltaLabel(saldoCurrent, saldoPrevious, false)
    );
  }

  function renderExpenseDetails(state) {
    const container = document.querySelector("[data-expense-detail]");
    if (!container) {
      return;
    }

    if (!state.categories.length) {
      container.innerHTML = '<p class="fx-empty">Cadastre despesas para ver a distribuição por categoria.</p>';
      return;
    }

    const total = state.categories.reduce((sum, item) => sum + item.value, 0) || 1;
    container.innerHTML = state.categories
      .map((item) => {
        const width = Math.round((item.value / total) * 100);
        return `
          <div class="fx-progress-item">
            <span>${item.name}</span>
            <span class="fx-progress-track"><span class="fx-progress-fill" style="--value: ${width}%"></span></span>
            <strong>${FinanceUtils.formatCurrency(item.value)}</strong>
          </div>
        `;
      })
      .join("");
  }

  function renderTransactions(state) {
    const container = document.querySelector("[data-last-transactions]");
    if (!container) {
      return;
    }

    const rows = [
      ...state.entries.map((item) => ({ ...item, kind: "Entrada" })),
      ...state.expenses.map((item) => ({ ...item, kind: "Despesa" }))
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    if (!rows.length) {
      container.innerHTML = '<p class="fx-empty">Nenhuma movimentação registrada ainda.</p>';
      return;
    }

    container.innerHTML = rows
      .map((item) => {
        const valueClass = item.kind === "Entrada" ? "fx-text-pos" : "fx-text-neg";
        const sign = item.kind === "Entrada" ? "+" : "-";
        return `
          <div class="fx-transaction-item">
            <div>
              <p>${item.description}</p>
              <small>${item.kind} · ${FinanceUtils.formatDate(item.date)}</small>
            </div>
            <strong class="${valueClass}">${sign} ${FinanceUtils.formatCurrency(item.value)}</strong>
          </div>
        `;
      })
      .join("");
  }

  function renderMonthlyPerformance(state) {
    const container = document.querySelector("[data-monthly-performance]");
    if (!container) {
      return;
    }

    const months = {};
    state.entries.forEach((item) => {
      const key = FinanceUtils.getMonthKey(item.date);
      months[key] = months[key] || { in: 0, out: 0 };
      months[key].in += item.value;
    });
    state.expenses.forEach((item) => {
      const key = FinanceUtils.getMonthKey(item.date);
      months[key] = months[key] || { in: 0, out: 0 };
      months[key].out += item.value;
    });

    const keys = Object.keys(months).sort().reverse().slice(0, 6);
    if (!keys.length) {
      container.innerHTML = '<p class="fx-empty">Cadastre entradas e despesas para acompanhar sua evolução mensal.</p>';
      return;
    }

    const max = Math.max(...keys.map((key) => Math.max(months[key].in, months[key].out)), 1);

    container.innerHTML = keys
      .map((key) => {
        const data = months[key];
        const saldo = data.in - data.out;
        const saldoClass = saldo >= 0 ? "fx-text-pos" : "fx-text-neg";
        const inWidth = Math.round((data.in / max) * 100);
        const outWidth = Math.round((data.out / max) * 100);
        return `
          <div class="fx-month-row">
            <div class="fx-month-row-head">
              <h3>${FinanceUtils.monthLabel(key)}</h3>
              <span class="fx-month-saldo ${saldoClass}">${saldo >= 0 ? "sobrou" : "faltou"} ${FinanceUtils.formatCurrency(Math.abs(saldo))}</span>
            </div>
            <div class="fx-month-bars">
              <div class="fx-month-bar">
                <span>Entradas</span>
                <span class="fx-month-bar-track"><span class="fx-month-bar-fill fx-month-bar-fill--green" style="--value: ${inWidth}%"></span></span>
                <strong>${FinanceUtils.formatCurrency(data.in)}</strong>
              </div>
              <div class="fx-month-bar">
                <span>Saídas</span>
                <span class="fx-month-bar-track"><span class="fx-month-bar-fill fx-month-bar-fill--red" style="--value: ${outWidth}%"></span></span>
                <strong>${FinanceUtils.formatCurrency(data.out)}</strong>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /* Apenas os dois canvases do layout "foco":
     - cashFlowHero: mini tendência (evolução do saldo, state.netWorth)
     - cashFlowChart: fluxo do mês — entradas x saídas (state.cashFlow) */
  function renderCharts(state) {
    const cor = FinanceCharts.colors;

    FinanceCharts.areaChart("#cashFlowHero", {
      labels: state.netWorth.labels,
      datasets: [
        { label: "Saldo", values: state.netWorth.values, color: cor.cyan, fill: `${cor.cyan}33` }
      ]
    });

    FinanceCharts.lineChart("#cashFlowChart", {
      labels: state.cashFlow.labels,
      datasets: [
        { label: "Entradas", values: state.cashFlow.receitas, color: cor.green, fill: `${cor.green}26` },
        { label: "Saídas", values: state.cashFlow.despesas, color: cor.red, fill: `${cor.red}26` }
      ]
    });
  }

  /* Revelação suave ao rolar — apenas visual, não esconde conteúdo
     de quem não tem JS/IntersectionObserver (fica visível por padrão
     via CSS; a classe .fx-reveal só ganha a transição quando o
     IntersectionObserver está disponível). */
  function setupReveal() {
    const items = document.querySelectorAll(".fx-reveal");
    if (!items.length) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((el) => observer.observe(el));
  }

  function boot() {
    const state = FinanceUtils.refreshSummary(FinanceUtils.getState());
    FinanceUtils.saveState(state);

    const welcome = document.querySelector("[data-fx-welcome]");
    const content = document.querySelector("[data-fx-dashboard-content]");
    const empty = isEmptyState(state);
    if (welcome) {
      welcome.hidden = !empty;
    }
    if (content) {
      content.hidden = empty;
    }
    if (empty) {
      return;
    }

    renderSummary(state);
    renderExpenseDetails(state);
    renderMonthlyPerformance(state);
    renderTransactions(state);
    renderCharts(state);
    setupReveal();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "dashboard") {
      return;
    }
    bindWelcome();
    boot();
  });
})();
