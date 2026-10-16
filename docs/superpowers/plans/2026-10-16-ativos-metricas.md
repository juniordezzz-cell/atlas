# Hold: Ativos (mesa + fichas) e Métricas (risco) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativos com a mesa "Posições e watchlist" + fichas com gráfico de 30 dias; Métricas com volatilidade, pior queda, pior dia, correlação e contribuição ao risco em 90 dias.

**Architecture:** dois módulos novos no core: `atlas-series.js` (busca e cache enxuto das séries diárias e das variações 24h/7d) e `atlas-risco.js` (contas puras, testadas em Node). As páginas `ativos.js` e `metricas.js` desenham a tela já com o que tem e redesenham quando os dados chegam.

**Tech Stack:** HTML/CSS/JS puro, sem build; CoinGecko via `AtlasProviders.get("coingecko")`; testes com `node`.

**Spec:** `docs/superpowers/specs/2026-10-16-ativos-metricas-design.md`

## Global Constraints

- Ativos: só as colunas Ativo · "Preço · 24h · 7d" · Result. · Trade; fichas com ticker + resultado, linha de 30 d, "US$ 26 · 48%". Nada além.
- Trade = `Forms.trade(id, "buy")` (a janela troca para venda).
- Risco: 90 dias, quantidades de hoje, carteira do seletor central (`S.get.walletPositions()`), √365, janela comum ≥ 30 dias.
- Stablecoin (`AtlasSetores.de(a).setor === "Stablecoin"`) fora do mapa de correlação, dentro do resto.
- Nunca número inventado: falha da CoinGecko vira aviso + "Tentar de novo".
- Visual sereno (sem glow); ícone do token via `data-atlas-token`; pt-BR com vírgula.
- `hold/index.html`: `hold-90` → `hold-91` e os dois scripts novos depois de `atlas-setores.js`.

## Review Focus

- CoinGecko devolvendo 429 no meio da carga: a tela mostra o que chegou e lista o resto como "fora do cálculo" (teste Task 2 com falha simulada).
- Ativo novo com 12 dias de histórico entre ativos de 90: janela comum ≥ 30 → ele sai e é listado (teste Task 1).
- Série com dia faltando (buraco): só entram dias presentes em todas as séries (teste Task 1).
- Carteira com uma stablecoin e um volátil: volatilidade menor que a do volátil sozinho; correlação vazia (teste Task 1).
- Busca + filtro Watchlist: fichas mostram a frase, não um cartão vazio (conferência Task 3).

---

### Task 1: Contas de risco (puras)

**Files:** Create `core/atlas-risco.js`, `hold/testes/risco.test.js`

**Interfaces — Produces:** `AtlasRisco.calcular(itens) -> resultado | null`
- `itens: [{ label, qtd, serie: [{ d: "YYYY-MM-DD", p: number }], stable?: bool }]`
- `resultado: { dias, inicio, fim, volatilidade /*fração/ano*/, piorQueda: { pct, pico, fundo } /*pct ≤ 0*/, piorDia: { pct, d }, correlacao: { labels, m /*matriz*/ }, contribuicao: [{ label, peso, risco }] /*fração, somam 1*/, fora: [label] }`
- `null` quando nenhum item tem ≥ 2 dias.
- Janela: interseção das datas; se < 31 datas, remove o item de série mais curta e tenta de novo (vai para `fora`).

- [ ] **Step 1: teste** — com `global.window = global`:
  - 2 ativos, 4 dias, A preços 100,110,99,99 qtd 1; B 50,50,50,50 qtd 2 → mas < 31 dias ⇒ usar série de 40 dias gerada: A alterna +10%/−10%, B constante (stable:true). Esperado: `fora` vazio, `correlacao.labels` = ["A"] (B stable fora), `contribuicao` de B = 0 e de A = 1, `volatilidade` > 0 e menor que a de A sozinho.
  - `piorQueda`: série 100,120,90,95,… → pct = 90/120−1 = −0,25, `pico`/`fundo` nas datas certas.
  - `piorDia` = menor retorno diário e a data dele.
  - Ativo C com 12 dias junto de A/B com 40 → C em `fora`, `dias` = 40.
  - Buraco: A sem o dia 10 → `dias` = 39.
  - Correlação de duas séries idênticas = 1 (±1e-9); opostas = −1.
- [ ] **Step 2:** `node hold/testes/risco.test.js` → falha (`AtlasRisco` indefinido).
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → "ok".

### Task 2: Séries e variações (CoinGecko + cache)

**Files:** Create `core/atlas-series.js`; Modify `core/providers/coingecko.js` (`chart(id, days, o)` aceita `o.ttl`; novo `variacoes(ids)`); Modify `hold/testes/risco.test.js`

**Interfaces — Produces:**
- `AtlasSeries.diaria(points) -> [{ d, p }]` — último ponto de cada dia UTC (puro).
- `AtlasSeries.idDe(ativo) -> string | null` — `cg_id` ou `AtlasTokens.cgId(ticker)`; `null` se `tipo` ≠ "Cripto".
- `AtlasSeries.carregar(ids, onParcial?) -> Promise<{ series: { id: [{d,p}] }, falhas: [id] }>` — cache `atlas.series.v1` (6 h, só pontos diários, 90 d); busca numa fila única do site (4 s entre pedidos; para no primeiro 429 e espera 1 min), chama `onParcial(series)` a cada chegada; erro de um id vai para `falhas` sem parar os outros.
- `AtlasSeries.variacoes(ids) -> Promise<{ id: { h24, d7 } }>` — um lote; rejeita em erro.
- `coingecko.variacoes(ids)` — `/coins/markets?vs_currency=usd&ids=…&price_change_percentage=24h,7d`, ttl 120000.

- [ ] **Step 1: teste** — `diaria` com pontos de 3 dias (vários por dia) → 3 itens, cada um o último do dia; `carregar` com provider falso (um id rejeita com status 429) → `falhas` = [esse id], o outro em `series`, e segunda chamada vem do cache sem chamar o provider.
- [ ] **Step 2:** rodar → falha. **Step 3:** implementar (provider falso via `AtlasProviders.get` substituível; espera de 1,2 s configurável por `AtlasSeries._espera` para o teste). **Step 4:** rodar → "ok".

### Task 3: Aba Ativos — mesa + fichas

**Files:** Modify `hold/js/pages/ativos.js` (`listView`; sai `faixaResumo`), `hold/css/components.css`

**Interfaces — Consumes:** `AtlasSeries.idDe/carregar/variacoes`, `Forms.trade`.

- [ ] **Step 1:** cabeçalho (Atualizar preços, Watchlist, Registrar compra — os três de hoje), filtros + busca; grade `g-12` com cartão "Posições e watchlist" (`col-7`) e "Uma ficha por ativo" (`col-5`), eyebrow "ATIVOS". Mesa: linha com `U.assetCell` compacto (ícone + ticker), "2,43 -1,2% +4,0%", Result. em % (watchlist: "0,90 · watchlist" e "—"; vendido: "—"), botão "Trade". Fichas: posições abertas filtradas pela busca; em Watchlist/Vendidos, frase curta. Linha da ficha: últimos 30 pontos da série, verde se fim ≥ início. Enquanto a série não chega, ficha sem linha e "carregando"; não cripto: "preço informado".
- [ ] **Step 2: conferir no navegador** (`?atlas-dev=1`): colunas exatamente as do esboço, Trade abre a janela com Comprar/Vender, linha abre o ativo, fichas com linha, 1600 e 375 px, console limpo.

### Task 4: Aba Métricas — laboratório de risco

**Files:** Modify `hold/js/pages/metricas.js` (reescrita do corpo; mantém cabeçalho e botões), `hold/css/components.css`, `hold/index.html`

**Interfaces — Consumes:** `AtlasSeries.carregar`, `AtlasRisco.calcular`, `AtlasSetores.de`.

- [ ] **Step 1:** linha de base "Últimos N dias de preço, com as quantidades de hoje — como esta carteira teria se comportado."; faixa de 3 números (Volatilidade "68% ao ano"; Pior queda "-31%" com "de 02/08 a 21/08"; Pior dia "-12%" com a data), cada um com uma frase; mapa de calor de correlação (até 8 maiores, azul único, valor no `title`, frase "Quanto mais escuro, mais os dois sobem e caem juntos."); barras "De onde vem o risco" (risco % e peso % lado a lado); "fora do cálculo: …"; estados: carregando, falha com "Tentar de novo", vazio zerado, 1 ativo (frases).
- [ ] **Step 2:** versão `hold-91` + scripts novos em `hold/index.html`.
- [ ] **Step 3: conferir no navegador:** 4 e 10 posições, uma não cripto, falha simulada da CoinGecko, claro/escuro, 375 px, console limpo; conferir à mão um número (volatilidade de 1 ativo) contra a série baixada.
- [ ] **Step 4:** todos os testes Node "ok"; mostrar capturas ao dono antes de commitar.
