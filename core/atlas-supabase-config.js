/* ============================================================
   ATLAS · core/atlas-supabase-config.js
   Onde o site lê os dados da Central RWA (backend em central-rwa/).

   Os dois valores vêm do Supabase → botão "Connect" (ou Project
   Settings → API):
     url            → "Project URL"      (https://xxxx.supabase.co)
     publishableKey → "Publishable key"  (começa com sb_publishable_)

   Os dois são PÚBLICOS por natureza, como a apiKey do Firebase: podem
   ficar no repositório. A chave publicável só consegue LER as visões
   crwa_* (dado de mercado); as tabelas do backend continuam fechadas.
   NUNCA coloque aqui a senha do banco, a connection string ou uma
   chave "secret"/"service_role".
   ============================================================ */
(function (global) {
  "use strict";

  global.ATLAS_SUPABASE = {
    url: "",
    publishableKey: ""
  };
})(window);
