/* ============================================================
   ATLAS — Bootstrap
   Inicializa o estado e monta o shell. Carregado por último.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function boot() {
    ATLAS.app.init();

    ATLAS.topbar.mountBrand(document.querySelector(".brand-cell"));
    ATLAS.topbar.mount(document.querySelector(".topbar"));
    ATLAS.sidebar.mount(document.querySelector(".nav"));
    ATLAS.oraculo.mount(document.getElementById("oraculo-root"));

    // Ao trocar de carteira, atualiza a topbar (nome + saldo)
    ATLAS.app.subscribe(function () {
      ATLAS.topbar.mount(document.querySelector(".topbar"));
    });

    ATLAS.router.start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.ATLAS = window.ATLAS || {});
