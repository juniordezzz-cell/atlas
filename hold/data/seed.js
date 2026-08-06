/* ============================================================
   HOLD SYSTEM · data/seed.js
   Estado inicial LIMPO — sem dados de demonstração.
   O Store só usa isto na primeira execução (localStorage vazio).
   ============================================================ */
window.HOLD_SEED = {
  meta: { version: 2, created: "2026-07-13", currency: "USD" },

  ativos: [],
  carteira: [],
  historico: [],

  config: {
    nome_gestor: "Gestor HOLD",
    moeda: "USD",
    tema: "dark",
    alerta_invalidacao: true,
    alerta_revisao: true,
    mostrar_conviccao: true
  }
};
