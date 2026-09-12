/* ===================================================================
   ATLAS — Login (Google, via Firebase)

   O botão delega para AtlasAuth.signIn(), que chama o provedor Firebase
   (login Google + checagem da allowlist). Em sucesso, vai para o
   dashboard. Fora da allowlist, mostra o motivo e não entra.

   Se o Firebase não estiver configurado (modo local), AtlasAuth.signIn
   ainda funciona como antes — abre uma sessão local sem barrar nada.
   =================================================================== */
(function () {
  "use strict";

  var btn = document.getElementById("btnGoogle");
  var erroEl = document.getElementById("loginErro");

  function erro(msg) {
    if (!erroEl) return;
    erroEl.textContent = msg || "Não foi possível entrar. Tente novamente.";
    erroEl.hidden = false;
  }
  function limpaErro() { if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; } }

  function irParaApp() { window.location.href = "dashboard.html"; }

  // Já autenticado? (sessão persistida) → entra direto.
  function checaSessao() {
    if (window.AtlasFirebase && AtlasFirebase.whenReady) {
      AtlasFirebase.whenReady(function () { if (AtlasAuth && AtlasAuth.autenticado()) irParaApp(); });
    } else if (window.AtlasAuth && AtlasAuth.autenticado()) {
      irParaApp();
    }
  }
  checaSessao();

  btn.addEventListener("click", function () {
    limpaErro();
    btn.disabled = true;
    var txt = btn.querySelector("span");
    var original = txt ? txt.textContent : "";
    if (txt) txt.textContent = "Entrando…";

    var p = window.AtlasAuth ? AtlasAuth.signIn({ metodo: "google" }) : Promise.reject(new Error("Auth indisponível."));

    p.then(function () { irParaApp(); })
     .catch(function (e) {
       btn.disabled = false;
       if (txt) txt.textContent = original;
       var code = e && e.code;
       if (code === "atlas/nao-autorizado") erro(e.message);
       else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") limpaErro();
       else if (code === "auth/popup-blocked") erro("O navegador bloqueou a janela de login. Libere pop-ups e tente de novo.");
       else if (code === "auth/unauthorized-domain") erro("Este domínio não está autorizado no Firebase. Adicione-o em Authentication → Authorized domains.");
       else erro((e && e.message) || "Não foi possível entrar.");
     });
  });
})();
