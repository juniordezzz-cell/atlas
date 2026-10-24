/* ============================================================
   app-bridge.js — ponte core (ES modules) → globais clássicos
   ------------------------------------------------------------
   Desde 23/10/2026 só a página Configurações (script clássico,
   js/pages/configuracoes.js) usa esta ponte: tema, backup e apagar
   dados. As outras telas são módulos (js/telas/*.js) e importam o
   core direto.

   Local-first: sem nuvem/backend externo, sem rede. pt-BR.
   ============================================================ */
import { getState, saveState as salvarLocal, updateState as atualizarLocal, resetState as zerarLocal, migrateState, STORAGE_KEY } from "./core/store.js";
import { situacaoNuvem } from "./ui/nuvem.js";

/* Toda gravação daqui (backup importado, apagar tudo, perfil) avisa a
   sincronia com a nuvem (js/ui/nuvem.js), como fazem as outras telas. */
const avisar = () => window.dispatchEvent(new CustomEvent("financas:mudou"));
const saveState = (s) => { const r = salvarLocal(s); avisar(); return r; };
const updateState = (fn) => { const r = atualizarLocal(fn); avisar(); return r; };
const resetState = () => { const r = zerarLocal(); avisar(); return r; };

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

/* Configurações: como está a sincronia e o botão "Atualizar o app agora"
   (tira o service worker e o cache deste app e recarrega — os
   lançamentos ficam, eles moram no localStorage e na nuvem). */
const TEXTO_NUVEM = {
  local: "Sem login neste aparelho: os lançamentos ficam só aqui.",
  conectando: "Conectando à sua conta…",
  ok: "Sincronizado com a sua conta: o que você lança aqui aparece no outro aparelho.",
  erro: "Não consegui falar com a nuvem agora. Os lançamentos continuam salvos aqui e sobem quando voltar.",
  cheio: "Seus dados passaram do tamanho que a nuvem aceita num documento. Exporte um backup e me avise."
};
function mostrarNuvem(situacao) {
  const el = document.getElementById("nuvemStatus");
  if (el) el.textContent = TEXTO_NUVEM[situacao] || TEXTO_NUVEM.local;
}
window.addEventListener("financas:nuvem", (e) => mostrarNuvem(e.detail));
document.addEventListener("DOMContentLoaded", () => {
  mostrarNuvem(situacaoNuvem());
  const botao = document.getElementById("forcarAtualizacao");
  if (!botao) return;
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    try {
      const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(regs.filter((r) => /financas\/?$/.test(new URL(r.scope).pathname)).map((r) => r.unregister()));
      if (window.caches) {
        const chaves = await caches.keys();
        await Promise.all(chaves.filter((k) => k.startsWith("financas-")).map((k) => caches.delete(k)));
      }
    } catch (err) {
      // segue para o recarregamento mesmo assim
    }
    location.replace("index.html?atualizado=" + Date.now());
  });
});

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
