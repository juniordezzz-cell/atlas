/* ============================================================
   ATLAS · core/atlas-firebase-config.js
   Configuração do Firebase + lista de convidados.

   ESTE É O ÚNICO ARQUIVO QUE VOCÊ EDITA À MÃO.

   1) config: vem do console do Firebase
      (Project settings → Your apps → Web → SDK setup and configuration).
      A apiKey do Firebase Web é PÚBLICA — não é segredo, pode ficar no
      repositório. Quem protege os dados são as regras do Firestore
      (Fase 2), não esconder a chave.

   2) allowedEmails: só estes emails Google entram (convite-only).
      Para liberar alguém, acrescente o email (minúsculo) nesta lista.
      Na Fase 1 esta lista barra a INTERFACE (client-side). Na Fase 2,
      as regras do Firestore passam a aplicá-la no servidor, de verdade.
   ============================================================ */
(function (global) {
  "use strict";

  global.ATLAS_FIREBASE = {
    config: {
      apiKey: "AIzaSyCvHDXyRfaozjHKL0S9zvs9C00NS6Bd8cs",
      authDomain: "cryptotrack-br.firebaseapp.com",
      projectId: "cryptotrack-br",
      storageBucket: "cryptotrack-br.firebasestorage.app",
      messagingSenderId: "641396446846",
      appId: "1:641396446846:web:1476619e73bf191630ea2f",
      measurementId: "G-L0T8K9VT74"
    },

    // Emails Google autorizados a entrar. Edite para convidar mais gente.
    allowedEmails: [
      "juniordezzz@gmail.com"
    ]
  };
})(window);
