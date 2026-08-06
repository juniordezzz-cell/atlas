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
      "Apresentação de abertura": "Opening sequence",
      "O boot e a tela de boas-vindas. Por padrão rodam só na primeira vez.":
        "The boot and welcome screens. By default they run only the first time.",
      "Só na primeira vez": "First time only",
      "Sempre": "Always",
      "Rever agora": "Replay now",
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
      "Não foi possível salvar": "Could not save",
      "Restaurar todas as preferências para o padrão?":
        "Restore all preferences to their defaults?",
      "Tema, idioma, formato de data e demais preferências voltam ao padrão de fábrica. Seus dados não são apagados.":
        "Theme, language, date format and other preferences return to factory defaults. Your data is not erased.",
      "Registre ativos, trades, posições ou teses em algum módulo — o backup exporta o que existir.":
        "Record assets, trades, positions or theses in a module — the backup exports whatever exists.",
      "Restaurar este backup?": "Restore this backup?",
      "Não foi possível importar": "Could not import",
      "Backup": "Backup"
    });
  }

  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }

  /* ---- 2. Avisos e diálogos ----
     Esta página tinha o SEU toast (a quinta implementação do sistema) e
     usava window.confirm/alert para restaurar padrões e importar backup.
     Agora tudo passa pelo kit compartilhado (core/ui/atlas-ui.js).

     Os invólucros abaixo existem para o caso de o kit não ter sido
     carregado: a função continua, só perde o acabamento. Nenhuma
     funcionalidade depende do kit estar presente. */

  function toast(msg, kind) {
    if (window.AtlasUI) { AtlasUI.toast(msg, { kind: kind || "ok" }); return; }
    if (window.console) console.log("[ATLAS]", msg);
  }

  function confirmar(opts) {
    if (window.AtlasUI) return AtlasUI.confirm(opts);
    return Promise.resolve(window.confirm(opts.title + (opts.message ? "\n\n" + opts.message : "")));
  }

  function avisar(opts) {
    if (window.AtlasUI) return AtlasUI.alert(opts);
    window.alert(opts.title + (opts.message ? "\n\n" + opts.message : ""));
    return Promise.resolve();
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
        confirmar({
          title: t("Restaurar todas as preferências para o padrão?"),
          message: t("Tema, idioma, formato de data e demais preferências voltam ao padrão de fábrica. Seus dados não são apagados."),
          confirmLabel: t("Restaurar padrões")
        }).then(function (ok) {
          if (!ok) return;
          AtlasSettings.reset();
          syncControls();
          toast(t("Preferências salvas"));
        });
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
          avisar({
            eyebrow: t("Backup"),
            title: t("Nenhum dado salvo ainda"),
            message: t("Registre ativos, trades, posições ou teses em algum módulo — o backup exporta o que existir.")
          });
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

            /* O texto continua dizendo TUDO o que o window.confirm dizia:
               restaurar backup é a ação mais destrutiva do sistema e não
               pode ficar mais bonita às custas de ficar menos clara. */
            var msg =
              "Arquivo: " + file.name + "\n" +
              "Criado em: " + info.createdAt + "\n" +
              "Contém: " + info.keys + " registros (" + info.human + ") — " +
              info.labels.join(", ") + "\n\n" +
              (atual.keys
                ? "ATENÇÃO: os dados atuais no navegador (" + atual.keys +
                  " registros) serão SUBSTITUÍDOS."
                : "O navegador está vazio agora, nada será perdido.") +
              "\n\nA página vai recarregar ao final.";

            return confirmar({
              eyebrow: t("Backup"),
              title: t("Restaurar este backup?"),
              message: msg,
              confirmLabel: t("Restaurar"),
              danger: !!atual.keys      // só é destrutivo se há o que perder
            }).then(function (ok) {
              if (!ok) return;
              AtlasBackup.restore(payload, "replace");
              toast(t("Backup restaurado"));
              setTimeout(function () { location.reload(); }, 700);
            });
          })
          .catch(function (err) {
            avisar({
              eyebrow: t("Backup"),
              title: t("Não foi possível importar"),
              message: err.message,
              danger: true
            });
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
      toast(ok ? t("Preferências salvas") : t("Não foi possível salvar"), ok ? "ok" : "erro");
    });
    if (window.AtlasI18n) AtlasI18n.refresh();
  }

  function init() { syncControls(); wire(); wireBackup(); wireModules(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
