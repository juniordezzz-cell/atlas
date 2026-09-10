import { getMonthKey, monthLabel } from "./format.js";

export const EXPENSE_TYPES = { fixed: "Gastos fixos", variable: "Gastos não fixos" };

export function summarizeEntries(entries) {
  return entries.reduce(
    (acc, item) => {
      acc.total += item.value;
      acc.bySource[item.source] = (acc.bySource[item.source] || 0) + item.value;
      return acc;
    },
    { total: 0, bySource: {} }
  );
}

export function summarizeExpenses(expenses) {
  return expenses.reduce(
    (acc, item) => {
      acc.total += item.value;
      acc.byType[item.type] = (acc.byType[item.type] || 0) + item.value;
      acc.byCategory[item.category] = (acc.byCategory[item.category] || 0) + item.value;
      return acc;
    },
    { total: 0, byType: {}, byCategory: {} }
  );
}

export function refreshSummary(state) {
  const entries = summarizeEntries(state.entries);
  const expenses = summarizeExpenses(state.expenses);
  state.summary.receitas = entries.total;
  state.summary.despesas = expenses.total;
  state.summary.saldo = entries.total - expenses.total;
  state.summary.investimentos = state.investments.invested;
  state.categories = Object.entries(expenses.byCategory).map(([name, value]) => {
    const found = state.expenses.find((expense) => expense.category === name);
    return { name, value, type: found ? found.type : "Outros" };
  });
  deriveCashFlow(state);
  deriveNetWorth(state);
  return state;
}

/* Fluxo do mês atual: acumulado de entradas x saídas em 7 marcos */
export function deriveCashFlow(state) {
  const keys = monthOptions(state);
  if (!keys.length) {
    return;
  }
  const key = keys[0];
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const checkpoints = [1, 5, 10, 15, 20, 25, lastDay];
  const inMonth = (rows) => rows.filter((r) => getMonthKey(r.date) === key);
  const upTo = (rows, day) =>
    rows.reduce((acc, r) => (Number(String(r.date).slice(8, 10)) <= day ? acc + r.value : acc), 0);
  const monthEntries = inMonth(state.entries);
  const monthExpenses = inMonth(state.expenses);
  state.cashFlow = {
    labels: checkpoints.map((d) => `${String(d).padStart(2, "0")} ${monthLabel(key).slice(0, 3)}`),
    receitas: checkpoints.map((d) => upTo(monthEntries, d)),
    despesas: checkpoints.map((d) => upTo(monthExpenses, d))
  };
}

/* Evolução do saldo: acumulado mês a mês (últimos 6 meses com dados) */
export function deriveNetWorth(state) {
  const keys = monthOptions(state).slice(0, 6).reverse();
  if (!keys.length) {
    return;
  }
  const sumMonth = (rows, key) =>
    rows.reduce((acc, r) => (getMonthKey(r.date) === key ? acc + r.value : acc), 0);
  let acumulado = 0;
  const values = keys.map((key) => {
    acumulado += sumMonth(state.entries, key) - sumMonth(state.expenses, key);
    return acumulado;
  });
  state.netWorth = {
    labels: keys.map((key) => monthLabel(key).slice(0, 3)),
    values
  };
}

export function monthOptions(state) {
  const keys = new Set();
  (state.entries || []).forEach((item) => keys.add(getMonthKey(item.date)));
  (state.expenses || []).forEach((item) => keys.add(getMonthKey(item.date)));
  return [...keys].filter(Boolean).sort().reverse();
}
