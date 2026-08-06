/* ============================================================
   ATLAS · js/configuracoes.js
   ------------------------------------------------------------
   Cérebro da página de Configurações (raiz).

   Não guarda estado próprio: tudo passa por AtlasSettings, que
   persiste em localStorage, aplica no <html> e avisa os módulos.
   Aqui a página só REFLETE o estado atual e dispara set().

   Trocar tema  → aplica na hora (atlas-theme.css reage).
   Trocar idioma→ o próprio core/i18n.js repinta / recarrega.
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Dicionário EN dos textos desta página ---- */
  if (window.AtlasI18n) {
    AtlasI18n.add("en", {
      "Ajuste tema, idioma e preferências do sistema":
        "Adjust theme, language and system preferences",
      "Aparência": "Appearance",
      "Tema": "Theme",
      "Escolha entre o modo escuro (padrão) e o claro":
        "Choose between dark mode (default) and light",
      "Escuro": "Dark",
      "Claro": "Light",
      "Animações": "Animations",
      "Ativa transições e efeitos de movimento":
        "Enables transitions and motion effects",
      "Idioma e Região": "Language & Region",
      "Idioma": "Language",
      "Muda todo o sistema, inclusive o Oráculo":
        "Changes the whole system, including the Oracle",
      "Português": "Português",
      "English": "English",
      "Formato de data": "Date format",
      "Como as datas aparecem nos relatórios":
        "How dates appear across reports",
      "O ATLAS opera em dólar (padrão do sistema)":
        "ATLAS operates in US dollars (system default)",
      "Padrão do sistema": "System default",
      "Sistema": "System",
      "Restaura tema, idioma e preferências para o padrão de fábrica":
        "Restores theme, language and preferences to factory defaults",
      "Restaurar padrões": "Restore defaults",
      "Não apaga seus dados": "Your data is not erased",
      "Dados e Backup": "Data & Backup",
      "Exportar backup": "Export backup",
      "Baixa um arquivo .json com todos os dados de todos os módulos. Guarde no Drive ou pendrive.":
        "Downloads a .json file with all data from every module. Keep it on Drive or a USB stick.",
      "Importar backup": "Import backup",
      "Restaura os dados a partir de um arquivo exportado. Substitui o que estiver no navegador agora.":
        "Restores data from an exported file. Replaces whatever is in the browser now.",
      "Escolher arquivo": "Choose file",
      "Backup exportado": "Backup exported",
      "Backup restaurado": "Backup restored",
      "Nenhum dado salvo ainda": "No data saved yet",
      "Preferências salvas": "Preferences saved",
      "Restaurar todas as preferências para o padrão?":
        "Restore all preferences to their defaults?"
    });
  }

  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }

  /* ---- 2. Toast de confirmação ---- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "atlas-toast";
      toastEl.setAttribute("role", "status");
      toastEl.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
        '<path d="M20 6 9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector("span").textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1900);
  }

  /* ---- 3. Sincroniza os controles com o estado atual ---- */
  function syncControls() {
    if (!window.AtlasSettings) return;
    // Segmentados: cada .seg tem data-key; botões têm data-val
    document.querySelectorAll(".seg[data-key]").forEach(function (seg) {
      var key = seg.getAttribute("data-key");
      var cur = String(AtlasSettings.get(key));
      seg.querySelectorAll("button[data-val]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.getAttribute("data-val") === cur));
      });
    });
    // Switches: data-key booleano
    document.querySelectorAll(".switch[data-key]").forEach(function (sw) {
      var key = sw.getAttribute("data-key");
      sw.setAttribute("aria-pressed", String(!!AtlasSettings.get(key)));
    });
  }

  /* ---- 4. Liga os eventos ---- */
  function wire() {
    if (!window.AtlasSettings) return;

    document.querySelectorAll(".seg[data-key]").forEach(function (seg) {
      var key = seg.getAttribute("data-key");
      seg.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-val]");
        if (!btn) return;
        var val = btn.getAttribute("data-val");
        if (String(AtlasSettings.get(key)) === val) return;
        AtlasSettings.set(key, val);
        syncControls();
        // idioma pode recarregar a página; se não recarregar, avisa
        if (key !== "lang" || AtlasI18n.lang() === "en") toast(t("Preferências salvas"));
      });
    });

    document.querySelectorAll(".switch[data-key]").forEach(function (sw) {
      var key = sw.getAttribute("data-key");
      sw.addEventListener("click", function () {
        AtlasSettings.set(key, !AtlasSettings.get(key));
        syncControls();
        toast(t("Preferências salvas"));
      });
    });

    var resetBtn = document.getElementById("btnReset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!window.confirm(t("Restaurar todas as preferências para o padrão?"))) return;
        AtlasSettings.reset();
        syncControls();
        toast(t("Preferências salvas"));
      });
    }

    // Reflete mudanças vindas de fora (outra aba, atalho, etc.)
    AtlasSettings.on(function () { syncControls(); });
  }

  /* ---- 5. Dados e Backup ---- */
  function renderBackupSummary() {
    if (!window.AtlasBackup) return;
    var st = AtlasBackup.stats();
    var statusEl = document.getElementById("bkStatus");
    var listEl = document.getElementById("bkList");

    if (statusEl) {
      statusEl.textContent = st.keys ? (st.keys + " · " + st.human) : t("Nenhum dado salvo ainda");
    }
    if (listEl) {
      listEl.textContent = st.keys ? st.groups.join(" · ") : t("Nenhum dado salvo ainda");
    }
  }

  function wireBackup() {
    if (!window.AtlasBackup) return;

    var btnExport = document.getElementById("btnExport");
    var btnImport = document.getElementById("btnImport");
    var fileInput = document.getElementById("bkFile");

    if (btnExport) {
      btnExport.addEventListener("click", function () {
        var st = AtlasBackup.stats();
        if (!st.keys) {
          window.alert(t("Nenhum dado salvo ainda") + ".");
          return;
        }
        var r = AtlasBackup.download();
        toast(t("Backup exportado"));
        renderBackupSummary();
        console.log("[ATLAS] backup:", r.name, r.keys + " chaves,", AtlasBackup.human(r.bytes));
      });
    }

    if (btnImport && fileInput) {
      btnImport.addEventListener("click", function () {
        fileInput.value = "";     // permite reimportar o mesmo arquivo
        fileInput.click();
      });

      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;

        AtlasBackup.readFile(file)
          .then(function (text) {
            var payload = AtlasBackup.parse(text);   // lança se inválido
            var info = AtlasBackup.inspect(payload);
            var atual = AtlasBackup.stats();

            var msg =
              "Restaurar este backup?\n\n" +
              "Arquivo: " + file.name + "\n" +
              "Criado em: " + info.createdAt + "\n" +
              "Contém: " + info.keys + " registros (" + info.human + ")\n" +
              "  " + info.labels.join(", ") + "\n\n" +
              (atual.keys
                ? "ATENÇÃO: os dados atuais no navegador (" + atual.keys +
                  " registros) serão SUBSTITUÍDOS.\n\n"
                : "O navegador está vazio agora, nada será perdido.\n\n") +
              "A página vai recarregar ao final.";

            if (!window.confirm(msg)) return;

            AtlasBackup.restore(payload, "replace");
            toast(t("Backup restaurado"));
            setTimeout(function () { location.reload(); }, 700);
          })
          .catch(function (err) {
            window.alert("Não foi possível importar:\n\n" + err.message);
          });
      });
    }

    renderBackupSummary();
  }

  /* ---- 6. Configurações por módulo ---- */
  function wireModules() {
    var host = document.getElementById("modSettings");
    if (!host || !window.AtlasModuleSettings) return;
    AtlasModuleSettings.render(host, function (ok, mod) {
      toast(ok ? t("Preferências salvas") : "Não foi possível salvar");
    });
    if (window.AtlasI18n) AtlasI18n.refresh();
  }

  function init() { syncControls(); wire(); wireBackup(); wireModules(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
