/* ============================================================
   ATLAS · DeFi — config.js
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;
  C.mountNav("config");

  var meta = S.meta();

  /* estado atual nos controles */
  U.qsa("#cfgTheme button").forEach(function (b) { b.classList.toggle("active", b.dataset.v === (meta.theme || "dark")); });
  U.qs("#cfgLang").value = meta.lang || "pt-BR";
  U.qs("#cfgCur").value = meta.currency || "USD";

  U.qsa("#cfgTheme button").forEach(function (b) {
    b.addEventListener("click", function () {
      U.qsa("#cfgTheme button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      S.setMeta({ theme: b.dataset.v });
      if (b.dataset.v === "light") U.toast("Tema claro chega numa próxima versão — mantendo escuro.", "info");
      else U.toast("Tema escuro aplicado.", "ok");
    });
  });

  U.qs("#cfgLang").addEventListener("change", function (e) {
    S.setMeta({ lang: e.target.value });
    U.toast("Idioma salvo.", "ok");
  });
  U.qs("#cfgCur").addEventListener("change", function (e) {
    S.setMeta({ currency: e.target.value });
    U.toast("Moeda padrão atualizada. Recarregando…", "ok");
    setTimeout(function () { location.reload(); }, 700);
  });

  /* Exportar JSON */
  U.qs("#btnExport").addEventListener("click", function () {
    var data = JSON.stringify(S.all(), null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "atlas-defi-patrimonio.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    U.toast("Patrimônio exportado.", "ok");
  });

  U.qs("#btnBackup").addEventListener("click", function () {
    try { localStorage.setItem("atlas_defi_backup_" + Date.now(), JSON.stringify(S.all())); U.toast("Backup salvo no navegador.", "ok"); }
    catch (e) { U.toast("Não foi possível salvar o backup neste ambiente.", "warn"); }
  });

  U.qs("#btnReset").addEventListener("click", function () {
    S.reset();
    U.toast("Dados de exemplo restaurados.", "ok");
    setTimeout(function () { location.href = "index.html"; }, 700);
  });
})();
