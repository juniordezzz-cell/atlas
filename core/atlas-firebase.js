/* ============================================================
   ATLAS · core/atlas-firebase.js
   Provedor de autenticação real (Firebase) — login com Google.
   Depende de: assets/vendor/firebase-app-compat + firebase-auth-compat,
               core/atlas-firebase-config.js, core/atlas-auth.js

   Registra-se em AtlasAuth. A partir daqui, signIn/signOut/current/
   protegido passam a valer de verdade — sem as telas mudarem.

   "Só convidados": depois do login Google, o email é conferido contra
   ATLAS_FIREBASE.allowedEmails. Fora da lista → desconecta e recusa.
   (Fase 1 = gate client-side; a Fase 2, com Firestore, aplica no servidor.)

   Sessão persiste local (IndexedDB do Firebase): quem já entrou abre o
   ATLAS mesmo offline; só o PRIMEIRO login precisa de rede.

   Expõe window.AtlasFirebase.whenReady(cb) — chamado quando o estado de
   autenticação inicial já foi resolvido (o guard espera por isso).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasFirebase) return;

  var CFG = global.ATLAS_FIREBASE;
  if (!CFG || !CFG.config || !global.firebase || !global.AtlasAuth) return; // sem config/SDK → modo local

  function allowed(email) {
    var list = (CFG.allowedEmails || []).map(function (e) { return String(e).trim().toLowerCase(); });
    if (!list.length) return true; // lista vazia = ninguém foi restringido
    return list.indexOf(String(email || "").trim().toLowerCase()) !== -1;
  }

  var app, auth;
  try {
    app = firebase.initializeApp(CFG.config);
    auth = firebase.auth();
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
  } catch (e) { return; } // falhou o init → segue em modo local

  // ---- resolução do estado inicial + fan-out de mudanças ----
  var readyResolved = false, readyCbs = [], changeFns = [];
  auth.onAuthStateChanged(function () {
    readyResolved = true;
    changeFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    var cbs = readyCbs; readyCbs = [];
    cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
  });

  function userView() {
    var u = auth.currentUser;
    if (!u || !u.email || !allowed(u.email)) return null;
    return { email: u.email, name: u.displayName || u.email.split("@")[0], foto: u.photoURL || null };
  }

  var provider = {
    nome: "firebase",
    current: function () { return userView(); },
    signIn: function () {
      var g = new firebase.auth.GoogleAuthProvider();
      g.setCustomParameters({ prompt: "select_account" });
      return auth.signInWithPopup(g).then(function (res) {
        var u = res.user;
        if (!allowed(u.email)) {
          return auth.signOut().then(function () {
            var err = new Error("A conta " + u.email + " não tem acesso ao ATLAS. Fale com o administrador.");
            err.code = "atlas/nao-autorizado";
            throw err;
          });
        }
        return { email: u.email, name: u.displayName || u.email.split("@")[0] };
      });
    },
    signOut: function () { return auth.signOut(); },
    onChange: function (fn) { if (typeof fn === "function") changeFns.push(fn); }
  };

  AtlasAuth.registerProvider(provider);

  global.AtlasFirebase = {
    whenReady: function (cb) { if (typeof cb !== "function") return; if (readyResolved) cb(); else readyCbs.push(cb); },
    allowed: allowed
  };
})(window);
