/* ============================================================
   ATLAS · core/atlas-secure.js
   Trava do app inteiro (Fase 1 do login) — UM include por página.
   Depende de: core/atlas-auth.js (já carregado antes, no <head>).

   O QUE FAZ
   ---------
   Numa página protegida, ele:
     1) esconde o conteúdo imediatamente (antes do body pintar);
     2) carrega, em cadeia, a config + o SDK do Firebase + o provedor;
     3) espera o Firebase resolver a sessão (assíncrono) e então:
          autenticado + autorizado → mostra a página
          caso contrário           → manda para o login.

   Páginas públicas (login, offline, landing, boas-vindas) são ignoradas.

   OFFLINE / FALHA DE CARGA: se o SDK não carregar (ex.: primeira visita
   offline) ou nenhum provedor registrar, ele NÃO barra (fail-open) — não
   trancar ninguém para fora por um soluço de rede. Não há dado seu na
   nuvem na Fase 1; a proteção de verdade vem das regras do Firestore na
   Fase 2. Quem já entrou tem a sessão persistida e abre offline.

   Um include só por página, com o SDK servido pelo próprio ATLAS.
   ============================================================ */
(function (global) {
  "use strict";

  // raiz do site, deduzida do próprio <script src=".../core/atlas-secure.js">
  var root = "";
  try {
    var s = (document.currentScript && document.currentScript.src) || "";
    var i = s.indexOf("/core/atlas-secure.js");
    if (i >= 0) root = s.slice(0, i + 1);
  } catch (e) {}

  var path = String(location.pathname || "").toLowerCase();
  if (/(login|offline|landing|boas-vindas)\.html$/.test(path)) return; // públicas

  /* MODO DEV — ver as telas sem login, SÓ no servidor local.
     Liga com ?atlas-dev=1 no endereço e fica lembrado neste navegador;
     desliga com ?atlas-dev=0. Existe para o Claude conseguir abrir e
     conferir as páginas que está editando (ele não pode fazer login).
     Fora de localhost/127.0.0.1 o bloco inteiro é ignorado: no site
     publicado a trava continua valendo sempre. Sem sessão, a nuvem
     (atlas-cloud.js) não sobe — os dados são só os locais deste navegador. */
  var DEV_KEY = "atlas.dev.semlogin";
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    try {
      var pedido = new URLSearchParams(location.search).get("atlas-dev");
      if (pedido === "1") localStorage.setItem(DEV_KEY, "1");
      else if (pedido === "0") localStorage.removeItem(DEV_KEY);
      if (localStorage.getItem(DEV_KEY) === "1") {
        global.ATLAS_DEV_SEM_LOGIN = true;
        var selo = function () {
          var b = document.createElement("div");
          b.textContent = "MODO DEV · sem login";
          b.title = "Só no servidor local. Desligue com ?atlas-dev=0 no endereço.";
          b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;" +
            "border-radius:6px;background:#f5b942;color:#1a1200;font:600 11px/1.2 system-ui,sans-serif;" +
            "pointer-events:none;opacity:.9";
          document.body.appendChild(b);
        };
        if (document.body) selo(); else document.addEventListener("DOMContentLoaded", selo);
        return;
      }
    } catch (e) {}
  }

  // esconde o conteúdo até resolver (evita flash de tela protegida)
  var style = document.createElement("style");
  style.id = "atlas-gate-style";
  style.textContent = "body{visibility:hidden!important}";
  (document.head || document.documentElement).appendChild(style);

  function reveal() { var el = document.getElementById("atlas-gate-style"); if (el && el.parentNode) el.parentNode.removeChild(el); }
  function toLogin() { try { location.replace(root + "pages/login.html"); } catch (e) { location.href = root + "pages/login.html"; } }

  function load(src, cb) {
    var el = document.createElement("script");
    el.src = src; el.onload = cb; el.onerror = cb;
    (document.head || document.documentElement).appendChild(el);
  }

  function decide() {
    if (!global.AtlasAuth || !AtlasAuth.real()) { reveal(); return; } // sem provedor real → não barra
    var go = function () { if (AtlasAuth.autenticado()) reveal(); else toLogin(); };
    if (global.AtlasFirebase && AtlasFirebase.whenReady) AtlasFirebase.whenReady(go); else go();
  }

  // cadeia: config → app → auth → firestore → provedor → nuvem → decide
  load(root + "core/atlas-firebase-config.js", function () {
    load(root + "assets/vendor/firebase-app-compat-10.14.1.js", function () {
      load(root + "assets/vendor/firebase-auth-compat-10.14.1.js", function () {
        load(root + "assets/vendor/firebase-firestore-compat-10.14.1.js", function () {
          load(root + "core/atlas-firebase.js", function () {
            // a nuvem (Fase 2) sobe depois do provedor; ela mesma espera o login
            load(root + "core/atlas-cloud.js", function () {});
            decide();
          });
        });
      });
    });
  });
})(window);
