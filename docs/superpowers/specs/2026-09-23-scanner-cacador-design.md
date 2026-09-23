# Scanner Pools — de lista manual a caçador de oportunidades

Data: 23/09/2026 · Status: aprovado em conversa, aguardando revisão da spec

## Problema

O Scanner Pools (`Ferramentas/scanner-pools/index.html`) mostra 93 pools e perde
oportunidades boas (ex.: UNI/WBNB na PancakeSwap/BNB Chain). Diagnóstico medido:

1. **É uma lista manual.** O Descobrir mostra só o que está gravado no
   `localStorage` (`estudo_pools_liquidez_v1` = 93 pools). A atualização diária
   renova números e nunca adiciona pool. Pool nova só entra por "Buscar pools
   novas" com confirmação.
2. **A busca é estrangulada.** Padrão: no máximo 30 pools por busca, no total
   (top 30 por TVL somando todas as fontes), TVL mínimo US$ 1 mi, 2 páginas
   (40 pools) por DEX na GeckoTerminal.
3. **O universo é grande.** Em 23/09/2026: das 80 primeiras pools da
   PancakeSwap v3/BSC, 72 passam em TVL ≥ US$ 100 mil e volume ≥ US$ 50 mil/dia;
   pela DefiLlama, 1.296 pools passam nas 10 redes do Scanner.
4. **Há muito lixo.** Na PancakeSwap v2/BSC a maioria das pools com volume é
   memecoin/token recém-criado.
5. Os painéis "Revisar pools que não atualizaram", "Buscar pools novas" e "Ler
   print" são ferramentas de manutenção expostas na tela principal de um
   produto que será vendido; o "Ler print" (OCR) não funciona bem.

## Decisões do dono

| Tema | Decisão |
|---|---|
| Modelo do Descobrir | Lista ao vivo + **acompanhamento automático**: toda pool que passa no filtro ganha uma leitura por dia, por 30 dias, sem o usuário favoritar. Estrela e níveis viram só destaque para o Radar. |
| Memecoin / token novo | **Dois trilhos**: Sólidas (padrão) e Caça (aba à parte). Camada de segurança barra nos dois. |
| Painéis | Remover "Revisar", "Buscar pools novas" e "Ler print". Manter "+ Pool" discreto para pool que nenhuma fonte cobre. |
| Onde roda | **Coletor no servidor** (GitHub Actions + Supabase), reaproveitando o backend da Central RWA. |

## Arquitetura

```
GitHub Actions (a cada 4 h)
  └─ python -m central_rwa pools
        DefiLlama /pools ──┐
        GeckoTerminal ─────┼─► pré-corte ─► segurança dos tokens ─► trilho + nota
                           │                 (cache 7 dias)
                           └────────────────────────────────────► Supabase
                                                                   pools, pool_leituras, tokens
Scanner (navegador)  ◄── visões públicas scanner_* (chave publicável, só leitura)
  localStorage: estrelas, níveis, notas, lista de tokens, pools manuais
```

### Coletor (`central-rwa/backend/central_rwa/pools/`)

1. **DefiLlama** `GET https://yields.llama.fi/pools` (uma chamada): pools das
   redes Solana, Base, Arbitrum, BSC, Ethereum, OP Mainnet, Polygon, Avalanche,
   Sui, Hyperliquid L1 e Robinhood Chain, nas DEXes que a DefiLlama cobre com
   volume (lista `LLAMA_ALLOWED_PROJECTS` atual do Scanner). Campos: `pool` (ID),
   `symbol`, `project`, `chain`, `poolMeta` (fee), `tvlUsd`, `volumeUsd1d`,
   `volumeUsd7d`, `apyBase7d`/`apyBase`/`apy`, `apyReward`, `underlyingTokens`.
2. **GeckoTerminal** `GET /networks/{net}/dexes/{dex}/pools?page=N` para as
   DEXes de `GECKO_SOURCES` (PancakeSwap nas 4 redes, Uniswap na Robinhood,
   Meteora, Velodrome, THENA), **até 10 páginas por DEX**, espaçadas para
   respeitar ~30 req/min, com espera e nova tentativa em 429. A taxa sai do
   nome ("USDT / WBNB 0.01%"), como já faz `geckoCand`.
3. **Pré-corte**: TVL ≥ US$ 100.000 **e** volume 24 h ≥ US$ 50.000.
4. **Segurança dos tokens** (GeckoTerminal `/networks/{net}/tokens/{addr}/info`,
   uma chamada por token, cache de 7 dias na tabela `tokens`): honeypot,
   mint/freeze authority, participação do desenvolvedor, idade, market cap,
   holders, `coingecko_coin_id`. Preço/mcap em lote por
   `/tokens/multi/{…}` (até 30), como o provedor atual.
5. **Classificação** (regras abaixo) e **nota**.
6. **Gravação**: upsert em `pools`; uma linha por pool por dia em
   `pool_leituras` (última leitura do dia vence); apaga leituras com mais de 30
   dias. Pool que não aparece em 3 coletas seguidas vira `ativa = false` e sai
   das visões; o histórico fica até expirar.
7. **Coleta parcial**: se uma fonte/DEX falhar, grava o resto e registra
   `status_coleta` (rede, DEX, ok/parcial/falhou, horário) para a tela mostrar.

Agendamento: `.github/workflows/scanner-pools.yml`, cron a cada 4 h, no grupo
de concorrência `central-rwa-db`, pulando com aviso se `SUPABASE_DB_URL` não
estiver configurada (mesmo padrão dos jobs da Central RWA).

### Supabase

Migration nova em `central-rwa/supabase/migrations/`:

- `pools` — `id` (texto: `llama:<id>` ou `gecko:<net>:<endereço>`), rede, dex,
  par, token_a/token_b (endereço + símbolo), fee, tvl, vol_24h, vol_7d,
  apr, apr_reward, trilho (`solida` | `caca` | `barrada`), motivos (texto[]),
  nota (0–100), componentes da nota, ativa, visto_em, falhas_seguidas.
- `pool_leituras` — pool_id, dia, tvl, vol_24h, vol_7d, apr, fee.
- `tokens` — rede, endereço, símbolo, flags de segurança, idade_dias, mcap,
  holders, coingecko_id, consultado_em.
- `status_coleta` — fonte, rede, dex, estado, contagem, horário.
- Visões públicas `scanner_pools` (ativas e não barradas),
  `scanner_leituras` (últimos 30 dias) e `scanner_status`, com `grant select`
  para o papel anônimo, como `crwa_*`.

## Regras do filtro

### Camada 1 — barrada (sem exceção)

- Qualquer token com honeypot, mint authority ativa, freeze authority ativa ou
  desenvolvedor com mais de 20%.
- Fee igual a zero, ou APR acima de 10.000% (erro de fonte).
- Volume/TVL acima de 50× em 3 leituras diárias seguidas (wash trading).

### Camada 2 — trilho

**Token sólido** se qualquer um:
- stable ou major (lista fixa: USDC, USDT, USDG, USD1, DAI, FDUSD, PYUSD,
  BTC, WBTC, cbBTC, BTCB, ETH, WETH, SOL, JitoSOL e LSTs, BNB, WBNB, AVAX,
  POL, SUI, HYPE — mantida no código, revisável);
- RWA conhecido (padrão `^[A-Z]{1,6}x$` dos xStocks, ouro, títulos — mesma
  regra de `autoCat`);
- os quatro juntos: ≥ 30 dias de existência, market cap ≥ US$ 10 mi,
  ≥ 1.000 holders, com `coingecko_coin_id`.

**Pool Sólida**: os dois tokens sólidos. **Pool Caça**: pelo menos um não.
Token sem informação de segurança → Caça (nunca Sólida).

### Camada 3 — lista do usuário (navegador)

Aprovar um token → as pools dele contam como Sólidas. Bloquear → somem das
duas listas. Vale acima da camada 2; não libera o que a camada 1 barrou.
Guardada no `localStorage` e coberta pelo backup central.

### Nota 0–100

| Componente | Peso | Cálculo |
|---|---|---|
| Rendimento | 40% | eficiência %/dia (fee × volume/TVL, ou APR de LP nas ve(3,3)), normalizada por percentil entre as pools ativas |
| Consistência | 30% | 1 − coeficiente de variação da razão volume/TVL nas leituras dos últimos 7 dias (com menos de 3 leituras: 0,5) |
| Profundidade | 20% | log10(TVL), de US$ 100 mil (0) a US$ 100 mi (1) |
| Tendência | 10% | variação do TVL em 7 dias, de −30% (0) a +30% (1) |

A nota é calculada no coletor e gravada; a tela só exibe.

## Scanner (navegador)

### Descobrir
- Linha de status: horário da última coleta, total acompanhado, Sólidas, Caça
  e fontes parciais, se houver.
- Abas **Sólidas | Caça**; filtros atuais (rede, plataforma com contagem real,
  categoria, TVL mínimo, busca, "Razão ≥ 2×").
- Tabela atual + coluna **Nota** (ordem padrão) + tendência de 7 dias vinda de
  `scanner_leituras`.
- Clique na pool abre o painel de evolução (o do Radar) com estrelar, nível e
  bloquear token.
- Na aba Caça, colunas de sinais: idade do token, market cap, variação 24 h,
  compradores × vendedores (dados da GeckoTerminal, gravados pelo coletor).
- **Removidos**: painéis "Revisar pools que não atualizaram", "Buscar pools
  novas", "Ler print" (e o Tesseract), atualização automática local de 24 h.
- **Mantido**: "+ Pool" (pool manual), discreto.

### Radar, Minhas pools, Guia
- Radar: pools estreladas ou com nível, com dados do servidor; manuais
  continuam com atualização à mão.
- Minhas pools: sem mudança.
- Guia: seção nova explicando fontes, as três camadas, os trilhos e a nota.

### Leitura e falha
- Leitura pelas visões `scanner_*` com `ATLAS_SUPABASE` (já existe).
- Cache da última leitura boa no `localStorage`; com o Supabase fora, mostra o
  cache com "dados de X horas atrás". Nunca uma tela vazia sem explicação.

### Transição dos dados atuais
Na primeira abertura após a mudança, cada pool gravada em
`estudo_pools_liquidez_v1` é casada com o servidor: primeiro por `srcId`
(`llama:…`), depois por rede + DEX + par normalizado (ETH/WETH, BNB/WBNB) +
fee. Casadas: estrela, nível e notas passam a ser chaveados pelo ID do
servidor; o histórico local anterior é mantido no painel de evolução. Não
casadas: viram pools manuais. Nada é apagado; a chave antiga fica como backup
até a próxima versão. O backup central passa a cobrir estrelas, níveis,
lista de tokens e manuais.

## Testes

- **Backend (pytest)**, com respostas gravadas das APIs, sem rede:
  pré-corte, camada 1, trilho de token e de pool, nota, casamento
  DefiLlama×GeckoTerminal, pool que some 3 vezes vira inativa, coleta parcial.
- **Site** (bateria de testes existente): migração dos 93 (casada / manual /
  nada apagado), leitura com Supabase fora usa o cache com aviso, lista de
  tokens (aprovar/bloquear) aplicada acima do trilho.
- **Verificação real**: uma execução do coletor e conferência de que pools da
  PancakeSwap/BNB Chain como UNI/WBNB aparecem, e de que a contagem Sólidas/Caça
  é plausível.

## Entrega em três partes

1. Coletor, tabelas, visões e job agendado — o site não muda.
2. Scanner lendo do servidor: trilhos, nota, remoção dos painéis.
3. Migração dos dados atuais, backup e Guia.

## Fora do escopo

- Previsão de preço e qualquer uso de IA (regras fixas e explicáveis).
- Capital mínimo para compensar o gás na Ethereum (pendência anterior).
- Alertas de virada de preço no trilho Caça (sugestão anterior; depois).

## Custos e limites

- GitHub Actions: 6 execuções/dia de ~8 min ≈ 1.450 min/mês somando a Central
  RWA. Gratuito em repositório público; em privado, o limite é 2.000 min/mês —
  se apertar, o cron passa para 6 h.
- GeckoTerminal: ~30 req/min; o coletor espaça as chamadas e usa cache de 7
  dias para tokens, então a maior parte das execuções só consulta tokens novos.
- Supabase: ~2.000 pools × 30 leituras ≈ 60 mil linhas em `pool_leituras`,
  dentro do plano gratuito.
