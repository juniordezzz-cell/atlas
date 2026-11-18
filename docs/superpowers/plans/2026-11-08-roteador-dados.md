# Roteador de dados do ATLAS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Nenhuma ferramenta da bancada chama API direto: tudo passa por `core/atlas-dados.js`, com reserva para cada tipo de dado, fila e pausa por fonte, e último dado bom guardado com data — o aviso "não foi possível carregar" só aparece quando não há nem fonte nem dado guardado.

**Architecture:** `core/atlas-dados.js` expõe `window.AtlasDados` em duas camadas. Baixo: `pedir(fonte, url, opts)` — fila por fonte (intervalo mínimo entre pedidos), disjuntor compartilhado entre abas (fonte que deu 429 fica pausada), pedido igual simultâneo vira um só, rede pelo `AtlasHttp`. Cima: um método por tipo de dado (`precos`, `buscar`, `ficha`, `velas`, `historico`, `cambio`, `serieBcb`), cada um com a cadeia de [docs/apis/roteamento.md](../../apis/roteamento.md) e com o último dado bom em localStorage. A lógica é criada por `AtlasDados.criar({ http, armazenamento, agora, intervalos })` para ser testada no Node com rede falsa.

**Tech Stack:** JS puro (IIFE), `node --test`, `AtlasHttp` (`core/http.js`).

**Spec:** [docs/apis/roteamento.md](../../apis/roteamento.md) (aprovado pelo dono em 08/11/2026: "Sim, pode construir").

## Global Constraints
- Nenhum `fetch(` nem URL de API nas ferramentas da bancada; só `AtlasDados`.
- CoinGecko é a última fonte em tudo que outra fonte entrega.
- Nenhuma chave de API no navegador. A decisão 1 do roteamento (chave Demo via Supabase) fica de fora até o dono decidir.
- Página Mercado e cadeia central (`core/atlas-precos.js`) **não mudam** nesta rodada (decisão 3 pendente).
- Chaves de localStorage: `atlas.dados.ultimo.v1` (último dado bom, só valores pequenos) e `atlas.dados.pausa.<fonte>` (disjuntor).
- Respostas grandes (velas, listas, pools) não entram no cache em localStorage do `AtlasHttp` (`ttl: 0`); o roteador guarda em memória.

## Review Focus
1. Fonte devolve 429: a próxima chamada a ela nem sai (pausada) e a reserva responde — teste `pedir` (Task 1).
2. Todas as fontes fora: volta o último dado bom com `salvo: true` e a data — testes de `precos` e `cambio` (Task 1).
3. Duas telas pedem a mesma coisa juntas: um pedido só — teste de duplicado (Task 1).
4. Token fora da Binance (velas): cai para CoinGecko/DefiLlama sem quebrar — teste de `velas` (Task 1).
5. Página sem rede ao abrir: ferramenta mostra o valor guardado com data, não o aviso — navegador (Task 5).

---

### Task 1: `core/atlas-dados.js` + testes

**Files:** Create `core/atlas-dados.js`, `core/testes/atlas-dados.test.cjs`; Modify `.github/workflows/ferramentas-calculos.yml` (rodar também este teste).

**Produces (`window.AtlasDados`):**
- `pedir(fonte, url, { ttl, timeout }) -> Promise<json>`; rejeita com `erro.pausada = true` sem rede se a fonte está pausada.
- `precos([{ id, sym }]) -> Promise<{ precos:{id:usd}, fontes:{id:nome}, salvos:[id], quando:{id:ms} }>` — DefiLlama lote → Binance (`<SYM>USDT`) → CoinPaprika (`/tickers?limit=250` por símbolo) → CoinGecko `simple/price` → último bom.
- `preco(id, sym) -> Promise<{ usd, fonte, quando, salvo } | null>`.
- `buscar(q) -> Promise<[{ id, sym, nome, img, rank, fonte }]>` — catálogo local (`window.ATLAS_TOKENS_TOP`) → CoinGecko `search` (24 h) → CoinPaprika `search`.
- `ficha(id, sym) -> Promise<{ usd, mcap, vol24, ch24, supply, ath, athDist, max24, min24, nome, sym, img, fonte, quando, salvo }>` — CoinPaprika ticker → CoinGecko `coins/markets` → último bom; `max24/min24` da Binance `ticker/24hr` quando listado.
- `velas(id, sym, intervalo, limite, precoRef) -> Promise<{ velas:[{t,o,h,l,c}], fonte }>` — Binance → CoinGecko `ohlc` → DefiLlama `chart` (só fechamento). Binance só vale se o último fechamento estiver a menos de 8% de `precoRef`.
- `historico(id, sym, dias) -> Promise<{ serie:[{t,v}], fonte }>` — Binance (semanal + diário) → DefiLlama `chart` → CoinGecko `market_chart` (≤365).
- `cambio() -> Promise<{ por:{ usd:1, brl, eur, gbp }, fonte, quando, salvo }>` (moeda por 1 dólar) — open.er-api → Binance (`USDTBRL`, `EURUSDT`, `GBPUSDT`) → CoinGecko `exchange_rates` → último bom.
- `serieBcb(numero, { ultimos | dataInicial, dataFinal }) -> Promise<{ dados, quando, salvo }>` — Banco Central → último bom (só `ultimos`).
- `pools() -> Promise<array>` — DefiLlama Yields, sem último bom (10 MB).
- `quandoTexto(ms) -> "08/11 às 14:32"`.
- `criar(opts)` — fábrica para testes.

- [ ] Testes (nomes): `pedir pausa a fonte depois de 429`, `pedir junta pedidos iguais`, `precos usa só a DefiLlama quando ela responde tudo`, `precos manda à Binance só quem faltou`, `precos devolve o último bom quando tudo falha`, `cambio cai para a Binance`, `cambio devolve o último bom`, `buscar acha no catálogo sem rede`, `velas pula a Binance quando o preço não bate`, `historico cai para a DefiLlama`.
- [ ] Ver falhar, implementar, ver passar; commit.

### Task 2: catálogo local `core/dados/tokens-top.js`
Gerado de `Ferramentas/_fonte-quadro/snap.json` por `core/dados/gerar-tokens-top.js` (formato `window.ATLAS_TOKENS_TOP = { quando, lista:[[id,sym,nome,imgSufixo,rank]] }`). Commit.

### Task 3: Conversor, Lucro, Staking, busca comum
`_comum/busca-token.js` passa a usar `AtlasDados.buscar` e `AtlasDados.preco`; Conversor usa `precos`/`ficha`/`historico`/`cambio`/`buscar`; Lucro e Staking usam `cambio` e `preco`; Juros usa `serieBcb`. Mostram "fonte · dd/mm às hh:mm" e, com dado guardado, nunca o aviso de erro. Commit por ferramenta.

### Task 4: Simulador e Comparador
Simulador: `buscar`, `preco`, `velas`. Comparador: `historico` para cripto e ações em token, `buscar`, `cambio`, `serieBcb`, `precos` no ticker. Commit.

### Task 5: Escada e Estratégia de Pool
No quadro, `getJSON` vira `AtlasDados.pedir` com a fonte certa; `fetchTop` passa a ser catálogo local + `precos`; `fetchMarkets` → `precos`; `fetchCandles`/`fetchDaily` com Binance → DefiLlama → CoinGecko por último; busca → `buscar`; APR → `pools`. Rebuild. Commit.

### Task 6: verificação, registro e revisão
Busca de `api.coingecko.com|coins.llama.fi|binance|coinpaprika|open.er-api|bcb` nas ferramentas da bancada (deve sobrar zero). Navegador: cada ferramenta com rede normal e com `AtlasDados` sem rede (valor guardado com data). Atualizar `docs/apis/*.md` (estado "implementado"), `docs/ferramentas-bancada-2026-11-08.md`, `sw.js`. Revisão final do ramo; publicar só com o "sim" do dono.
