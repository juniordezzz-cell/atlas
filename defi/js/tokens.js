/* ============================================================
   ATLAS · DeFi — tokens.js
   ------------------------------------------------------------
   FACHADA DO DEFI SOBRE O REGISTRO CENTRAL.

   A tabela de símbolo -> id vivia AQUI, e essa era a origem de um
   problema de arquitetura: o mesmo CRCLX que aparece numa pool do
   DeFi aparece como posição no RWA e pode virar um trade. Uma tabela
   dentro de `defi/` obrigaria os outros módulos a duplicá-la — e
   quatro tabelas divergem, é só questão de tempo.

   Na terceira auditoria a tabela subiu para core/atlas-tokens.js, e
   a cadeia de resolução de preço para core/atlas-precos.js. Este
   arquivo continua existindo porque `DeFiTokens` é chamado em seis
   telas do módulo; ele é uma casca fina, sem regra própria.

   Quem procura a tabela de ids: core/atlas-tokens.js
   Quem procura a ordem das fontes: core/atlas-precos.js
   ============================================================ */
(function () {
  "use strict";

  function faltando(nome) {
    return new Error(nome + " não carregado nesta página.");
  }

  var Tokens = {
    /* ---- delegações puras ao registro central ---- */
    resolve:   function (s) { return window.AtlasTokens ? AtlasTokens.resolve(s) : null; },
    cgId:      function (s) { return window.AtlasTokens ? AtlasTokens.cgId(s) : null; },
    conhece:   function (s) { return window.AtlasTokens ? AtlasTokens.conhece(s) : false; },
    definir:   function (s, id) { return window.AtlasTokens ? AtlasTokens.definir(s, id) : false; },
    overrides: function () { return window.AtlasTokens ? AtlasTokens.overrides() : {}; },
    lista:     function () { return window.AtlasTokens ? AtlasTokens.lista() : []; },

    /* ------------------------------------------------------------
       Preço em lote — delegado à cadeia única (core/atlas-precos.js).

       Devolve só os valores; quem precisa do diagnóstico chama
       precosDetalhado. Rejeita quando NENHUM preço veio e houve erro
       de rede: o chamador precisa distinguir "não conheço esse ativo"
       de "a fonte está fora do ar", porque só a primeira justifica
       pedir o preço ao usuário.
       ------------------------------------------------------------ */
    precos: function (simbolos) {
      return Tokens.precosDetalhado(simbolos).then(function (d) {
        if (d.erro && !Object.keys(d.valores).length) throw d.erro;
        return d.valores;
      });
    },

    /* ------------------------------------------------------------
       A MESMA BUSCA, COM O DIAGNÓSTICO JUNTO

         valores      { SIMBOLO: precoUSD }
         fonte        { SIMBOLO: "manual"|"stable"|"registro"|"busca"|"dex" }
         detalhe      { SIMBOLO: {rede, endereco, liquidez, pools} }  (fonte secundária)
         faltando     [SIMBOLO...]  nenhuma fonte respondeu — é a lista
                                    que faz a tela PEDIR o preço
         vencidos     [SIMBOLO...]  preço manual mais velho que a validade
         divergentes  [{simbolo, primaria, secundaria, pct}]
         erro         Error|null
       ------------------------------------------------------------ */
    precosDetalhado: function (simbolos) {
      var alvos = (simbolos || []).map(function (s) {
        return String(s == null ? "" : s).trim().toUpperCase();
      }).filter(Boolean);
      var unicos = [], visto = {};
      alvos.forEach(function (s) { if (!visto[s]) { visto[s] = 1; unicos.push(s); } });

      if (!window.AtlasPrecos) {
        return Promise.resolve({
          valores: {}, faltando: unicos, vencidos: [], divergentes: [],
          fonte: {}, em: {}, detalhe: {},
          erro: faltando("Camada de preços (core/atlas-precos.js)")
        });
      }
      return window.AtlasPrecos.deVarios(unicos);
    }
  };

  window.DeFiTokens = Tokens;
})();
