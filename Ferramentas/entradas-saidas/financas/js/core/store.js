/* ============================================================
   store.js — o que o Finanças guarda (localStorage, local-first)
   ------------------------------------------------------------
   Versão 2 (23/10/2026): um livro-caixa só (js/core/livro.js).
     { versao: 2,
       lancamentos: [...],          // ver livro.js
       aprendizado: { palavra: categoria },   // o que o Oráculo aprendeu
       metas: { mensal: centavos|null, categorias: { nome: centavos } },
       profile, settings }

   A v1 guardava `entries`/`expenses` em reais (float) e um planner
   que espalhava previsões pelo ano. Na migração só fica o que já
   aconteceu (data até hoje), convertido para centavos; o estado
   antigo inteiro vai antes para BACKUP_KEY, para nada se perder.
   ============================================================ */
import { centavosDeReais } from "./dinheiro.js";
import { TIPOS } from "./livro.js";
import { todayKey } from "./datas.js";

const STORAGE_KEY = "finance-dashboard-state";
const BACKUP_KEY = "finance-dashboard-state.backup-v1";

function estadoVazio() {
  return {
    versao: 2,
    lancamentos: [],
    aprendizado: {},
    metas: { mensal: null, categorias: {} },
    profile: { name: "", email: "", currency: "BRL" },
    settings: { animations: true }
  };
}

let contador = 0;
function novoId() {
  contador = (contador + 1) % 1000;
  return `l-${Date.now().toString(36)}-${contador}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function lancamentoValido(l) {
  return !!l && typeof l === "object" && TIPOS.includes(l.tipo) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(l.data)) &&
    Number.isSafeInteger(l.centavos) && (l.centavos > 0 || (l.tipo === "saldo" && l.centavos === 0)) &&
    (l.tipo !== "transferencia" || l.sentido === "saida" || l.sentido === "entrada");
}

function limparLancamento(l, i) {
  return {
    id: String(l.id || `m-${i}`),
    data: l.data,
    tipo: l.tipo,
    centavos: l.centavos,
    descricao: String(l.descricao || "").slice(0, 120),
    categoria: l.categoria ? String(l.categoria).slice(0, 60) : null,
    ...(l.destino ? { destino: String(l.destino).slice(0, 60) } : {}),
    ...(l.tipo === "transferencia" ? { sentido: l.sentido } : {}),
    criadoEm: Number.isFinite(Number(l.criadoEm)) ? Number(l.criadoEm) : i
  };
}

/* Aceita v1, v2 ou um backup importado. Idempotente. */
function migrarEstado(raw, hoje = todayKey()) {
  const base = estadoVazio();
  if (!raw || typeof raw !== "object") return base;
  if (raw.profile && typeof raw.profile === "object") base.profile = { ...base.profile, ...raw.profile };
  if (raw.settings && typeof raw.settings === "object") base.settings = { ...base.settings, ...raw.settings };

  if (raw.versao === 2) {
    base.lancamentos = (Array.isArray(raw.lancamentos) ? raw.lancamentos : [])
      .filter(lancamentoValido).map(limparLancamento);
    if (raw.aprendizado && typeof raw.aprendizado === "object") {
      for (const [k, v] of Object.entries(raw.aprendizado)) {
        if (typeof v === "string") base.aprendizado[String(k).slice(0, 40)] = v.slice(0, 60);
      }
    }
    const m = raw.metas || {};
    base.metas.mensal = Number.isSafeInteger(m.mensal) && m.mensal > 0 ? m.mensal : null;
    for (const [k, v] of Object.entries(m.categorias || {})) {
      if (Number.isSafeInteger(v) && v > 0) base.metas.categorias[String(k).slice(0, 60)] = v;
    }
    return base;
  }

  // v1: só o realizado (data até hoje)
  const feito = (r) => r && /^\d{4}-\d{2}-\d{2}/.test(String(r.date)) && String(r.date).slice(0, 10) <= hoje;
  let i = 0;
  for (const r of (raw.entries || []).filter(feito)) {
    const c = centavosDeReais(r.value);
    if (c > 0) base.lancamentos.push(limparLancamento({
      id: r.id, data: String(r.date).slice(0, 10), tipo: "entrada", centavos: c,
      descricao: r.description, categoria: r.source || "Recebimento", criadoEm: i
    }, i++));
  }
  for (const r of (raw.expenses || []).filter(feito)) {
    const c = centavosDeReais(r.value);
    if (c > 0) base.lancamentos.push(limparLancamento({
      id: r.id, data: String(r.date).slice(0, 10), tipo: "saida", centavos: c,
      descricao: r.description, categoria: r.category || "Outros", criadoEm: i
    }, i++));
  }
  return base;
}

function lerEstado(hoje) {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const raw = JSON.parse(salvo);
      if (raw && raw.versao !== 2) {
        // guarda o formato antigo antes de mexer (uma vez só)
        if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, salvo);
        const novo = migrarEstado(raw, hoje);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(novo));
        return novo;
      }
      return migrarEstado(raw, hoje);
    }
  } catch (err) {
    // armazenamento ilegível: começa vazio
  }
  return estadoVazio();
}

function salvarEstado(estado) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch (err) {
    // localStorage indisponível (modo privado etc.)
  }
  return estado;
}

function adicionar(estado, lanc) {
  // criadoEm sempre cresce: dois lançamentos no mesmo milissegundo
  // (uma frase com dois gastos) mantêm a ordem em que foram ditos
  const maior = estado.lancamentos.reduce((m, x) => Math.max(m, Number(x.criadoEm) || 0), 0);
  const l = { id: novoId(), descricao: "", categoria: null, ...lanc, criadoEm: Math.max(Date.now(), maior + 1) };
  if (!lancamentoValido(l)) throw new Error("Lançamento inválido");
  estado.lancamentos.push(limparLancamento(l, estado.lancamentos.length));
  return estado;
}

function atualizar(estado, id, campos) {
  const i = estado.lancamentos.findIndex((l) => l.id === id);
  if (i < 0) return estado;
  const l = { ...estado.lancamentos[i], ...campos, id };
  if (!lancamentoValido(l)) throw new Error("Lançamento inválido");
  estado.lancamentos[i] = limparLancamento(l, i);
  return estado;
}

function remover(estado, id) {
  estado.lancamentos = estado.lancamentos.filter((l) => l.id !== id);
  return estado;
}

/* Nomes antigos, usados por Configurações. */
const getState = lerEstado;
const saveState = salvarEstado;
const freshState = estadoVazio;
const migrateState = migrarEstado;
function updateState(fn) {
  const cur = lerEstado();
  return salvarEstado(fn(cur) || cur);
}
function resetState() {
  return salvarEstado(estadoVazio());
}

export {
  STORAGE_KEY, BACKUP_KEY, estadoVazio, novoId, migrarEstado, lerEstado, salvarEstado,
  adicionar, atualizar, remover, lancamentoValido,
  getState, saveState, freshState, migrateState, updateState, resetState
};
