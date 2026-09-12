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

  // cadeia: config → firebase-app → firebase-auth → provedor → decide
  load(root + "core/atlas-firebase-config.js", function () {
    load(root + "assets/vendor/firebase-app-compat-10.14.1.js", function () {
      load(root + "assets/vendor/firebase-auth-compat-10.14.1.js", function () {
        load(root + "core/atlas-firebase.js", function () { decide(); });
      });
    });
  });
})(window);
