/* ============================================================
   ATLAS · core/atlas-setores.js
   ------------------------------------------------------------
   SETOR DE CADA ATIVO: RWA, IA, DePIN, ZK, DeFi...

   O ativo do Hold sempre teve o campo "setor", mas era texto livre e
   ninguém preenchia: a alocação por setor saía "Sem setor" para a
   carteira inteira. Pedido do dono (16/10/2026): o Painel mostra a
   alocação por setor sem a pessoa precisar classificar nada.

   Três camadas, nesta ordem
   -------------------------
     1. o que a pessoa digitou em Editar (vence sempre)
     2. o catálogo curado abaixo (offline, instantâneo)
     3. as categorias da CoinGecko, buscadas uma vez por ativo e
        guardadas em localStorage (atlas.setores.cg.v1)

   Um ativo cabe em mais de um setor (LINK é oráculo e RWA). Aqui ele
   fica em UM — o principal —, para a pizza somar 100%.

   Exposto em: window.AtlasSetores
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasSetores) return;

  var LISTA = ["RWA", "IA", "DePIN", "ZK", "DeFi", "Oráculos", "Layer 1", "Layer 2",
               "Infraestrutura", "Reserva de valor", "Privacidade", "Games", "Memecoin",
               "Exchange", "Stablecoin", "Outros"];

  var CATALOGO = {
    "RWA": "ONDO CFG POLYX PLUME OM SYRUP MPL GFI TRU RIO CPOOL PAXG XAUT USYC BUIDL OUSG CHEX",
    "IA": "FET TAO RENDER RNDR AGIX OCEAN WLD VIRTUAL AI16Z ARKM GRASS AIXBT KAITO OLAS PAAL NMR COOKIE GRIFFAIN ZEREBRO VVV",
    "DePIN": "FIL AR HNT AKT IO THETA IOTX MOBILE HONEY DIMO GEOD AIOZ STORJ POKT ATH PEAQ NOS",
    "ZK": "ZK STRK MINA SCR TAIKO MANTA LRC PROVE ZKJ ALEO",
    "DeFi": "UNI AAVE MKR SKY CRV CVX LDO COMP SNX PENDLE MORPHO JUP RAY ORCA DYDX GMX AERO VELO CAKE SUSHI 1INCH BAL ENA ETHFI JTO HYPE KMNO DRIFT FXS RPL SPK EUL FLUID RUNE OSMO JOE",
    "Oráculos": "LINK PYTH BAND API3 UMA TRB RED DIA",
    "Layer 1": "ETH SOL ADA AVAX DOT ATOM NEAR SUI APT SEI TON TRX XRP INJ KAS ALGO HBAR XLM ICP EGLD S FTM BERA MON ETC",
    "Layer 2": "ARB OP POL MATIC MNT METIS STX BLAST",
    "Infraestrutura": "TIA ZRO W AXL QNT GRT ENS SSV EIGEN AVAIL",
    "Reserva de valor": "BTC LTC BCH",
    "Privacidade": "XMR ZEC SCRT ROSE DASH",
    "Games": "IMX AXS SAND MANA GALA BEAM RON PRIME ILV YGG",
    "Memecoin": "DOGE SHIB PEPE WIF BONK FLOKI TRUMP POPCAT MEW BRETT FARTCOIN PENGU SPX",
    "Exchange": "BNB OKB CRO LEO KCS GT BGB",
    "Stablecoin": "USDT USDC DAI USDE FDUSD PYUSD USDS USD1 TUSD"
  };
  var POR_TICKER = {};
  Object.keys(CATALOGO).forEach(function (setor) {
    CATALOGO[setor].split(" ").forEach(function (t) { POR_TICKER[t] = setor; });
  });

  /* Categoria da CoinGecko → setor. A ordem importa: "AI Agents" num
     token da Solana não pode cair em "Layer 1" só porque a lista dele
     também traz "Solana Ecosystem". O mais específico vem primeiro. */
  var REGRAS = [
    [/stablecoin/i, "Stablecoin"],
    [/meme/i, "Memecoin"],
    [/real.?world|\brwa\b|tokeniz/i, "RWA"],
    [/artificial intelligence|\bai\b|ai agent/i, "IA"],
    [/depin|physical infrastructure|storage/i, "DePIN"],
    [/zero knowledge|\bzk\b/i, "ZK"],
    [/oracle/i, "Oráculos"],
    [/privacy/i, "Privacidade"],
    [/gaming|metaverse|play to earn/i, "Games"],
    [/exchange-based/i, "Exchange"],
    [/layer 2|rollup/i, "Layer 2"],
    [/decentralized finance|defi|\bdex\b|lending|yield|liquid staking|derivatives/i, "DeFi"],
    [/layer 1|smart contract platform/i, "Layer 1"],
    [/infrastructure|interoperability|bridge/i, "Infraestrutura"]
  ];

  var CHAVE = "atlas.setores.cg.v1";
  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { cache = {}; }
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) {} }

  function canonico(txt) {
    var t = String(txt || "").trim();
    if (!t) return "";
    var low = t.toLowerCase();
    for (var i = 0; i < LISTA.length; i++) if (LISTA[i].toLowerCase() === low) return LISTA[i];
    if (low === "ai") return "IA";
    return t;   // o que a pessoa escreveu, como escreveu
  }

  function idCg(a) {
    if (a.cg_id) return a.cg_id;
    var T = global.AtlasTokens;
    return T && T.cgId ? T.cgId(a.ticker) : null;
  }

  function deCategorias(cats) {
    for (var i = 0; i < REGRAS.length; i++) {
      for (var j = 0; j < cats.length; j++) if (REGRAS[i][0].test(cats[j])) return REGRAS[i][1];
    }
    return null;
  }

  /* { setor, fonte }: fonte = "manual" | "catalogo" | "coingecko" | null */
  function de(a) {
    if (!a) return { setor: "Outros", fonte: null };
    var manual = canonico(a.setor);
    if (manual) return { setor: manual, fonte: "manual" };
    var tk = String(a.ticker || "").toUpperCase();
    if (POR_TICKER[tk]) return { setor: POR_TICKER[tk], fonte: "catalogo" };
    var id = idCg(a);
    if (id && cache[id]) return { setor: cache[id], fonte: "coingecko" };
    return { setor: "Outros", fonte: null };
  }

  /* Busca na CoinGecko quem ainda está em "Outros". Resolve true se
     algum ativo ganhou setor (a tela redesenha). Uma tentativa por id
     por sessão — "não achei" também é guardado, como "Outros". */
  var tentados = {};
  function completar(ativos) {
    var prov = global.AtlasProviders && global.AtlasProviders.get && global.AtlasProviders.get("coingecko");
    if (!prov || !prov.assetFull) return Promise.resolve(false);
    var ids = [];
    (ativos || []).forEach(function (a) {
      if (!a || (a.tipo && a.tipo !== "Cripto") || de(a).fonte) return;
      var id = idCg(a);
      if (id && !(id in cache) && !tentados[id] && ids.indexOf(id) < 0) ids.push(id);
    });
    ids = ids.slice(0, 4);   // a API grátis limita; o resto vem na próxima abertura
    if (!ids.length) return Promise.resolve(false);
    return Promise.all(ids.map(function (id) {
      tentados[id] = true;
      return prov.assetFull(id).then(function (d) {
        cache[id] = (d && deCategorias(d.categories || [])) || "Outros";
        return cache[id] !== "Outros";
      }).catch(function () { return false; });
    })).then(function (r) {
      gravar();
      return r.some(Boolean);
    });
  }

  /* Cor fixa por setor: RWA tem a mesma cor em qualquer carteira e em
     qualquer tela (Painel hoje, Métricas depois). Tons médios e sóbrios;
     os seis setores mais comuns ficam com as cores mais distantes entre
     si. Fora da lista e "Outros": cinza. */
  var CORES = {
    "DeFi": "#4C7BD9", "Layer 1": "#2FA58F", "Oráculos": "#D4A23A", "RWA": "#8A6AD1",
    "IA": "#C2566F", "DePIN": "#3E9BC0", "ZK": "#B07A4F", "Layer 2": "#5C9E5A",
    "Infraestrutura": "#7D86C9", "Reserva de valor": "#C98A2E", "Privacidade": "#4E7F8A",
    "Games": "#A65E9E", "Memecoin": "#C7685A", "Exchange": "#8C9A3F", "Stablecoin": "#6E8CA8"
  };
  function cor(setor) { return CORES[setor] || "#66707F"; }

  global.AtlasSetores = { lista: LISTA.slice(), de: de, completar: completar, cor: cor };
})(window);
