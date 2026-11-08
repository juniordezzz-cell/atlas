# Roteamento de dados do ATLAS (proposta de 08/11/2026)

Status: **proposta para o dono revisar.** Nada disto está implementado ainda,
exceto o que está marcado como "já existe".

A tela pede um **tipo de dado**; o roteador tenta as fontes na ordem abaixo e
devolve a primeira resposta boa. Toda resposta boa é guardada como "último dado
bom", com data, para quando todas as fontes falharem.

O id de referência de um token continua sendo o da CoinGecko (`solana`,
`bitcoin`). DefiLlama aceita esse id direto (`coingecko:solana`); Binance usa o
símbolo (`SOLUSDT`); CoinPaprika e CoinLore usam o tradutor que já existe em
`core/providers/id-map.js`.

## 1. Cadeia por tipo de dado

| Tipo de dado | 1ª fonte | 2ª | 3ª | Última | Cache | Se tudo falhar |
|---|---|---|---|---|---|---|
| **Preço atual** (1 ou vários tokens) | DefiLlama, em lote *(já existe)* | Binance (pares USDT) | CoinPaprika | CoinGecko | 60 s | último preço com data; campo para digitar |
| **Preço de token só de DEX** | GeckoTerminal *(já existe)* | DefiLlama (endereço do contrato) | — | — | 60 s | último preço com data |
| **Busca de token** (nome ou sigla) | lista local dos ~500 maiores (sem rede) | CoinPaprika | CoinGecko | — | 24 h | "não achei"; pode digitar o preço à mão |
| **Lista dos maiores** (top N com market cap e variação) | CoinLore | CoinPaprika | CoinGecko | lista embutida (`snap.json`) | 10 min | lista embutida, com a data dela |
| **Ficha do token** (market cap, oferta, ATH) | CoinPaprika | CoinLore | CoinGecko | — | 1 h | última ficha com data; "indisponível" nos campos que faltarem |
| **Velas e gráfico** (15m a semanal) | Binance | DefiLlama (série diária) | CoinGecko (≤365 dias) | — | 1–5 min | último gráfico guardado; sem gráfico, a conta continua |
| **Histórico longo** (anos) | Binance (semanal) | DefiLlama `/chart` | CoinGecko (≤365 dias) | — | 6 h | último histórico guardado |
| **Câmbio** (real, dólar, euro, libra) | open.er-api *(já existe em `core/currency.js`)* | Binance (`USDTBRL`, `EURUSDT`, `GBPUSDT`) | CoinGecko `exchange_rates` | — | 1 h | última cotação com data; campo editável |
| **Câmbio "cripto"** (via stablecoin) | Binance `USDTBRL` | DefiLlama (preço do USDT) | CoinGecko | — | 60 s | igual ao câmbio |
| **Selic, CDI, IPCA** | Banco Central | — | — | — | 12 h | último valor com data |
| **Pools e APR** | DefiLlama Yields | — | — | — | 30 min | último valor com data; APR editável |
| **Categorias/setores** | CoinGecko *(já existe, guardado em `atlas-setores.js`)* | — | — | — | 7 dias | categoria guardada |
| **Medo e ganância** | alternative.me *(já existe)* | — | — | — | 1 h | último valor com data |

### Proteções comuns a todas as cadeias
- **Fila por fonte:** no máximo N pedidos por minuto a cada fonte, somando
  todas as telas abertas (CoinGecko ~10/min, GeckoTerminal 25/min, CoinPaprika
  e CoinLore espaçados, DefiLlama e Binance folgados).
- **Disjuntor:** fonte que devolveu 429 ou ficou fora fica pulada por 3 minutos.
- **Pedido igual ao mesmo tempo vira um só:** duas telas pedindo o preço de SOL
  no mesmo segundo recebem a mesma resposta.
- **Respostas grandes não entram no cache comum** do `AtlasHttp` em
  localStorage (listas de 250 tokens, velas, pools); ficam em memória e o
  "último dado bom" guarda só o essencial.
- **A tela sabe de onde veio** (para mostrar "fonte: Binance · 14:32"), mas não
  escolhe a fonte.

## 2. O que cada ferramenta e tela usa

| Tela | Preço | Busca | Lista top | Ficha | Velas/gráfico | Histórico longo | Câmbio | Selic/CDI | Pools/APR |
|---|---|---|---|---|---|---|---|---|---|
| Conversor e Câmbio | ✔ | ✔ | ✔ | ✔ | ✔ | | ✔ (os dois) | | |
| Escada · DCA | ✔ | ✔ | ✔ | | ✔ | ✔ (DCA no tempo) | | | |
| Estratégia de Pool | ✔ | ✔ | ✔ | | ✔ | | | | ✔ |
| Lucro Cripto | ✔ | ✔ | | | | | ✔ | | |
| Staking | ✔ | ✔ | | | | | ✔ | | |
| Juros Compostos | | | | | | | | ✔ | |
| Comparador de Ativos | ✔ | ✔ | | | | ✔ | ✔ | ✔ | |
| Simulador de Trade | ✔ | ✔ | | | ✔ | | | | |
| Calculadora de Market Cap | ✔ | ✔ | ✔ (ranking) | ✔ | | | | | |
| Scanner Pools | ✔ | | | | | | | | ✔ (servidor) |
| Hold, Trade, RWA, DeFi, Dashboard, Carteiras | ✔ *(já pela cadeia)* | ✔ | | ✔ (autocomplete) | | | ✔ | | |
| Mercado | ✔ | ✔ | ✔ | ✔ | ✔ | | | | |

## 3. Hoje × proposta (onde a CoinGecko sai da frente)

| Tela | Hoje, ao abrir | Com o roteador |
|---|---|---|
| Conversor | 4–5 pedidos à CoinGecko (preço, mercado, gráfico, câmbio; mais 2 páginas de 250 na busca) | preço DefiLlama, gráfico Binance, câmbio open.er-api/Binance, ficha CoinPaprika; CoinGecko só se tudo falhar |
| Escada e Pool | 2 páginas de 250 na CoinGecko (lista) + velas Binance + série DefiLlama | lista CoinLore → CoinPaprika; resto igual |
| Lucro, Staking | busca + preço + câmbio na CoinGecko | busca local/CoinPaprika, preço DefiLlama, câmbio open.er-api |
| Comparador | lista, busca, câmbio e xStocks na CoinGecko | histórico Binance/DefiLlama; xStocks pela DefiLlama `/chart` (a conferir); câmbio open.er-api |
| Simulador | busca e preço na CoinGecko, velas Binance | busca local/CoinPaprika, preço DefiLlama, velas Binance |
| Mercado | CoinGecko primeiro em rankings, ficha e gráfico (cadeia `tryChain` já tem reservas) | trocar a ordem: CoinLore/CoinPaprika/Binance antes |

## 4. Pontos para o dono decidir

1. **Chave "Demo" da CoinGecko pelo servidor.** Dá 100 pedidos por minuto, mas
   não pode ficar no navegador (regra 6). Caminho possível: uma Edge Function no
   Supabase que repassa os pedidos à CoinGecko com a chave guardada lá, como já
   é feito com o OpenRouter. Vale a pena, ou ficamos só com as fontes sem chave?
2. **Uso "não comercial" da CoinPaprika grátis.** Se o ATLAS for vendido, a
   CoinPaprika grátis pode não servir; a CoinLore e a DefiLlama não têm essa
   restrição publicada.
3. **Ordem do Mercado.** Hoje a página Mercado põe a CoinGecko na frente. Trocar
   a ordem muda de onde vêm os números do Mercado (ligeiras diferenças de preço
   e market cap entre as fontes).
