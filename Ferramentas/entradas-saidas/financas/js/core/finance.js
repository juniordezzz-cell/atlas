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

/* ------------------------------------------------------------
   MÊS ATUAL × REALIZADO

   O Planejar gera os lançamentos do ANO inteiro (o salário de janeiro
   a dezembro, o aluguel dos doze meses). O resumo somava todos: com
   salário de R$ 1.000/mês, o card "Entradas" mostrava R$ 12.000 em
   setembro, o "Saldo do mês" era o saldo do ano — com dezembro contado
   como recebido — e o "fluxo do mês atual" desenhava dezembro, o último
   mês com lançamento.

   Agora:
     • o resumo é do MÊS ATUAL, que vem de hoje;
     • REALIZADO é o que tem data até hoje; depois disso é PREVISTO e
       aparece à parte (summary.previsto), nunca somado ao realizado.

   `hoje` é injetável (AAAA-MM-DD) para os testes não dependerem do dia.
   ------------------------------------------------------------ */
export function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentMonthKey(today = todayKey()) {
  return String(today).slice(0, 7);
}

export function isRealized(item, today = todayKey()) {
  return String(item && item.date).slice(0, 10) <= today;
}

export function refreshSummary(state, today = todayKey()) {
  const mes = currentMonthKey(today);
  const doMes = (rows) => (rows || []).filter((r) => getMonthKey(r.date) === mes);
  const feitos = (rows) => rows.filter((r) => isRealized(r, today));
  const porVir = (rows) => rows.filter((r) => !isRealized(r, today));

  const entradasMes = doMes(state.entries);
  const saidasMes = doMes(state.expenses);
  const entries = summarizeEntries(feitos(entradasMes));
  const expenses = summarizeExpenses(feitos(saidasMes));
  const prevEntradas = summarizeEntries(porVir(entradasMes)).total;
  const prevSaidas = summarizeExpenses(porVir(saidasMes)).total;

  state.summary.mes = mes;
  state.summary.receitas = entries.total;
  state.summary.despesas = expenses.total;
  state.summary.saldo = entries.total - expenses.total;
  state.summary.previsto = {
    receitas: prevEntradas,
    despesas: prevSaidas,
    saldoFimDoMes: entries.total + prevEntradas - expenses.total - prevSaidas
  };
  state.summary.investimentos = state.investments.invested;
  state.categories = Object.entries(expenses.byCategory).map(([name, value]) => {
    const found = saidasMes.find((expense) => expense.category === name);
    return { name, value, type: found ? found.type : "Outros" };
  });
  deriveCashFlow(state, today);
  deriveNetWorth(state, today);
  return state;
}

/* Fluxo do mês atual: acumulado de entradas x saídas em 7 marcos.
   Depois de hoje a linha fica parada — o previsto não é desenhado
   como se já tivesse acontecido. */
export function deriveCashFlow(state, today = todayKey()) {
  const key = currentMonthKey(today);
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const checkpoints = [1, 5, 10, 15, 20, 25, lastDay];
  const inMonth = (rows) =>
    (rows || []).filter((r) => getMonthKey(r.date) === key && isRealized(r, today));
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

/* Evolução do saldo: acumulado mês a mês, nos 6 meses que TERMINAM no
   mês atual, só com o realizado. O acumulado parte de tudo que veio
   antes da janela, senão a curva recomeçaria do zero a cada 6 meses. */
export function deriveNetWorth(state, today = todayKey()) {
  const atual = currentMonthKey(today);
  const [y, m] = atual.split("-").map(Number);
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const feitos = (rows) => (rows || []).filter((r) => isRealized(r, today));
  const entradas = feitos(state.entries);
  const saidas = feitos(state.expenses);
  if (!entradas.length && !saidas.length) {
    return;
  }
  const soma = (rows, pred) => rows.reduce((acc, r) => (pred(getMonthKey(r.date)) ? acc + r.value : acc), 0);
  let acumulado = soma(entradas, (k) => k < keys[0]) - soma(saidas, (k) => k < keys[0]);
  const values = keys.map((key) => {
    acumulado += soma(entradas, (k) => k === key) - soma(saidas, (k) => k === key);
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
