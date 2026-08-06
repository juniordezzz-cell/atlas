/* ===================================================================
   ATLAS — Oráculo (Dashboard raiz)
   -------------------------------------------------------------------
   O Oráculo agora é UM ÚNICO componente compartilhado, vivo em
   core/ui/atlas-shell.js (mesmo ícone/avatar, mesmo painel em todos
   os módulos). Este arquivo NÃO monta mais nada: apenas registra o
   "cérebro" do Dashboard no componente central.

   Comportamento preservado do Oráculo antigo da raiz:
     • mensagem de boas-vindas = resumo da consolidação (ATLAS_DATA);
     • analista, nunca previsor — recusa educadamente pedidos de previsão.
   IA real entra numa etapa futura (Firebase).
   =================================================================== */
(function () {
  "use strict";

  if (!window.AtlasOraculo || typeof AtlasOraculo.registerBrain !== "function") {
    // Shell não carregado — nada a fazer (dashboard sem Oráculo é melhor
    // do que um erro de console). Falha silenciosa é aceitável AQUI porque
    // não há tela para quebrar.
    return;
  }

  var WELCOME =
    (window.ATLAS_DATA && ATLAS_DATA.oraculo && ATLAS_DATA.oraculo.mensagem) ||
    "Sou o Oráculo do ATLAS. Analiso seus dados registrados — evolução, " +
    "rentabilidade e estatísticas. Não faço previsões de mercado; a decisão é sua.";

  /* Pedidos de previsão → recusa educada (mesma regra do Oráculo original) */
  var PREVISAO = [
    "vai subir", "vai cair", "devo comprar", "devo vender", "qual token",
    "melhor amanhã", "vai render mais", "previsão", "prever", "vai valorizar"
  ];

  AtlasOraculo.registerBrain(function () {
    return {
      chips: ["Como está meu patrimônio?", "O que preciso revisar?"],

      summary: function () { return WELCOME; },

      answer: function (q) {
        q = (q || "").toLowerCase();

        if (PREVISAO.some(function (p) { return q.indexOf(p) > -1; })) {
          return "Não faço previsões de mercado. Posso analisar seus dados " +
                 "registrados — evolução, rentabilidade, comparações e " +
                 "estatísticas. A decisão final é sempre sua.";
        }

        if (/patrim|total|banca|quanto|evolu|resum|consolid/.test(q)) {
          return WELCOME;
        }

        // Devolve null → o cérebro-base do shell assume a resposta.
        return null;
      }
    };
  });
})();
