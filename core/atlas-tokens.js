/* ============================================================
   ATLAS · core/atlas-tokens.js
   ------------------------------------------------------------
   REGISTRO DE ATIVOS: símbolo -> id da API de preço.

   Este arquivo nasceu como defi/js/tokens.js e subiu para o core na
   terceira auditoria. O motivo é simples: a tabela vale para o ATLAS
   inteiro. O mesmo CRCLX que aparece numa pool do DeFi aparece como
   posição no RWA e pode virar um trade — e uma tabela por módulo são
   quatro tabelas para divergir.

   Por que a tabela existe
   -----------------------
   Sem ela, "SOL" seria resolvido por BUSCA no CoinGecko, pegando o
   resultado mais bem ranqueado. Funciona na maioria dos casos e falha
   justamente nos que importam:

     ETH  x  WETH   -> ativos diferentes, preços diferentes
     BTC  x  WBTC  x  cbBTC
     SOL  x  mSOL  x  JitoSOL  x  bSOL
     stETH x wstETH  (wstETH vale MAIS que 1 ETH)
     SPCXB x SPCXX   (SpaceX de dois emissores diferentes)

   Errar o id significa calcular com o preço do ativo errado — e o
   número fica plausível, que é o pior tipo de erro.

   Três camadas de resolução, nesta ordem
   --------------------------------------
     1. override manual do usuário  (localStorage, tem prioridade)
     2. tabela curada abaixo        (offline, instantânea)
     3. nada                        → AtlasPrecos segue para a busca e,
                                      depois, para a fonte secundária

   Só entra aqui id CONFERIDO. Token que não está na tabela continua
   funcionando pelos caminhos seguintes — melhor um caminho
   transparente que um id inventado.

   Exposto em: window.AtlasTokens
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasTokens) return;

  var KEY_OVERRIDE = "atlas.defi.tokens.v1";   // mesma chave de sempre: os
                                               // overrides já gravados valem

  var TABELA = {
    /* ---- Stablecoins (o preço já é 1, mas o id serve para nome/ícone) ---- */
    USDC:    ["usd-coin", "USD Coin"],
    USDT:    ["tether", "Tether"],
    DAI:     ["dai", "Dai"],
    USDE:    ["ethena-usde", "Ethena USDe"],
    SUSDE:   ["ethena-staked-usde", "Ethena Staked USDe"],
    PYUSD:   ["paypal-usd", "PayPal USD"],
    FDUSD:   ["first-digital-usd", "First Digital USD"],
    USDS:    ["usds", "USDS"],

    /* ---- Bitcoin e as suas embalagens ---- */
    BTC:     ["bitcoin", "Bitcoin"],
    WBTC:    ["wrapped-bitcoin", "Wrapped Bitcoin"],
    CBBTC:   ["coinbase-wrapped-btc", "Coinbase Wrapped BTC"],
    TBTC:    ["tbtc", "tBTC"],

    /* ---- Ethereum e derivados de staking ----
            wstETH e weETH valem MAIS que 1 ETH: nunca tratar como ETH. */
    ETH:     ["ethereum", "Ethereum"],
    WETH:    ["weth", "Wrapped Ether"],
    STETH:   ["staked-ether", "Lido Staked ETH"],
    WSTETH:  ["wrapped-steth", "Wrapped stETH"],
    RETH:    ["rocket-pool-eth", "Rocket Pool ETH"],
    CBETH:   ["coinbase-wrapped-staked-eth", "Coinbase Wrapped Staked ETH"],
    WEETH:   ["wrapped-eeth", "Wrapped eETH"],
    EZETH:   ["renzo-restaked-eth", "Renzo Restaked ETH"],

    /* ---- Solana e os seus LSTs ---- */
    SOL:     ["solana", "Solana"],
    MSOL:    ["msol", "Marinade Staked SOL"],
    JITOSOL: ["jito-staked-sol", "Jito Staked SOL"],
    BSOL:    ["blazestake-staked-sol", "BlazeStake Staked SOL"],
    JUPSOL:  ["jupiter-staked-sol", "Jupiter Staked SOL"],

    /* ---- Ecossistema Solana ---- */
    ORCA:    ["orca", "Orca"],
    JUP:     ["jupiter-exchange-solana", "Jupiter"],
    RAY:     ["raydium", "Raydium"],
    JTO:     ["jito-governance-token", "Jito"],
    KMNO:    ["kamino", "Kamino"],
    PYTH:    ["pyth-network", "Pyth Network"],
    DRIFT:   ["drift-protocol", "Drift Protocol"],
    W:       ["wormhole", "Wormhole"],
    RENDER:  ["render-token", "Render"],
    BONK:    ["bonk", "Bonk"],
    WIF:     ["dogwifcoin", "dogwifhat"],

    /* ---- L1 / L2 nativos ---- */
    ARB:     ["arbitrum", "Arbitrum"],
    OP:      ["optimism", "Optimism"],
    BNB:     ["binancecoin", "BNB"],
    AVAX:    ["avalanche-2", "Avalanche"],
    MATIC:   ["matic-network", "Polygon (antigo MATIC)"],
    POL:     ["polygon-ecosystem-token", "Polygon"],
    SUI:     ["sui", "Sui"],
    APT:     ["aptos", "Aptos"],
    SEI:     ["sei-network", "Sei"],
    TIA:     ["celestia", "Celestia"],
    INJ:     ["injective-protocol", "Injective"],
    NEAR:    ["near", "NEAR Protocol"],
    DOT:     ["polkadot", "Polkadot"],
    ATOM:    ["cosmos", "Cosmos Hub"],
    ADA:     ["cardano", "Cardano"],
    XRP:     ["ripple", "XRP"],
    DOGE:    ["dogecoin", "Dogecoin"],
    LTC:     ["litecoin", "Litecoin"],

    /* ---- DeFi blue chips ---- */
    LINK:    ["chainlink", "Chainlink"],
    AAVE:    ["aave", "Aave"],
    UNI:     ["uniswap", "Uniswap"],
    CRV:     ["curve-dao-token", "Curve DAO"],
    CVX:     ["convex-finance", "Convex Finance"],
    LDO:     ["lido-dao", "Lido DAO"],
    PENDLE:  ["pendle", "Pendle"],
    GMX:     ["gmx", "GMX"],
    SUSHI:   ["sushi", "SushiSwap"],
    BAL:     ["balancer", "Balancer"],
    MKR:     ["maker", "Maker"],
    SNX:     ["havven", "Synthetix"],
    ENA:     ["ethena", "Ethena"],
    EIGEN:   ["eigenlayer", "EigenLayer"],
    MORPHO:  ["morpho", "Morpho"],
    ETHFI:   ["ether-fi", "ether.fi"],

    /* ---- DEXes por chain ---- */
    AERO:    ["aerodrome-finance", "Aerodrome"],
    VELO:    ["velodrome-finance", "Velodrome"],
    CAKE:    ["pancakeswap-token", "PancakeSwap"],

    /* ---- Base ---- */
    DEGEN:   ["degen-base", "Degen"],
    BRETT:   ["based-brett", "Brett"],
    TOSHI:   ["toshi", "Toshi"],
    VIRTUAL: ["virtual-protocol", "Virtual Protocol"],

    /* ============================================================
       AÇÕES E ÍNDICES TOKENIZADOS (RWA)
       ------------------------------------------------------------
       Esta seção é o resultado direto da auditoria de RWA da terceira
       fase, e é a correção do problema que a originou.

       O QUE ESTAVA ACONTECENDO
       Nenhum destes símbolos estava na tabela. Todos caíam na BUSCA
       por texto do CoinGecko — que, até esta auditoria, aceitava
       qualquer resultado quando não havia símbolo idêntico. O preço
       vinha de outro ativo, a razão do par saía errada, a posição
       aparecia "fora do range" e o Dashboard emitia alerta crítico.
       Tudo plausível, tudo errado.

       O QUE FOI CONFERIDO
       Cada id abaixo foi verificado contra a listagem da própria
       CoinGecko e teve o preço cruzado com a fonte secundária
       (GeckoTerminal, pools reais com liquidez). As duas fontes
       ficaram entre 0,2% e 0,4% de diferença — evidência de que o
       ativo identificado é o certo.

       A ARMADILHA QUE ISSO DESFAZ
       SPCXB e SPCXX são os DOIS SpaceX, de emissores diferentes
       (bStocks e xStocks), com preços diferentes. Resolver "SpaceX"
       por busca de texto escolheria um dos dois na sorte. Aqui eles
       são ativos distintos, como são na realidade.
       ============================================================ */
    SPYX:    ["sp500-xstock", "SP500 xStock"],
    QQQX:    ["nasdaq-xstock", "Nasdaq xStock"],
    GLDX:    ["gold-xstock", "Gold xStock"],
    CRCLX:   ["circle-xstock", "Circle xStock"],
    SPCXX:   ["spacex-xstocks", "SpaceX xStock"],
    SPCXB:   ["spacex-bstocks-tokenized-stock", "SpaceX bStock"],
    TSLAX:   ["tesla-xstock", "Tesla xStock"],
    NVDAX:   ["nvidia-xstock", "NVIDIA xStock"],
    AAPLX:   ["apple-xstock", "Apple xStock"],
    MSFTX:   ["microsoft-xstock", "Microsoft xStock"],
    GOOGLX:  ["alphabet-xstock", "Alphabet xStock"],
    AMZNX:   ["amazon-xstock", "Amazon xStock"],
    METAX:   ["meta-xstock", "Meta xStock"],
    MSTRX:   ["microstrategy-xstock", "MicroStrategy xStock"],
    COINX:   ["coinbase-xstock", "Coinbase xStock"],
    HOODX:   ["robinhood-xstock", "Robinhood xStock"],
    INTCX:   ["intel-xstock", "Intel xStock"],
    SKHYX:   ["sk-hynix-xstock", "SK Hynix xStock"],
    SNDKX:   ["sandisk-corporation-xstock", "Sandisk xStock"],
    BSPX:    ["bending-spoons-xstock", "Bending Spoons xStock"],
    STRCX:   ["strategy-pp-variable-xstock", "Strategy PP Variable xStock"]
  };

  function norm(sym) {
    return String(sym == null ? "" : sym).trim().toUpperCase();
  }

  function lerOverrides() {
    try { return JSON.parse(global.localStorage.getItem(KEY_OVERRIDE) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function gravarOverrides(obj) {
    try { global.localStorage.setItem(KEY_OVERRIDE, JSON.stringify(obj)); } catch (e) {}
  }

  var Tokens = {
    /* Resolve o símbolo. Devolve
         { symbol, cgId, name, fonte: "override"|"tabela" }
       ou null — e null é resposta legítima: significa "siga para a
       busca e, se ela não souber, para a fonte secundária". */
    resolve: function (sym) {
      var s = norm(sym);
      if (!s) return null;

      var ov = lerOverrides();
      if (ov[s]) return { symbol: s, cgId: ov[s], name: s, fonte: "override" };

      var t = TABELA[s];
      if (t) return { symbol: s, cgId: t[0], name: t[1], fonte: "tabela" };

      return null;
    },

    cgId: function (sym) {
      var r = Tokens.resolve(sym);
      return r ? r.cgId : null;
    },

    nome: function (sym) {
      var r = Tokens.resolve(sym);
      return r ? r.name : null;
    },

    conhece: function (sym) { return !!Tokens.resolve(sym); },

    /* Grava o id certo para um símbolo. É a saída para quando a tabela
       erra ou não conhece o token. Passar cgId vazio remove. */
    definir: function (sym, cgId) {
      var s = norm(sym);
      if (!s) return false;
      var ov = lerOverrides();
      if (cgId) ov[s] = String(cgId).trim();
      else delete ov[s];
      gravarOverrides(ov);
      return true;
    },

    overrides: lerOverrides,

    /* Lista para autocomplete: tabela + overrides, ordenada.
       Formato: [{ symbol, name, cgId }] */
    lista: function () {
      var ov = lerOverrides(), out = [], vistos = {};
      Object.keys(TABELA).forEach(function (s) {
        vistos[s] = 1;
        out.push({ symbol: s, name: ov[s] ? s : TABELA[s][1], cgId: ov[s] || TABELA[s][0] });
      });
      Object.keys(ov).forEach(function (s) {
        if (vistos[s]) return;
        out.push({ symbol: s, name: s, cgId: ov[s] });
      });
      out.sort(function (a, b) { return a.symbol < b.symbol ? -1 : 1; });
      return out;
    }
  };

  global.AtlasTokens = Tokens;

  /* Apresenta-se à cadeia de preço. Idempotente. */
  if (global.AtlasPrecos && global.AtlasPrecos.registrarRegistro) {
    global.AtlasPrecos.registrarRegistro(Tokens.cgId);
  }
})(typeof window !== "undefined" ? window : this);
