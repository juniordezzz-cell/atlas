import { yearMonthKeys } from "./format.js";
import { EXPENSE_TYPES, refreshSummary } from "./finance.js";

const YEAR = new Date().getFullYear();
const RANGE_START = `${YEAR}-01-01`;
const RANGE_END = `${YEAR}-12-31`;

/* ---------- Modelo padrão (com os campos do motor) ---------- */
function defaultPlanner(year = new Date().getFullYear()) {
  return {
    owner: "",
    year: year,
    incomes: [
      { id: "i1", label: "Salário líquido (trabalho principal)", value: 0, frequency: "monthly", monthday: 5, weekday: 5, startDate: `${year}-01-05` },
      { id: "i2", label: "Salário líquido (trabalho 2)", value: 0, frequency: "monthly", monthday: 5, weekday: 5, startDate: `${year}-01-05` },
      { id: "i3", label: "Vale-alimentação / refeição", value: 0, frequency: "monthly", monthday: 1, weekday: 5, startDate: `${year}-01-01` },
      { id: "i4", label: "Renda extra (freelas, vendas...)", value: 0, frequency: "monthly", monthday: 15, weekday: 5, startDate: `${year}-01-15` },
      { id: "i5", label: "Outras entradas (bônus, aluguel...)", value: 0, frequency: "monthly", monthday: 20, weekday: 5, startDate: `${year}-01-20` }
    ],
    essentials: [
      { id: "s1", label: "Aluguel / financiamento", value: 0, monthday: 5 },
      { id: "s2", label: "Condomínio", value: 0, monthday: 5 },
      { id: "s3", label: "Luz", value: 0, monthday: 10 },
      { id: "s4", label: "Água", value: 0, monthday: 10 },
      { id: "s5", label: "Gás", value: 0, monthday: 10 },
      { id: "s6", label: "Internet", value: 0, monthday: 15 },
      { id: "s7", label: "Plano de saúde", value: 0, monthday: 8 },
      { id: "s8", label: "Aporte em investimentos (pague-se primeiro!)", value: 0, monthday: 5 }
    ],
    nonEssentials: [
      { id: "n1", label: "Supermercado", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` },
      { id: "n2", label: "Transporte / combustível", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` },
      { id: "n3", label: "Delivery / iFood", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` },
      { id: "n4", label: "Farmácia", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` },
      { id: "n5", label: "Saídas / lazer", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` },
      { id: "n6", label: "Imprevistos", value: 0, month: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}` }
    ]
  };
}

/* ---------- Motor: datas de recebimento de uma fonte ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parse(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }

function payDates(income, startISO, endISO) {
  const start = parse(startISO);
  const end = parse(endISO);
  const out = [];
  const freq = income.frequency || "monthly";

  if (freq === "weekly") {
    const wd = Number(income.weekday);
    const d = new Date(start);
    while (d.getDay() !== wd) { d.setDate(d.getDate() + 1); }
    for (; d <= end; d.setDate(d.getDate() + 7)) { out.push(iso(d)); }
  } else if (freq === "biweekly") {
    let d = parse(income.startDate || startISO);
    while (d < start) { d.setDate(d.getDate() + 14); }
    for (; d <= end; d.setDate(d.getDate() + 14)) { out.push(iso(d)); }
  } else if (freq === "firstBusinessDay") {
    let y = start.getFullYear();
    let m = start.getMonth();
    while (true) {
      const d = new Date(y, m, 1);
      while (d.getDay() === 0 || d.getDay() === 6) { d.setDate(d.getDate() + 1); }
      if (d > end) { break; }
      if (d >= start) { out.push(iso(d)); }
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  } else {
    /* mensal (padrão) */
    const day = Math.min(31, Math.max(1, Number(income.monthday) || 1));
    let y = start.getFullYear();
    let m = start.getMonth();
    while (true) {
      const last = new Date(y, m + 1, 0).getDate();
      const d = new Date(y, m, Math.min(day, last));
      if (d > end) { break; }
      if (d >= start) { out.push(iso(d)); }
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  }
  return out;
}

function sum(rows) {
  return rows.reduce((acc, row) => acc + (Number(row.value) || 0), 0);
}

/* Recebimentos de UMA fonte no período, como [{date, value}].
   Frequência regular repete o mesmo valor; "custom" usa parcelas
   avulsas (cada uma com sua data e seu próprio valor). */
function incomeEntries(income, startISO, endISO) {
  if (income.frequency === "custom") {
    return (income.installments || [])
      .filter((p) => p.date && p.date >= startISO && p.date <= endISO && (Number(p.value) || 0) > 0)
      .map((p) => ({ date: p.date, value: Number(p.value) || 0 }));
  }
  const v = Number(income.value) || 0;
  if (v <= 0) { return []; }
  return payDates(income, startISO, endISO).map((date) => ({ date, value: v }));
}

/* Soma da renda de uma fonte custom (usado pra manter income.value em dia) */
function installmentsTotal(income) {
  return (income.installments || []).reduce((acc, p) => acc + (Number(p.value) || 0), 0);
}

/* Total de ENTRADAS que caem num mês. Para frequência regular, é
   nº de recebimentos × valor (é aqui que meses com 5 sextas rendem
   mais). Para custom, é a soma das parcelas daquele mês. */
function incomeInMonth(planner, mk) {
  return planner.incomes.reduce((acc, income) => {
    const doMes = incomeEntries(income, RANGE_START, RANGE_END)
      .filter((e) => e.date.slice(0, 7) === mk)
      .reduce((s, e) => s + e.value, 0);
    return acc + doMes;
  }, 0);
}

/* ============================================================
   GERAÇÃO — transforma o planejamento em lançamentos datados
   do ano todo (Jan..Dez), que abastecem as outras páginas.
   ============================================================ */
const DEMO_IDS = ["e1", "e2", "e3", "d1", "d2", "d3", "d4", "d5", "d6"];

function generateMovimentos(state, planner, year = new Date().getFullYear()) {
  const rangeStart = `${year}-01-01`;
  const rangeEnd = `${year}-12-31`;
  const manter = (row) => !String(row.id).startsWith("pl-") && !DEMO_IDS.includes(row.id);
  const TYPES = EXPENSE_TYPES;

  /* Entradas: um lançamento por recebimento no ano (parcelas custom
     entram com seus próprios valores) */
  const novasEntradas = [];
  planner.incomes.forEach((income, idx) => {
    incomeEntries(income, rangeStart, rangeEnd).forEach((rec, i) => {
      novasEntradas.push({
        id: `pl-${income.id}-${rec.date}-${i}`,
        date: rec.date,
        source: income.label || "Entrada",
        description: income.label || "Entrada do planejamento",
        value: rec.value
      });
    });
  });

  /* Gastos fixos: um lançamento por mês, no dia escolhido */
  const novasSaidas = [];
  planner.essentials.forEach((row) => {
    const v = Number(row.value) || 0;
    if (v <= 0) { return; }
    const day = Math.min(31, Math.max(1, Number(row.monthday) || 5));
    yearMonthKeys(year).forEach((mk) => {
      const [y, m] = mk.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      const date = `${mk}-${pad(Math.min(day, last))}`;
      novasSaidas.push({
        id: `pl-${row.id}-${mk}`,
        date,
        category: row.label || "Gasto fixo",
        type: TYPES.fixed,
        description: row.label || "Gasto fixo",
        value: v
      });
    });
  });

  /* Gastos não fixos: um lançamento no mês a que pertencem (dia 15) */
  planner.nonEssentials.forEach((row) => {
    const v = Number(row.value) || 0;
    if (v <= 0) { return; }
    const mk = row.month || new Date().toISOString().slice(0, 7);
    novasSaidas.push({
      id: `pl-${row.id}`,
      date: `${mk}-15`,
      category: row.label || "Gasto não fixo",
      type: TYPES.variable,
      description: row.label || "Gasto não fixo",
      value: v
    });
  });

  state.entries = state.entries.filter(manter).concat(novasEntradas);
  state.expenses = state.expenses.filter(manter).concat(novasSaidas);
  return refreshSummary(state);
}

export { defaultPlanner, payDates, incomeEntries, incomeInMonth, installmentsTotal, generateMovimentos };
