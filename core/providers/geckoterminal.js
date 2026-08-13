/* ============================================================
   ATLAS · core/providers/geckoterminal.js
   ------------------------------------------------------------
   PROVEDOR SECUNDÁRIO DE PREÇO — capacidade "prices".
   Depende de: core/http.js, core/providers/registry.js

   POR QUE ESTA FONTE, E NÃO OUTRA
   -------------------------------
   A primária é a CoinGecko, que lista ATIVOS. Ela falha exatamente
   onde a carteira do usuário dói: token recém-lançado, ação
   tokenizada, LP token, memecoin de dois dias. Nesses casos o ativo
   não está listado em lugar nenhum — mas está sendo NEGOCIADO numa
   DEX, e é de lá que sai o preço de verdade.

   Foram avaliadas três candidatas, com os tokens reais que falharam
   na auditoria (CRCLX, SPCXB, SPYX, SKHYX):

     GeckoTerminal   ESCOLHIDA. Sem chave, sem cadastro. Cobre TODAS
                     as chains que o ATLAS usa (Solana, Ethereum,
                     Base, Arbitrum, Polygon, BNB), não só uma. Devolve
                     preço em USD já convertido e, junto, a LIQUIDEZ da
                     pool — que é o que permite separar mercado real de
                     pool de fachada. Mesma casa da CoinGecko, então os
                     dois lados falam do mesmo ativo.

     Jupiter         Só Solana, e exige o endereço do mint. Ótima para
                     um app de Solana; estreita demais para o ATLAS,
                     que tem posições em seis chains.

     DexScreener     Cobertura parecida, mas sem compromisso público de
                     limite de uso e com mais ruído de token falso nos
                     resultados de busca por símbolo.

   O RISCO DESTA FONTE, E O QUE FAZEMOS COM ELE
   --------------------------------------------
   Qualquer um cria uma pool com o símbolo "SOL". Buscar por símbolo
   numa DEX é, por construção, sujeito a falsificação — e um preço
   errado aqui é pior que preço nenhum.

   Três defesas, todas visíveis para quem lê o resultado:

     1. LIQUIDEZ MÍNIMA. Pool com menos de MIN_LIQUIDEZ em reserva não
        conta. Falsificar preço numa pool com milhões de dólares de
        reserva custa milhões.
     2. MAIOR RESERVA VENCE. Entre as que passam, vale a mais líquida —
        que é onde o preço se forma.
     3. PROVENIÊNCIA JUNTO. Devolve rede, endereço do token, liquidez e
        quantas pools concordam. A tela mostra; o usuário confere.

   E, acima de tudo: esta fonte é FALLBACK. Só é consultada quando a
   CoinGecko não reconhece o símbolo. Quando as duas respondem, o
   AtlasPrecos compara e avisa se discordarem — ver `divergentes`.

   API do provedor:
     .priceBySymbol(sym) -> Promise<{usd, rede, endereco, liquidez,
                                     pools, nome} | null>
     .pricesBySymbols([syms]) -> Promise<{ SIMBOLO: {…} }>
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;   // exige o core
  if (window.AtlasProviders.get("geckoterminal")) return;

  var BASE = "https://api.geckoterminal.com/api/v2";

  /* Reserva mínima da pool, em USD. Abaixo disto o "preço" é o que a
     última transação de vinte dólares deixou no livro — não é mercado.
     Cinquenta mil é folgado para token real e proibitivo para pool
     montada só para enganar um agregador. */
  var MIN_LIQUIDEZ = 50000;

  /* Limite público sem chave: ~30 chamadas/min. O TTL de 60s espelha o
     da CoinGecko — as duas fontes envelhecem no mesmo ritmo, senão
     comparar uma com a outra seria comparar momentos diferentes. */
  var TTL = 60000;

  function norm(s) { return String(s == null ? "" : s).trim().toUpperCase(); }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }

  /* O nome da pool vem como "CRCLx / USDC". Devolve os dois lados em
     maiúsculas, ou null quando não é um par de dois. */
  function lados(nome) {
    var p = String(nome || "").split("/").map(function (x) { return norm(x); }).filter(Boolean);
    return p.length === 2 ? p : null;
  }

  /* ------------------------------------------------------------
     Escolhe o preço do símbolo pedido dentro dos resultados.

     O símbolo pode ser o lado ESQUERDO ou o DIREITO da pool, e o
     preço correspondente muda de campo. Ignorar isso faria uma busca
     por USDC devolver o preço do token do outro lado.
     ------------------------------------------------------------ */
  function extrair(data, sym) {
    var itens = (data && data.data) || [];
    var candidatos = [];

    itens.forEach(function (p) {
      var a = p.attributes || {};
      var par = lados(a.name);
      if (!par) return;

      var liq = n(a.reserve_in_usd);
      if (liq < MIN_LIQUIDEZ) return;

      var usd = null;
      if (par[0] === sym) usd = n(a.base_token_price_usd);
      else if (par[1] === sym) usd = n(a.quote_token_price_usd);
      if (!(usd > 0)) return;

      /* A rede NÃO vem como relação própria nesta resposta — só
         base_token, quote_token e dex. Ela é o prefixo do id, tanto do
         pool ("solana_G39wyw…") quanto do token. Ler de `relationships
         .network` devolvia null em silêncio, e a proveniência que a
         tela mostra ficava sem o item mais importante: em que rede
         esse preço foi formado. */
      var rel = p.relationships || {};
      var tokRel = par[0] === sym ? rel.base_token : rel.quote_token;
      var tokId = tokRel && tokRel.data ? String(tokRel.data.id) : String(p.id || "");
      var corte = tokId.indexOf("_");
      var rede = corte !== -1 ? tokId.slice(0, corte) : null;
      var endereco = corte !== -1 ? tokId.slice(corte + 1) : tokId;
      var dex = rel.dex && rel.dex.data ? String(rel.dex.data.id) : null;

      candidatos.push({ usd: usd, liquidez: liq, rede: rede, endereco: endereco,
                        dex: dex, nome: a.name });
    });

    if (!candidatos.length) return null;
    candidatos.sort(function (a, b) { return b.liquidez - a.liquidez; });

    var melhor = candidatos[0];
    /* Quantas pools INDEPENDENTES concordam com esse preço (±2%). É a
       medida de confiança que a tela mostra: um preço confirmado por
       cinco pools é outra coisa que um preço visto numa só. */
    var concordam = candidatos.filter(function (c) {
      return Math.abs(c.usd - melhor.usd) / melhor.usd <= 0.02;
    }).length;

    return {
      usd: melhor.usd,
      rede: melhor.rede,
      endereco: melhor.endereco,
      dex: melhor.dex,
      liquidez: Math.round(melhor.liquidez),
      pools: concordam,
      nome: melhor.nome
    };
  }

  var GeckoTerminal = {
    name: "GeckoTerminal",
    capabilities: ["prices"],
    /* Marca este provedor como SECUNDÁRIO. O AtlasPrecos usa isto para
       não o colocar na frente da CoinGecko: forCapability("prices")
       devolve o primeiro registrado, e a ordem de <script> não pode ser
       o que decide qual fonte manda no dinheiro do usuário. */
    secundario: true,
    MIN_LIQUIDEZ: MIN_LIQUIDEZ,

    priceBySymbol: function (sym) {
      var s = norm(sym);
      if (!s) return Promise.resolve(null);
      return AtlasHttp.getJSON(
        BASE + "/search/pools?query=" + encodeURIComponent(s),
        { ttl: TTL, timeout: 12000, retries: 1, cacheKey: "gt.search." + s }
      ).then(function (d) {
        return extrair(d, s);
      }).catch(function () { return null; });
    },

    /* Um por vez, de propósito: a busca é por símbolo e não existe
       endpoint de lote para ela. Poucos símbolos chegam aqui — só os
       que a fonte primária não reconheceu. */
    pricesBySymbols: function (simbolos) {
      var alvos = (simbolos || []).map(norm).filter(Boolean);
      var out = {};
      return alvos.reduce(function (cadeia, s) {
        return cadeia.then(function () {
          return GeckoTerminal.priceBySymbol(s).then(function (r) {
            if (r) out[s] = r;
          });
        });
      }, Promise.resolve()).then(function () { return out; });
    }
  };

  window.AtlasProviders.register("geckoterminal", GeckoTerminal);
})();
