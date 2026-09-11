# Design — Atlas Academy (command center de mercado)

- **Data:** 2026-09-11
- **Autor:** Junior + Claude (Opus 4.8)
- **Status:** aprovado para virar plano de implementação
- **Módulo:** `academy/` (reescrito — substitui a antiga biblioteca de teses)

---

## 1. Objetivo

Transformar o módulo `academy/` numa **central de pesquisa de mercado** — um
command center com visual HUD (referência premium fornecida pelo usuário), que
consome APIs gratuitas e serve como camada de inteligência/educação sobre ativos,
ao lado do ATLAS principal (que segue sendo o produto de gestão de carteira).

Cobertura da primeira versão: **cripto + RWA (ativos tokenizados)**, ambos via
CoinGecko como fonte primária, com **cadeia de fallback** para outras APIs
gratuitas. **Não** há ações de mercado tradicional cru — só o que existe
tokenizado. Ouro entra como ouro tokenizado (PAXG).

A antiga biblioteca de "teses" é **removida** (decisão do usuário: "é tudo novo").

## 2. Princípios (herdados da cultura do código do ATLAS)

1. **Nenhum módulo chama `fetch` direto.** Tudo passa por `AtlasHttp` (cache
   TTL + retry + timeout) e pelos provedores registrados em `AtlasProviders`.
2. **Nunca mentir com dado.** Campo que a API gratuita não entrega (holders,
   investidores institucionais, etc.) é exibido como **"indisponível"** — jamais
   inventado nem preenchido com número velho. (Ver comentários de
   `core/providers/coingecko.js` sobre não passar número desatualizado como atual.)
3. **Offline-first / sem build.** Vanilla JS puro, mesmos padrões do projeto,
   servido por http. Sem framework, sem passo de compilação.
4. **Rate limit é cidadão de primeira classe.** TTLs conservadores, chamadas em
   lote, atualização por intervalo (~60s), nunca por segundo.

## 3. Arquitetura

### 3.1 Camada de dados — cadeia de fallback por capacidade

Hoje `AtlasProviders.forCapability(cap)` devolve **o primeiro** provedor que
atende a capacidade. Estender para uma **cadeia**:

- Novo método `AtlasProviders.chainFor(cap)` → devolve **lista ordenada** de
  provedores que atendem `cap` (ordem de registro = ordem de preferência).
- Novo helper `AtlasProviders.tryChain(cap, methodName, args)` → tenta cada
  provedor da cadeia em ordem; se um rejeitar (erro/429/timeout) ou devolver
  vazio, passa ao próximo; só rejeita se **todos** falharem. Registra em
  console qual fonte respondeu (para diagnóstico), sem poluir a UI.
- `forCapability` continua existindo (compatibilidade com quem já usa).

### 3.2 Capacidades e provedores

| Capacidade | Primário | Fallback 1 | Fallback 2 |
|---|---|---|---|
| `prices` | CoinGecko | Binance `ticker/24hr` (keyless, só majors) | CoinPaprika |
| `chart` | CoinGecko `market_chart` | Binance `klines` (keyless, majors) | CoinPaprika histórico |
| `rankings` | CoinGecko `markets` | CoinPaprika `tickers` | CoinLore |
| `global` | CoinGecko `global` | CoinPaprika `global` | CoinLore `global` |
| `assetDetail` | CoinGecko `/coins/{id}` | CoinPaprika `/coins/{id}` | — |
| `search` | CoinGecko `search` | CoinPaprika `search` | — |
| `feargreed` | alternative.me | (fonte única, cache longo) | — |
| `onchainPrice` | CoinGecko | DefiLlama `coins.llama.fi` | — |

Provedores keyless (sempre respondem): **Binance, CoinPaprika, CoinLore,
DefiLlama, alternative.me**. CoinGecko segue primário por ter a **categoria RWA**
pronta e os metadados mais ricos. Se o usuário informar a demo key do CoinGecko
nas configurações, o limite sobe automaticamente (já suportado hoje).

### 3.3 Tradutor de identidade (id resolver)

Cada API nomeia o mesmo ativo de forma diferente (CoinGecko `solana`,
CoinPaprika `sol-solana`, Binance `SOLUSDT`). Componente novo
`core/providers/id-map.js`:

- Mantém o **id do CoinGecko como canônico**.
- Resolve para o id de cada fallback **pelo símbolo** (`SOL` → `SOLUSDT` na
  Binance; lookup por símbolo no catálogo do CoinPaprika/CoinLore).
- Cacheia o mapeamento (localStorage via `AtlasHttp`/store).
- Quando um fallback não conhece o ativo (RWA obscura fora da Binance), a cadeia
  segue adiante; se ninguém tiver, a UI mostra "indisponível". **Fallback ≠
  cobertura idêntica** — comportamento aceito e explícito.

### 3.4 Novos arquivos de provedor

- `core/providers/coingecko.js` — **estender** (não reescrever) com:
  `global()`, `topMovers({order, category, perPage})`, `categories()`,
  `assetFull(id)`, `chart(id, days)`. (Já tem `search`, `price`, `priceFull`,
  `prices`, `priceOn`.)
- `core/providers/binance.js` — novo. `prices(symbols)`, `chart(symbol, days)`.
- `core/providers/coinpaprika.js` — novo. `global`, `rankings`, `assetDetail`,
  `search`, `chart`.
- `core/providers/coinlore.js` — novo. `global`, `rankings`.
- `core/providers/defillama.js` — novo. `onchainPrice(contratos)`.
- `core/providers/feargreed.js` — novo. `feargreed()`.
- `core/providers/id-map.js` — novo. Tradutor de identidade.
- `core/providers/registry.js` — **estender** com `chainFor` e `tryChain`.

## 4. Telas

O Academy é uma **página única estilo SPA** (como o `academy.js` atual): shell do
ATLAS (sidebar + topbar), telas trocadas dentro de `#view` por **rota de hash**.
Duas telas apenas:

### 4.1 `#/` — Dashboard (command center)

- **Faixa de mercado no topo**, auto-refresh ~60s: BTC · ETH · SOL · Market Cap
  total · Dominância BTC · Volume 24h · Fear & Greed · Ouro (PAXG).
- **Painéis** (cada linha clicável → `#/ativo/<id>`):
  - **Tokens em alta** — rank, preço, %24h, volume, market cap.
  - **RWAs em alta** — idem, filtrado pela categoria RWA do CoinGecko, com setor.
  - **Maiores quedas** — piores do dia.
  - **Volume anormal** — maior razão volume/market cap (sinal de movimento).
  - **Categorias / setores** — variação por setor no dia.
- Busca no topo (autocomplete cripto + RWA) → `#/ativo/<id>`.

### 4.2 `#/ativo/<id>` — Página do ativo

Tela cheia dedicada (não modal), com botão voltar.

- **Topo:** logo, nome, símbolo, selo (Cripto | RWA), **preço grande**, variação
  24h, **gráfico** com seletor de período **24h · 7d · 30d · 3m · 6m · 1a**.
  Abaixo: mini-blocos de variação por janela + **ATH / ATL** (com data e % desde).
- **Abas:**

| Aba | Conteúdo |
|---|---|
| **Mercado** | Market cap, ranking, volume 24h, FDV, exchanges/pares |
| **Dados** | Supply circulante / total / máximo e métricas derivadas |
| **On-chain** | Blockchain(s), contratos por rede (link p/ explorador), holders *quando existir* |
| **Fundamentos** | O que é, categoria/setor, protocolo/ecossistema, classificação |
| **Sobre** | Emissor/empresa, links oficiais (site, whitepaper, redes), riscos, relação RWA/DeFi, notícias/relevância |

Quase tudo vem de **uma chamada** `assetDetail(id)` (CoinGecko `/coins/{id}`:
descrição, links, contratos/plataformas, supply, ATH/ATL, categorias). O gráfico
é uma segunda chamada (`chart`). Campos ausentes → "indisponível".

## 5. Arquivos de UI (novos / reescritos)

- `academy/index.html` — reescrever: shell + `#view`, carregar os provedores.
- `academy/js/academy.js` — reescrever: roteador de hash + render das duas telas.
- `academy/js/dashboard.js` — novo: monta faixa + painéis do dashboard.
- `academy/js/asset-page.js` — novo: monta a página do ativo (abas + gráfico).
- `academy/css/academy.css` — reescrever para o visual command center / HUD.
- Gráfico: SVG/canvas próprio, sem dependência externa (mantém "sem build").

## 6. Tratamento de erro / estados

- Todo painel tem 3 estados: **carregando**, **dado**, **indisponível** (com
  motivo amigável vindo do `AtlasHttp`). Nunca tela branca, nunca número inventado.
- Se o primário falhar mas um fallback responder, a UI mostra o dado normalmente
  (a troca é invisível). Se **todos** falharem, o painel mostra "indisponível" +
  botão "tentar de novo".

## 7. Fora de escopo (fases futuras)

- Ações de mercado tradicional cru (não tokenizado).
- Ouro/DXY/petróleo por fonte de mercado spot (usando PAXG por ora).
- Notícias por API dedicada (v1 usa o que o CoinGecko/CoinPaprika entregam).
- Holders/investidores institucionais quando exigirem APIs pagas.

## 8. Testes / verificação

- Verificar cada provedor isoladamente (resposta real + queda simulada → fallback).
- Verificar o resolver de identidade com um ativo grande (SOL) e uma RWA.
- Abrir o Academy por http (nunca `file://`) e conferir dashboard + página do
  ativo com dado real no navegador.
- Conferir estados de erro forçando 429 (o comportamento de fallback e de
  "indisponível" precisa aparecer, não pode virar tela branca).
