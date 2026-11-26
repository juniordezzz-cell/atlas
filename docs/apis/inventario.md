# Inventário de APIs do ATLAS (08/11/2026)

Uma seção por fonte. "Página" é o que roda no navegador (GitHub Pages);
"servidor" é o `central-rwa` (Python e Supabase), que pode guardar chave.
Limites com **(oficial)** vieram da documentação da própria API; com
**(não oficial)** são de terceiros ou da prática e precisam de folga.

Resumo de quanto cada uma aparecia no código da página em 08/11, antes do roteador:

| Fonte | Arquivos da página que chamam | Exige chave? |
|---|---|---|
| CoinGecko | 17 | não (opcional "Demo") |
| Binance | 6 | não |
| DefiLlama | 6 (+ provedor) | não |
| GeckoTerminal | 1 provedor, 15 páginas carregam | não |
| CoinPaprika | 1 provedor + id-map | não |
| CoinLore | 1 provedor + id-map | não |
| Banco Central (SGS) | 2 | não |
| open.er-api | 1 (`core/currency.js`) | não |
| alternative.me (medo e ganância) | 1 provedor | não |

---

## CoinGecko — `api.coingecko.com/api/v3`

- **Entrega:** preço, busca de token por nome, lista dos maiores com market
  cap, ficha do token (oferta, ATH, categorias, links), gráfico, câmbio
  (`exchange_rates`), ícones.
- **Chave:** não obrigatória. Sem chave o limite é **por endereço de internet,
  dividido com quem estiver no mesmo IP** (oficial). Com a chave grátis "Demo"
  (cabeçalho `x-cg-demo-api-key`) o limite sobe; o provedor do ATLAS já aceita
  a chave em `atlas.assets.cg_key.v1`, mas ela fica no navegador de cada um.
- **Limite:** sem chave, baixo e variável (na prática, um punhado de pedidos
  por minuto antes do 429). Demo: 100 por minuto pela página oficial de erros
  (uma página antiga ainda diz ~30; a CoinGecko aumentou em 17/05/2026)
  (oficial, com conflito). Histórico grátis só dos **últimos 365 dias**.
- **Ponto fraco:** é a fonte mais usada do ATLAS e a primeira da cadeia de
  quase tudo; qualquer tela pesada derruba as outras por alguns minutos.
- **Quem usa (página):**
  - Provedor `core/providers/coingecko.js` (capacidades: prices, search,
    rankings, global, assetDetail, chart, categories), carregado em Hold,
    DeFi, Trade, RWA, Dashboard, Carteiras, Mercado, Scanner Pools e
    Calculadora de Market Cap.
  - `core/atlas-precos.js` (reserva do preço atual e busca de id),
    `core/atlas-price.js`, `core/atlas-setores.js` (categorias),
    `core/atlas-token-icons.js` e `js/atlas-assets.js` (ícones e
    autocomplete), `core/currency.js` (reserva do câmbio).
  - As 8 ferramentas da bancada **não chamam mais a CoinGecko direto**: passam
    pelo roteador `core/atlas-dados.js`, onde ela é a última reserva (e a 2ª na
    busca de token fora do catálogo local).
- **Quem usa (servidor):** `central-rwa/backend/central_rwa/providers/coingecko.py`,
  `pools/fontes.py`.

## DefiLlama — `coins.llama.fi`, `yields.llama.fi`, `api.llama.fi`, `stablecoins.llama.fi`

- **Entrega:** preço atual em lote (`/prices/current/coingecko:<id>,...`, até
  ~200 ids por pedido; 250 volta 400), preço de uma data, séries
  (`/chart`), variação; pools e APR (`yields.llama.fi/pools`, ~10 MB); TVL,
  stablecoins, categorias DeFi.
- **Chave:** não. **Limite:** sem limite rígido publicado para o plano grátis
  (não oficial: entre ~300 por minuto e ~500 a cada 5 minutos). Cada preço
  traz `timestamp` e `confidence`.
- **Não tem:** busca por nome, market cap, ficha do token, velas OHLC.
- **Quem usa (página):** `core/providers/defillama.js` (preço atual da cadeia
  central desde 16/10, Mercado, DeFi); Escada e Estratégia de Pool (preço,
  série diária e APR das pools).
- **Quem usa (servidor):** `providers/defillama.py`, `pools/fontes.py`
  (Scanner Pools).
- **Mercado reformado (26/11/2026):** também `/overview/dexs` (volume de DEX
  24h, ~3 MB), `/overview/fees` (taxas 24h, ~6 MB) e
  `stablecoins.llama.fi/stablecoincharts/all` (total de stablecoins). Respostas
  de vários MB ficam **só em memória** por 5 a 10 min (o `localStorage` não
  comporta); a tela guarda o resumo em `atlas.mercado.v1`.
- **Mudanças da fonte vistas em 26/11/2026:** `/overview/derivatives` e
  `/summary/derivatives/*` passaram a responder **402 (pago)**; e o
  `/protocols` mostra TVL **zero** para BlackRock BUIDL, Ondo, Paxos Gold,
  Tether Gold e Circle USYC (RWA do Mercado passou para as categorias da
  CoinGecko).

## Hyperliquid — `api.hyperliquid.xyz/info` (POST)

- **Entrega:** `{"type":"metaAndAssetCtxs"}` devolve cada mercado de
  perpétuos com `dayNtlVlm` (volume em dólar 24 h); a soma é o volume da
  corretora. **Chave:** não. **CORS:** aberto.
- **Quem usa:** `core/providers/hyperliquid.js` (aba DeFi do Mercado), com
  cache de 5 min em memória. Entrou porque o volume de perpétuos da DefiLlama
  ficou pago.

## Binance — `data-api.binance.vision` (só cotações) e `api.binance.com`

- **Entrega:** preço e velas (`/api/v3/klines`, 15m a 1w, até 1000 velas,
  histórico longo) dos pares listados na Binance (`<SÍMBOLO>USDT`), e pares de
  moeda como `USDTBRL` e `EURUSDT`.
- **Chave:** não. **Limite:** 6.000 de "peso" por minuto por IP (oficial; um
  pedido de velas pesa 2). A `api.binance.com` é bloqueada em alguns países e
  redes; a `data-api.binance.vision` é a porta pública só de cotações.
- **Não tem:** token que não é listado na Binance (a maioria dos pequenos),
  market cap.
- **Quem usa (página):** `core/providers/binance.js` (Mercado, reserva da
  faixa de preços), Escada e Estratégia de Pool (velas), Comparador (histórico
  longo), Simulador de Trade (velas), Medo e Ganância (`velasLongas`: diário
  desde 2018 de 7 tokens ao abrir, cerca de 28 pedidos; intradiário sob demanda).

## CoinPaprika — `api.coinpaprika.com/v1`

- **Entrega:** preço com market cap e variação (`/tickers`), busca, ficha do
  token, gráfico.
- **Chave:** não. **Limite:** 20.000 pedidos por mês no grátis e 10 por segundo
  por IP (oficial); grátis cobre ~2.000 ativos e 1 ano de histórico diário.
  A página de preços fala em uso "pessoal e não comercial".
- **Quem usa (página):** `core/providers/coinpaprika.js` (Mercado e reserva da
  Calculadora de Market Cap), `core/providers/id-map.js` (tradução de id).

## CoinLore — `api.coinlore.net/api`

- **Entrega:** lista dos maiores com preço, market cap e variação
  (`/tickers/`), dados globais.
- **Chave:** não. **Limite:** sem limite publicado; recomenda espaçar os
  pedidos (~1 por segundo) (não oficial).
- **Quem usa (página):** `core/providers/coinlore.js` (Mercado), `id-map.js`.

## GeckoTerminal — `api.geckoterminal.com/api/v2`

- **Entrega:** preço de token de DEX (pela pool), pools.
- **Chave:** não. **Limite:** 30 pedidos por minuto (oficial).
- **Quem usa (página):** `core/providers/geckoterminal.js` — último degrau da
  cadeia de preço (tokens que só existem em DEX) e conferência de divergência.
- **Quem usa (servidor):** `providers/geckoterminal.py`, `pools/fontes.py`.

## Banco Central do Brasil (SGS) — `api.bcb.gov.br/dados/serie/bcdata.sgs.<n>`

- **Entrega:** Selic meta (série 432), CDI diário (12), IPCA (433).
- **Chave:** não. **Limite:** não publicado; responder em cache longo (horas).
- **Quem usa (página):** Juros Compostos (Selic), Comparador (CDI e IPCA).

## open.er-api — `open.er-api.com/v6/latest/USD`

- **Entrega:** câmbio de moedas (BRL, EUR, GBP…) contra o dólar, atualizado
  uma vez por dia.
- **Chave:** não. **Limite:** grátis com uso moderado; pede cache (não oficial).
- **Quem usa (página):** `core/currency.js` (câmbio do ATLAS inteiro; a reserva
  é a CoinGecko `exchange_rates`) e o roteador `core/atlas-dados.js` (câmbio
  das ferramentas: open.er-api → Binance → CoinGecko).

## alternative.me — índice de medo e ganância

- **Entrega:** o índice diário; com `limit=0`, o histórico inteiro desde 02/2018. **Chave:** não.
- **Quem usa:** `core/providers/feargreed.js` (Mercado, só o valor de hoje) e o
  roteador `core/atlas-dados.js` (`medoGanancia`, histórico inteiro, para a
  ferramenta Medo e Ganância).

---

## Só no servidor (`central-rwa`), nunca na página

| Fonte | Para quê | Chave |
|---|---|---|
| DexScreener (`api.dexscreener.com`) | pares de DEX | não |
| xStocks (`api.xstocks.fi`) | ações em token | não |
| Orca (`api.orca.so`), Raydium (`api-v3.raydium.io`) | pools diretas | não |
| RPC da Base (`mainnet.base.org`, Alchemy) | Aerodrome | Alchemy sim |
| Finnhub, Tiingo, FRED (`api.stlouisfed.org`), Twelve Data | mercado tradicional | sim (`providers/keyed.py`) |
| OpenRouter (`openrouter.ai`) | IA do Oráculo e do Scanner (Edge Functions) | sim, no Supabase |

## Infraestrutura (não é dado de mercado)

Firebase (login e Firestore: `identitytoolkit`, `firestore.googleapis.com`) e
Supabase (Edge Functions e banco). Ficam fora do roteador.

## Fontes das informações de limite

- CoinGecko: [erros e limites](https://docs.coingecko.com/docs/common-errors-rate-limit), [changelog](https://docs.coingecko.com/changelog.md)
- CoinPaprika: [planos da API](https://docs.coinpaprika.com/api-plans), [introdução REST](https://docs.coinpaprika.com/api-reference/rest-api/introduction)
- DefiLlama: [Pro API](https://docs.llama.fi/pro-api), [assinatura](https://defillama.com/subscribe)
