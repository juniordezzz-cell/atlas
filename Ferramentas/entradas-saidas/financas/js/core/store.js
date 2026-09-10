const STORAGE_KEY = "finance-dashboard-state";

/* Tipos de gasto (fonte única do texto que aparece na tela e nos
   lançamentos). Trocamos "Essenciais/Não essenciais" por
   "Gastos fixos/Gastos não fixos" — fixo = repete todo mês. */
const EXPENSE_TYPES = { fixed: "Gastos fixos", variable: "Gastos não fixos" };

/* De->Para dos nomes antigos, usado na migração automática. */
const LEGACY_TYPE_MAP = {
  "Essenciais": EXPENSE_TYPES.fixed,
  "Não essenciais": EXPENSE_TYPES.variable
};

const defaultState = {
  summary: {
    receitas: 2000,
    despesas: 1810,
    saldo: 190,
    investimentos: 0
  },
  cashFlow: {
    labels: ["01 Mar", "05 Mar", "10 Mar", "15 Mar", "20 Mar", "25 Mar", "31 Mar"],
    receitas: [80, 310, 720, 980, 1420, 1780, 2050],
    despesas: [40, 95, 340, 520, 860, 1220, 1600]
  },
  categories: [
    { name: "Casa", value: 850, type: "Gastos fixos" },
    { name: "Transporte", value: 250, type: "Gastos fixos" },
    { name: "Alimentação", value: 350, type: "Gastos não fixos" },
    { name: "Saúde", value: 100, type: "Gastos fixos" },
    { name: "Lazer", value: 80, type: "Gastos não fixos" },
    { name: "Outros", value: 180, type: "Gastos não fixos" }
  ],
  netWorth: {
    labels: ["Out", "Nov", "Dez", "Jan", "Fev", "Mar"],
    values: [-980, -610, -220, 90, 360, 720]
  },
  entries: [
    { id: "e1", date: "2026-03-05", source: "Salário", description: "Salário mensal", value: 1550 },
    { id: "e2", date: "2026-03-12", source: "Freelance", description: "Projeto de identidade visual", value: 350 },
    { id: "e3", date: "2026-03-24", source: "Outras receitas", description: "Reembolso", value: 100 }
  ],
  expenses: [
    { id: "d1", date: "2026-03-02", category: "Casa", type: "Gastos fixos", description: "Aluguel e contas", value: 850 },
    { id: "d2", date: "2026-03-07", category: "Transporte", type: "Gastos fixos", description: "Aplicativos e combustível", value: 250 },
    { id: "d3", date: "2026-03-11", category: "Alimentação", type: "Gastos não fixos", description: "Mercado", value: 350 },
    { id: "d4", date: "2026-03-14", category: "Saúde", type: "Gastos fixos", description: "Farmácia", value: 100 },
    { id: "d5", date: "2026-03-20", category: "Lazer", type: "Gastos não fixos", description: "Cinema", value: 80 },
    { id: "d6", date: "2026-03-27", category: "Outros", type: "Gastos não fixos", description: "Compras diversas", value: 180 }
  ],
  investments: {
    emergencyReserve: 0,
    invested: 0,
    availableCash: 190,
    profitability: 0,
    allocation: [
      { name: "Reserva de emergência", value: 0 },
      { name: "Investimentos", value: 0 },
      { name: "Caixa disponível", value: 190 }
    ]
  },
  profile: {
    name: "Usuário",
    email: "usuario@email.com",
    currency: "BRL"
  },
  settings: {
    theme: "dark",
    animations: true,
    compactTables: false
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ============================================================
   MIGRAÇÃO AUTOMÁTICA — roda ao carregar os dados da conta.
   É idempotente (pode rodar quantas vezes quiser). Faz duas
   coisas:
     1. Renomeia os tipos antigos ("Essenciais" etc.) para os
        novos ("Gastos fixos" etc.) em lançamentos e categorias.
     2. Completa o planner antigo com os campos do motor de
        recorrência (frequência da renda, dia dos gastos fixos,
        mês dos gastos não fixos) sem perder nada do que existe.
   ============================================================ */
function migrateState(state) {
  if (!state || typeof state !== "object") {
    return state;
  }

  const fixType = (row) => {
    if (row && LEGACY_TYPE_MAP[row.type]) {
      row.type = LEGACY_TYPE_MAP[row.type];
    }
    return row;
  };
  (state.expenses || []).forEach(fixType);
  (state.categories || []).forEach(fixType);

  if (state.planner && Array.isArray(state.planner.incomes)) {
    const mesAtual = new Date().toISOString().slice(0, 7);
    state.planner.incomes.forEach((row) => {
      if (!row.frequency) {
        row.frequency = "monthly";
        row.monthday = row.monthday || 5;
        row.weekday = row.weekday === undefined ? 5 : row.weekday;
        row.startDate = row.startDate || `${new Date().getFullYear()}-01-05`;
      }
    });
    (state.planner.essentials || []).forEach((row) => {
      if (row.monthday === undefined) {
        row.monthday = 5;
      }
    });
    (state.planner.nonEssentials || []).forEach((row) => {
      if (!row.month) {
        row.month = mesAtual;
      }
    });
  }

  return state;
}

/* Estado zerado — é o que um assinante PRO novo recebe na
   primeira vez (sem herdar nenhum dado de demonstração). */
function freshState() {
  const fresh = clone(defaultState);
  fresh.entries = [];
  fresh.expenses = [];
  fresh.categories = [];
  fresh.summary = { receitas: 0, despesas: 0, saldo: 0, investimentos: 0 };
  fresh.cashFlow = { labels: defaultState.cashFlow.labels, receitas: [0, 0, 0, 0, 0, 0, 0], despesas: [0, 0, 0, 0, 0, 0, 0] };
  fresh.netWorth = { labels: defaultState.netWorth.labels, values: [0, 0, 0, 0, 0, 0] };
  fresh.investments = { emergencyReserve: 0, invested: 0, availableCash: 0, profitability: 0, allocation: [] };
  delete fresh.planner;
  return fresh;
}

/* ============================================================
   LOCAL-FIRST PERSISTENCE (localStorage)
   ============================================================ */

function getState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateState(parsed);
    }
  } catch (err) {
    // Fall through to freshState on any error
  }
  return freshState();
}

function saveState(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    // Silently fail if localStorage is unavailable
  }
  return next;
}

function updateState(fn) {
  const cur = getState();
  const next = fn(cur) || cur;
  saveState(next);
  return next;
}

function resetState() {
  return saveState(freshState());
}

export { defaultState, freshState, migrateState, getState, saveState, updateState, resetState, STORAGE_KEY };
