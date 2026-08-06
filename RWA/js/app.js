/* ============================================================
   ATLAS · RWA — app.js
   Bootstrap: monta o shell, registra rotas, inicia o roteador SPA.
   ============================================================ */
(function () {
  "use strict";

  function boot() {
    var V = window.Views;
    Shell.mount("#shell");
    Router
      .register("dashboard", V.dashboard, "dashboard")
      .register("portfolio", V.portfolio, "portfolio")
      .register("asset/:id", V.asset, "portfolio")
      .register("macro", V.macro, "macro")
      .register("risk", V.risk, "risk")
      .register("narrative", V.narrative, "narrative")
      .register("journal", V.journal, "journal")
      .start();
  }

  try {
    boot();
  } catch (e) {
    console.error("ATLAS RWA boot error:", e);
    var root = document.getElementById("shell");
    if (root) {
      root.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0B0F1A;color:#E5E7EB;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px">' +
          '<div>' +
            '<h2 style="font-size:20px;margin-bottom:12px">Erro ao iniciar o módulo RWA</h2>' +
            '<p style="color:#9CA3AF;font-size:14px;margin-bottom:20px">' + (e.message || e) + '</p>' +
            '<button onclick="try{localStorage.removeItem(\'atlas_rwa_state_v2\');location.reload();}catch(x){location.reload();}" ' +
              'style="padding:10px 22px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:rgba(79,140,255,0.15);color:#4F8CFF;cursor:pointer;font-size:14px;font-weight:600">' +
              'Resetar dados e recarregar</button>' +
          '</div>' +
        '</div>';
    }
  }
})();
