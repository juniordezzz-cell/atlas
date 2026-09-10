/* ============================================================
   configuracoes.js — controller da página "Configurações"
   ------------------------------------------------------------
   Portado de js/config.js (v1), adaptado para o shell ATLAS:

   - Tema: a v1 guardava o tema em state.settings.theme e alternava
     a classe body.light-theme. Neste módulo a fonte única de
     verdade do tema é o mecanismo do shell — atributo data-theme
     na <html>, persistido em localStorage sob a chave
     "atlas-financas-theme" (financas/js/ui/shell.js e
     FinanceUtils.applyTheme em financas/js/app-bridge.js, que já
     usa essa mesma chave). Os botões abaixo só leem/gravam esse
     mecanismo — state.settings.theme fica intocado/sem uso.
   - Animações e tabelas compactas continuam em state.settings
     (countUpCurrency, em financas/js/app-bridge.js, lê
     settings.animations para decidir se anima os números).
   - Backup (exportar/importar) e "restaurar dados" usam a mesma
     API do core (getState/saveState/refreshSummary/resetState),
     só que agora local-first — sem nuvem, sem "resetarNuvem".

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: o import de backup faz JSON.parse do arquivo
   escolhido pelo próprio usuário (FileReader local, sem rede) e
   grava via FinanceUtils.saveState — mesmo padrão de "dados vêm só
   do próprio usuário/localStorage" already usado no restante do
   módulo financas/js/pages/*.js.
   ============================================================ */
(function () {
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function initTheme() {
    const buttons = document.querySelectorAll("[data-theme-choice]");
    if (!buttons.length) {
      return;
    }

    function sync() {
      const theme = currentTheme();
      buttons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.themeChoice === theme);
      });
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        FinanceUtils.applyTheme(button.dataset.themeChoice);
        sync();
      });
    });

    sync();

    // Mantém os botões em sincronia mesmo se o tema mudar por outra
    // via (ex.: o botão ◐ da topbar do shell, financas/js/ui/shell.js).
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(sync).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
    }
  }

  function initSwitches() {
    const state = FinanceUtils.getState();
    const animations = document.querySelector("#animationsToggle");
    const compact = document.querySelector("#compactTablesToggle");

    if (animations) {
      animations.checked = state.settings.animations !== false;
      animations.addEventListener("change", () => {
        FinanceUtils.updateState((current) => {
          current.settings.animations = animations.checked;
          return current;
        });
      });
    }

    if (compact) {
      compact.checked = state.settings.compactTables === true;
      compact.addEventListener("change", () => {
        FinanceUtils.updateState((current) => {
          current.settings.compactTables = compact.checked;
          return current;
        });
      });
    }
  }

  function initProfile() {
    const state = FinanceUtils.getState();
    const form = document.querySelector("#profileForm");
    if (!form) {
      return;
    }

    const profile = state.profile || {};
    form.elements.name.value = profile.name || "";
    form.elements.email.value = profile.email || "";
    form.elements.currency.value = profile.currency || "BRL";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      FinanceUtils.updateState((current) => {
        current.profile = {
          name: formData.get("name"),
          email: formData.get("email"),
          currency: formData.get("currency")
        };
        return current;
      });
      FinanceUtils.toast("Perfil atualizado.");
    });
  }

  function initBackup() {
    const exportButton = document.querySelector("#exportBackup");
    const importInput = document.querySelector("#importBackup");
    const resetButton = document.querySelector("#resetData");

    if (exportButton) {
      exportButton.addEventListener("click", () => {
        FinanceUtils.downloadText(
          "backup-financas.json",
          JSON.stringify(FinanceUtils.getState(), null, 2),
          "application/json;charset=utf-8"
        );
      });
    }

    if (importInput) {
      importInput.addEventListener("change", () => {
        const file = importInput.files[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const nextState = JSON.parse(reader.result);
            FinanceUtils.saveState(FinanceUtils.refreshSummary(nextState));
            FinanceUtils.toast("Backup importado.");
            initSwitches();
            initProfile();
          } catch (error) {
            FinanceUtils.toast("Arquivo inválido.");
          }
        };
        reader.readAsText(file);
        importInput.value = "";
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        FinanceUtils.resetState();
        FinanceUtils.toast("Dados restaurados.");
        initSwitches();
        initProfile();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "configuracoes") {
      return;
    }

    initTheme();
    initSwitches();
    initProfile();
    initBackup();
  });
})();
