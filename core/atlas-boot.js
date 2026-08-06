/* ============================================================
   ATLAS · core/atlas-boot.js
   ------------------------------------------------------------
   Ponto único de partida da camada global.

   Responsabilidades:
     1. Descobrir em qual módulo a página está rodando e marcar
        <html data-module="..."> — é isso que aciona o sotaque de
        cor certo em themes/atlas-theme.css.
     2. Garantir que tema, animações e idioma já estejam aplicados
        ANTES da primeira pintura (evita o "flash" de tema errado).
     3. Expor AtlasBoot.repaint() — o gancho que os módulos chamam
        quando precisam repintar após troca de moeda/idioma.

   Ordem de carga obrigatória em cada HTML:

     <script src="../core/settings.js"></script>
     <script src="../core/i18n.js"></script>
     <script src="../core/currency.js"></script>
     <script src="../core/atlas-boot.js"></script>

   E, no <head>, SEMPRE por último no CSS:

     <link rel="stylesheet" href="../themes/atlas-theme.css">
     <link rel="stylesheet" href="../themes/atlas-effects.css">
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasBoot) return;

  /* ---------- 1. Identificação do módulo ---------- */

  function detectModule() {
    var html = document.documentElement;

    // Declaração explícita ganha de qualquer heurística.
    var declared = html.getAttribute("data-module");
    if (declared) return declared;

    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("/hold/") !== -1)    return "hold";
    if (path.indexOf("/trade/") !== -1)   return "trade";
    if (path.indexOf("/defi/") !== -1)    return "defi";
    if (path.indexOf("/rwa/") !== -1)     return "rwa";
    if (path.indexOf("/academy/") !== -1) return "academy";
    return "atlas"; // dashboard, login, boas-vindas, boot
  }

  var moduleId = detectModule();
  document.documentElement.setAttribute("data-module", moduleId);

  /* ---------- 2. Rótulo humano do módulo (usado no cabeçalho) ---------- */

  var LABELS = {
    hold: "HOLD",
    trade: "TRADE",
    defi: "DEFI",
    rwa: "RWA",
    academy: "ACADEMY",
    atlas: "ATLAS"
  };

  /* ---------- 3. Repintura coordenada ---------- */

  var repainters = [];

  function repaint(reason) {
    repainters.slice().forEach(function (fn) {
      try { fn(reason); }
      catch (e) { if (window.console) console.error("[AtlasBoot] repaint:", e); }
    });
    if (window.AtlasI18n) window.AtlasI18n.refresh();
  }

  // Trocar moeda ou formato numérico exige repintar valores.
  if (window.AtlasSettings) {
    window.AtlasSettings.on(function (changed) {
      var needs = ["currency", "numberFormat", "dateFormat"].some(function (k) {
        return changed.indexOf(k) !== -1;
      });
      if (needs) repaint("settings");
    });
  }
  document.addEventListener("atlas:currency", function () { repaint("currency"); });

  /* ---------- 4. API ---------- */

  window.AtlasBoot = {
    module: function () { return moduleId; },
    label: function (id) { return LABELS[id || moduleId] || String(id || moduleId).toUpperCase(); },

    /* Um módulo registra aqui a sua função de redesenho.
       Ex.: AtlasBoot.onRepaint(function(){ Router.rerender(); }); */
    onRepaint: function (fn) { if (typeof fn === "function") repainters.push(fn); return fn; },
    repaint: repaint,

    /* Diagnóstico rápido no console */
    status: function () {
      return {
        module: moduleId,
        theme: window.AtlasSettings && window.AtlasSettings.get("theme"),
        lang: window.AtlasI18n && window.AtlasI18n.lang(),
        currency: window.AtlasCurrency && window.AtlasCurrency.code(),
        fxStale: window.AtlasCurrency && window.AtlasCurrency.isStale(),
        fxUpdated: window.AtlasCurrency && window.AtlasCurrency.updatedAt()
      };
    }
  };
})();
