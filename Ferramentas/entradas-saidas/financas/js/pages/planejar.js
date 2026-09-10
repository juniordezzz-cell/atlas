/* ============================================================
   planejar.js — controller da página "Planejar" (Entradas x Saídas)
   ------------------------------------------------------------
   Fonte única de lançamentos. Cada coisa tem tempo:

     • RENDA        → cada fonte tem uma frequência (semanal,
                      quinzenal, mensal, 1º dia útil ou parcelas
                      avulsas). O motor gera os recebimentos
                      datados do ano todo.
     • GASTOS FIXOS → repetem todo mês, no dia escolhido.
     • GASTOS NÃO   → lançados por mês (variam), presos ao mês
       FIXOS          selecionado no topo.

   Tudo isso vira state.entries / state.expenses datados, que
   alimentam Visão geral, Entradas, Despesas, Relatórios e Análises.

   As funções puras do motor de recorrência (payDates,
   incomeEntries, incomeInMonth, installmentsTotal,
   generateMovimentos, defaultPlanner) vivem em
   financas/js/core/recurrence.js e chegam aqui via
   window.FinancePlanner (publicado por financas/js/app-bridge.js).
   Este arquivo cuida só da parte de DOM: templates de linha,
   eventos e persistência (via window.FinanceUtils).

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML (innerHTML) a
   partir de `planner`/`state` (lidos do localStorage pelo próprio
   app, via FinanceUtils.getState — mesma origem, sem rede ou
   terceiros) e de textos fixos deste arquivo, passando os únicos
   campos de texto livre (label do usuário) por escapeHtml() antes
   de entrar no template. Não há entrada de rede sendo injetada;
   mesmo padrão já usado em financas/js/app-bridge.js.
   ============================================================ */
(function () {
  const LISTS = ["incomes", "essentials", "nonEssentials"];
  const YEAR = new Date().getFullYear();
  const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  function getPlanner(state) {
    if (!state.planner || !Array.isArray(state.planner.incomes)) {
      state.planner = window.FinancePlanner.defaultPlanner(YEAR);
    }
    FinanceUtils.migrateState(state);
    return state.planner;
  }

  function sum(rows) {
    return rows.reduce((acc, row) => acc + (Number(row.value) || 0), 0);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Templates de linha ---------- */
  function freqParam(income) {
    const freq = income.frequency || "monthly";
    if (freq === "weekly") {
      const opts = WEEKDAYS.map((name, i) =>
        `<option value="${i}" ${Number(income.weekday) === i ? "selected" : ""}>${name}</option>`).join("");
      return `<select class="fx-freq-input fx-freq-weekday" aria-label="Dia da semana">${opts}</select>`;
    }
    if (freq === "biweekly") {
      return `<input type="date" class="fx-freq-input fx-freq-start" value="${income.startDate || `${YEAR}-01-01`}" aria-label="1º pagamento">`;
    }
    if (freq === "firstBusinessDay") {
      return `<span class="fx-freq-note">1º dia útil do mês</span>`;
    }
    if (freq === "custom") {
      return `<span class="fx-freq-note">Parcelas avulsas — some as datas abaixo</span>`;
    }
    return `<input type="number" class="fx-freq-input fx-freq-monthday" min="1" max="31" value="${income.monthday || 5}" aria-label="Dia do mês" title="Dia do mês">`;
  }

  /* Editor de parcelas (só para frequência "Personalizada") */
  function installmentsBlock(income) {
    if (income.frequency !== "custom") { return ""; }
    const parcelas = (income.installments || []);
    const linhas = parcelas.length
      ? parcelas.map((p) => `
          <div class="fx-inst-row" data-inst-id="${p.id}">
            <input type="date" class="fx-inst-date" value="${p.date || ""}" aria-label="Data da parcela">
            <input type="number" class="fx-inst-value" value="${p.value || ""}" min="0" step="0.01" placeholder="0,00" inputmode="decimal" aria-label="Valor da parcela">
            <button class="fx-inst-remove" type="button" title="Remover parcela" aria-label="Remover parcela">✕</button>
          </div>`).join("")
      : `<p class="fx-inst-empty">Nenhuma parcela ainda. Ex: recebi 500 no dia 5, 500 no dia 15 e 400 no dia 25.</p>`;
    return `
      <div class="fx-installments">
        <div class="fx-inst-head">
          <span>Parcelas — data + valor (o total é somado sozinho)</span>
          <button class="fx-inst-add" type="button" data-inst-add>+ parcela</button>
        </div>
        ${linhas}
      </div>`;
  }

  function incomeRow(row) {
    const freq = row.frequency || "monthly";
    const isCustom = freq === "custom";
    const freqOpts = [
      ["weekly", "Semanal"],
      ["biweekly", "Quinzenal"],
      ["monthly", "Mensal"],
      ["firstBusinessDay", "1º dia útil"],
      ["custom", "Personalizada"]
    ].map(([v, label]) => `<option value="${v}" ${freq === v ? "selected" : ""}>${label}</option>`).join("");

    /* Quando é personalizada, o valor vira um total calculado (só leitura) */
    const valorField = isCustom
      ? `<input type="text" class="fx-row-value fx-row-total" value="${FinanceUtils.formatCurrency(window.FinancePlanner.installmentsTotal(row))}" readonly tabindex="-1" aria-label="Total das parcelas" title="Somado das parcelas">`
      : `<input type="number" class="fx-row-value" value="${row.value || ""}" min="0" step="0.01" placeholder="0,00" inputmode="decimal" aria-label="Valor por recebimento">`;

    return `
      <div class="fx-row fx-row--income${isCustom ? " is-custom" : ""}" data-row-id="${row.id}">
        <input type="text" class="fx-row-label" value="${escapeHtml(row.label)}" placeholder="Descrição" aria-label="Descrição">
        ${valorField}
        <div class="fx-row-freq">
          <select class="fx-freq-type" aria-label="Frequência">${freqOpts}</select>
          <span class="fx-freq-param">${freqParam(row)}</span>
        </div>
        <button class="fx-row-remove" type="button" title="Remover linha" aria-label="Remover linha">✕</button>
        ${installmentsBlock(row)}
      </div>
    `;
  }

  function fixedRow(row) {
    return `
      <div class="fx-row fx-row--fixed" data-row-id="${row.id}">
        <input type="text" class="fx-row-label" value="${escapeHtml(row.label)}" placeholder="Descrição" aria-label="Descrição">
        <input type="number" class="fx-row-day" min="1" max="31" value="${row.monthday || 5}" aria-label="Dia do mês" title="Dia que vence todo mês">
        <input type="number" class="fx-row-value" value="${row.value || ""}" min="0" step="0.01" placeholder="0,00" inputmode="decimal" aria-label="Valor">
        <button class="fx-row-remove" type="button" title="Remover linha" aria-label="Remover linha">✕</button>
      </div>
    `;
  }

  function variableRow(row) {
    return `
      <div class="fx-row" data-row-id="${row.id}">
        <input type="text" class="fx-row-label" value="${escapeHtml(row.label)}" placeholder="Descrição" aria-label="Descrição">
        <input type="number" class="fx-row-value" value="${row.value || ""}" min="0" step="0.01" placeholder="0,00" inputmode="decimal" aria-label="Valor">
        <button class="fx-row-remove" type="button" title="Remover linha" aria-label="Remover linha">✕</button>
      </div>
    `;
  }

  function selectedMonth() {
    return document.querySelector("#plannerMonth")?.value || new Date().toISOString().slice(0, 7);
  }

  function renderLists(planner) {
    const mk = selectedMonth();
    const incomes = document.querySelector('[data-planner-list="incomes"]');
    if (incomes) { incomes.innerHTML = planner.incomes.map(incomeRow).join(""); }

    const essentials = document.querySelector('[data-planner-list="essentials"]');
    if (essentials) { essentials.innerHTML = planner.essentials.map(fixedRow).join(""); }

    const nonEssentials = document.querySelector('[data-planner-list="nonEssentials"]');
    if (nonEssentials) {
      const doMes = planner.nonEssentials.filter((row) => (row.month || mk) === mk);
      nonEssentials.innerHTML = doMes.length
        ? doMes.map(variableRow).join("")
        : '<p class="fx-empty" style="padding:14px 18px;">Nenhum gasto não fixo neste mês. Adicione abaixo.</p>';
    }
  }

  function fillMonthSelect(planner) {
    const select = document.querySelector("#plannerMonth");
    if (!select) { return; }
    const current = select.value || new Date().toISOString().slice(0, 7);
    select.innerHTML = FinanceUtils.yearMonthKeys(YEAR)
      .map((key) => `<option value="${key}">${FinanceUtils.monthLabel(key)}</option>`)
      .join("");
    const has = [...select.options].some((o) => o.value === current);
    select.value = has ? current : new Date().toISOString().slice(0, 7);
  }

  function renderTotals(planner) {
    const fmt = FinanceUtils.formatCurrency;
    const mk = selectedMonth();

    const entradas = window.FinancePlanner.incomeInMonth(planner, mk);
    const essenciais = sum(planner.essentials);
    const naoEssenciais = sum(planner.nonEssentials.filter((row) => (row.month || mk) === mk));
    const saidas = essenciais + naoEssenciais;
    const sobra = entradas - saidas;
    const reserva = essenciais * 6;

    FinanceUtils.setText("[data-planner-entradas]", fmt(entradas));
    FinanceUtils.setText("[data-planner-total-entradas]", fmt(entradas));
    FinanceUtils.setText("[data-planner-essenciais]", fmt(essenciais));
    FinanceUtils.setText("[data-planner-sub-essenciais]", fmt(essenciais));
    FinanceUtils.setText("[data-planner-nao-essenciais]", fmt(naoEssenciais));
    FinanceUtils.setText("[data-planner-sub-nao-essenciais]", fmt(naoEssenciais));
    FinanceUtils.setText("[data-planner-total-saidas]", fmt(saidas));
    FinanceUtils.setText("[data-planner-sobra]", fmt(sobra));
    FinanceUtils.setText("[data-planner-reserva]", fmt(reserva));

    const sobraBox = document.querySelector("[data-planner-sobra-box]");
    if (sobraBox) {
      sobraBox.classList.toggle("is-negative", sobra < 0);
      const sobraValue = sobraBox.querySelector("[data-planner-sobra]");
      if (sobraValue) {
        sobraValue.className = sobra >= 0 ? "fx-text-pos" : "fx-text-neg";
      }
    }

    const meses = document.querySelector("[data-planner-meses]");
    if (meses) {
      if (sobra > 0 && reserva > 0) {
        const qty = Math.ceil(reserva / sobra);
        meses.textContent = `${qty} ${qty === 1 ? "mês" : "meses"}`;
      } else {
        meses.textContent = "—";
      }
    }

    const commit = document.querySelector("[data-planner-commit]");
    const commitPct = document.querySelector("[data-planner-commit-pct]");
    if (commit && commitPct) {
      const pct = entradas > 0 ? Math.round((saidas / entradas) * 100) : 0;
      commit.style.setProperty("--value", `${Math.min(pct, 100)}%`);
      commit.classList.toggle("is-warn", pct > 70 && pct <= 90);
      commit.classList.toggle("is-danger", pct > 90);
      commitPct.textContent = `${pct}%`;
    }
  }

  function savePlanner(planner) {
    FinanceUtils.updateState((state) => {
      state.planner = planner;
      return window.FinancePlanner.generateMovimentos(state, planner, new Date().getFullYear());
    });
  }

  /* ---------- Eventos ---------- */
  function bindEvents(planner) {
    LISTS.forEach((listName) => {
      const container = document.querySelector(`[data-planner-list="${listName}"]`);
      if (!container) { return; }

      container.addEventListener("input", (event) => {
        const rowElement = event.target.closest("[data-row-id]");
        if (!rowElement) { return; }
        const row = planner[listName].find((item) => item.id === rowElement.dataset.rowId);
        if (!row) { return; }

        if (event.target.classList.contains("fx-row-label")) { row.label = event.target.value; }
        if (event.target.classList.contains("fx-row-value") && !event.target.classList.contains("fx-row-total")) { row.value = Number(event.target.value) || 0; }
        if (event.target.classList.contains("fx-row-day")) { row.monthday = Number(event.target.value) || 1; }
        if (event.target.classList.contains("fx-freq-weekday")) { row.weekday = Number(event.target.value); }
        if (event.target.classList.contains("fx-freq-monthday")) { row.monthday = Number(event.target.value) || 1; }
        if (event.target.classList.contains("fx-freq-start")) { row.startDate = event.target.value; }

        /* Parcelas da renda personalizada */
        if (event.target.classList.contains("fx-inst-date") || event.target.classList.contains("fx-inst-value")) {
          const instEl = event.target.closest("[data-inst-id]");
          const parcela = (row.installments || []).find((p) => p.id === instEl.dataset.instId);
          if (parcela) {
            if (event.target.classList.contains("fx-inst-date")) { parcela.date = event.target.value; }
            if (event.target.classList.contains("fx-inst-value")) { parcela.value = Number(event.target.value) || 0; }
            row.value = window.FinancePlanner.installmentsTotal(row);
            const totalField = rowElement.querySelector(".fx-row-total");
            if (totalField) { totalField.value = FinanceUtils.formatCurrency(row.value); }
          }
        }

        savePlanner(planner);
        renderTotals(planner);
      });

      /* Trocar a frequência: se envolve "Personalizada", re-desenha a
         linha toda (muda o campo de valor e mostra/esconde parcelas). */
      container.addEventListener("change", (event) => {
        if (!event.target.classList.contains("fx-freq-type")) { return; }
        const rowElement = event.target.closest("[data-row-id]");
        const row = planner[listName].find((item) => item.id === rowElement.dataset.rowId);
        if (!row) { return; }
        const eraCustom = row.frequency === "custom";
        row.frequency = event.target.value;
        if (row.frequency === "custom" && !Array.isArray(row.installments)) {
          row.installments = [{ id: FinanceUtils.uid("pc"), date: `${selectedMonth()}-05`, value: 0 }];
        }
        savePlanner(planner);
        if (row.frequency === "custom" || eraCustom) {
          renderLists(planner);
        } else {
          const paramSpan = rowElement.querySelector(".fx-freq-param");
          if (paramSpan) { paramSpan.innerHTML = freqParam(row); }
        }
        renderTotals(planner);
      });

      container.addEventListener("click", (event) => {
        /* Adicionar parcela numa renda personalizada */
        const addInst = event.target.closest("[data-inst-add]");
        if (addInst) {
          const rowElement = addInst.closest("[data-row-id]");
          const row = planner[listName].find((item) => item.id === rowElement.dataset.rowId);
          if (row) {
            row.installments = row.installments || [];
            row.installments.push({ id: FinanceUtils.uid("pc"), date: `${selectedMonth()}-05`, value: 0 });
            savePlanner(planner);
            renderLists(planner);
            renderTotals(planner);
            rowElement.querySelector(".fx-inst-row:last-child .fx-inst-value")?.focus();
          }
          return;
        }

        /* Remover parcela */
        const rmInst = event.target.closest(".fx-inst-remove");
        if (rmInst) {
          const rowElement = rmInst.closest("[data-row-id]");
          const instEl = rmInst.closest("[data-inst-id]");
          const row = planner[listName].find((item) => item.id === rowElement.dataset.rowId);
          if (row) {
            row.installments = (row.installments || []).filter((p) => p.id !== instEl.dataset.instId);
            row.value = window.FinancePlanner.installmentsTotal(row);
            savePlanner(planner);
            renderLists(planner);
            renderTotals(planner);
          }
          return;
        }

        const button = event.target.closest(".fx-row-remove");
        if (!button) { return; }
        const rowElement = button.closest("[data-row-id]");
        planner[listName] = planner[listName].filter((item) => item.id !== rowElement.dataset.rowId);
        savePlanner(planner);
        renderLists(planner);
        renderTotals(planner);
      });
    });

    document.querySelectorAll("[data-planner-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const listName = button.dataset.plannerAdd;
        const id = FinanceUtils.uid("row");
        if (listName === "incomes") {
          planner.incomes.push({ id, label: "", value: 0, frequency: "monthly", monthday: 5, weekday: 5, startDate: `${YEAR}-01-05` });
        } else if (listName === "essentials") {
          planner.essentials.push({ id, label: "", value: 0, monthday: 5 });
        } else {
          planner.nonEssentials.push({ id, label: "", value: 0, month: selectedMonth() });
        }
        savePlanner(planner);
        renderLists(planner);
        renderTotals(planner);
        const container = document.querySelector(`[data-planner-list="${listName}"]`);
        const lastLabel = container?.querySelector(".fx-row:last-child .fx-row-label");
        lastLabel?.focus();
      });
    });

    const monthSelect = document.querySelector("#plannerMonth");
    if (monthSelect) {
      monthSelect.addEventListener("change", () => {
        renderLists(planner);
        renderTotals(planner);
      });
    }

    const owner = document.querySelector("#plannerOwner");
    if (owner) {
      owner.value = planner.owner || "";
      owner.addEventListener("input", () => {
        planner.owner = owner.value;
        savePlanner(planner);
      });
    }

    const reset = document.querySelector("#plannerReset");
    if (reset) {
      reset.addEventListener("click", () => {
        const confirmed = window.confirm("Limpar todos os valores e voltar ao modelo padrão?");
        if (!confirmed) { return; }
        const fresh = window.FinancePlanner.defaultPlanner(YEAR);
        Object.assign(planner, fresh);
        savePlanner(planner);
        renderLists(planner);
        renderTotals(planner);
        if (owner) { owner.value = ""; }
        FinanceUtils.toast("Orçamento reiniciado.");
      });
    }
  }

  function boot() {
    const state = FinanceUtils.getState();
    const planner = getPlanner(state);
    /* Regenera os lançamentos a partir do planejamento salvo */
    window.FinancePlanner.generateMovimentos(state, planner, YEAR);
    FinanceUtils.saveState(state);
    fillMonthSelect(planner);
    renderLists(planner);
    renderTotals(planner);
    bindEvents(planner);
    const ownerInput = document.querySelector("#plannerOwner");
    if (ownerInput && document.activeElement !== ownerInput) {
      ownerInput.value = planner.owner || "";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "comparativo") { return; }
    boot();
  });
})();
