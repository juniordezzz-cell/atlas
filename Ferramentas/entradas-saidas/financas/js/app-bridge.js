/* ============================================================
   app-bridge.js — ponte core (ES modules) → globais clássicos
   ------------------------------------------------------------
   Os controllers das páginas (scripts clássicos, carregados
   depois deste módulo) esperam a mesma API global que a v1
   (window.FinanceUtils / window.FinanceCharts). Este módulo
   importa os core modules puros (financas/js/core/*.js) e o
   motor de gráficos (financas/js/ui/charts.js) e publica essa
   superfície em window, além de incluir os helpers de DOM que
   não são puros o bastante para morar no core.

   Local-first: sem nuvem/backend externo, sem rede. pt-BR.

   Nota de segurança: fillMonthSelect/renderRows montam HTML a
   partir de dados 100% locais (state salvo no localStorage pelo
   próprio app, sem nenhuma origem de rede/terceiros) — mesmo
   padrão já usado em js/utils.js. Não há entrada de usuário não
   confiável sendo injetada.
   ============================================================ */
import {
  formatCurrency,
  formatPercent,
  formatDate,
  parseMoney,
  getMonthKey,
  monthLabel,
  yearMonthKeys,
  MONTH_NAMES
} from "./core/format.js";
import {
  getState,
  saveState,
  updateState,
  resetState,
  migrateState,
  defaultState,
  freshState,
  STORAGE_KEY
} from "./core/store.js";
import {
  EXPENSE_TYPES,
  summarizeEntries,
  summarizeExpenses,
  refreshSummary,
  monthOptions
} from "./core/finance.js";
import {
  defaultPlanner,
  payDates,
  incomeEntries,
  incomeInMonth,
  installmentsTotal,
  generateMovimentos
} from "./core/recurrence.js";
import * as Charts from "./ui/charts.js";

/* ============================================================
   Helpers de DOM (portados de js/utils.js, linhas ~262-462) —
   não são puros (tocam document/localStorage/requestAnimationFrame),
   por isso vivem na ponte, e não no core. Chamam as funções do
   core diretamente (importadas acima), não via window.FinanceUtils,
   para funcionar como referências internas do módulo.
   ============================================================ */

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function fillMonthSelect(selector, state, allLabel) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }

  const current = element.value;
  const options = monthOptions(state)
    .map((key) => `<option value="${key}">${monthLabel(key)}</option>`)
    .join("");

  element.innerHTML = `<option value="all">${allLabel || "Todos os meses"}</option>${options}`;
  if ([...element.options].some((option) => option.value === current)) {
    element.value = current;
  }
}

function renderRows(tbody, rows, template) {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = rows.map(template).join("");
}

function setText(selector, value) {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    element.textContent = value;
  });
}

/* Contador animado: o valor "sobe" até o número final (R$) */
function countUpCurrency(selector, value, duration) {
  const elements = document.querySelectorAll(selector);
  const target = Number(value) || 0;
  const animations = getState().settings.animations !== false;
  if (!elements.length) {
    return;
  }
  if (!animations) {
    elements.forEach((el) => { el.textContent = formatCurrency(target); });
    return;
  }
  const total = duration || 900;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let start = null;
  function frame(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / total, 1);
    const current = target * ease(p);
    elements.forEach((el) => { el.textContent = formatCurrency(current); });
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");
}

function toast(message) {
  let element = document.querySelector(".toast");
  if (!element) {
    element = document.createElement("div");
    element.className = "toast";
    document.body.appendChild(element);
  }

  element.textContent = message;
  element.classList.add("is-visible");
  window.setTimeout(() => element.classList.remove("is-visible"), 2400);
}

/* Adaptação: a v1 (sistema de conta antigo) alternava a classe body.light-theme.
   Neste módulo o tema é controlado por data-theme na <html>, e
   persistido pela mesma chave que js/ui/shell.js usa
   (atlas-financas-theme) — para os dois ficarem sempre em sincronia. */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("atlas-financas-theme", theme);
  } catch (err) {
    // localStorage indisponível (modo privado etc.) — ignora
  }
}

/* ============================================================
   Publicação dos globais clássicos
   ============================================================ */
window.FinanceUtils = {
  STORAGE_KEY,
  EXPENSE_TYPES,
  defaultState,
  freshState,
  migrateState,
  resetState,
  yearMonthKeys,
  getState,
  saveState,
  updateState,
  refreshSummary,
  formatCurrency,
  formatPercent,
  formatDate,
  parseMoney,
  uid,
  getMonthKey,
  monthLabel,
  monthOptions,
  MONTH_NAMES,
  fillMonthSelect,
  summarizeEntries,
  summarizeExpenses,
  renderRows,
  setText,
  countUpCurrency,
  downloadText,
  toCsv,
  toast,
  applyTheme
};

window.FinanceCharts = {
  colors: Charts.colors,
  lineChart: Charts.lineChart,
  areaChart: Charts.areaChart,
  barChart: Charts.barChart,
  horizontalBars: Charts.horizontalBars,
  doughnutChart: Charts.doughnutChart
};

/* Motor de recorrência do planejador (financas/js/core/recurrence.js),
   exposto para a página Planejar (financas/js/pages/planejar.js) usar
   como window.FinancePlanner.* — mesmo padrão de ponte que FinanceUtils. */
window.FinancePlanner = {
  defaultPlanner,
  payDates,
  incomeEntries,
  incomeInMonth,
  installmentsTotal,
  generateMovimentos
};
