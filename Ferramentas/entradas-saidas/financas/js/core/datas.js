/* ============================================================
   datas.js — dias no formato AAAA-MM-DD, sem hora e sem fuso
   ------------------------------------------------------------
   O Finanças só guarda o DIA. As contas de calendário usam UTC
   para não escorregar um dia no horário de verão ou em fuso
   diferente; "hoje" vem do relógio local de quem está usando.
   ============================================================ */

const pad = (n) => String(n).padStart(2, "0");

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utc(chave) {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
function chaveUtc(dt) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function somarDias(chave, n) {
  const dt = utc(chave);
  dt.setUTCDate(dt.getUTCDate() + n);
  return chaveUtc(dt);
}

/* Data real? (rejeita 31/02, 00/10…) */
export function dataValida(a, m, d) {
  if (!(a >= 2000 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function montar(a, m, d) {
  return `${a}-${pad(m)}-${pad(d)}`;
}

/* 0 = domingo … 6 = sábado */
export function diaDaSemana(chave) {
  return utc(chave).getUTCDay();
}

export function mesDe(chave) {
  return String(chave).slice(0, 7);
}

export function somarMeses(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function nomeMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = MESES[m - 1] || "";
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`;
}

/* "Hoje", "Ontem", "Qui, 23/10" */
export function diaCurto(chave, hoje = todayKey()) {
  if (chave === hoje) return "Hoje";
  if (chave === somarDias(hoje, -1)) return "Ontem";
  const [, m, d] = chave.split("-");
  const s = SEMANA[diaDaSemana(chave)];
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}, ${d}/${m}`;
}
