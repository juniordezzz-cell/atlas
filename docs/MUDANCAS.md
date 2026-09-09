# ATLAS — correções de carteira + performance de pool

> **Nota (estado atual).** A parte de carteira deste documento é
> **histórica**. O seletor por módulo descrito abaixo não existe mais: hoje
> há **um** componente compartilhado (`wallets/walletSelector.js` +
> `wallets/walletSelector.css`) usado por Dashboard, Hold, Trade, DeFi, RWA
> e Relatórios, e nenhum CSS de módulo tem regra de carteira. As classes
> `.wsel*`, `.wallet-sel`, `.wallet__*` e `.w-*` citadas aqui foram
> removidas. Os arquivos `js/wallets.js`, `core/ui/atlas-wallet-dialog.js` e
> `RWA/components/shell.js` foram apagados. Para o estado atual, veja
> **`MUDANCAS_WALLETS.md`**.

## 1. Sete falhas corrigidas

| # | Arquivo | Problema | Correção |
|---|---------|----------|----------|
| 1 | `defi/css/global.css` | `.wsel-menu { display:flex }` sem prefixo sobrescrevia o `display:none` — o menu de carteira ficava **permanentemente aberto**. Mais 7 linhas duplicadas. | Prefixo `.wsel.open` restaurado; duplicatas removidas. *(hoje: bloco inteiro removido — o CSS é do componente)* |
| 2 | `defi/js/data.js` | `_localWalletId` era variável de memória e o seletor dá `location.reload()` logo depois de trocar: a carteira **Local era impossível de selecionar**. | Persiste em `atlas_defi_local_wallet`. |
| 3 | `hold/js/state.js` | Mesmo padrão. O Hold é SPA, então funcionava na sessão e **morria no F5**. | Persiste em `atlas_hold_local_wallet`. |
| 4 | `trade/assets/js/core/state.js` | `syncWithCentral()` fazia `state.currentWallet = activeGlobalId()` sem condição — **pisava na isolada salva em todo boot**. | Isolada do Trade manda; nos outros casos a global da central manda. |
| 5 | `js/wallets.js`, `walletSelector.js`, `rwa-app.js`, `atlas-shell.css` | `document.addEventListener("click")` **dentro** da função de render: um listener novo por render, preso a nós removidos, fechando cego sem `contains()`. | `AtlasCloseMenus` virou o utilitário único. *(hoje: `js/wallets.js` apagado; o componente usa clique delegado no host e uma convenção só, `.awsel[data-open]`)* |
| 6 | `defi/configuracoes.html` | A página monta o seletor de carteira mas não carregava o diálogo → **TypeError** ao clicar em "Nova carteira Local". | Scripts adicionados. *(hoje o arquivo é `wallets/walletDialog.js`, e o componente registra um erro claro no console se ele faltar)* |
| 7 | `defi/js/dashboard.js`, `defi/js/pool.js` | `currentValue` era gravado na criação da pool e **nunca atualizado**. Como `varAtivos = atual − inicial − taxas`, registrar US$ 5,62 de taxa mostrava **−US$ 5,62** de variação de ativos. Era também a causa do "Lucro Total US$ 0". | Recalculado com preço do CoinGecko via `DeFiPerf`. |

## 2. Arquivos novos

- **`core/providers/defillama.js`** (282 linhas) — provedor registrado com capacidade `"pools"`, como o `registry.js` já documentava. Endpoint `yields.llama.fi/pools`, público, sem chave; cobre Orca, Raydium, Meteora, Kamino, Uniswap, Aerodrome, PancakeSwap, Curve, Camelot em Solana/Ethereum/Base/Arbitrum/Polygon/Optimism/BNB/Avalanche.
  - `ttl: 0` de propósito: a resposta crua tem dezenas de MB e no cache do `AtlasHttp` estouraria a cota do localStorage do ATLAS inteiro. Só o resultado enxuto é guardado.
  - **Sem lista branca de protocolos**, também de propósito: os slugs mudam de versão (`aerodrome-v1` → `aerodrome-slipstream`) e uma lista branca falharia em silêncio, parecendo queda de rede. Filtra por chain + TVL + par de dois tokens; os nomes conhecidos só rotulam e ordenam.
- **`defi/js/tokens.js`** (267 linhas, 78 tokens) — registro símbolo→id do CoinGecko em três camadas: override manual → tabela curada → busca do `AtlasPrice`. É o que impede ETH/WETH, BTC/WBTC/cbBTC e stETH/wstETH de calcularem com o preço do ativo errado.
- **`defi/js/performance.js`** (177 linhas) — motor puro, sem DOM e sem rede.

## 3. Como a performance é calculada

```
custo      = qtdEntradaA×precoEntradaA + qtdEntradaB×precoEntradaB
benchmark  = qtdEntradaA×precoAtualA   + qtdEntradaB×precoAtualB
real       = qtdAtualA×precoAtualA     + qtdAtualB×precoAtualB     (se informada)
pnlMercado = (real ?? benchmark) − custo
IL         = real − benchmark                                       (só no modo real)
pnlTotal   = pnlMercado + taxasColetadas        ← pendente fica fora, mostrada à parte
```

Dois modos, e a tela **sempre diz qual está em uso**:

- **Benchmark HODL** (padrão) — "quanto eu teria se não tivesse feito pool". Honesto e útil, mas diverge da corretora com o tempo, porque numa pool concentrada as quantidades mudam sozinhas.
- **Real** — quando você informa a composição atual. Bate com a corretora e ainda entrega o impermanent loss.

A composição de `pnlTotal` espelha a Orca de propósito: no print, `5,91 = 0,62 (unrealized) + 5,29 (realized)`, com a pendente de `0,33` à parte.

## 4. Na tela

- Painel **"Performance dos ativos"** na página da pool: custo de entrada, variação de cada lado isolada, PnL de mercado, IL, taxas coletadas/pendentes, PnL total, selo dentro/fora da faixa.
- Campos editáveis de composição atual e faixa min/max.
- Wizard: busca de pool no catálogo DefiLlama + autocomplete nativo de token (`<datalist>` — zero CSS, funciona igual em `file://`).
- Faixa min/max com **seletor de denominação**: a pool cota uma razão ("SOL per ORCA"), e sem saber qual token é o numerador a faixa inverte e o selo sai errado.

## 5. Código morto removido — 17 arquivos, 1.664 linhas

Nenhum tinha tag `<script>`, rota, ou carregamento dinâmico (o projeto não usa `import()` nem `createElement("script")` em lugar nenhum, então as tags são a verdade completa).

- `RWA/`: `js/app.js`, `js/router.js`, `js/view-{dashboard,portfolio,journal,asset,narrative,risk,macro}.js` — versão antiga duplicada dentro do `rwa-app.js`, que define o seu próprio `Shell` e `Router`. (`components/shell.js` sobreviveu a esta limpeza e foi apagado depois, junto com o seletor duplicado do RWA.)
- `hold/js/pages/`: `watchlist.js`, `carteira.js`, `estudos.js`, `configuracoes.js`
- `trade/modules/`: `estudos/` e `configuracoes/`. O `ATLAS.estudos = ATLAS.teses` do `teses.js:278` já cobria as chamadas antigas em `rd.js`, `trades.js` e `dashboard.js`.

  **Correção deste registro:** as duas pastas continuam no disco — foram
  desligadas (nenhuma tag `<script>`/`<link>` aponta para elas), não apagadas.
  `trade/modules/configuracoes/configuracoes.js:37` ainda escreve
  `class="wallet__swatch"`, classe que deixou de existir junto com o CSS de
  carteira do Trade. Como o arquivo não é carregado, isso não afeta nada em
  execução — mas se for reativado um dia, o seletor de lá nasce sem estilo.
  Apagar as duas pastas resolve; ficou de fora por não ser assunto de
  carteira.

## 6. Verificação executada

- 100% dos JS passam no `node --check`.
- Nenhuma referência quebrada: todo `src=`/`href=` de todo HTML aponta pra arquivo existente.
- Motor de performance testado com o exemplo real: 2 SOL a $75 + 100 ORCA a $1,20, SOL indo a $80 → **+$10,00 exato**. Modo real, IL e selo de faixa conferidos.
- Filtro do DefiLlama testado com amostra: aceitou 6, rejeitou corretamente TVL baixo, pool de 3 tokens, chain fora da lista e token único. Mapeamento `BSC → BNB` e slug→rótulo conferidos.
- Registro de tokens testado: as 14 variantes críticas resolvem certo, desconhecido cai na busca, override tem prioridade e persiste.

## 7. Dois pontos que exigem seu olho

1. **Os ids do CoinGecko da tabela curada valem conferida** nos tokens que você mais usa. Só entrou id que eu tenho confiança, mas conferir é barato e o override manual (`DeFiTokens.definir("SIMBOLO","id")`) existe exatamente pra isso.
2. **Se o "Atualizar lista" falhar em `file://`** por CORS, a mensagem já explica e a lista local continua valendo. Nesse caso o caminho é servir a pasta por um servidor local (`python -m http.server`), que resolve de vez — e vale pra todas as chamadas de API do ATLAS, não só essa.
