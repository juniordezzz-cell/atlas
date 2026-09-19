# Central RWA — Fontes verificadas

> O que foi **realmente testado** com chamada real, e não o que a documentação promete.
> Atualize sempre que uma fonte for sondada de novo (`python -m central_rwa probe`) ou mudar de comportamento.
> Os limites em uso estão em `central-rwa/backend/config/providers.yaml`.

## Verificadas em 2026-09-19 (chamada real, sem chave)

| Fonte | Capacidade | Endpoint | Resultado | Limite observado | Observações |
|---|---|---|---|---|---|
| **xStocks** | catálogo | `GET api.xstocks.fi/api/v2/public/assets?page=N` | ✅ 928 ativos, 10 páginas | Cabeçalho `x-ratelimit-limit: 1000`, reinicia em ~1 min | `pageSize` máx. 100. Traz `underlyingSymbol` (ticker da ação) e contratos em 11 redes (Solana, Ethereum, BNB, Arbitrum, Optimism, Mantle, Ink, HyperEVM, XLayer, TON, Tron). **Não emite na Robinhood Chain.** |
| xStocks | preço | `GET .../public/assets/{symbol}/price-data` | ❌ não usado | — | Demorou ~20 s e devolveu `{"quote": null}` com o mercado fechado (sábado). `/public/wallets` deu 404: as carteiras públicas do emissor precisam de outro caminho (Fase 2). |
| **DexScreener** | preço de token | `GET api.dexscreener.com/tokens/v1/{chain}/{a,b,...}` | ✅ NVDAx/Solana US$ 222,45, liquidez US$ 2,15M | Documentado: 300/min | Até 30 endereços por chamada. Ids de rede: `solana`, `ethereum`, `bsc`, `robinhood`. Não achou NVDAx em Ethereum/BNB (sem pool). |
| **DefiLlama** | preço de token | `GET coins.llama.fi/prices/current/{chain:addr,...}` | ✅ NVDAx 222,42 em Solana/Ethereum/BNB; XAUT 4.373; PAXG 4.366 | Sem limite publicado | Só preço (sem volume/liquidez). Traz `confidence`. Rede: `robinhood` existe. |
| **GeckoTerminal** | preço de token | `GET api.geckoterminal.com/api/v2/networks/{net}/tokens/multi/{a,b}` | ✅ NVDAx 222,55, volume 24h US$ 4,9M | Documentado: 30/min | Ids: `solana`, `eth`, `bsc`, `robinhood`. **Preço ruim em pools rasas**: SPYx na BNB = 1.567 (real ~767) e AAPLx na BNB = 0,07. Por isso ficou como 3ª fonte. |
| **CoinGecko** (sem chave) | catálogo por categoria, preço | `/coins/markets?category=`, `/coins/list?include_platform=true`, `/simple/token_price/{platform}` | ⚠️ funciona, mas **deu 429 depois de ~6 chamadas**, mesmo com ritmo de 3/min | Muito baixo sem chave | Categorias úteis: `ondo-tokenized-assets` (250), `robinhood-chain-stocks-ecosystem` (193), `bstocks-ecosystem` (72), `tokenized-gold`, `tokenized-silver`, `tokenized-commodities` (43), `tokenized-treasuries`, `tokenized-money-market-fund-mmfs`. `tokenized-t-bills` veio **vazia**. **Recomendação forte: criar a chave Demo.** |
| **Yahoo (yfinance 1.7)** | histórico diário, cotação | biblioteca `yfinance` | ✅ NVDA, GC=F, CL=F, SPY: 2.514 pregões em 10 anos (2016-09-19 → 2026-09-18) | Não oficial; bloqueia IP por excesso | NVDA 222,27, igual ao token (222,45), o que confirma a premissa da seção 7. |
| **Tesouro dos EUA** | taxas de T-bills | `home.treasury.gov/.../daily-treasury-rates.csv/{ano}/all?type=daily_treasury_bill_rates` | ✅ 14.074 taxas de 2016 a 2026 | — | Prazos 4, 6, 8, 13, 17, 26 e 52 semanas. Usamos o "COUPON EQUIVALENT". A API Fiscal Data (`avg_interest_rates`) veio vazia com o filtro testado e não foi adotada. |

## Implementadas, mas NÃO sondadas (precisam de chave)

Escritas a partir da documentação pública. Ao cadastrar a chave, rode `python -m central_rwa probe --dry-run` e registre o resultado aqui.

| Fonte | Variável | Capacidade | Status |
|---|---|---|---|
| Tiingo | `TIINGO_KEY` | histórico diário | ⏳ aguardando chave |
| Twelve Data | `TWELVEDATA_KEY` | histórico diário, cotação (inclui XAU/USD) | ⏳ aguardando chave |
| Finnhub | `FINNHUB_KEY` | cotação | ⏳ aguardando chave |
| FRED | `FRED_KEY` | petróleo (DCOILWTICO, DCOILBRENTEU), T-bills (DTB4WK, DTB3, DTB6, DTB1YR) | ⏳ aguardando chave |

## Da seção 17 da especificação, fora da Fase 1

| Fonte | Motivo |
|---|---|
| CoinPaprika | A busca por símbolo redireciona (301) e o preço exige id próprio; não mapeia contrato → token. Reavaliar. |
| Stooq | Passou a exigir chave via captcha (abr/2026). Fica como reserva, se o Yahoo falhar muito. |
| Alpha Vantage, EODHD, Marketstack, Polygon | Limites gratuitos muito baixos para 10 anos × dezenas de ativos. Reserva. |
| Ondo GM API | Acesso gratuito não confirmado. A Ondo entra pelo catálogo da CoinGecko. |
| Blockscout, Etherscan, Alchemy, Helius, Moralis, Bitquery | Fase 2 (fluxo on-chain). |
| Notícias (Finnhub news, Marketaux, etc.) | Fase 7. |

## Achados das execuções de teste (2026-09-19)

- **Catálogo:** 4.051 tokens nas 4 redes (xStocks 2.784 + CoinGecko 1.265 + 2 overrides).
  - Por rede: Solana 1.178, Ethereum 1.430, BNB 1.250, Robinhood Chain 193.
  - 250 sem mapeamento e 117 mapeamentos de baixa confiança, para revisar.
- **Camada B:** 2.057 de 3.801 tokens têm preço em alguma fonte. Os outros ~1.700 não têm pool, ou seja, existem no contrato mas não negociam. 64 ativos passaram do piso de US$ 100 mil.
- **Divergência entre fontes:** na Robinhood Chain, 1–5% entre DexScreener e GeckoTerminal (pools rasas, fim de semana). Os tokens xStocks podem ficar um pouco acima da ação por causa do **multiplicador de dividendos**: SPYx 767 vs SPY 761,7.
- **Tickers estranhos** para revisar em `mapping_overrides.yaml`: `SPCX` (SpaceX, sem ação listada), `SKHY` / `SKYHY`, `BRK.B`.
