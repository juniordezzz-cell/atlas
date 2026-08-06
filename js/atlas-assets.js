/* ============================================================
   ATLAS · atlas-assets.js
   Autocomplete de ativos compartilhado (Hold / Trade / DeFi / RWA).

   - Local-first: lista curada embutida → sugestão instantânea.
   - Rede via provedor "coingecko" do core (AtlasProviders); se o
     core não estiver carregado, usa fallback interno equivalente.
   - file:// friendly. IIFE + window.X. Sem build, sem módulos ES.

   API pública (estável):
     AtlasAssets.localSearch(q)         -> [{id,symbol,name,rank,thumb}]
     AtlasAssets.search(q)              -> Promise<[...]> (local + live)
     AtlasAssets.price(coinId)          -> Promise<number|null>  (USD)
     AtlasAssets.priceFull(coinId)      -> Promise<{usd,marketCap,image,symbol,name}|null>
     AtlasAssets.attach(inputEl, opts)  -> liga um input ao dropdown
     AtlasAssets.autoBind(root)         -> liga inputs [data-atlas-asset]
     AtlasAssets.setApiKey(key)         -> Demo key opcional
     AtlasAssets.SEED                   -> lista curada

   opts de attach():
     { value: 'symbol' | 'name',        // o que gravar ao selecionar
       onSelect: function(coin, el) {}, // hook (preencher campos irmãos)
       onError:  function(msg) {},      // erro de rede amigável
       max: 8, minChars: 1 }

   CORREÇÃO (bug de duplicação/reabertura):
   pick() escrevia no input e disparava "input"/"focus", que
   reativavam a própria busca e reabriam o dropdown. Agora o
   preenchimento programático roda com supressão (__aaSuppress)
   e o focus pós-seleção não reabre a lista.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasAssets) return; // idempotente

  var CG = "https://api.coingecko.com/api/v3";
  var CACHE_KEY = "atlas.assets.cache.v1";
  var APIKEY_KEY = "atlas.assets.cg_key.v1";
  var CACHE_TTL = 1000 * 60 * 60 * 24;

  function provider() {
    return (window.AtlasProviders && AtlasProviders.forCapability("prices")) || null;
  }

  /* ---------- Lista curada (top ativos por relevância) ---------- */
  var SEED = [
    ["bitcoin","BTC","Bitcoin"],["ethereum","ETH","Ethereum"],["tether","USDT","Tether"],
    ["binancecoin","BNB","BNB"],["solana","SOL","Solana"],["usd-coin","USDC","USD Coin"],
    ["ripple","XRP","XRP"],["staked-ether","STETH","Lido Staked Ether"],["cardano","ADA","Cardano"],
    ["dogecoin","DOGE","Dogecoin"],["tron","TRX","TRON"],["avalanche-2","AVAX","Avalanche"],
    ["chainlink","LINK","Chainlink"],["the-open-network","TON","Toncoin"],["polkadot","DOT","Polkadot"],
    ["matic-network","MATIC","Polygon"],["polygon-ecosystem-token","POL","Polygon"],["litecoin","LTC","Litecoin"],
    ["shiba-inu","SHIB","Shiba Inu"],["wrapped-bitcoin","WBTC","Wrapped Bitcoin"],["bitcoin-cash","BCH","Bitcoin Cash"],
    ["uniswap","UNI","Uniswap"],["dai","DAI","Dai"],["internet-computer","ICP","Internet Computer"],
    ["near","NEAR","NEAR Protocol"],["aptos","APT","Aptos"],["ethereum-classic","ETC","Ethereum Classic"],
    ["monero","XMR","Monero"],["stellar","XLM","Stellar"],["cosmos","ATOM","Cosmos Hub"],
    ["okb","OKB","OKB"],["filecoin","FIL","Filecoin"],["crypto-com-chain","CRO","Cronos"],
    ["hedera-hashgraph","HBAR","Hedera"],["arbitrum","ARB","Arbitrum"],["vechain","VET","VeChain"],
    ["mantle","MNT","Mantle"],["render-token","RENDER","Render"],["injective-protocol","INJ","Injective"],
    ["optimism","OP","Optimism"],["maker","MKR","Maker"],["immutable-x","IMX","Immutable"],
    ["kaspa","KAS","Kaspa"],["first-digital-usd","FDUSD","First Digital USD"],["the-graph","GRT","The Graph"],
    ["theta-token","THETA","Theta Network"],["fantom","FTM","Fantom"],["sui","SUI","Sui"],
    ["thorchain","RUNE","THORChain"],["lido-dao","LDO","Lido DAO"],["aave","AAVE","Aave"],
    ["floki","FLOKI","FLOKI"],["algorand","ALGO","Algorand"],["sei-network","SEI","Sei"],
    ["bonk","BONK","Bonk"],["jupiter-exchange-solana","JUP","Jupiter"],["pyth-network","PYTH","Pyth Network"],
    ["fetch-ai","FET","Artificial Superintelligence Alliance"],["quant-network","QNT","Quant"],["flow","FLOW","Flow"],
    ["gala","GALA","Gala"],["axie-infinity","AXS","Axie Infinity"],["the-sandbox","SAND","The Sandbox"],
    ["decentraland","MANA","Decentraland"],["tezos","XTZ","Tezos"],["eos","EOS","EOS"],
    ["chiliz","CHZ","Chiliz"],["bittensor","TAO","Bittensor"],["celestia","TIA","Celestia"],
    ["blur","BLUR","Blur"],["dydx-chain","DYDX","dYdX"],["mina-protocol","MINA","Mina Protocol"],
    ["neo","NEO","NEO"],["kava","KAVA","Kava"],["curve-dao-token","CRV","Curve DAO"],
    ["pancakeswap-token","CAKE","PancakeSwap"],["gmx","GMX","GMX"],["helium","HNT","Helium"],
    ["conflux-token","CFX","Conflux"],["frax","FRAX","Frax"],["rocket-pool","RPL","Rocket Pool"],
    ["nervos-network","CKB","Nervos Network"],["1inch","1INCH","1inch"],["compound-governance-token","COMP","Compound"],
    ["convex-finance","CVX","Convex Finance"],["zcash","ZEC","Zcash"],["dash","DASH","Dash"],
    ["iota","IOTA","IOTA"],["ordinals","ORDI","ORDI"],["synthetix-network-token","SNX","Synthetix"],
    ["worldcoin-wld","WLD","Worldcoin"],["ethena","ENA","Ethena"],["ethena-usde","USDE","Ethena USDe"],
    ["starknet","STRK","Starknet"],["wormhole","W","Wormhole"],["book-of-meme","BOME","BOOK OF MEME"],
    ["dogwifcoin","WIF","dogwifhat"],["pepe","PEPE","Pepe"],["arweave","AR","Arweave"],
    ["akash-network","AKT","Akash Network"],["ondo-finance","ONDO","Ondo"],["jasmycoin","JASMY","JasmyCoin"],
    ["gnosis","GNO","Gnosis"],["oasis-network","ROSE","Oasis"],["basic-attention-token","BAT","Basic Attention Token"],
    ["ravencoin","RVN","Ravencoin"],["zilliqa","ZIL","Zilliqa"],["enjincoin","ENJ","Enjin Coin"],
    ["ecash","XEC","eCash"],["astar","ASTR","Astar"],["woo-network","WOO","WOO"],
    ["skale","SKL","SKALE"],["ankr","ANKR","Ankr"],["golem","GLM","Golem"],
    ["kusama","KSM","Kusama"],["ethereum-name-service","ENS","Ethereum Name Service"],["mask-network","MASK","Mask Network"],
    ["gitcoin","GTC","Gitcoin"],["livepeer","LPT","Livepeer"],["harmony","ONE","Harmony"],
    ["celo","CELO","Celo"],["loopring","LRC","Loopring"],["dydx","ETHDYDX","dYdX (ethDYDX)"],
    ["stepn","GMT","GMT"],["apecoin","APE","ApeCoin"],["chia","XCH","Chia"],
    ["kadena","KDA","Kadena"],["osmosis","OSMO","Osmosis"],["terra-luna-2","LUNA","Terra"],
    ["terrausd","USTC","TerraClassicUSD"],["frax-share","FXS","Frax Share"],["balancer","BAL","Balancer"],
    ["yearn-finance","YFI","yearn.finance"],["sushi","SUSHI","SushiSwap"],["0x","ZRX","0x Protocol"],
    ["uma","UMA","UMA"],["band-protocol","BAND","Band Protocol"],["api3","API3","API3"],
    ["dogelon-mars","ELON","Dogelon Mars"],["safepal","SFP","SafePal"],["trust-wallet-token","TWT","Trust Wallet"],
    ["true-usd","TUSD","TrueUSD"],["paypal-usd","PYUSD","PayPal USD"],["paxos-standard","USDP","Pax Dollar"],
    ["blockstack","STX","Stacks"],["theta-fuel","TFUEL","Theta Fuel"],["holotoken","HOT","Holo"],
    ["wax","WAXP","WAX"],["kucoin-shares","KCS","KuCoin"],["gatechain-token","GT","Gate"],
    ["bitget-token","BGB","Bitget Token"],["notcoin","NOT","Notcoin"],["dogs-2","DOGS","Dogs"],
    ["cat-in-a-dogs-world","MEW","cat in a dogs world"],["popcat","POPCAT","Popcat"],["brett-based","BRETT","Brett"],
    ["aerodrome-finance","AERO","Aerodrome Finance"],["eigenlayer","EIGEN","EigenLayer"],
    ["raydium","RAY","Raydium"],["jito-governance-token","JTO","Jito"],["drift-protocol","DRIFT","Drift"],
    ["kamino","KMNO","Kamino"],["marinade","MNDE","Marinade"],["tensor","TNSR","Tensor"]
  ].map(function (r) { return { id: r[0], symbol: r[1], name: r[2], rank: 0, thumb: "" }; });

  /* ---------- Cache localStorage (fallback interno, sem core) ---------- */
  var mem = {};
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch (e) { return mem; }
  }
  function writeCache(obj) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); }
    catch (e) { mem = obj; }
  }
  function apiKey() {
    try { return localStorage.getItem(APIKEY_KEY) || ""; } catch (e) { return ""; }
  }

  /* ---------- Matching local (síncrono, instantâneo) ---------- */
  function localSearch(q, max) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return [];
    max = max || 8;
    var scored = [];
    for (var i = 0; i < SEED.length; i++) {
      var c = SEED[i];
      var sym = c.symbol.toLowerCase(), nm = c.name.toLowerCase();
      var score = -1;
      if (sym === q) score = 100;
      else if (sym.indexOf(q) === 0) score = 80;
      else if (nm.indexOf(q) === 0) score = 60;
      else if (nm.indexOf(q) !== -1) score = 40;
      else if (sym.indexOf(q) !== -1) score = 20;
      if (score >= 0) scored.push({ c: c, s: score, i: i });
    }
    scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return scored.slice(0, max).map(function (x) { return x.c; });
  }

  /* ---------- Busca live: provedor do core, ou fallback interno ---------- */
  function liveSearch(q) {
    q = String(q || "").trim().toLowerCase();
    if (q.length < 2) return Promise.resolve([]);

    var p = provider();
    if (p && p.search) return p.search(q).catch(function () { return []; });

    /* fallback interno (página sem core carregado) */
    var cache = readCache();
    var hit = cache[q];
    if (hit && (Date.now() - hit.t) < CACHE_TTL) return Promise.resolve(hit.items);
    var headers = {};
    var key = apiKey();
    if (key) headers["x-cg-demo-api-key"] = key;
    return fetch(CG + "/search?query=" + encodeURIComponent(q), { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        var items = (data && data.coins ? data.coins : []).map(function (c) {
          return { id: c.id, symbol: (c.symbol || "").toUpperCase(), name: c.name,
                   rank: c.market_cap_rank || 9999, thumb: c.thumb || c.large || "" };
        });
        items.sort(function (a, b) { return a.rank - b.rank; });
        cache[q] = { t: Date.now(), items: items };
        writeCache(cache);
        return items;
      })
      .catch(function () { return []; });
  }

  /* combina local + live, deduplicando por id */
  function search(q, max) {
    max = max || 8;
    var local = localSearch(q, max);
    return liveSearch(q).then(function (live) {
      var seen = {}, out = [];
      local.concat(live).forEach(function (c) {
        var k = c.id || c.symbol;
        if (seen[k]) return; seen[k] = 1; out.push(c);
      });
      return out.slice(0, max);
    }).catch(function () { return local; });
  }

  /* ---------- Preço: provedor do core, ou fallback interno ---------- */
  var _priceCache = {};
  function price(coinId) {
    if (!coinId) return Promise.resolve(null);
    var p = provider();
    if (p && p.price) return p.price(coinId);

    var hit = _priceCache[coinId];
    if (hit && (Date.now() - hit.t) < 60000) return Promise.resolve(hit.v);
    var headers = {};
    var key = apiKey();
    if (key) headers["x-cg-demo-api-key"] = key;
    return fetch(CG + "/simple/price?ids=" + encodeURIComponent(coinId) + "&vs_currencies=usd", { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        var v = d && d[coinId] && typeof d[coinId].usd === "number" ? d[coinId].usd : null;
        if (v != null) _priceCache[coinId] = { t: Date.now(), v: v };
        return v;
      })
      .catch(function () { return null; });
  }

  /* Preço completo (USD + market cap + imagem). Rejeita com mensagem amigável. */
  function priceFull(coinId) {
    if (!coinId) return Promise.resolve(null);
    var p = provider();
    if (p && p.priceFull) return p.priceFull(coinId);
    /* sem core: cai no preço simples */
    return price(coinId).then(function (v) {
      return v == null ? null : { id: coinId, usd: v, marketCap: null, image: "", symbol: "", name: "" };
    });
  }

  /* ---------- CSS do dropdown (injetado uma vez) ---------- */
  function injectCSS() {
    if (document.getElementById("atlas-assets-css")) return;
    var css = "" +
      ".aa-drop{position:fixed;z-index:99999;min-width:200px;max-height:302px;overflow-y:auto;" +
      "background:var(--aa-bg,#0E1526);border:1px solid var(--aa-border,#1F2A3A);border-radius:10px;" +
      "box-shadow:0 18px 48px rgba(0,0,0,.55);padding:5px;font-family:inherit;" +
      "animation:aaIn .12s ease}" +
      "@keyframes aaIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}" +
      ".aa-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer}" +
      ".aa-row:hover,.aa-row.aa-on{background:var(--aa-hover,rgba(34,211,238,.12))}" +
      ".aa-badge{width:22px;height:22px;border-radius:50%;flex:0 0 22px;display:flex;align-items:center;" +
      "justify-content:center;font-size:10px;font-weight:700;color:#0B0F14;background:var(--aa-accent,#22D3EE);" +
      "overflow:hidden}" +
      ".aa-badge img{width:100%;height:100%;object-fit:cover}" +
      ".aa-sym{font-weight:700;font-size:13px;color:var(--aa-text,#E6EDF3);letter-spacing:.3px}" +
      ".aa-name{font-size:12px;color:var(--aa-dim,#8595B2);margin-left:2px}" +
      ".aa-meta{margin-left:auto;font-size:10px;color:var(--aa-dim,#8595B2);white-space:nowrap}" +
      ".aa-empty{padding:12px 10px;font-size:12px;color:var(--aa-dim,#8595B2)}" +
      ".aa-drop::-webkit-scrollbar{width:8px}" +
      ".aa-drop::-webkit-scrollbar-thumb{background:var(--aa-border,#1F2A3A);border-radius:6px}";
    var s = document.createElement("style");
    s.id = "atlas-assets-css"; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- Dropdown de autocomplete ligado a um input ---------- */
  function attach(input, opts) {
    if (!input || input.__aaBound) return; // não religar
    input.__aaBound = true;
    opts = opts || {};
    injectCSS();
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");

    var mode = opts.value; // 'symbol' | 'name' | undefined (autodetect)
    var max = opts.max || 8;
    var minChars = opts.minChars != null ? opts.minChars : 1;

    var drop = null, rows = [], active = -1, debTimer = null, lastQ = "";
    var justPicked = 0;      // timestamp da última seleção → focus não reabre
    var pickedValue = null;  // valor "commitado" pela seleção → focus não reabre
                             // enquanto o usuário não digitar algo diferente

    function close() {
      if (drop) { drop.remove(); drop = null; }
      rows = []; active = -1;
      clearTimeout(debTimer);
      document.removeEventListener("mousedown", onDocDown, true);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    }
    function onDocDown(e) {
      if (drop && !drop.contains(e.target) && e.target !== input) close();
    }
    function position() {
      if (!drop) return;
      var r = input.getBoundingClientRect();
      drop.style.left = r.left + "px";
      drop.style.top = (r.bottom + 4) + "px";
      drop.style.minWidth = Math.max(200, r.width) + "px";
    }
    function ensureDrop() {
      if (drop) return;
      drop = document.createElement("div");
      drop.className = "aa-drop";
      document.body.appendChild(drop);
      position();
      document.addEventListener("mousedown", onDocDown, true);
      window.addEventListener("scroll", position, true);
      window.addEventListener("resize", position);
    }

    /* CORREÇÃO do bug de duplicação:
       - __aaSuppress ignora os eventos "input" disparados pelo
         próprio preenchimento programático (neste campo e nos
         irmãos preenchidos pelo onSelect);
       - justPicked impede o handler de focus de reabrir a lista
         logo após selecionar. */
    function pick(coin) {
      var writeSym = mode === "symbol" || (mode == null && looksLikeSymbolField());
      input.__aaSuppress = true;
      input.value = writeSym ? coin.symbol : coin.name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.__aaSuppress = false;
      pickedValue = input.value;
      close();
      justPicked = Date.now();
      if (typeof opts.onSelect === "function") {
        try { opts.onSelect(coin, input); } catch (e) {}
      }
      input.focus();
    }
    function looksLikeSymbolField() {
      var hint = ((input.placeholder || "") + " " + (input.getAttribute("data-f") || "") +
                  " " + (input.id || "")).toLowerCase();
      return /btc|sol|ticker|symbol|token|par|base|quote|ativo|asset/.test(hint) &&
             !/nome|name|bitcoin|ethereum/.test(hint);
    }
    function badge(coin) {
      if (coin.thumb) return '<span class="aa-badge"><img src="' + coin.thumb + '" alt=""></span>';
      return '<span class="aa-badge">' + (coin.symbol || "?").slice(0, 2) + "</span>";
    }
    function render(items) {
      ensureDrop();
      rows = items; active = -1;
      if (!items.length) {
        drop.innerHTML = '<div class="aa-empty">Nenhum ativo encontrado.</div>';
        return;
      }
      drop.innerHTML = items.map(function (c, i) {
        var meta = c.rank && c.rank < 9999 ? "#" + c.rank : "";
        return '<div class="aa-row" data-i="' + i + '">' + badge(c) +
          '<span class="aa-sym">' + esc(c.symbol) + '</span>' +
          '<span class="aa-name">' + esc(c.name) + '</span>' +
          (meta ? '<span class="aa-meta">' + meta + '</span>' : "") + '</div>';
      }).join("");
      Array.prototype.forEach.call(drop.querySelectorAll(".aa-row"), function (el) {
        el.addEventListener("mousedown", function (e) {
          e.preventDefault();
          pick(rows[parseInt(el.getAttribute("data-i"), 10)]);
        });
      });
      position();
    }
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
      });
    }
    function run() {
      if (input.__aaSuppress) return; // evento programático → ignorar
      var q = input.value.trim();
      if (q !== pickedValue) pickedValue = null; // usuário editou → libera de novo
      lastQ = q;
      if (q.length < minChars) { close(); return; }
      // 1) instantâneo (local)
      render(localSearch(q, max));
      // 2) live com debounce, mescla se ainda for a mesma query
      clearTimeout(debTimer);
      debTimer = setTimeout(function () {
        search(q, max).then(function (items) {
          if (drop && input.value.trim() === lastQ && items.length) render(items);
        });
      }, 400);
    }
    function move(d) {
      if (!drop || !rows.length) return;
      active = (active + d + rows.length) % rows.length;
      Array.prototype.forEach.call(drop.querySelectorAll(".aa-row"), function (el, i) {
        el.classList.toggle("aa-on", i === active);
        if (i === active) el.scrollIntoView({ block: "nearest" });
      });
    }

    input.addEventListener("input", run);
    input.addEventListener("focus", function () {
      if (Date.now() - justPicked < 300) return;          // acabou de selecionar
      if (input.value.trim() === pickedValue) return;     // valor já escolhido → só reabre se digitar
      if (input.value.trim().length >= minChars) run();
    });
    input.addEventListener("keydown", function (e) {
      if (!drop) return;
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        if (active >= 0 && rows[active]) { e.preventDefault(); pick(rows[active]); }
      } else if (e.key === "Escape") { close(); }
    });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
  }

  /* ---------- Varredura declarativa: [data-atlas-asset] ---------- */
  function autoBind(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll("[data-atlas-asset]"), function (el) {
      var v = el.getAttribute("data-atlas-asset"); // "symbol" | "name" | ""
      attach(el, { value: v || undefined });
    });
  }

  window.AtlasAssets = {
    SEED: SEED,
    localSearch: localSearch,
    liveSearch: liveSearch,
    search: search,
    price: price,
    priceFull: priceFull,
    attach: attach,
    autoBind: autoBind,
    setApiKey: function (k) {
      var p = provider();
      if (p && p.setApiKey) p.setApiKey(k);
      else { try { localStorage.setItem(APIKEY_KEY, k || ""); } catch (e) {} }
    },
    clearCache: function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
      if (window.AtlasHttp) AtlasHttp.clearCache();
      mem = {}; _priceCache = {};
    }
  };

  // liga automaticamente qualquer input marcado quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { autoBind(); });
  } else { autoBind(); }
})();
