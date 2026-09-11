# Atlas Academy (central de mercado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o módulo `academy/` como um command center de mercado (cripto + RWA) que consome APIs gratuitas com cadeia de fallback automática.

**Architecture:** Vanilla JS puro, sem build. Toda rede passa por `AtlasHttp` (cache/retry/timeout) e por provedores registrados em `AtlasProviders`. O registro ganha uma **cadeia de fallback por capacidade**; a UI consome uma fachada única (`AcademyData`) e nunca sabe qual fonte respondeu. O Academy é uma página SPA com roteamento por hash (dashboard + página do ativo).

**Tech Stack:** HTML/CSS/JS vanilla, PWA offline-first, servido por `py -3 -m http.server 8777`. APIs: CoinGecko (primário), Binance, CoinPaprika, CoinLore, DefiLlama, alternative.me. Gráfico em SVG próprio (sem lib).

**Spec:** `docs/superpowers/specs/2026-09-11-academy-mercado-design.md`

## Global Constraints

- **Nenhum `fetch` direto.** Sempre `AtlasHttp.getJSON(url, {ttl, timeout, retries, headers, cacheKey})`.
- **Nunca inventar dado.** Campo ausente na API → valor `null` no provedor e **"indisponível"** na UI. Jamais preencher com número velho.
- **DOM seguro:** montar tela com `document.createElement` + `textContent`/`append`. **Não** usar `innerHTML` com conteúdo vindo de API (nomes, descrições) — evita XSS e é a regra do hook de segurança do repo. Para limpar um nó, remover filhos em laço, não `node.innerHTML = ""`.
- **Sem build, sem framework, sem dependência externa** (nem no gráfico). Servir por http, nunca `file://`.
- **Rate limit conservador:** TTLs longos, chamadas em lote, refresh por intervalo (~60s), nunca por segundo.
- **Idioma:** UI, comentários e mensagens de commit em português; commits diretos na `main`.
- **Atribuição de commit:** terminar toda mensagem com
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Servidor de dev:** preview via `.claude/launch.json` nome `atlas` (porta 8777). Academy em `http://localhost:8777/academy/`.

## Formas de dados canônicas (contrato de TODOS os provedores de uma capacidade)

Todo provedor de uma capacidade DEVE devolver exatamente estas formas. É isso que
faz o fallback ser invisível para a UI. Campos sem dado = `null`.

```js
// prices  -> Array<TickerItem>            capacidade "prices"
TickerItem   = { id, symbol, name, usd, change24h, image }        // change24h em %

// rankings -> Array<MarketRow>            capacidade "rankings"
MarketRow    = { id, symbol, name, usd, change24h, volume24h, marketCap, rank, image, category }

// global -> GlobalStats                   capacidade "global"
GlobalStats  = { marketCap, volume24h, btcDominance }             // USD; dominância em %

// categories -> Array<Category>           (só CoinGecko na v1; sem fallback)
Category     = { id, name, change24h, marketCap, volume24h }

// assetDetail -> AssetDetail              capacidade "assetDetail"
AssetDetail  = {
  id, symbol, name, image, classification,   // 'crypto' | 'rwa'
  usd, change: { h24, d7, d30, m3, m6, y1 }, // % por janela; null se ausente
  ath, athDate, atl, atlDate,
  marketCap, fdv, volume24h, rank,
  supply: { circulating, total, max },
  platforms: Array<{ chain, contract, explorerUrl }>,
  categories: Array<string>,
  description,                               // texto
  links: { homepage, whitepaper, twitter, telegram, github, reddit },
  exchanges: Array<{ name, pair, url }>
}

// chart -> ChartSeries                     capacidade "chart"
ChartSeries  = { days, points: Array<[tsMillis, price]> }

// feargreed -> FearGreed                   capacidade "feargreed"
FearGreed    = { value, label, ts }         // value 0..100
```

---

## Task 0: Harness de verificação no navegador (scaffolding reutilizável)

Cria uma página de dev que carrega o core + provedores e expõe helpers de
asserção no console. Usada por todas as tasks de provedor. **Não** entra no app
final (fica em `academy/dev/`, fora do fluxo do usuário).

**Files:**
- Create: `academy/dev/provider-check.html`

**Interfaces:**
- Produces: página `http://localhost:8777/academy/dev/provider-check.html` que,
  após carregar, deixa `window.AtlasHttp`, `window.AtlasProviders` e um helper
  global `assert(cond, msg)` (loga `OK`/`FALHOU msg`) disponíveis no console.

- [ ] **Step 1: Criar a página de checagem**

```html
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Provider check</title>
<script src="../../core/http.js"></script>
<script src="../../core/providers/registry.js"></script>
<!-- os <script> dos provedores são acrescentados aqui conforme cada task -->
</head><body>
<pre id="out">Abra o console. Helpers: assert(cond,msg), P (AtlasProviders), H (AtlasHttp).</pre>
<script>
  window.P = window.AtlasProviders; window.H = window.AtlasHttp;
  window.assert = function (c, m) {
    console.log((c ? "OK: " : "FALHOU: ") + m); return !!c;
  };
</script>
</body></html>
```

- [ ] **Step 2: Subir o servidor e abrir a página**

Preview: iniciar servidor `atlas` (launch.json) e navegar para
`http://localhost:8777/academy/dev/provider-check.html`.
Esperado: a `<pre>` aparece; no console, `P` e `H` são objetos (não `undefined`).

- [ ] **Step 3: Commit**

```bash
git add academy/dev/provider-check.html
git commit -m "Academy: harness de checagem de provedores no navegador

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1: Cadeia de fallback no registro de provedores

**Files:**
- Modify: `core/providers/registry.js` (acrescentar `chainFor` e `tryChain`)

**Interfaces:**
- Consumes: `AtlasProviders.register/get/list` (já existem).
- Produces:
  - `AtlasProviders.chainFor(cap) -> Array<impl>` — todos os provedores que
    declaram `cap` em `capabilities`, na ordem de registro.
  - `AtlasProviders.tryChain(cap, method, args) -> Promise<result>` — chama
    `impl[method].apply(impl, args)` para cada provedor da cadeia; passa ao
    próximo se rejeitar OU se devolver "vazio" (`null`/`undefined`/`[]`/`{}`).
    Rejeita só se todos falharem, com a última mensagem amigável. Loga no
    console qual provedor respondeu.

- [ ] **Step 1: Escrever o teste (asserção de console)**

Na `provider-check.html`, o teste é executado via console após implementar. Código de teste a rodar:

```js
// stubs: A falha sempre; B responde. A cadeia deve cair de A para B.
P.register("stubA", { capabilities:["x"], go:function(){ return Promise.reject(new Error("boom")); }});
P.register("stubB", { capabilities:["x"], go:function(){ return Promise.resolve("ok-B"); }});
assert(P.chainFor("x").length === 2, "chainFor('x') tem 2 provedores");
P.tryChain("x","go",[]).then(function(r){ assert(r === "ok-B", "tryChain caiu para stubB"); });
// vazio também deve pular:
P.register("stubC", { capabilities:["y"], go:function(){ return Promise.resolve([]); }});
P.register("stubD", { capabilities:["y"], go:function(){ return Promise.resolve([1,2]); }});
P.tryChain("y","go",[]).then(function(r){ assert(r && r.length===2, "tryChain pula resposta vazia"); });
```

- [ ] **Step 2: Rodar e ver falhar**

Abrir a página, colar o teste no console. Esperado: `FALHOU` (métodos não existem / `chainFor is not a function`).

- [ ] **Step 3: Implementar**

Acrescentar ao objeto `window.AtlasProviders` em `registry.js` (usar as vars
`registry` e `order` já existentes no arquivo):

```js
chainFor: function (cap) {
  var out = [];
  for (var i = 0; i < order.length; i++) {
    var p = registry[order[i]];
    if (p && p.capabilities && p.capabilities.indexOf(cap) !== -1) out.push(p);
  }
  return out;
},
tryChain: function (cap, method, args) {
  var chain = this.chainFor(cap);
  function empty(v){ return v == null ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0); }
  var i = 0, lastErr = null;
  function next() {
    if (i >= chain.length) {
      return Promise.reject(lastErr || new Error("Sem fonte de dados disponível."));
    }
    var impl = chain[i++];
    var fn = impl && impl[method];
    if (typeof fn !== "function") return next();
    return Promise.resolve().then(function(){ return fn.apply(impl, args || []); })
      .then(function (res) {
        if (empty(res)) return next();
        try { console.log("[academy] " + cap + " respondido por provedor #" + i); } catch(e){}
        return res;
      })
      .catch(function (err) { lastErr = err; return next(); });
  }
  return next();
}
```

- [ ] **Step 4: Rodar e ver passar**

Recarregar, colar o teste. Esperado: 4 linhas `OK`.

- [ ] **Step 5: Commit**

```bash
git add core/providers/registry.js
git commit -m "Provedores: registro ganha cadeia de fallback (chainFor/tryChain)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Provedor Fear & Greed (alternative.me)

**Files:**
- Create: `core/providers/feargreed.js`
- Modify: `academy/dev/provider-check.html` (incluir o `<script>`)

**Interfaces:**
- Produces: provedor `"feargreed"`, capability `["feargreed"]`, método
  `feargreed() -> Promise<FearGreed|null>` (forma canônica acima).

- [ ] **Step 1: Teste (console)**

```js
P.tryChain("feargreed","feargreed",[]).then(function(fg){
  assert(fg && fg.value >= 0 && fg.value <= 100, "F&G value 0..100");
  assert(typeof fg.label === "string" && fg.label.length > 0, "F&G tem label");
});
```

- [ ] **Step 2: Ver falhar** — provedor ainda não existe → cadeia vazia rejeita. Esperado: `FALHOU`.

- [ ] **Step 3: Implementar `core/providers/feargreed.js`**

Endpoint keyless: `https://api.alternative.me/fng/?limit=1`. Resposta:
`{ data: [ { value:"52", value_classification:"Neutral", timestamp:"1700000000" } ] }`.

```js
(function () {
  "use strict";
  if (!window.AtlasHttp || !window.AtlasProviders) return;
  if (window.AtlasProviders.get("feargreed")) return;
  var LABELS = { "Extreme Fear":"Medo extremo","Fear":"Medo","Neutral":"Neutro",
                 "Greed":"Ganância","Extreme Greed":"Ganância extrema" };
  window.AtlasProviders.register("feargreed", {
    capabilities: ["feargreed"],
    feargreed: function () {
      return AtlasHttp.getJSON("https://api.alternative.me/fng/?limit=1",
        { ttl: 1000*60*30, cacheKey: "fng.latest" }).then(function (d) {
        var it = d && d.data && d.data[0]; if (!it) return null;
        var v = parseInt(it.value, 10); if (!isFinite(v)) return null;
        return { value: v, label: LABELS[it.value_classification] || it.value_classification,
                 ts: parseInt(it.timestamp, 10) * 1000 };
      });
    }
  });
})();
```

- [ ] **Step 4: Incluir `<script src="../../core/providers/feargreed.js"></script>` na provider-check.html, recarregar, rodar o teste.** Esperado: 2 `OK` com dado real.

- [ ] **Step 5: Commit**

```bash
git add core/providers/feargreed.js academy/dev/provider-check.html
git commit -m "Provedores: Fear & Greed (alternative.me, keyless)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: CoinGecko — estender com global/rankings/categories/assetDetail/chart

**Files:**
- Modify: `core/providers/coingecko.js` (acrescentar métodos + capabilities)

**Interfaces:**
- Consumes: `AtlasHttp`, `headers()` e o `CoinGecko` já existentes no arquivo.
- Produces (acrescenta às capabilities existentes `["prices","search"]` →
  `["prices","search","rankings","global","assetDetail","chart","categories"]`):
  - `global() -> Promise<GlobalStats|null>`
  - `topMovers({ order, category, perPage }) -> Promise<Array<MarketRow>>`
    (order ex.: `price_change_percentage_24h_desc`; category ex.: `real-world-assets-rwa`)
  - `categories() -> Promise<Array<Category>>`
  - `assetFull(id) -> Promise<AssetDetail|null>`
  - `chart(id, days) -> Promise<ChartSeries|null>`

- [ ] **Step 1: Teste (console)**

```js
P.tryChain("global","global",[]).then(g=>{ assert(g && g.marketCap>0, "CG global marketCap"); assert(g.btcDominance>0,"CG dominância BTC"); });
P.get("coingecko").topMovers({order:"price_change_percentage_24h_desc",perPage:10}).then(r=>{ assert(r.length>0 && "change24h" in r[0], "CG movers forma MarketRow"); });
P.get("coingecko").assetFull("solana").then(a=>{ assert(a && a.symbol==="SOL","CG assetFull SOL"); assert(a.change && "d7" in a.change,"CG variações por janela"); assert(Array.isArray(a.platforms),"CG platforms[]"); });
P.get("coingecko").chart("solana",7).then(c=>{ assert(c && c.points.length>0,"CG chart 7d pontos"); });
```

- [ ] **Step 2: Ver falhar** — métodos ainda não existem. Esperado: `FALHOU`/erros.

- [ ] **Step 3: Implementar** (acrescentar ao objeto `CoinGecko`, antes do `register`):

Endpoints (base `https://api.coingecko.com/api/v3`):
- global: `/global` → `data.total_market_cap.usd`, `data.total_volume.usd`, `data.market_cap_percentage.btc`.
- markets: `/coins/markets?vs_currency=usd&order=<order>&per_page=<n>&page=1&price_change_percentage=24h&sparkline=false[&category=<cat>]`.
- categories: `/coins/categories` → `{id,name,market_cap_change_24h,market_cap,volume_24h}`.
- detalhe: `/coins/<id>?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false`.
- chart: `/coins/<id>/market_chart?vs_currency=usd&days=<days>` → `prices: [[ts,preço],...]`.

```js
global: function () {
  return AtlasHttp.getJSON(BASE + "/global", { ttl: 120000, headers: headers(), cacheKey:"cg.global" })
    .then(function (d) { var g = d && d.data; if (!g) return null;
      return { marketCap: g.total_market_cap && g.total_market_cap.usd || null,
               volume24h: g.total_volume && g.total_volume.usd || null,
               btcDominance: g.market_cap_percentage && g.market_cap_percentage.btc || null }; });
},
topMovers: function (o) {
  o = o || {}; var order = o.order || "market_cap_desc";
  var url = BASE + "/coins/markets?vs_currency=usd&order=" + order +
    "&per_page=" + (o.perPage || 20) + "&page=1&price_change_percentage=24h&sparkline=false" +
    (o.category ? "&category=" + encodeURIComponent(o.category) : "");
  return AtlasHttp.getJSON(url, { ttl: 90000, headers: headers(), cacheKey: "cg.mkts." + order + (o.category||"") + (o.perPage||20) })
    .then(function (arr) { return (arr || []).map(function (c) {
      return { id:c.id, symbol:(c.symbol||"").toUpperCase(), name:c.name, usd:c.current_price,
        change24h:c.price_change_percentage_24h, volume24h:c.total_volume, marketCap:c.market_cap,
        rank:c.market_cap_rank, image:c.image, category:o.category||null }; }); });
},
categories: function () {
  return AtlasHttp.getJSON(BASE + "/coins/categories", { ttl: 300000, headers: headers(), cacheKey:"cg.cats" })
    .then(function (arr) { return (arr||[]).map(function (c) {
      return { id:c.id, name:c.name, change24h:c.market_cap_change_24h, marketCap:c.market_cap, volume24h:c.volume_24h }; }); });
},
assetFull: function (id) {
  if (!id) return Promise.resolve(null);
  return AtlasHttp.getJSON(BASE + "/coins/" + encodeURIComponent(id) +
    "?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false",
    { ttl: 180000, headers: headers(), cacheKey: "cg.coin." + id }).then(function (c) {
    if (!c) return null; var m = c.market_data || {};
    var plats = []; var det = c.detail_platforms || {};
    Object.keys(det).forEach(function (chain) { var p = det[chain]; if (p && p.contract_address)
      plats.push({ chain: chain, contract: p.contract_address, explorerUrl: null }); });
    var isRwa = (c.categories||[]).some(function(x){ return /real.?world|rwa|tokenized/i.test(x||""); });
    var l = c.links || {};
    return {
      id:c.id, symbol:(c.symbol||"").toUpperCase(), name:c.name, image:c.image && c.image.large,
      classification: isRwa ? "rwa" : "crypto",
      usd: m.current_price && m.current_price.usd || null,
      change: { h24: m.price_change_percentage_24h, d7: m.price_change_percentage_7d,
                d30: m.price_change_percentage_30d, m3: m.price_change_percentage_60d,
                m6: m.price_change_percentage_200d, y1: m.price_change_percentage_1y },
      ath: m.ath && m.ath.usd || null, athDate: m.ath_date && m.ath_date.usd || null,
      atl: m.atl && m.atl.usd || null, atlDate: m.atl_date && m.atl_date.usd || null,
      marketCap: m.market_cap && m.market_cap.usd || null,
      fdv: m.fully_diluted_valuation && m.fully_diluted_valuation.usd || null,
      volume24h: m.total_volume && m.total_volume.usd || null, rank: c.market_cap_rank || null,
      supply: { circulating: m.circulating_supply, total: m.total_supply, max: m.max_supply },
      platforms: plats, categories: (c.categories||[]).filter(Boolean),
      description: (c.description && c.description.en) || null,
      links: { homepage: (l.homepage||[])[0]||null, whitepaper: l.whitepaper||null,
        twitter: l.twitter_screen_name ? "https://twitter.com/"+l.twitter_screen_name : null,
        telegram: l.telegram_channel_identifier ? "https://t.me/"+l.telegram_channel_identifier : null,
        github: (l.repos_url && l.repos_url.github || [])[0] || null,
        reddit: l.subreddit_url || null },
      exchanges: (c.tickers||[]).slice(0,15).map(function (t) {
        return { name: t.market && t.market.name, pair: t.base + "/" + t.target, url: t.trade_url || null }; })
    };
  });
},
chart: function (id, days) {
  if (!id) return Promise.resolve(null); days = days || 7;
  return AtlasHttp.getJSON(BASE + "/coins/" + encodeURIComponent(id) +
    "/market_chart?vs_currency=usd&days=" + days,
    { ttl: days <= 1 ? 60000 : 300000, headers: headers(), cacheKey: "cg.chart." + id + "." + days })
    .then(function (d) { var pts = d && d.prices; if (!pts || !pts.length) return null;
      return { days: days, points: pts }; });
},
```

E atualizar `capabilities: ["prices","search","rankings","global","assetDetail","chart","categories"]`.

- [ ] **Step 4: Recarregar, rodar o teste.** Esperado: todas as asserções `OK` com dado real.

- [ ] **Step 5: Commit**

```bash
git add core/providers/coingecko.js
git commit -m "Provedores: CoinGecko ganha global, rankings, categorias, detalhe e gráfico

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Provedor CoinPaprika (fallback amplo, keyless)

**Files:**
- Create: `core/providers/coinpaprika.js`
- Modify: `academy/dev/provider-check.html` (incluir `<script>`)

**Interfaces:**
- Produces: provedor `"coinpaprika"`, capabilities
  `["prices","search","rankings","global","assetDetail","chart"]`, com os mesmos
  métodos/forma do CoinGecko: `prices(ids)`, `search(q)`, `topMovers(o)`,
  `global()`, `assetFull(id)`, `chart(id,days)`. **ids aqui são ids do
  CoinPaprika** (ex.: `sol-solana`); a fachada (Task 9) resolve o id via id-map
  antes de chamar quando cai para este provedor.

- [ ] **Step 1: Teste (console)**

```js
P.get("coinpaprika").global().then(g=>assert(g && g.marketCap>0,"Paprika global"));
P.get("coinpaprika").topMovers({order:"price_change_percentage_24h_desc",perPage:10}).then(r=>assert(r.length>0 && "change24h" in r[0],"Paprika movers forma MarketRow"));
P.get("coinpaprika").assetFull("sol-solana").then(a=>assert(a && a.symbol==="SOL","Paprika assetFull SOL"));
```

- [ ] **Step 2: Ver falhar** — provedor não existe.

- [ ] **Step 3: Implementar** — Base `https://api.coinpaprika.com/v1`. Endpoints:
  - global: `/global` → `market_cap_usd`, `volume_24h_usd`, `bitcoin_dominance_percentage`.
  - tickers (rankings/prices): `/tickers?limit=<n>` → item
    `{id,symbol,name,rank,quotes:{USD:{price,volume_24h,market_cap,percent_change_24h}}}`;
    ordenar por `percent_change_24h` no cliente para movers (desc/asc conforme `o.order`).
  - detalhe: `/coins/<id>` (descrição, links, tags) + `/tickers/<id>` (preço/mktcap/variações).
    Mapear tags → `categories`; `classification="rwa"` se alguma tag casar
    `/real.?world|rwa|tokenized/i`. Variações: Paprika dá `percent_change_24h/7d/30d/1y`
    (m3/m6 podem ficar `null`).
  - chart: `/tickers/<id>/historical?start=<YYYY-MM-DD>&interval=<1h|1d>` →
    `[{timestamp, price}]` → `points:[[Date.parse(ts), price]]`. Se o tier free não
    devolver histórico, retornar `null` (cadeia cai para Binance).

Seguir o shape canônico (símbolo em maiúsculo, mapear `quotes.USD.*`; reusar o
mesmo formato de `MarketRow`/`AssetDetail` do CoinGecko).

- [ ] **Step 4: Incluir `<script>`, recarregar, rodar teste.** Esperado: `OK` com dado real.

- [ ] **Step 5: Commit**

```bash
git add core/providers/coinpaprika.js academy/dev/provider-check.html
git commit -m "Provedores: CoinPaprika como fallback amplo (keyless)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Provedor Binance (preço + gráfico de majors, keyless)

**Files:**
- Create: `core/providers/binance.js`
- Modify: `academy/dev/provider-check.html`

**Interfaces:**
- Produces: provedor `"binance"`, capabilities `["prices","chart"]`:
  - `prices(symbols) -> Promise<Array<TickerItem>>` — `symbols` são símbolos
    (ex.: `["BTC","ETH"]`); internamente vira `BTCUSDT`.
  - `chart(symbol, days) -> Promise<ChartSeries|null>` — aceita símbolo
    (`"SOL"`) e monta `SOLUSDT`; se não for par válido, resolve `null`.

- [ ] **Step 1: Teste (console)**

```js
P.get("binance").prices(["BTC","ETH"]).then(r=>{ assert(r.length===2,"Binance 2 preços"); assert(r[0].usd>0 && "change24h" in r[0],"Binance forma TickerItem"); });
P.get("binance").chart("SOL",7).then(c=>assert(c && c.points.length>0,"Binance klines 7d"));
P.get("binance").chart("ATIVOINEXISTENTEXYZ",7).then(c=>assert(c===null,"Binance retorna null p/ par inexistente"));
```

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Implementar** — Base `https://api.binance.com/api/v3`.
  - preços: `/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]` (array url-encoded) →
    `{symbol, lastPrice, priceChangePercent}`; mapear de volta ao símbolo base
    removendo `USDT`. `name`/`image` = símbolo, `id` = símbolo (Binance não tem metadado).
  - chart: `/klines?symbol=SOLUSDT&interval=<i>&limit=<n>`; interval por `days`
    (1→`15m`, 7→`1h`, 30→`4h`, 90→`8h`, 180→`12h`, 365→`1d`); cada kline
    `[openTime, open, high, low, close, ...]` → `[openTime, +close]`.
    Em erro/HTTP 400 (par inválido) → capturar e devolver `null` (não propagar).
  - TTL: preço 60s, chart como no CoinGecko.

- [ ] **Step 4: Incluir `<script>`, recarregar, rodar teste.** Esperado: `OK`.

- [ ] **Step 5: Commit**

```bash
git add core/providers/binance.js academy/dev/provider-check.html
git commit -m "Provedores: Binance para preço e gráfico de majors (keyless)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Provedor CoinLore (fallback de global/rankings, keyless)

**Files:**
- Create: `core/providers/coinlore.js`
- Modify: `academy/dev/provider-check.html`

**Interfaces:**
- Produces: provedor `"coinlore"`, capabilities `["global","rankings"]`:
  - `global() -> Promise<GlobalStats|null>` — `https://api.coinlore.net/api/global/`
    → `[{mcap, volume, btc_d}]`.
  - `topMovers(o) -> Promise<Array<MarketRow>>` —
    `https://api.coinlore.net/api/tickers/?start=0&limit=100` → `data[]` com
    `{id,symbol,name,rank,price_usd,percent_change_24h,volume24,market_cap_usd}`;
    ordenar no cliente conforme `o.order`.

- [ ] **Step 1: Teste (console)**

```js
P.get("coinlore").global().then(g=>assert(g && g.marketCap>0,"CoinLore global"));
P.get("coinlore").topMovers({order:"price_change_percentage_24h_desc",perPage:10}).then(r=>assert(r.length>0,"CoinLore movers"));
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** conforme endpoints acima, shape canônico (símbolo maiúsculo, números com `parseFloat`). TTL 90–120s.
- [ ] **Step 4: Incluir `<script>`, recarregar, rodar teste.** Esperado: `OK`.
- [ ] **Step 5: Commit**

```bash
git add core/providers/coinlore.js academy/dev/provider-check.html
git commit -m "Provedores: CoinLore como fallback de global e rankings (keyless)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Provedor DefiLlama (preço por contrato on-chain, keyless)

**Files:**
- Create: `core/providers/defillama.js`
- Modify: `academy/dev/provider-check.html`

**Interfaces:**
- Produces: provedor `"defillama"`, capability `["onchainPrice"]`:
  - `onchainPrice(refs) -> Promise<{ [ref]: usd }>` — `refs` no formato
    `"<chain>:<contrato>"` (ex.: `"ethereum:0x..."`);
    `https://coins.llama.fi/prices/current/<refs vírgula>` →
    `{coins:{"ethereum:0x...":{price}}}`.

- [ ] **Step 1: Teste (console)**

```js
P.get("defillama").onchainPrice(["ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]).then(m=>{ // USDC
  var k = Object.keys(m)[0]; assert(k && m[k] > 0, "DefiLlama preço por contrato");
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** conforme endpoint. TTL 60s. Chaves preservadas no mapa de saída.
- [ ] **Step 4: Incluir `<script>`, recarregar, rodar teste.** Esperado: `OK`.
- [ ] **Step 5: Commit**

```bash
git add core/providers/defillama.js academy/dev/provider-check.html
git commit -m "Provedores: DefiLlama para preço por contrato on-chain (keyless)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Tradutor de identidade entre APIs (id-map)

**Files:**
- Create: `core/providers/id-map.js`
- Modify: `academy/dev/provider-check.html`

**Interfaces:**
- Consumes: `AtlasHttp`; catálogos do CoinPaprika (`/coins`) e do CoinLore.
- Produces: `window.AtlasIdMap`:
  - `resolve(canonicalId, symbol, target) -> Promise<string|null>` — `target` é
    `"binance"` | `"coinpaprika"` | `"coinlore"`. Binance = `symbol.toUpperCase()`
    (o provedor Binance acrescenta `USDT`). Paprika/Lore = lookup por símbolo no
    catálogo (cacheado 24h); em empate, o de menor `rank`. Retorna `null` se não achar.

- [ ] **Step 1: Teste (console)**

```js
AtlasIdMap.resolve("solana","SOL","coinpaprika").then(id=>assert(id==="sol-solana","id-map SOL→Paprika"));
AtlasIdMap.resolve("solana","SOL","binance").then(id=>assert(id==="SOL","id-map SOL→Binance base"));
AtlasIdMap.resolve("zzz-fake","ZZZFAKE","coinpaprika").then(id=>assert(id===null,"id-map inexistente→null"));
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** — Paprika catálogo: `https://api.coinpaprika.com/v1/coins`
  (lista grande; cachear 24h via `AtlasHttp` ttl longo; filtrar `is_active`,
  escolher menor `rank` por símbolo). CoinLore: usar `/api/tickers/?limit=100`
  como catálogo parcial (só majors — aceitável). Guardar mapa resolvido por
  `symbol` em memória para não varrer toda vez.
- [ ] **Step 4: Incluir `<script>`, recarregar, rodar teste.** Esperado: `OK`.
- [ ] **Step 5: Commit**

```bash
git add core/providers/id-map.js academy/dev/provider-check.html
git commit -m "Provedores: tradutor de identidade de ativo entre APIs (id-map)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Fachada de dados do Academy (`AcademyData`)

Uma camada fina que a UI consome. Esconde `tryChain` + id-map. É o único ponto
que as telas chamam.

**Files:**
- Create: `academy/js/market-data.js`
- Modify: `academy/dev/provider-check.html`

**Interfaces:**
- Consumes: `AtlasProviders.tryChain`, provedores das Tasks 2–7, `AtlasIdMap`.
- Produces: `window.AcademyData`:
  - `ticker() -> Promise<Array<TickerItem>>` — BTC/ETH/SOL + PAXG (ids fixos do CoinGecko).
  - `global() -> Promise<GlobalStats>` — via `tryChain("global","global",[])`.
  - `feargreed() -> Promise<FearGreed|null>`.
  - `gainers()/losers()/rwa()/abnormalVolume() -> Promise<Array<MarketRow>>`.
  - `categories() -> Promise<Array<Category>>`.
  - `search(q) -> Promise<Array<{id,symbol,name,thumb,rank}>>` — via `tryChain("search","search",[q])`.
  - `asset(id) -> Promise<AssetDetail>` — `tryChain("assetDetail","assetFull",[id])`;
    quando cair para CoinPaprika, resolver o id via `AtlasIdMap` antes.
  - `chart(id, symbol, days) -> Promise<ChartSeries>` — CoinGecko por `id`, senão
    Binance por `symbol`, senão Paprika.

Regras específicas:
- `gainers`: `topMovers({order:"price_change_percentage_24h_desc",perPage:20})`.
- `losers`: `order:"price_change_percentage_24h_asc"`.
- `rwa`: `topMovers({category:"real-world-assets-rwa",order:"...desc",perPage:20})`
  (só CoinGecko tem categoria; se falhar, retorna `[]` → UI diz "indisponível").
- `abnormalVolume`: `topMovers({order:"volume_desc",perPage:100})` e ordenar por
  `volume24h / marketCap` desc, top 10 (ignorar marketCap nulo/zero).

- [ ] **Step 1: Teste (console, na provider-check com todos os scripts + este)**

```js
AcademyData.ticker().then(t=>assert(t.length>=3 && t[0].usd>0,"fachada ticker"));
AcademyData.gainers().then(r=>assert(r.length>0 && r[0].change24h!=null,"fachada gainers"));
AcademyData.abnormalVolume().then(r=>assert(r.length>0,"fachada volume anormal"));
AcademyData.asset("solana").then(a=>assert(a && a.symbol==="SOL","fachada asset SOL"));
AcademyData.chart("solana","SOL",7).then(c=>assert(c && c.points.length>0,"fachada chart"));
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `AcademyData` conforme contrato acima.
- [ ] **Step 4: Recarregar, rodar teste.** Esperado: 5 `OK`.
- [ ] **Step 5: Teste de fallback forçado** — no console:

```js
AtlasHttp.clearCache();
// derruba o CoinGecko: sobrescreve seus métodos para rejeitar
["global","topMovers","assetFull","chart"].forEach(m=>{ P.get("coingecko")[m]=()=>Promise.reject(new Error("429")); });
AcademyData.global().then(g=>assert(g && g.marketCap>0,"fallback global sem CoinGecko"));
AcademyData.asset("solana").then(a=>assert(a && a.symbol==="SOL","fallback asset via Paprika"));
```
Esperado: `OK` — a fachada entrega dado mesmo com CoinGecko fora.

- [ ] **Step 6: Commit**

```bash
git add academy/js/market-data.js academy/dev/provider-check.html
git commit -m "Academy: fachada de dados única (AcademyData) sobre a cadeia de fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Shell do Academy + roteador de hash (remove as teses)

**Files:**
- Rewrite: `academy/index.html`
- Rewrite: `academy/js/academy.js`
- Delete: `core/entities/theses.js` (e qualquer dado/entidade só das teses)

**Interfaces:**
- Consumes: shell/estilos do ATLAS (`core/ui/*`), `AcademyData`, os provedores.
- Produces: `window.AcademyRouter` com `go(hash)` e render em `#view`; duas rotas
  que delegam a `renderDashboard(el)` e `renderAsset(el, id)` (Tasks 11–13; aqui
  só o esqueleto que chama placeholders `"Carregando…"`).

- [ ] **Step 1: Reescrever `academy/index.html`** — manter o cabeçalho/carregamento
  global do ATLAS (copiar do index atual), **trocar** os `<script>` finais:
  remover `../core/entities/theses.js` e o `js/academy.js` antigo; **incluir**, na
  ordem: `../core/http.js` (se ainda não), `../core/providers/registry.js`,
  os provedores (`feargreed`, `coingecko`, `coinpaprika`, `binance`, `coinlore`,
  `defillama`), `../core/providers/id-map.js`, `js/market-data.js`,
  `js/academy-chart.js` (Task 12), `js/dashboard.js`, `js/asset-page.js`,
  `js/academy.js`. Título → "ATLAS — Academy". Sidebar: manter logo/voltar,
  remover a `nav` de teses. Topbar: manter a searchbox (vira busca de ativo).

- [ ] **Step 2: Reescrever `academy/js/academy.js`** — roteador de hash (DOM seguro, sem `innerHTML`):

```js
(function () {
  "use strict";
  var view = document.getElementById("view");
  function clear(node){ while (node.firstChild) node.removeChild(node.firstChild); }
  var routes = {
    "": function (el) { window.renderDashboard ? renderDashboard(el) : (el.textContent="Carregando…"); },
    "ativo": function (el, id) { window.renderAsset ? renderAsset(el, id) : (el.textContent="Carregando…"); }
  };
  function parse() { var h = (location.hash||"#/").replace(/^#\/?/, ""); var p = h.split("/");
    return { name: p[0]||"", arg: p[1]||"" }; }
  function render() { var r = parse(); clear(view); (routes[r.name]||routes[""])(view, r.arg); }
  window.AcademyRouter = { go: function (hash) { location.hash = hash; } };
  window.addEventListener("hashchange", render);
  // busca no topo → autocomplete simples (implementado na Task 11) → navega
  var box = document.getElementById("globalSearch");
  if (box) { box.placeholder = "Pesquisar ativo (ex.: SOL, AAVE)…";
    var t; box.addEventListener("input", function () { clearTimeout(t); var q = box.value.trim();
      t = setTimeout(function () { if (q.length >= 2 && window.__academySearch) __academySearch(q); }, 250); });
    box.addEventListener("keydown", function (e) { if (e.key === "Enter" && window.__academySearchFirst) __academySearchFirst(); });
  }
  render();
})();
```

- [ ] **Step 3: Deletar `core/entities/theses.js`** e conferir que nada mais o
  referencia: `grep -rn "theses" --include=*.html --include=*.js .` deve
  retornar vazio (ou só docs). Ajustar `sw.js` se ele listar o arquivo no cache.

- [ ] **Step 4: Verificar no navegador** — abrir `http://localhost:8777/academy/`.
  Esperado: shell do ATLAS aparece, `#view` mostra "Carregando…", **console sem
  404** (nada de theses.js). Navegar para `#/ativo/solana` → "Carregando…".

- [ ] **Step 5: Commit**

```bash
git add academy/index.html academy/js/academy.js
git rm core/entities/theses.js
git commit -m "Academy: novo shell + roteador de hash; aposenta a biblioteca de teses

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Tela Dashboard (faixa de mercado + painéis)

**Files:**
- Create: `academy/js/dashboard.js`
- Rewrite: `academy/css/academy.css` (estilos do command center / HUD)

**Interfaces:**
- Consumes: `AcademyData`, `AcademyRouter.go`.
- Produces: `window.renderDashboard(el)`; e o autocomplete de busca
  `window.__academySearch(q)` / `window.__academySearchFirst()`.

- [ ] **Step 1: Implementar `renderDashboard(el)`** (DOM seguro: `createElement`/`textContent`) — montar:
  - faixa de mercado: `Promise.all([AcademyData.ticker(), AcademyData.global(), AcademyData.feargreed()])`.
  - painéis: `gainers`, `rwa`, `losers`, `abnormalVolume`, `categories`.
  - cada linha de ativo com `onclick` → `AcademyRouter.go("/ativo/" + row.id)`.
  - cada painel com 3 estados (carregando / dado / indisponível + botão "tentar de novo").
  - auto-refresh: `setInterval` a cada 60s **só enquanto a rota for a home**
    (limpar o intervalo no `hashchange`).
  - autocomplete: `__academySearch(q)` chama `AcademyData.search(q)` e mostra
    lista sob a searchbox (nós criados via `createElement`); clicar →
    `AcademyRouter.go("/ativo/"+id)`. `__academySearchFirst()` navega para o 1º resultado.

- [ ] **Step 2: Implementar CSS** do dashboard (grid de painéis, faixa superior,
  linhas de tabela, cores de alta/baixa usando tokens de `css/variables.css`).

- [ ] **Step 3: Verificar no navegador** — `http://localhost:8777/academy/`.
  Esperado (com internet): faixa com BTC/ETH/SOL/marketcap/dominância/vol/F&G,
  painéis preenchidos com dado real, %24h coloridas. Clicar numa linha vai para
  `#/ativo/<id>`. `read_console_messages` sem erro.

- [ ] **Step 4: Verificar estado de erro** — no console, derrubar os provedores de
  `rankings` (`P.chainFor("rankings").forEach(p=>p.topMovers=()=>Promise.reject(new Error("x")))`),
  recarregar a home. Esperado: painéis de ranking mostram "indisponível" +
  "tentar de novo", **sem tela branca**.

- [ ] **Step 5: Screenshot + commit**

```bash
git add academy/js/dashboard.js academy/css/academy.css
git commit -m "Academy: dashboard command center (faixa de mercado + painéis)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Gráfico SVG próprio (sem dependência)

**Files:**
- Create: `academy/js/academy-chart.js`

**Interfaces:**
- Produces: `window.AcademyChart.line(container, points, opts)` — desenha um SVG
  de linha responsivo a partir de `points: [[ts, price]]`; `opts` com cor e se é
  alta/baixa. Sem lib externa. SVG criado com `createElementNS` (sem `innerHTML`).

- [ ] **Step 1: Teste (console, em qualquer página do Academy)**

```js
var d = document.createElement("div"); d.style.width="400px"; d.style.height="160px"; document.body.appendChild(d);
AcademyChart.line(d, [[1,10],[2,12],[3,9],[4,15]], { up:true });
assert(d.querySelector("svg path"), "AcademyChart desenha um <path>");
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** — normalizar pontos para o viewBox, gerar `path`
  `d="M.. L.."`, eixo mínimo (min/max preço, primeiro/último tempo), área sob a
  linha com gradiente, cor por `opts.up`. Redesenhar em `resize` (ResizeObserver).
  Elementos SVG via `document.createElementNS("http://www.w3.org/2000/svg", ...)`.
- [ ] **Step 4: Rodar teste.** Esperado: `OK` e uma linha visível.
- [ ] **Step 5: Commit**

```bash
git add academy/js/academy-chart.js
git commit -m "Academy: gráfico de linha em SVG próprio, sem dependência

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Tela Página do ativo (topo + gráfico + 5 abas)

**Files:**
- Create: `academy/js/asset-page.js`
- Modify: `academy/css/academy.css` (estilos da página do ativo)

**Interfaces:**
- Consumes: `AcademyData.asset`, `AcademyData.chart`, `AcademyChart.line`, `AcademyRouter`.
- Produces: `window.renderAsset(el, id)`.

- [ ] **Step 1: Implementar `renderAsset(el, id)`** (DOM seguro) —
  - carregar `AcademyData.asset(id)`; estado carregando/indisponível.
  - topo: imagem, nome, símbolo, selo `classification` (Cripto|RWA), preço
    grande, %24h colorida, botão voltar (`AcademyRouter.go("/")`).
  - gráfico: seletor de período `[1,7,30,90,180,365]` (rótulos 24h/7d/30d/3m/6m/1a);
    ao trocar, `AcademyData.chart(id, asset.symbol, dias)` → `AcademyChart.line`.
  - blocos de variação por janela (`asset.change`) + ATH/ATL com data e % desde.
  - abas (Mercado/Dados/On-chain/Fundamentos/Sobre) conforme a tabela da spec;
    **todo campo nulo renderiza "indisponível"** (helper `val(x, fmt)`);
    contratos com link para explorador quando a chain for conhecida (mapa
    chain→baseUrl: ethereum→etherscan.io/token/, solana→solscan.io/token/, etc.).

- [ ] **Step 2: Implementar CSS** da página (topo, grid de métricas, abas, área do gráfico).

- [ ] **Step 3: Verificar no navegador** — `http://localhost:8777/academy/#/ativo/solana`.
  Esperado: página cheia com preço, gráfico que troca de período, abas navegáveis,
  campos preenchidos. Testar também uma RWA (ex.: `#/ativo/ondo-finance`) e um id
  inválido (`#/ativo/zzz`) → "indisponível", sem quebrar. `read_console_messages` limpo.

- [ ] **Step 4: Verificar fallback do gráfico** — no console, derrubar
  `P.get("coingecko").chart=()=>Promise.reject(new Error("x"))`, recarregar a
  página do ativo. Esperado: gráfico ainda aparece (via Binance) para SOL.

- [ ] **Step 5: Screenshot + commit**

```bash
git add academy/js/asset-page.js academy/css/academy.css
git commit -m "Academy: página dedicada do ativo (topo, gráfico e 5 abas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Integração com o ATLAS (menu, service worker, limpeza)

**Files:**
- Modify: onde o menu do ATLAS lista o Academy (conferir; provável `js/atlas-nav.js`).
- Modify: `sw.js` (cachear os novos arquivos do Academy; remover teses do cache).

**Interfaces:**
- Consumes: navegação existente do ATLAS.

- [ ] **Step 1: Conferir o link do Academy no menu** — `grep -rn "academy" js/ core/ pages/ --include=*.js --include=*.html`. Garantir que o item aponta para `academy/index.html` e o rótulo/descrição reflitam "central de mercado" (não "teses").

- [ ] **Step 2: Atualizar `sw.js`** — acrescentar ao precache os arquivos novos
  (provedores, `market-data.js`, `dashboard.js`, `asset-page.js`,
  `academy-chart.js`, `academy.css`) e **remover** `theses.js`. Subir a versão
  do cache do SW (mesmo padrão dos commits anteriores).

- [ ] **Step 3: Verificar** — abrir o ATLAS pela raiz (por http), ir ao menu,
  entrar no Academy, navegar dashboard→ativo→voltar. Recarregar offline (DevTools)
  e confirmar que o shell abre do cache (dados podem ficar "indisponível" offline,
  o que é correto). Console sem 404.

- [ ] **Step 4: Commit**

```bash
git add js/atlas-nav.js sw.js
git commit -m "Academy: entra no menu como central de mercado e no service worker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] Abrir o ATLAS por http (nunca `file://`), entrar no Academy pelo menu.
- [ ] Dashboard: faixa e todos os painéis com dado real; %24h coloridas; clique leva ao ativo.
- [ ] Página do ativo: cripto (SOL) e RWA (ex.: ONDO) com gráfico trocando período e 5 abas.
- [ ] Forçar 429 no CoinGecko (sobrescrever métodos) e confirmar que dashboard e
      página do ativo continuam entregando dado pelos fallbacks.
- [ ] Campos sem dado aparecem como "indisponível", nunca inventados, nunca tela branca.
- [ ] `grep -rn "theses"` limpo (sem referências órfãs).
- [ ] Console sem erros/404 em dashboard e página do ativo.
