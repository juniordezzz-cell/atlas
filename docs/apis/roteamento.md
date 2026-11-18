# Roteamento de dados do ATLAS (08/11/2026)

Status: **implementado para as 8 ferramentas da bancada** em `core/atlas-dados.js`
(`window.AtlasDados`, testes em `core/testes/atlas-dados.test.cjs`), aprovado
pelo dono em 08/11/2026. Hold, DeFi, Trade, RWA, Dashboard e Carteiras seguem
na cadeia de preço de 16/10 (`core/atlas-precos.js`); a página Mercado segue na
`tryChain` do registro de provedores (decisão 3 abaixo ainda pendente).

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
| **Busca de token** (nome ou sigla) | catálogo local dos 500 maiores (`core/dados/tokens-top.js`, sem rede) | CoinGecko (cache 24 h) | CoinPaprika | — | 24 h | "não achei"; pode digitar o preço à mão |
| **Lista dos maiores** (top N com variação) | catálogo local + preço e variação da DefiLlama em lote | — | — | instantâneo embutido (`snap.json`) | 2 min | instantâneo embutido, com a data dele |
| **Ficha do token** (market cap, oferta, ATH) | CoinPaprika (lista de 250, 2 min) + máx./mín. 24 h da Binance | CoinGecko | — | — | 2 min | última ficha com data; "indisponível" nos campos que faltarem |
| **Velas e gráfico** (15m a semanal) | Binance (último preço precisa bater em 8%) | DefiLlama (só fechamento, até 500 pontos) | CoinGecko | — | — | sem gráfico, a conta continua |
| **Histórico longo** (anos) | Binance (semanal + diário, preço conferido) | DefiLlama `/chart` (contado a partir de hoje, até 500 pontos) | CoinGecko (≤365 dias) | — | 10 min | — |
| **Câmbio** (real, dólar, euro, libra) | open.er-api *(já existe em `core/currency.js`)* | Binance (`USDTBRL`, `EURUSDT`, `GBPUSDT`) | CoinGecko `exchange_rates` | — | 1 h | última cotação com data; campo editável |
| **USDT e USDC** (modo câmbio do Conversor) | cadeia de preço (DefiLlama primeiro) | | | | 60 s | 1 dólar |
| **Selic, CDI, IPCA** | Banco Central | — | — | — | 12 h | último valor com data |
| **Pools e APR** | DefiLlama Yields | — | — | — | 30 min | último valor com data; APR editável |
| **Categorias/setores** | CoinGecko *(já existe, guardado em `atlas-setores.js`)* | — | — | — | 7 dias | categoria guardada |
| **Medo e ganância** | alternative.me *(já existe)* | — | — | — | 1 h | último valor com data |
| **Medo e ganância, histórico inteiro** (`medoGanancia`) | alternative.me (`limit=0`, diário desde 02/2018) | — | — | — | 1 h | última série guardada (`atlas.dados.fng.v1`), com a data |
| **Velas longas** (`velasLongas`, anos de 15m a 1w, OHLC + volume) | Binance, página por página (1000 velas por pedido, até 25 páginas) | — | — | — | 10 min | sem gráfico daquele tempo; o resto da tela segue |

### Ajustes feitos na construção (em relação à proposta)
- **Busca:** CoinGecko antes da CoinPaprika — os ids da CoinGecko servem direto
  na DefiLlama e trazem imagem; a busca é rara, fica 24 h em cache e o
  disjuntor pula a CoinGecko quando ela está no limite.
- **Lista dos maiores:** sai a CoinLore. O catálogo local já tem os 500 nomes e
  imagens; preço e variação vêm da DefiLlama em 5 pedidos de lote.
- **DefiLlama `/chart`:** aceita no máximo 500 pontos e devolve vazio quando o
  início é anterior ao token; por isso o roteador sempre conta para trás a
  partir de agora (`end=`).

### Proteções comuns a todas as cadeias
- **Fila por fonte** (por página): intervalo mínimo entre pedidos — CoinGecko
  6 s, GeckoTerminal 2,5 s, CoinLore e open.er-api 1 s, CoinPaprika 0,4 s,
  Banco Central 0,2 s, DefiLlama 0,15 s, Binance 0,06 s.
- **Disjuntor** (combinado entre as abas por `atlas.dados.pausa.<fonte>`):
  fonte que devolveu 429 fica pulada por 3 minutos; rede fora ou erro 5xx, por
  1 minuto. Erro 4xx comum (ex.: par inexistente na Binance) não pausa.
- **Último dado bom:** `atlas.dados.ultimo.v1` (preço por token, ficha, câmbio,
  Selic), no máximo 400 entradas; a lista dos 500 não entra.
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
| Medo e Ganância | | | | | ✔ (`velasLongas`) | ✔ (`velasLongas` diário desde 2018) | | | |

## 3. Antes × depois (onde a CoinGecko saiu da frente)

| Tela | Antes, ao abrir | Com o roteador (medido em 08/11) |
|---|---|---|
| Conversor | 4–5 pedidos à CoinGecko (preço, mercado, gráfico, câmbio; mais 2 páginas de 250 na busca) | 0 à CoinGecko: preço DefiLlama, câmbio open.er-api, ficha CoinPaprika, gráfico Binance |
| Escada e Pool | 2 páginas de 250 na CoinGecko (lista) + velas Binance + série DefiLlama | 0 à CoinGecko: lista e variação DefiLlama, velas Binance |
| Lucro, Staking | busca + preço + câmbio na CoinGecko | 0 à CoinGecko: busca local, preço DefiLlama, câmbio open.er-api |
| Comparador | lista, busca, câmbio e xStocks na CoinGecko | 0 à CoinGecko: históricos Binance e DefiLlama (xStocks diários desde 07/2025), CDI do Banco Central, câmbio open.er-api, faixa de cima CoinPaprika |
| Simulador | busca e preço na CoinGecko, velas Binance | 0 à CoinGecko: busca local, preço DefiLlama, velas Binance |
| Mercado | CoinGecko primeiro em rankings, ficha e gráfico (cadeia `tryChain` já tem reservas) | **não mudou** (decisão 3) |

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
