/* ============================================================
   despesas.js — controller da página "Despesas" (VISUALIZAÇÃO)
   ------------------------------------------------------------
   Não existe cadastro de gastos aqui (exceto a lista de compras,
   que é um rascunho antes do lançamento). Os lançamentos formais
   vêm da página "Planejar" (fonte única). Esta página mostra:
   totais por tipo, tabelas, gráficos e a "Lista de compras do
   mês" (mini-feature que lança despesas ao marcar itens pagos).

   Portado de js/despesas.js (v1), adaptado para:
   - Inicializar direto no DOMContentLoaded (sem o evento
     "finance-cloud-ready" — local-first, sem nuvem).
   - Link do estado vazio aponta para planejar.html.
   - Cores dos gráficos lidas de window.FinanceCharts.colors.red
     (tokens ATLAS). O segundo tom (gastos não fixos) é derivado
     do token --vermelho via color-mix(), resolvido em tempo de
     execução com getComputedStyle — nada de cor hexadecimal fixa.

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML (innerHTML) a
   partir de `state` (lido do localStorage pelo próprio app, via
   FinanceUtils.getState -- mesma origem, sem rede ou terceiros) e
   de textos fixos deste arquivo. Não há entrada de rede sendo
   injetada; mesmo padrão ja usado em financas/js/app-bridge.js.
   ============================================================ */
(function () {
  /* Deriva um tom mais escuro do token --vermelho (tema atual) sem
     hardcodar hex. Dois passos, porque o contexto 2D do canvas NÃO
     resolve var(--token) (fillStyle é um <color> "solto", fora da
     cascata CSS) mas ENTENDE color-mix() com cores literais:
       1) lê o valor computado de --vermelho no tema atual via
          getComputedStyle(documentElement) — já resolvido pelo
          navegador para o tema ativo (dark/light);
       2) pinta 1 pixel de canvas com color-mix(in srgb, <literal>
          70%, #000) e lê o pixel de volta em #rrggbb — formato que
          o motor de gráficos (financas/js/ui/charts.js) espera,
          já que ele monta gradientes concatenando "cor + alfa em
          hex" (ex.: dataset.color + "55"). */
  function deriveToneFromToken(tokenName, mixPercent, fallback) {
    try {
      const base = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
      if (!base) {
        return fallback;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = `color-mix(in srgb, ${base} ${mixPercent}%, #000)`;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const toHex = (n) => n.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (err) {
      return fallback;
    }
  }

  function getFilteredExpenses(state) {
    const month = document.querySelector("#despesaMonth")?.value || "all";
    const category = document.querySelector("#despesaCategory")?.value || "all";

    return state.expenses.filter((item) => {
      const matchesMonth = month === "all" || FinanceUtils.getMonthKey(item.date) === month;
      const matchesCategory = category === "all" || item.category === category;
      return matchesMonth && matchesCategory;
    });
  }

  function renderCards(state) {
    const TYPES = FinanceUtils.EXPENSE_TYPES;
    const summary = FinanceUtils.summarizeExpenses(state.expenses);
    FinanceUtils.setText("[data-despesas-total]", FinanceUtils.formatCurrency(summary.total));
    FinanceUtils.setText("[data-despesas-essenciais]", FinanceUtils.formatCurrency(summary.byType[TYPES.fixed] || 0));
    FinanceUtils.setText("[data-despesas-nao-essenciais]", FinanceUtils.formatCurrency(summary.byType[TYPES.variable] || 0));
    const categorias = Object.values(summary.byCategory);
    FinanceUtils.setText("[data-despesas-maior]", FinanceUtils.formatCurrency(categorias.length ? Math.max(...categorias) : 0));
  }

  function renderTables(state) {
    const rows = getFilteredExpenses(state);
    const tbody = document.querySelector("#despesasTableBody");
    if (!rows.length) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="fx-empty-cell">Nenhuma saída ainda. Lance seus gastos na página <a href="planejar.html">Planejar</a>.</td></tr>';
      }
      return;
    }
    FinanceUtils.renderRows(tbody, rows, (item) => `
      <tr>
        <td>${FinanceUtils.formatDate(item.date)}</td>
        <td>${item.category}</td>
        <td>${item.description}</td>
        <td><span class="fx-tag fx-tag--red">${item.type}</span></td>
        <td class="fx-text-neg">${FinanceUtils.formatCurrency(item.value)}</td>
      </tr>
    `);
  }

  function renderCharts(state) {
    const TYPES = FinanceUtils.EXPENSE_TYPES;
    const essentials = state.expenses.filter((item) => item.type === TYPES.fixed);
    const nonEssentials = state.expenses.filter((item) => item.type === TYPES.variable);
    const sorted = [...state.categories].sort((a, b) => b.value - a.value);
    const redSoft = deriveToneFromToken("--vermelho", 70, FinanceCharts.colors.red);

    FinanceCharts.barChart("#essenciaisChart", {
      labels: essentials.map((item) => item.category),
      datasets: [{ label: TYPES.fixed, color: FinanceCharts.colors.red, values: essentials.map((item) => item.value) }]
    });

    FinanceCharts.barChart("#naoEssenciaisChart", {
      labels: nonEssentials.map((item) => item.category),
      datasets: [{ label: TYPES.variable, color: redSoft, values: nonEssentials.map((item) => item.value) }]
    });

    FinanceCharts.horizontalBars("#topCategoriasChart", {
      labels: sorted.map((item) => item.name),
      values: sorted.map((item) => item.value),
      color: FinanceCharts.colors.red
    });
  }

  /* ---------- Lista de compras do mês ---------- */
  function getShopping(state) {
    if (!Array.isArray(state.shopping)) {
      state.shopping = [
        { id: "c1", name: "Gás", value: 0, done: false },
        { id: "c2", name: "Luz", value: 0, done: false },
        { id: "c3", name: "Supermercado", value: 0, done: false }
      ];
    }
    return state.shopping;
  }

  function renderShopping(state) {
    const container = document.querySelector("[data-shopping-list]");
    if (!container) {
      return;
    }

    const items = getShopping(state);

    if (!items.length) {
      container.innerHTML = '<p class="fx-empty">Sua lista está vazia. Adicione o primeiro item acima.</p>';
    } else {
      container.innerHTML = items
        .map(
          (item) => `
            <div class="fx-shopping-item ${item.done ? "is-done" : ""}" data-shopping-id="${item.id}">
              <input type="checkbox" ${item.done ? "checked" : ""} aria-label="Marcar como pago">
              <span class="fx-shopping-name">${item.name}</span>
              <span class="fx-shopping-value">${FinanceUtils.formatCurrency(item.value)}</span>
              <button class="fx-row-remove" type="button" title="Remover item" aria-label="Remover item">✕</button>
            </div>
          `
        )
        .join("");
    }

    const total = items.reduce((acc, item) => acc + item.value, 0);
    const pago = items.filter((item) => item.done).reduce((acc, item) => acc + item.value, 0);
    FinanceUtils.setText("[data-shopping-total]", FinanceUtils.formatCurrency(total));
    FinanceUtils.setText("[data-shopping-pago]", FinanceUtils.formatCurrency(pago));
    FinanceUtils.setText("[data-shopping-pendente]", FinanceUtils.formatCurrency(total - pago));
  }

  function bindShopping() {
    const form = document.querySelector("#shoppingForm");
    const container = document.querySelector("[data-shopping-list]");
    const launch = document.querySelector("#shoppingLaunch");
    if (!form || !container) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.querySelector("#shoppingName").value.trim();
      const value = Number(document.querySelector("#shoppingValue").value) || 0;
      if (!name) {
        return;
      }

      const state = FinanceUtils.updateState((current) => {
        getShopping(current).push({ id: FinanceUtils.uid("item"), name, value, done: false });
        return current;
      });

      form.reset();
      document.querySelector("#shoppingName").focus();
      renderShopping(state);
    });

    container.addEventListener("click", (event) => {
      const row = event.target.closest("[data-shopping-id]");
      if (!row) {
        return;
      }

      if (event.target.matches('input[type="checkbox"]')) {
        const state = FinanceUtils.updateState((current) => {
          const item = getShopping(current).find((entry) => entry.id === row.dataset.shoppingId);
          if (item) {
            item.done = event.target.checked;
          }
          return current;
        });
        renderShopping(state);
      }

      if (event.target.closest(".fx-row-remove")) {
        const state = FinanceUtils.updateState((current) => {
          current.shopping = getShopping(current).filter((entry) => entry.id !== row.dataset.shoppingId);
          return current;
        });
        renderShopping(state);
      }
    });

    if (launch) {
      launch.addEventListener("click", () => {
        const category = document.querySelector("#shoppingCategory")?.value || "Casa";
        let launched = 0;

        const state = FinanceUtils.updateState((current) => {
          const paid = getShopping(current).filter((item) => item.done && item.value > 0);
          if (!paid.length) {
            return current;
          }

          const today = new Date().toISOString().slice(0, 10);
          paid.forEach((item) => {
            current.expenses.push({
              id: FinanceUtils.uid("d"),
              date: today,
              category,
              type: FinanceUtils.EXPENSE_TYPES.variable,
              description: `Lista de compras: ${item.name}`,
              value: item.value
            });
            launched += 1;
          });

          current.shopping = getShopping(current).filter((item) => !(item.done && item.value > 0));
          return FinanceUtils.refreshSummary(current);
        });

        if (!launched) {
          FinanceUtils.toast("Marque itens pagos com valor para lançar.");
          return;
        }

        FinanceUtils.toast(`${launched} ${launched === 1 ? "item lançado" : "itens lançados"} como despesa.`);
        renderShopping(state);
        renderCards(state);
        renderTables(state);
        renderCharts(state);
      });
    }
  }

  function bindFilters() {
    ["#despesaMonth", "#despesaCategory"].forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.addEventListener("input", () => renderTables(FinanceUtils.getState()));
      }
    });
  }

  function boot() {
    const state = FinanceUtils.refreshSummary(FinanceUtils.getState());
    FinanceUtils.saveState(state);
    FinanceUtils.fillMonthSelect("#despesaMonth", state);
    renderCards(state);
    renderTables(state);
    renderCharts(state);
    renderShopping(state);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "despesas") {
      return;
    }
    boot();
    bindFilters();
    bindShopping();
  });
})();
