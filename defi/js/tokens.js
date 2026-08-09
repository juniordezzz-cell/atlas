/* ============================================================
   ATLAS · DeFi — tokens.js
   ------------------------------------------------------------
   REGISTRO DE TOKENS: símbolo -> id do CoinGecko.

   Por que este arquivo existe
   ---------------------------
   O AtlasPrice resolve "SOL" fazendo uma BUSCA no CoinGecko e
   pegando o resultado de maior capitalização. Funciona na maioria
   dos casos e falha justamente nos que importam numa pool:

     ETH  x  WETH   -> ativos diferentes, preços diferentes
     BTC  x  WBTC  x  cbBTC
     SOL  x  mSOL  x  JitoSOL  x  bSOL
     stETH x wstETH  (wstETH vale MAIS que 1 ETH)

   Numa pool o par é exatamente onde essas variantes aparecem.
   Errar o id significa calcular performance com o preço do ativo
   errado — e o número fica plausível, que é o pior tipo de erro.

   Três camadas de resolução, nesta ordem
   --------------------------------------
     1. override manual do usuário  (localStorage, tem prioridade)
     2. tabela curada abaixo        (offline, instantânea)
     3. AtlasPrice.bySymbol()       (busca no CoinGecko, chute)

   A camada 3 continua existindo de propósito: token novo que não
   está na tabela ainda funciona, só sem garantia de precisão. Se
   sair errado, o usuário grava o id certo uma vez (camada 1) e
   fica resolvido para sempre.
   ============================================================ */
(function () {
  "use strict";

  var KEY_OVERRIDE = "atlas.defi.tokens.v1";

  /* ------------------------------------------------------------
     Tabela curada.
     Formato: SÍMBOLO: [id do CoinGecko, nome, chains onde é comum]

     Só entra aqui id que eu tenho confiança de estar certo. Token
     que não está na tabela cai na busca do AtlasPrice — melhor um
     chute transparente que um id inventado.
     ------------------------------------------------------------ */
  var TABELA = {
    /* ---- Stablecoins (o AtlasPrice já trata como 1, mas o id
            serve para exibir nome/ícone) ---- */
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
    VIRTUAL: ["virtual-protocol", "Virtual Protocol"]
  };

  function norm(sym) {
    return String(sym == null ? "" : sym).trim().toUpperCase();
  }

  function lerOverrides() {
    try { return JSON.parse(localStorage.getItem(KEY_OVERRIDE) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function gravarOverrides(obj) {
    try { localStorage.setItem(KEY_OVERRIDE, JSON.stringify(obj)); } catch (e) {}
  }

  var Tokens = {
    /* Resolve o símbolo. Devolve
         { symbol, cgId, name, fonte: "override"|"tabela" }
       ou null quando não conhece — e null é resposta legítima:
       significa "cai na busca do AtlasPrice". */
    resolve: function (sym) {
      var s = norm(sym);
      if (!s) return null;

      var ov = lerOverrides();
      if (ov[s]) return { symbol: s, cgId: ov[s], name: s, fonte: "override" };

      var t = TABELA[s];
      if (t) return { symbol: s, cgId: t[0], name: t[1], fonte: "tabela" };

      return null;
    },

    /* id do CoinGecko, ou null */
    cgId: function (sym) {
      var r = Tokens.resolve(sym);
      return r ? r.cgId : null;
    },

    conhece: function (sym) { return !!Tokens.resolve(sym); },

    /* Grava o id certo para um símbolo. É a saída para quando a
       tabela erra ou não conhece o token. Passar cgId vazio remove. */
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
    },

    /* ------------------------------------------------------------
       Preço em lote, pelo id — sem passar pela busca.

       Recebe símbolos, devolve { SIMBOLO: precoUSD }. Os que estão
       no registro vão numa única chamada /simple/price com todos os
       ids juntos. Os desconhecidos caem no AtlasPrice.bySymbol(),
       um por um. Stablecoin não vai à rede.
       ------------------------------------------------------------ */
    precos: function (simbolos) {
      var alvos = (simbolos || []).map(norm).filter(Boolean);
      var unicos = [], visto = {};
      alvos.forEach(function (s) { if (!visto[s]) { visto[s] = 1; unicos.push(s); } });

      var resultado = {};
      var porId = {};   // cgId -> [símbolos]
      var ids = [];
      var desconhecidos = [];

      unicos.forEach(function (s) {
        if (window.AtlasPrice && AtlasPrice.isStable(s)) { resultado[s] = 1; return; }
        var id = Tokens.cgId(s);
        if (id) {
          if (!porId[id]) { porId[id] = []; ids.push(id); }
          porId[id].push(s);
        } else {
          desconhecidos.push(s);
        }
      });

      var prov = (window.AtlasProviders && AtlasProviders.get)
        ? AtlasProviders.get("coingecko") : null;

      var pLote = (ids.length && prov && prov.prices)
        ? prov.prices(ids).then(function (mapa) {
            ids.forEach(function (id) {
              var v = mapa[id];
              if (typeof v === "number" && isFinite(v)) {
                porId[id].forEach(function (s) { resultado[s] = v; });
              }
            });
          }).catch(function () {})
        : Promise.resolve();

      var pSoltos = desconhecidos.map(function (s) {
        if (!window.AtlasPrice) return Promise.resolve();
        return AtlasPrice.bySymbol(s).then(function (r) {
          if (r && typeof r.usd === "number") resultado[s] = r.usd;
        }).catch(function () {});
      });

      return Promise.all([pLote].concat(pSoltos)).then(function () { return resultado; });
    }
  };

  window.DeFiTokens = Tokens;
})();
