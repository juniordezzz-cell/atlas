export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

export function formatPercent(value) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value) || 0)}%`;
}

export function formatDate(value) {
  /* Só aceita AAAA-MM-DD (com ou sem hora depois). O resultado vai
     direto para innerHTML nas tabelas, e a data pode vir de um backup
     importado — texto que não é data vira "—", nunca marcação (SEC-001). */
  const m = String(value == null ? "" : value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export function parseMoney(value) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

export function getMonthKey(date) {
  return String(date || "").slice(0, 7);
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function monthLabel(key) {
  const [year, month] = String(key).split("-");
  const name = MONTH_NAMES[Number(month) - 1] || key;
  return `${name} / ${year}`;
}

export function yearMonthKeys(year) {
  const y = year || new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}

