# Proposta: preço atual DefiLlama-primeiro no ATLAS inteiro (16/10/2026)

Status: **aprovada e implementada em 16/10/2026** (Scanner: opção a — tag incluída em
`Ferramentas/scanner-pools/index.html`, arquivo não commitado por ter trabalho de outra sessão).
Testes: `node core/testes/precos.test.js` → `ok` (14 casos).

## O que existe hoje (lido no código)

| Caminho | Arquivo | Pedido à CoinGecko |
|---|---|---|
| Cadeia central, ativo com id curado | `core/atlas-precos.js` `deVarios` → `coingecko.pricesRaw` | 1 `simple/price` em lote |
| Cadeia central, ativo sem id (busca) | `core/atlas-price.js` `bySymbol` | **2 por ativo**: `search` (cache 24 h) + `simple/price?ids=<um>` |
| Hold ao abrir (`refreshIfStale` → `refreshPrices`) | `hold/js/state.js:775-782` | 1 `simple/price` em lote, direto no provedor, fora da cadeia |
| Autocomplete (Hold, Trade, RWA) | `AtlasPrecos.de(coin.symbol)` | joga fora o `coin.id` exato e cai na busca se o símbolo não está na tabela → 2 pedidos |
| Market cap no autocomplete do Hold | `AtlasAssets.priceFull` | 1 `coins/markets` por seleção (fica: só ela tem market cap) |
| Pool do DeFi (preço de base/quote) | `defi/js/pools.js:532` `AtlasPrice.bySymbol` | 2 por token, fora da cadeia (sem manual) |
| Reserva da tela Carteiras | `js/carteiras.js:980` `AtlasAssets.price` | só se a cadeia não carregou |

Páginas que carregam a cadeia: `defi/{index,lending,pool,pools,staking,testes}.html`, `pages/{dashboard,carteiras,testes-contas-cenario,testes-oraculo}.html`, `RWA/index.html`, `trade/index.html`, `Ferramentas/scanner-pools/index.html`, `hold/index.html`. Só o Hold carrega `core/providers/defillama.js`.

## O que foi medido no navegador (localhost, 16/10)

- `coins.llama.fi/prices/current/coingecko:<id>,...` com CORS, sem chave.
- 15 ids da carteira de teste: 14 achados (o inexistente volta ausente, sem erro), ~1,3 s.
- Top 100 da CoinGecko: 100/100 achados; maior diferença para a CoinGecko 0,65% (STX); nenhum acima de 3%.
- **Limite**: 200 ids (URL de 4,3 KB) passa; 250 ids (5,4 KB) volta **400**. Lotes de 100.
- Cada preço traz `timestamp` (visto entre 18 s e 9 min de idade) e `confidence` (0,99 nos grandes).

## Proposta

### 1. `core/providers/defillama.js` ganha `precosAtuais(cgIds)`
Lotes de 100 ids, `ttl` 60 s, chave de cache com ids ordenados. Devolve `{ id: usd }`.
Descarta preço com `confidence < 0,9` ou `timestamp` com mais de 1 h — esses caem na reserva.
**Propaga** o erro quando todos os lotes falham (mesma regra do `pricesRaw`: falha de rede não pode virar "sem preço").

### 2. Cadeia (`core/atlas-precos.js`) — ordem nova
1. manual (inalterado) · 2. stablecoin = 1 (inalterado)
3. id curado → **DefiLlama em lote**; os ids que ela não trouxe → CoinGecko em lote (`pricesRaw`); se a DefiLlama caiu, todos vão à CoinGecko (como hoje)
4. busca por símbolo → a CoinGecko só **acha o id** (`search`, cache 24 h); o preço desses ids entra no **mesmo lote** do passo 3 em vez de um `simple/price` por ativo
5. DEX (GeckoTerminal) para quem sobrou + conferência de divergência dos que vieram da busca (inalterado, limite 3%)

`fonte` continua `"registro"`/`"busca"` (as telas não mudam); `detalhe[s].provedor` passa a dizer `"defillama"` ou `"coingecko"`.

### 3. Duas entradas novas na cadeia, para ninguém precisar furar
- `AtlasPrecos.porIds([{ simbolo, id }])` — para o Hold: manual vence, resto vai no lote do passo 3. O `refreshPrices` deixa de chamar `coingecko.pricesRaw` direto; `precoFonte` vira `"defillama"`/`"coingecko"` conforme quem respondeu.
- `AtlasPrecos.de(sim, { id })` — o autocomplete de Hold/Trade/RWA passa o `coin.id` que já tem; não cai mais na busca.

### 4. `core/atlas-price.js` `bySymbol`
Continua usando a busca da CoinGecko para achar o id, mas o preço vem de `precosAtuais` (CoinGecko só se a DefiLlama não trouxer). Assim o DeFi (`pools.js`) e a reserva das Carteiras também deixam de fazer `simple/price` por ativo, sem mexer neles.

### 5. Carregar `core/providers/defillama.js` (com `?v=`) antes de `atlas-price.js` nas 14 páginas acima.

### 6. Fica na CoinGecko, com cache longo
Busca/autocomplete (24 h, já é), market cap (`priceFull`, 2 min → **1 h**), categorias/setores (`assetFull`, já guardado por `atlas-setores.js`), ícones (`atlas-token-icons.js`, já tem cache próprio), câmbio (`currency.js`, fora do escopo).

### Opcional (não incluído sem você pedir)
Preço de uma data (`AtlasPrecos.emData`) também pode ir para `coins.llama.fi/prices/historical/<timestamp>/coingecko:<id>` com a CoinGecko `/history` de reserva — hoje é 1 pedido por ativo e por data.

## Testes
`core/testes/precos.test.js` (Node, padrão de `hold/testes/*.test.js`, com `AtlasHttp` falso):
manual vence DefiLlama; stable não vai à rede; DefiLlama responde tudo → zero chamadas à CoinGecko; DefiLlama sem um id → só esse vai à CoinGecko; DefiLlama fora → lote CoinGecko; as duas fora → `erro` preenchido e nada vira zero; confiança baixa/preço velho → reserva; lote de 230 ids → 3 pedidos; busca resolve id e o preço vem do lote; divergência busca × DEX acima de 3% continua indo para `divergentes`.

## Conferência no navegador (`?atlas-dev=1`)
Abrir Hold, Dashboard, Carteiras, Trade, RWA, DeFi (pools e pool) e Scanner; em cada uma, listar pedidos de rede e confirmar: nenhum `simple/price` com um id só; preço atual saindo de `coins.llama.fi/prices/current`.

## Ponto que precisa de decisão
`Ferramentas/scanner-pools/index.html` tem alterações de outra sessão ainda não commitadas. Incluir a tag `<script>` lá mistura com o trabalho alheio no mesmo arquivo. Opções: (a) incluir e **não** commitar esse arquivo, avisando; (b) deixar o Scanner para depois.

## Resultado medido (16/10, `?atlas-dev=1`)
- Hold ao abrir: 12 ativos num único `coins.llama.fi/prices/current`, nenhum pedido de preço à CoinGecko; `precoFonte` = `defillama` em todos.
- DeFi (pools): `AtlasPrice.bySymbol("AERO")` e `deVarios([BTC, PENDLE, VIRTUAL, USDC, ZRO])` → CoinGecko só em `search` (AERO, ZRO); preços em 2 pedidos à DefiLlama; GeckoTerminal só confere o ZRO (veio da busca).
- Dashboard, Carteiras, Trade, RWA, Scanner: `defillama.js` carregado, sem pedido à CoinGecko ao abrir.
- `defi/testes.html` 429/429; `pages/testes-contas-cenario.html` sem falhas.
