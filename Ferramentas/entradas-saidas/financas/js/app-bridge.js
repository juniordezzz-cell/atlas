/* ============================================================
   app-bridge.js — ponte core (ES modules) → globais clássicos
   ------------------------------------------------------------
   Desde 23/10/2026 só a página Configurações (script clássico,
   js/pages/configuracoes.js) usa esta ponte: tema, backup e apagar
   dados. As outras telas são módulos (js/telas/*.js) e importam o
   core direto.

   Local-first: sem nuvem/backend externo, sem rede. pt-BR.
   ============================================================ */
import { getState, saveState, updateState, resetState, migrateState, STORAGE_KEY } from "./core/store.js";

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

/* O tema mora em data-theme na <html>, com a mesma chave que
   js/ui/shell.js usa (atlas-financas-theme). */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("atlas-financas-theme", theme);
  } catch (err) {
    // localStorage indisponível (modo privado etc.) — ignora
  }
}

window.FinanceUtils = {
  STORAGE_KEY,
  getState,
  saveState,
  updateState,
  resetState,
  migrateState,
  downloadText,
  toast,
  applyTheme
};
