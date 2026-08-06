# ATLAS — Progresso da Integração

> ## ⚠️ Leia antes: carteiras neste documento são HISTÓRICO
>
> Este arquivo é um **log cronológico**. As seções sobre seletor de carteira
> descrevem etapas já superadas e citam arquivos e classes que **não existem
> mais**. Elas ficam aqui como registro do caminho percorrido, não como
> descrição do sistema atual.
>
> **Onde está o estado atual:** `MUDANCAS_WALLETS.md`.
>
> O que mudou desde as seções abaixo:
>
> | Citado aqui | Realidade hoje |
> |---|---|
> | `js/wallets.js` | **apagado**. A central é `wallets/walletStore.js`, `walletTypes.js`, `walletLedger.js`, `walletManager.js` |
> | `core/ui/atlas-wallet-dialog.js` | **apagado** → `wallets/walletDialog.js` (agora também renomeia e exclui) |
> | `RWA/components/shell.js` | **apagado**. O RWA monta o componente compartilhado a partir de `RWA/js/rwa-app.js` |
> | `.wsel*`, `.wallet-sel`, `.wallet-menu`, `.wallet-opt`, `.wallet-add`, `.wallet__*`, `.w-*` | **removidas de todo CSS**. O componente é `.awsel`, e o único CSS dele é `wallets/walletSelector.css` |
> | "seletor com uma pele de CSS por módulo" | não existe mais: **um markup, um CSS**, idêntico em Dashboard, Hold, Trade, DeFi, RWA e Relatórios |
> | `.wsel-add svg` / `data-wsel-close` / folha (scrim) de fundo | removidos. Fechar ao clicar fora é o listener de captura de `wallets/walletMenus.js`, sem folha e sem disputa de z-index |
> | `<select id="repWallet">` nos Relatórios | virou o mesmo componente dos módulos |
>
> Funções do componente, iguais em todos os módulos: selecionar global,
> selecionar local, criar global, criar local, renomear e excluir.

Moeda do sistema: **sempre US$** (nenhum módulo usa R$).

---

## Reestruturação (spec de 9 tópicos) — TÓPICO 1: Padronização do Oráculo ✅

**Objetivo:** um único Oráculo, reutilizável, em TODOS os módulos + Dashboard —
com o **ícone do Dashboard (ATENA)** e o **painel do módulo Trade**.

**Situação encontrada:** já existia um componente compartilhado `AtlasOraculo`
(`core/ui/atlas-shell.js`) usado por hold/trade/defi/rwa/academy, mas: (a) o gatilho
era um *orbe*, não o ícone da ATENA; (b) o **Dashboard raiz ficava de fora**, com um
Oráculo próprio (`js/oraculo.js` + markup + CSS em `dashboard.css`) — dois Oráculos
diferentes. O Trade ainda montava seu Oráculo antigo em `#oraculo-root`, já
neutralizado por CSS.

**O que foi feito (unificação num só componente):**
- `core/ui/atlas-shell.js`: gatilho trocado de orbe → **imagem da ATENA** (mesmo
  ícone do Dashboard), com `onerror` → fallback luminoso. Oráculo agora habilitado
  também no módulo `atlas` (Dashboard), mas **sem** a faixa superior (essa é só dos
  módulos — Tópico 2). Caminho da ATENA resolvido por profundidade
  (`assets/…` na raiz, `../assets/…` nos módulos).
- `core/ui/atlas-shell.css`: estilos do orbe (core/dot/rings) substituídos pelos da
  ATENA — flutuação "gênio" (`atlas-fab-float`) + anel cônico vermelho↔azul girando
  (`atlas-fab-spin`), idênticos ao Dashboard. Painel (layout Trade) mantido intacto.
- `dashboard.html`: carrega `core/ui/atlas-shell.css` + `atlas-shell.js`; **markup do
  Oráculo antigo removido**; passa a usar o componente compartilhado.
- `js/oraculo.js`: **reescrito** — não monta mais nada; apenas **registra o cérebro do
  Dashboard** no componente central (`AtlasOraculo.registerBrain`), preservando a
  mensagem de boas-vindas (resumo da consolidação) e a **recusa educada de previsões**.
- `css/dashboard.css`: bloco morto do Oráculo antigo (`.oraculo-fab/.fab-*/.oraculo-panel/.msg…`) removido.

**Testes:** `node --check` em 100% do JS (sem erro). jsdom **24/24**: em módulo (hold)
e no Dashboard (atlas) — ícone ATENA correto por caminho, painel estilo Trade
(badge+chips+composer), abre/fecha, sem duplicação, faixa só nos módulos, boas-vindas
e recusa de previsão preservadas no Dashboard.

**Sem quebrar nada:** faixa "Voltar ao Atlas" intacta; Trade sem Oráculo duplicado
(antigo segue neutralizado); todas as 9 páginas do DeFi com `data-module="defi"`.
Backups `.bak` foram usados durante a edição (removidos do zip final).

*Aguardando autorização do Jeferson para o Tópico 2.*

---

## ✅ Concluído neste bloco (RWA + consolidação)

### 1. Botão RWA no menu do Atlas
- `dashboard.html`: item **RWA** adicionado como **último item** do menu (depois de Configurações), `href="RWA/index.html"`, ícone `layers`.
- *Se preferir embaixo do DeFi/Trade, é só mover o `<a>` — ajuste trivial.*

### 2. RWA com carteiras (igual ao Trade)
- `RWA/js/store.js` refatorado para **multi-carteira** (chave `atlas_rwa_state_v2`):
  - Dados de mercado (macro/narrative) compartilhados; **portfólio por carteira** (`byWallet[id]`).
  - Carteira **principal** (global ativa) nasce com a carteira-semente (8 ativos); demais nascem vazias.
  - Novos métodos: `wallets()`, `currentWallet()`, `setWallet()`, `isIsolated()`, `globalTotal()`, `onWalletChange()`.
  - `globalTotal()` soma **só carteiras globais** → é o valor que sobe pro dashboard.
  - Guards anti-NaN para carteira vazia (isolada nova).
- `RWA/index.html`: carrega `../js/wallets.js` (central única) antes do store.
- `RWA/components/shell.js`: **seletor de carteiras** no topo (badges global/isolada), header **"ATLAS RWA"** maior e menu descido.
- Regra aplicada: **global soma no principal · isolada fica só no RWA**.

### 3. Consolidação real do dashboard (US$)
- `js/atlas-consolidation.js` (novo): lê os **totais reais** de Trade + Hold + DeFi + RWA (defensivo, try/catch por módulo) e devolve snapshot com total, P&L, evolução, categorias e blockchain.
- `js/data.js`: `ATLAS_DATA` agora é montado do `AtlasConsolidation` (era mock em R$).
- `js/dashboard.js`: formatação US$ + escala do gráfico dinâmica.
- `dashboard.html`: carrega as camadas de dados dos módulos antes do dashboard.

**Validado (jsdom):** patrimônio US$ 316.802 = Trade 21.895 + Hold 111.253 + DeFi 9.244 + RWA 174.410. Carteira isolada vazia → 0, sem NaN, ignorada no total. Sem nenhum R$.

## ⏭️ Estágios seguintes (não feitos ainda)
- **Bloco 2 (Hold/DeFi):** adaptar Hold e DeFi ao `AtlasWallets` (hoje contam inteiros como principal; carteira isolada neles ainda não é separada).
- Replicar header **"ATLAS <Módulo>"** + menu descido em Trade / Hold / DeFi (feito só no RWA).
- Trade: sub-carteiras de exchange (bybit/hyperliquid/testes) do seed **não** entram no total — só as carteiras globais da central (`principal`, `carteira2`). Registrar como globais na central se quiser somá-las.
- Firebase: trocar localStorage pelas camadas de store (já abstraídas).

## Notas técnicas
- Backups: `RWA/js/store.js.bak`, `js/data.js.bak`.
- Validação: `node --check` + jsdom (`/home/claude/.jsdom`).


---

## Sessão 13/07/2026 — Reset de dados + preparo p/ GitHub

**Feito:**
- Todos os seeds de demonstração zerados (sistema nasce limpo, do zero):
  - Trade: `seed.js` v5 → **v6** (só carteira "Principal", sem estudos/RDs/trades)
  - Hold: `HOLD_SEED` vazio; chave `HOLD_STATE_V1` → **V2**
  - DeFi: pools/staking/lending vazios; chave `atlas_defi_state_v1` → **v2**
  - RWA: assets/journal/curvas zerados; chave `atlas_rwa_state_v2` → **v3**
  - Central de carteiras: só "Principal"; chave `atlas.wallets.v1` → **v2**
- Bump de chaves/versões força reset automático de localStorage antigo no navegador (não precisa limpar manualmente).
- Persistência intacta: dados criados pelo usuário continuam salvos em localStorage (validado via smoke test — addPool no DeFi persistiu).
- `.gitignore` criado. Varredura de segredos: nenhum encontrado.

**Atenção:**
- Painéis Macro/Narrativa do RWA ainda exibem valores estáticos de demonstração (são indicadores de mercado, não dados do usuário) — candidatos a API real.
- Pasta `RWA/` em maiúsculas: manter consistência nos links (GitHub Pages é case-sensitive).

---

## Sessão 17/07/2026 — Autocomplete de ativos (CoinGecko)

**Feito:**
- Novo módulo compartilhado `js/atlas-assets.js` → `window.AtlasAssets`. IIFE + window, sem build, file:// friendly.
  - **Local-first:** lista curada de 165 ativos embutida (SEED) → autocomplete instantâneo, sem rede, para as moedas comuns (Solana, BTC, ETH…). Digitar "so" já sugere Solana.
  - **CoinGecko keyless** (`/search`) como fallback para long-tail, com **debounce 400ms + cache em localStorage** (chave `atlas.assets.cache.v1`, TTL 24h). Respeita o limite de 5-15 req/min da API pública (sem key).
  - Offline / 429 → cai só na lista local, sem quebrar.
  - Demo key opcional (30 req/min estável): `AtlasAssets.setApiKey("...")` → guarda em `atlas.assets.cg_key.v1`.
  - Dropdown próprio (CSS injetado 1x, `position:fixed`, z-index 99999 → aparece por cima dos modais). Navegação por teclado (↑↓ Enter Esc), clique, badge com thumb da moeda.
  - API: `localSearch(q)` (síncrono), `search(q)` (local+live), `attach(input, {value, onSelect})`, `autoBind()` para `[data-atlas-asset]`.
- **Plugado em todos os campos de ativo:**
  - **DeFi** (`pools.html`): `#tkBase` e `#tkQuote` via `data-atlas-asset="symbol"` (autoBind).
  - **Hold** (`forms.js` — Novo ativo): campos **Nome** e **Ticker** com **preenchimento cruzado** (selecionar em qualquer um preenche os dois).
  - **Trade**: formulários de **Estudo** (`estudos.js`), **RD** (`rd.js`) e **Abrir trade** (`trades.js`), campo `data-f="asset"`.
- Script carregado via `../js/atlas-assets.js` em `defi/pools.html`, `hold/index.html` e `trade/index.html`.

**Validado (jsdom, 12/12):** localSearch instantâneo, prioridade de match (symbol exato > prefixo > nome), SEED íntegro (165), attach cria dropdown ao digitar, search mescla local+live sem duplicar por id.

**Atenção / próximos:**
- Autopreenchimento cobre **identidade do ativo** (nome/ticker). Autopreencher **preço** (via `/simple/price`) fica como passo seguinte natural — o módulo já tem a base de cache/rede pronta.
- SEED é fixa; a busca live cobre o resto. Se quiser, dá pra pré-carregar o top-500 de `/coins/markets` em cache no primeiro uso.

---

## Sessão 18/07/2026 — Rodada grande de melhorias

### RWA reconstruído (era o urgente)
- Camada visual refeita do zero em **um arquivo blindado** `RWA/js/rwa-app.js` (substitui shell.js, router.js, app.js e as 7 views — arquivos antigos removidos). Mantidos: `store.js`, `utils.js`, `charts.js`, `ui.js`, todo o CSS.
- **Nunca mais tela branca silenciosa:** captura global de erros pinta banner vermelho na tela com botão "Resetar dados e recarregar"; cada view tem try/catch próprio.
- Tudo virou opcional/resiliente: Chart.js (CDN), `../js/wallets.js` e `../js/atlas-assets.js` podem falhar que o módulo renderiza igual (`onerror` nos scripts + guards).
- **CRUD de ativos criado** (não existia!): store ganhou `addAsset/updateAsset/removeAsset/removeJournal`; modal "+ Adicionar ativo" no Dashboard e Portfolio (nome, ticker c/ autocomplete CoinGecko + cross-fill, classe, setor, investido, atual, score, sensibilidade, status); editar/excluir no detalhe do ativo; Journal ganhou form de nova entrada + excluir.
- Estados vazios com CTA em todas as views. Macro/Narrative marcados com tag "valores de referência — API real em breve".
- CSS de modais/forms apendado em `RWA/css/components.css` (.rmodal*, .rform, .rbtn*).
- **Validado: 20/20 asserts jsdom no PIOR caso** (sem Chart, sem wallets, sem assets): todas as 6 views renderizam, CRUD persiste, modal abre.
- Obs.: causa-raiz da tela branca na máquina do Jeferson nunca foi reproduzida em simulação (código antigo rodava ok no jsdom). A reconstrução elimina a classe inteira de falha silenciosa; se algo falhar agora, o erro aparece escrito na tela.

### Telas de entrada (index → boas-vindas → login)
- `index.html`/`css/init.css`/`js/init.js` refeitos no estilo **Gargantua**: fundo espacial com **luzes cônicas girando** (feixes vermelho+azul), disco de acreção inclinado, estrelas, HUD monoespaçado nos 4 cantos (relógio real, SYS/MEM fake).
- **Esfera = arte da ATENA** (`assets/atena.webp`, 144KB, fundo transparente, gerada do atena.png 6MB): giro **360° horizontal (7s, contínuo) + 360° vertical (11s)** via CSS 3D aninhado (.atena-tilt > .atena-spin), glow pulsante vermelho/azul, 2 anéis orbitais.
- **Duração: 7.5s** (meta era ≤8s; antes 10s) + botão "pular ›".
- `boas-vindas.html` redesenhada: mesma ATENA girando, título com gradiente vermelho→roxo→azul, eyebrow mono, botão "Entrar" com gradiente animado. Login mantido (já entra automático em qualquer submit — sem validação, como pedido).

### Dashboard raiz
- **Banner "Plano Premium" removido** (HTML inteiro fora).
- **Menu reordenado:** Dashboard → Hold → Trade → DeFi → RWA → Academy → Relatórios → Configurações. **Item "Oráculo" removido do menu lateral.**
- **Oráculo agora é a ATENA flutuante** no canto inferior direito (substitui a bolinha do FAB): `assets/atena.webp` com animação de flutuação tipo gênio da lâmpada (fabFloat 4.5s) + anel cônico vermelho/azul girando; clique abre o mesmo painel de chat de antes (`js/oraculo.js` intacto).
- **Saudação corrigida:** "Júnior Jefferson" → **"Jeferson Junior"** no `js/data.js` (2 lugares) E no placeholder hardcoded do HTML. Sub "Bem-vindo ao Oráculo" → "Bem-vindo ao ATLAS". Placeholder "R$ 125.430,75" → "US$ 0".
- Fade-in de página + stagger nos KPIs em `css/global.css`.
- Validado: 7/7 asserts jsdom (boot completo com todas as camadas de dados).

### Módulos
- **Hold:** botão "Recolher" gigante REMOVIDO da sidebar (e estado colapsado antigo é limpo do localStorage no boot). Brand padronizado: "HOLD / ATLAS SYSTEM" → **"ATLAS HOLD / Long-Term System"**. Preço em tempo real: ao escolher ativo no autocomplete, campo "Preço atual (USD)" é preenchido via CoinGecko `/simple/price` (novo helper `AtlasAssets.price(id)`, cache 60s) — só se o campo estiver vazio.
- **Trade:** saudação "Boa noite, operador" REMOVIDA da topbar → eyebrow fixo "ATLAS Trade" (item 14: boas-vindas só no Atlas raiz).
- **DeFi:** botão "‹ Atlas" → **"‹ Voltar ao Atlas"** (components.js).
- **Transições de página** (fade+rise .45-.5s) adicionadas: raiz (global.css), Hold (#app-view), Trade (.view__inner), DeFi (main/cards), RWA (#app). Sai o corte seco.
- Validado por jsdom: Hold 4/4, Trade 4/4, DeFi 4/4.

### AtlasAssets (compartilhado)
- Novo método `AtlasAssets.price(coinId)` → Promise<preço USD> via `/simple/price`, cache 60s em memória, keyless (aceita Demo key se setada).

### Persistência (auditada)
- Todos os stores gravam em localStorage a cada mutação e carregam dados existentes antes de qualquer seed (nada sobrescreve dados do usuário): hold state, trade store, defi data, rwa store, wallets. ✓

### Pendências conhecidas
- Academy / Relatórios / Configurações do menu raiz seguem sem página (href="#").
- Macro/Narrative do RWA seguem com valores de referência estáticos (API real de macro é item futuro).
- Autopreencher preço nos forms do Trade/DeFi (Hold já tem) — próximo passo natural.
- Hold/DeFi ainda não adaptados ao AtlasWallets (pendência antiga).

---

## Sessão 18/07/2026 — FASE 1: Core por provedores + correções

**Arquitetura nova (`core/`):**
- `core/http.js` — serviço ÚNICO de rede: timeout 8s, retry c/ backoff, cache TTL (memória + localStorage), erros amigáveis. Nenhum módulo deve chamar fetch() direto daqui pra frente.
- `core/providers/registry.js` — registro de provedores por capacidade (prices/search/pools/lending). Regra: nada de lógica por corretora/DEX nos módulos; nova fonte = novo provedor registrado.
- `core/providers/coingecko.js` — provedor de preços/busca: `search`, `price`, `priceFull` (USD + market cap + imagem), `prices` em lote.

**Bugs corrigidos:**
- Autocomplete (texto duplicado / dropdown reaparecendo): `pick()` disparava "input"/"focus" que reativavam a própria busca. Agora: supressão de eventos programáticos (`__aaSuppress`) + valor "commitado" (`pickedValue`) — focus em campo já escolhido não reabre; digitar de novo libera normalmente. Validado em jsdom.
- Preço automático: Hold preenche preço + market cap ao selecionar (toast amigável se API falhar); RWA preenche "Preço atual"; Trade sugere preço de mercado na Entrada (editável). Moeda: **sempre USD** (regra do sistema).
- RWA: 10 arquivos mortos removidos (app.js, router.js, view-*.js, components/shell.js — versão antiga pré-rwa-app.js). Só `rwa-app.js` + store/utils/charts/ui permanecem. As 6 rotas validadas em jsdom.

**HTMLs atualizados** (carregam o core antes do autocomplete): RWA/index.html, hold/index.html, trade/index.html, defi/pools.html.

**Validação (jsdom):** RWA 6/6 rotas renderizando · autocomplete sem reabertura/duplicação · Hold/Trade/DeFi-pools montando sem erro · cache HTTP (2 chamadas → 1 fetch) · erro 429 amigável.

**⏭️ Fase 2 (aprovar antes):** DeFi inteligente — provedor DefiLlama (pools por chain+DEX, lending c/ LTV e health factor), fluxo Rede → Protocolo → pools reais.

---

## Sessão 18/07/2026 (2) — RWA RESOLVIDO + Boot/Boas-vindas refeitos

### 🎯 Causa REAL do bug do RWA (encontrada via screenshot)
Não era JavaScript — por isso os testes passavam. Era **CSS**: o `<div class="scrim">`
(overlay do menu mobile) só tinha estilo dentro do media query mobile. No desktop,
sem estilo base, o navegador o tratava como **item do grid** (`.app-shell` tem 2
colunas), ocupando a coluna do conteúdo e empurrando o `.main` (topbar + páginas)
para fora da tela. Menu aparecia, conteúdo não.
**Correção:** `.scrim { position: fixed; … }` como estilo base em `layout.css`
(fora do fluxo do grid) + removida a duplicata do `responsive.css`. Arquivos
mortos da versão antiga removidos de novo (tinham voltado no zip).

### 🚀 Boot (index.html) — refeito completo
- `css/atlas-celestial.css` (novo, compartilhado): fundo espacial em camadas
  (nebulosas com drift → estrelas 2 profundidades → partículas → vinheta),
  núcleo ATENA, halo com bloom/pulso, 3 anéis 3D independentes, sombra dinâmica, HUD.
- **Esfera corrigida:** a imagem NÃO gira mais (o `rotateY` achatava = "moeda").
  Movimento agora vem da LUZ: specular orbitando (conic-gradient girando),
  sheen varrendo a superfície, rim-light + terminador para volume, respiração
  sutil de escala e wobble 3D lento da cena (rotateX/Y ±4°). Referência: planeta.
- `js/atlas-fx.js` (novo, compartilhado): starfield parallax + partículas
  (orbitam/sobem/desvanecem) em canvas, HUD vivo (CPU·MEM·NET·LAT·SYNC·CLOCK
  com interpolação suave), boot engine por etapas com easeInOutCubic.
  Um único rAF, pausa com aba oculta, respeita prefers-reduced-motion.
- Barra de carregamento: preenchimento por `scaleX` (GPU), glow, shine varrendo,
  porcentagem animada, 8 mensagens dinâmicas (Kernel → IA → Módulos → Segurança
  → Mercado → APIs → Finalizando). Fallback: se o FX falhar, segue em 2s.

### 🎬 Boas-vindas — apresentação cinematográfica (≠ boot)
Fade de abertura → esfera cresce sob a luz → feixe varre a cena → mensagem em
cascata → botão "Entrar no sistema" com glow pulsante → fade de saída → login.

### Validação (jsdom)
Boot: 8 mensagens ciclando, barra 0→100 com easing, transição de saída OK.
Boas-vindas: sem erros, fade de saída OK. RWA: renderizando + scrim corrigido.
Só transform/opacity nas animações (sem reflow). Reduced-motion coberto.

---

## Sessão 18/07/2026 (3) — Teses + Academy + Carteiras (Hold/DeFi)

Refatoração grande em 4 blocos. Moeda segue **sempre US$**. Sem frameworks, tudo `file://`-friendly, validado por `node --check` (100% do JS do projeto) + smoke tests jsdom.

### Bloco 1 — Estudos → Tese (entidade compartilhada)
- **`core/entities/theses.js` (novo) → `window.AtlasTheses`:** fonte única da verdade das teses. Chaves `atlas.theses.v1` + `atlas.future_studies.v1`.
  - Status oficiais: **Planejada · Em andamento · Concluída · Arquivada**.
  - Concluir → sai do módulo e vai pro Academy. Reabrir → volta ao módulo de origem, status andamento, **versão +1** (a versão concluída vira snapshot em `versions[]`). Histórico nunca se perde (`history[]` = evolução da visão, `versions[]` = fotos de cada conclusão, `log[]` = auditoria).
  - Migração automática **não destrutiva** (flags `meta.migrated`): lê `HOLD_STATE_V2` (teses active/review→andamento, invalid→arquivada; estudos→planejada) e `atlas.state.v1` do Trade (studies + archive; concluído→concluida com snapshot v1). **IDs preservados** → `ativo.tese_id` (Hold) e `rd.studyId` (Trade) continuam válidos.
  - `stats()` para o Academy (KPIs + por módulo + tempo médio de conclusão). `futures()` seed: Hyperliquid, Ethena, Morpho, EigenLayer, Pendle, Drift. `promoteFuture(id, module)`.
- **Hold:** menu "Estudos" removido; página de Teses reescrita (Iniciar/Concluir→Academy/Arquivar/Reativar). Teses viram espelho da entidade. `createStudy/convertStudyToThesis/invalidateThesis` removidos → `concludeThesis/archiveThesis`.
- **Trade:** `modules/estudos/` → `modules/teses/` (deletado o antigo). Shim de vocabulário no `state.js` (`_toOld/_toNew`) mantém RD/Dashboard/Trades/Oráculo intactos. Regra das 72h preservada.
- **DeFi:** nova página `teses.html` + `js/teses.js` no menu (via `NAV` em `components.js`).

### Bloco 2 — Academy (Central de Conhecimento)
- **`academy/` (novo):** SPA hash-router (`index.html` + `css/academy.css` + `js/academy.js`), identidade visual da raiz (tokens de `css/variables.css`).
- Menu: Dashboard · Em andamento · Concluídas · Estudos futuros · Biblioteca · Pesquisar Teses · Relatórios.
- KPIs: em andamento, concluídas, revisões, estudos futuros, tempo médio de conclusão, última atualização.
- Detalhe da tese: timeline de evolução, versões concluídas, auditoria, **Reabrir** (→ volta ao módulo), Editar. Estudos futuros promovíveis a tese no módulo escolhido.
- Link "Academy" no `dashboard.html` ativado (era `href="#"` morto).

### Bloco 3 — Carteiras (Hold + DeFi + Dashboard + rótulos)
- **Decisão:** teses ficam no **módulo** (visíveis em todas as carteiras) — só o **dinheiro** (posições/pools/trades) é por carteira.
- **`js/wallets.js`:** `typeLabel()`/`typeTag()` (UI mostra **"Local"**; tipo interno segue `isolada` p/ não quebrar Trade/RWA). Helper `stamp(module, origem, walletId)` → carimba `{walletId, module, data, origem}`.
- **Hold:** posições agora por carteira (`walletId` em cada posição; `positionOf/portfolioValue/counts/alerts` filtram pela ativa). `executeBuy` carimba; `executeSell` só marca ativo "vendido" se não sobrar posição em nenhuma carteira. Seletor Global/Local na topbar + criar carteira Local. `globalTotal()` soma só globais. `wallets.js` incluído no `hold/index.html` (**faltava** — era a causa do Hold nunca usar a central).
- **DeFi:** estado migrado p/ `byWallet[id]` (chave `atlas_defi_state_v2` → **v3**, migração automática do v2 p/ carteira principal). Pools/staking/lending/closed por carteira. Seletor na topnav de todas as páginas (`mountWalletSelector` em `components.js`). `globalTotal()` novo. `wallets.js` incluído nas 9 páginas.
- **Dashboard principal:** botão de carteira (antes hardcoded) virou seletor da carteira **global** ativa (afeta todos os módulos, re-consolida via reload). Criar nova carteira global.
- **Consolidação (`js/atlas-consolidation.js`):** `holdTotal()`/`defiTotal()` usam `globalTotal()` → somam **todas as globais**, nunca só a carteira ativa. Carteiras Local ficam fora do patrimônio total.
- **Trade/RWA:** textos "isolada"/"Isolada · só no X" → **"Local"** nos seletores.

### Bloco 4 — Limpeza + validação geral
- Varredura de órfãos: nenhuma chamada às APIs antigas de estudo (só as linhas legítimas do `importJSON` do Hold que repassam backups à entidade). Arquivos antigos (`hold/js/pages/estudos.js`, `trade/modules/estudos/`) confirmados removidos.
- **Bug de ordem de scripts corrigido:** `defi/teses.html` e `academy/index.html` não carregavam `wallets.js` antes das camadas que dependem dele — teriam quebrado no navegador. Corrigido. Auditoria confirma wallets.js antes de data.js nas 9 páginas DeFi.
- **Resiliência:** Hold e DeFi funcionam mesmo **sem** a central (fallback "principal", sem tela branca). Confirmado em jsdom.

### Validação
- `node --check`: **100% do JS do projeto** sem erro.
- jsdom: migração completa (Hold estudo+tese + Trade concluída = 3 teses, 1 no Academy) · Academy 7 rotas renderizando · reopen (v1→v2) · promoteFuture · Hold/DeFi carteiras Local isoladas · consolidação soma só globais (Hold 1000 + DeFi 2000 = 3000) · nova carteira global funciona.

### Pendências conhecidas (fora do escopo destes 4 blocos)
- Menu raiz: **Relatórios** e **Configurações** seguem sem página (`href="#"`). Academy já ligado.
- Trade/RWA já usavam carteiras desde antes; só os rótulos foram padronizados agora.
- Macro/Narrative do RWA seguem com valores de referência estáticos (API real = item futuro).

---

## Sessão — Relatórios, Configurações, Tema Claro, i18n & Calendário

**Fluxo desta sessão:** Jeferson entrega melhorias → separadas em etapas → uma de cada vez, com aval a cada passo → zip só no fim.

### Roadmap acordado
- **Etapa 1 — Página de Configurações (raiz).** Construir a página (botão do menu era `href="#"` morto) e ligar aos motores já existentes (`core/settings.js` + `core/i18n.js`): tema Escuro/Claro, idioma PT/EN.
- **Etapa 2 — Garantir que "muda tudo".** Auditar trade/hold/defi/RWA: toda cor cravada → variável de tema (modo claro não pode quebrar); expandir dicionário EN cobrindo navegação, páginas novas e Oráculo/ATENA ("site todo em inglês").
- **Etapa 3 — Infra de datas / Calendário global.** Cada movimento (entrada/saída) com data em todos os módulos + componente de calendário reutilizável + camada que consolida movimentos datados. Pré-requisito dos relatórios.
- **Etapa 4 — Página de Relatórios (raiz).** Entrada/saída mensal/trimestral/semestral/anual; comparação mês a mês (positivo/negativo), semanas, anos; projeção. Chart.js.

### Etapa 1 — CONCLUÍDA
- **Descoberta:** os motores já existiam de sessão anterior ("item 9") e já carregados em todas as páginas — `themes/atlas-theme.css` tem `[data-theme=dark|light]`; `core/settings.js` (store global tema/idioma/moeda/formato/animações, persiste em `atlas.settings.v1`, aplica no `<html>`, emite evento); `core/i18n.js` (PT/EN, sweep de DOM + `[data-i18n]`). Faltava só a **página**.
- **Novos arquivos:** `configuracoes.html` (raiz, shell idêntico ao dashboard, `data-module="atlas"`), `css/configuracoes.css` (controles 100% em tokens `--atlas-*`, acompanham claro/escuro), `js/configuracoes.js` (liga controles ao `AtlasSettings` + dicionário EN da própria página + toast de confirmação).
- **Controles:** Tema (Escuro padrão / Claro) · Animações (switch) · Idioma (Português / English) · Formato de data (dd/MM/yyyy · MM/dd/yyyy · yyyy-MM-dd) · Moeda travada em **USD** (regra do sistema) · Restaurar padrões (`AtlasSettings.reset()` com confirmação).
- **Comportamento:** tema aplica na hora (CSS reage a `data-theme`); idioma dispara o repaint do próprio `i18n.js` (sweep p/ EN; `location.reload()` ao voltar p/ PT). A página não guarda estado próprio — tudo via `AtlasSettings`.
- **Menu:** botão "Configurações" do `dashboard.html` religado (`href="#"` → `configuracoes.html`).
- **Validação:** `node --check` OK nos 3 JS; smoke jsdom 16/16 (padrão dark, toggle p/ light aplica no `<html>`, controles refletem, EN traduz via `data-i18n`, reset restaura, moeda = USD).
- **Pendência p/ Etapa 2:** `.sidebar` (compartilhada com o dashboard) ainda tem gradiente azul-escuro cravado na mão — não é theme-aware. Não tocada agora p/ não alterar o dashboard fora do escopo; normalizar na auditoria da Etapa 2.

### Etapa 2 — CONCLUÍDA (garantir que "muda tudo")
**Descoberta-chave (cor):** a ponte de tema (`themes/atlas-theme.css`) já é **completa** — cada `html[data-module=X]` remapeia os tokens do próprio módulo (`--bg/--surface/--text/--border`, `--glass-*`, `--bg-deep/--text-hi`, etc.) para os `--atlas-*` que viram em `[data-theme]`. Como o seletor de módulo (0,1,1) vence o `:root` do módulo (0,1,0) e o CSS carrega por último, **as superfícies/texto/borda já clareavam sozinhas**. Auditar ≠ converter 675 literais.
- **Corrigidos 31 literais escuros** que passavam por fora do token (regras de componente, não definições `:root`): sidebar + menus do dashboard, glass-fills de input do Trade/DeFi, tooltip do DeFi, e overlays brancos (`rgba(255,255,255,.03–.10)`) que **somem no claro** → agora `var(--atlas-inner)` / tokens de superfície do módulo. Marker do RWA `#fff` → `var(--text)`.
- **Mantidos de propósito:** tinta escura sobre acento (`color:#04121e` em botões/badges — correta nos dois temas), fallbacks de resiliência `var(--x, #escuro)` (o token vence; o literal só age sem o tema carregado), gradientes decorativos do orbe da ATENA, e as telas de splash/login (`login.css`, `boas-vindas.css`, `init.css`) que seguem escuras por identidade (starfield). *(anotado — se quiser login claro também, é um passo à parte)*

**i18n / "inclusive o Oráculo":**
- **ATENA agora é bilíngue** (`core/ui/atlas-shell.js`): helper `L(pt,en)` guiado por `AtlasI18n.lang()`. `summary()` e `answer()` (todas as ramificações, com números interpolados) produzem PT ou EN; regex de intenção reconhece termos PT **e** EN. Chrome traduzido (título, placeholder, aria de fechar/enviar/abrir, chips) — o rótulo do chip vira EN mas o `data-q` continua em PT para o matching não quebrar.
- **Dicionário base expandido** (`core/i18n.js`): ~35 chaves novas cobrindo títulos de gráfico (Evolução Patrimonial, Distribuição por Categoria/Blockchain), termos de DeFi/Hold/RWA (Fechar/Editar posição, Posições de staking/lending, Protocolo, APR Realizado por Posição…), boot ("Ligando sistema…", "pular boot ›") e login (Entrar, Senha, Esqueceu sua senha?, Cadastre-se…).

**Validação:** `node --check` em **84 arquivos** JS, 0 erro · chaves `{}` balanceadas nos 9 CSS editados · smoke E2E (jsdom) 11/11: `<html data-theme=light>` aplicado, chaves novas do dicionário, e ATENA montada **em inglês** (aria "Open Oracle", chip "How is the module?", saudação "Module TRADE has no theses yet…").

**Nota honesta:** cobertura EN de **todas** as strings profundas dos módulos é incremental por design (motor texto-como-chave). O vocabulário comum + telas visíveis + Oráculo estão cobertos; textos muito específicos de views internas podem aparecer em PT e entram no dicionário conforme surgirem em uso. Trocar EN→PT no meio da sessão recarrega a página (repinta tudo); a saudação já impressa do Oráculo só troca ao reabrir/recarregar.

### Correção de terminologia — ATENA vs Oráculo
Alinhamento do Jeferson: **o sistema/feature é o Oráculo** (chat de perguntas e respostas; no futuro receberá uma IA via chave de API). **ATENA é só o avatar/imagem** — não deve existir como termo/conceito no site, apenas como nome do arquivo.
- Texto visível (`alt="Núcleo ATENA"` em `index.html` e `boas-vindas.html`) → `alt="Oráculo"`.
- Classe CSS `.atlas-oraculo__atena` → `.atlas-oraculo__avatar` (4 em `atlas-shell.css` + o `<img>` em `atlas-shell.js`); variável `ATENA_SRC` → `ORACULO_AVATAR`.
- Comentários que citavam "ATENA" reescritos p/ "avatar do Oráculo".
- **Filename `assets/atena.webp` mantido** (é o nome da imagem — como pedido). Verificado: **zero** ocorrências do termo ATENA no código; só resta o path do arquivo.
- Validação: `node --check` OK · mount do Oráculo confirmado em jsdom (avatar com classe nova, `src` = `atena.webp`).

### Etapa 3 — EM ANDAMENTO · Sub-bloco 3A CONCLUÍDO (livro-razão de movimentos)
Design confirmado com o Jeferson: **relatório é POR CARTEIRA** — escolhe-se um `walletId` (global OU local, pelo nome) e recebe-se o relatório só daquela carteira. Caminho **robusto/híbrido**.

**Novo:** `js/atlas-movements.js` — `window.AtlasMovements`, o livro-razão único.
- Movimento canônico: `{ id, date:"YYYY-MM-DD", tipo:"entrada"|"saida"|"resultado", valorUSD, module, walletId, origem, label }`. Sempre USD.
- Duas fontes que convivem: **gravados** (`record()`/`recordMany()` → `localStorage['atlas.movements.v1']`, fonte da verdade precisa, por carteira — o que os módulos passam a alimentar no 3C) **+ derivados** (adaptadores extraem do que cada módulo já guarda; isolados aqui → troca p/ Firebase mexe só nesta camada).
- API: `record/recordMany/remove/clearRecorded`, `registerAdapter(fn)`, `list({walletId,from,to,module,tipo,includeDerived})`, `summarize()` `{entrada,saida,resultado,net,count}`, `groupByPeriod(list,"month"|"quarter"|"semester"|"year")`, `compareBuckets()` (delta vs período anterior, flag positivo/negativo), `walletsWithActivity()` (p/ o seletor do relatório).
- Datas normalizadas (epoch/ISO/`YYYY-MM-DD`) → `YYYY-MM-DD`. `net = entrada − saída` (resultado é performance, separado do fluxo).

**Adaptadores (backfill best-effort):**
- **DeFi** — completo: `DeFiStore.all().byWallet[*]` → `pool.movements[]` (in/out) + `closed[]` (resultado = profit @ closedAt).
- **Hold** — sólido: `Store.state.carteira[]` (todas as carteiras) → cada posição = entrada (qtd×preço médio) na data do stamp.
- **Trade** — trade fechado (`closedAt`+`pnl`) = resultado; exposto novo acessor read-only `ATLAS.app.allWalletData()`.
- **RWA** — ativo com data de compra = entrada (custo); sem data, ignorado.
- Hold(venda), Trade(banca) e RWA(sem data) ficam precisos via `record()` no **3C**.

**Validação:** `node --check` no projeto todo (0 erro) · smoke jsdom **25/25**: relatório por-carteira (A≠B), resumo, agrupamento mês/trimestre/ano, comparação com delta, filtro de período, e os 4 adaptadores atribuindo à carteira certa com stores semeados.

**Falta na Etapa 3:** 3B — `AtlasCalendar` (componente de calendário compartilhado, o "calendário do site inteiro"); 3C — fiar `record()` nos formulários/ações dos módulos (compra/venda Hold, pool DeFi já tem movements mas plugar record, fechar trade, compra/venda RWA) + seletor de data padrão.

### Etapa 3 — Sub-bloco 3B CONCLUÍDO (calendário compartilhado)
**Novos:** `core/ui/atlas-calendar.js` (`window.AtlasCalendar`) + `core/ui/atlas-calendar.css`. Vanilla/IIFE, file://-safe.
- **`AtlasCalendar.field(opts)`** — campo de data com popover (botão + grade de mês) p/ formulários. `getValue/setValue/open/close/destroy`. Fecha ao escolher, fora-clique e Esc. Exibe formatado via `AtlasSettings.formatDate()`.
- **`AtlasCalendar.month(opts)`** — visão de mês embutida (relatórios). Marca dias com movimento: `markers` (mapa ou fn) OU, se vier `walletId`, puxa automático do `AtlasMovements` (dot verde/vermelho pelo net do dia). Navegação ‹ mês ›, "Hoje", "Limpar".
- **Bilíngue:** nomes de mês/dia via `Intl` + idioma do `AtlasSettings`; re-renderiza ao trocar idioma/tema (assinatura em `AtlasSettings.on`, `destroy()` faz `off()` — sem vazamento). Rótulos próprios no dicionário EN.
- **Tema:** 100% tokens `--atlas-*` → claro/escuro automático (Etapa 2).
- Carregamento das tags acontece onde for usado (formulários no 3C, página de Relatórios na Etapa 4).

**Validação:** `node --check` no projeto (0 erro) · smoke jsdom **14/14** (campo formata/abre/escolhe/fecha; mês com 42 células + 7 dias-da-semana; dots pos/neg; navegação; marcador automático por carteira via AtlasMovements; título troca p/ inglês) + teste isolado de `destroy` (remove nó e dessinscreve).

**Falta na Etapa 3:** 3C — plugar `AtlasCalendar.field` + `AtlasMovements.record()` nas ações dos módulos (compra/venda Hold, pool DeFi, fechar trade, compra/venda RWA) para os movimentos nascerem datados e por carteira.

### Etapa 3 — Sub-bloco 3C CONCLUÍDO · ETAPA 3 COMPLETA (record() nas ações + dedup)
Movimentos passam a nascer **datados e por carteira** onde o dado do módulo não era suficiente (Hold, RWA). DeFi (via `pool.movements`) e Trade (trade fechado) seguem precisos por derivação — sem `record()` p/ não duplicar.
- **Hold** (`hold/js/state.js`): `executeBuy` grava `entrada` (qtd×preço), `executeSell` grava `saida`; data = `data.data` ou hoje; `walletId` = carteira ativa; `ref: "hold:<ativo>:<wallet>"`.
- **RWA** (`RWA/js/store.js`): `addAsset` grava `entrada` (custo) e carimba `a.date`; `removeAsset` grava `saida` (valor atual); `ref: "rwa:<id>:<wallet>"`.
- **Dedup / anti-dupla-contagem (motor):** `AtlasMovements.recorded()` e `recordedRefs()` (sem recursão). Adaptador do **Hold** deriva só o **RESTO** = `custo_atual − gravado_líquido` daquela posição → o pré-3C continua derivado, a compra nova é gravada, nada some nem dobra. Adaptador do **RWA** pula ativo já gravado. Campo `ref` preservado no `normalize`.
- **Carregamento:** `../js/atlas-movements.js` adicionado a `hold/index.html` e `RWA/index.html` (SPAs) — onde o `record()` dispara.

**Validação:** `node --check` no projeto (0 erro) · smoke jsdom **8/8**: pré-3C derivado (20000) → após compra de 5000 o total fecha 25000 (5000 gravado + 20000 resto), venda total zera o derivado, e o **store REAL do RWA** grava 1 entrada sem dobrar.

**Pendência (polish, encaixa na Etapa 4):** plugar o `AtlasCalendar.field` nos formulários de compra/venda (Hold/RWA) e no de pool (DeFi) para o usuário **escolher/retroagir a data** — hoje o `record()` usa a data de hoje por padrão (correto p/ uso ao vivo). O componente já está pronto; falta só inseri-lo nos forms.

## ETAPA 3 COMPLETA ✅ — livro-razão por carteira (3A) + calendário compartilhado (3B) + record() nas ações com dedup (3C).

### Etapa 4 — CONCLUÍDA (Página de Relatórios, por carteira)
Botões mortos do menu agora ativos: **Relatórios** e **Configurações** apontam pras páginas (dashboard + configuracoes + relatorios cruzam-se).
**Novos:** `relatorios.html` (shell ATLAS, `data-module="atlas"`), `css/relatorios.css`, `js/relatorios.js`.
- **Por carteira:** seletor lista todas (`AtlasWallets.all()`, ★ global / • local, com nome); trocar a carteira troca o relatório inteiro. Tag Global/Local. Preserva seleção e reage a carteira criada/removida (`AtlasWallets.subscribe`).
- **Granularidade:** Mensal / Trimestral / Semestral / Anual (`groupByPeriod`).
- **KPIs:** Entradas, Saídas, Resultado, Fluxo líquido (`summarize`), coloridos pos/neg.
- **Gráfico (Chart.js 4.4.1):** barras entrada/saída por período + linha net + **projeção** tracejada (regressão linear no net). Cores lidas dos tokens `--atlas-*` (acompanha tema); re-render no change de tema/idioma.
- **Comparação entre períodos:** tabela com entrada/saída/net + **delta vs. anterior** (seta ↑/↓, % e cor pos/neg) — a "comparação entre meses/anos positivos/negativos".
- **Projeção do próximo período:** callout com estimativa por tendência linear.
- **Calendário do mês:** `AtlasCalendar.month({walletId})` embutido, com os dias marcados (dot verde/vermelho pelo net) — o "calendário do site" concretizado.
- **Movimentos recentes:** últimos 8, com dot por tipo, módulo, data formatada e valor.
- **Estado vazio** quando a carteira não tem movimento. USD em tudo. Bilíngue (data-i18n + dicionário próprio). Escuta `atlas:movement` p/ atualizar ao vivo.

**Validação:** `node --check` no projeto (0 erro) · smoke E2E jsdom **14/14**: seletor lista carteiras, default global, KPIs corretos (principal US$3.000 entradas), 3 meses na comparação, projeção visível, calendário montado, 4 movimentos recentes; **troca p/ carteira local → relatório muda (US$8.000)**; troca de período agrega; estado vazio numa carteira sem movimento. (Chart.js é guardado — não roda no jsdom, não quebra.)

**Único item aberto (polish, opcional):** inserir o `AtlasCalendar.field` nos formulários de compra/venda (Hold/RWA) e pool (DeFi) p/ escolher/retroagir a data — hoje `record()` usa a data de hoje (correto p/ uso ao vivo). Componente pronto; falta só inserir nos forms.

---

## Sessão 28/07/2026 — Backup de dados (item entregue)

**Contexto:** antes de cadastrar dados reais, blindar contra perda.
Os dados do ATLAS vivem no localStorage do Chrome — trocar os arquivos
do site NÃO apaga nada, mas limpar dados de navegação, formatar o PC ou
trocar de navegador apaga tudo sem aviso.

**Entregue:**
- `core/atlas-backup.js` — ARQUIVO ÚNICO do backup. Varre o localStorage
  por padrão de nome (`atlas.*`, `atlas_*`, `atlas:*`, `axiom*`, `HOLD_*`),
  então chave de módulo novo entra sozinha, sem editar lista.
- Card "Dados e Backup" em `configuracoes.html` (Exportar / Importar).
- Ligação em `js/configuracoes.js`.
- Estilos `.btn-ghost.accent` e `.bk-detail` em `css/configuracoes.css`.

**Decisões:**
- Caches (`atlas.assets.cache.v1`, `atlas.http.cache.v1`, `atlas.fx.v1`)
  ficam FORA do arquivo — são regeneráveis e só inchariam o backup.
- Import valida antes de gravar: recusa JSON inválido, arquivo de outro
  app, backup vazio ou chave estranha ao ATLAS.
- Restauração tem rollback: se a gravação falhar no meio, desfaz tudo.
- Modo "replace" — estado idêntico ao dia do backup.

**Correção de robustez:** `core/currency.js` — erro síncrono no fetch
escapava do `.catch()` e podia derrubar o boot. Agora vira rejeição e
cai no fallback.

**REGRA ASSUMIDA:** nunca mais fazer bump de chave do localStorage
(`V2` → `V3`) para descartar dados. Se precisar migrar, escrever código
de migração. Bump de chave = dados do usuário perdidos.

**Chaves cobertas pelo backup:**
`atlas.settings.v1`, `atlas.wallets.v2`, `atlas.state.v1` (Trade),
`atlas.theses.v1`, `atlas.movements.v1`, `atlas.future_studies.v1`,
`atlas_defi_state_v3`, `atlas_rwa_state_v3`, `HOLD_STATE_V2`,
`HOLD_SIDEBAR`, `atlas.assets.cg_key.v1`.

## Sessão 28/07/2026 — Pontos 4 e 5

### Ponto 5 — Hold: remover Watchlist e Carteira  [FEITO]
- `hold/js/router.js` — retirados os 2 itens da NAV.
- `hold/index.html` — retirados os `<script>` das 2 páginas.
- Apagados `hold/js/pages/carteira.js` e `hold/js/pages/watchlist.js`.
- `hold/js/pages/dashboard.js` — KPI "Watchlist" removido, grid `g-4` → `g-3`.
- `#/carteira` e `#/watchlist` caem no painel sozinhos (o `parseHash` já
  tinha fallback para rota inexistente). Nenhum link órfão no projeto.
- MANTIDOS de propósito: o seletor de carteira Global/Local da topbar e o
  KPI "Valor da carteira" — são coisas diferentes da PÁGINA Carteira.

### Bug "undefined teses ativas"  [FEITO]
- `hold/js/state.js` — `counts()` nunca devolveu `teses_ativas`, mas
  `dashboard.js` lia essa chave. Adicionado: planejadas + em andamento.

### Ponto 4 — Oráculo fixo  [PARCIAL — ver pendência]
- `core/ui/atlas-shell.css` — posição do FAB agora é `!important`
  (`position/right/bottom/top/left`). 40 arquivos CSS em 6 módulos: qualquer
  regra solta podia empurrar o botão. Agora a posição é lei.
- `core/ui/atlas-shell.js` — novo `anchorGuard()`: garante que o FAB seja
  filho DIRETO do `<body>` e avisa no console se algum ancestral tiver
  transform/filter/contain (o que anula `position: fixed`).
- `hold/js/router.js` — **causa provável encontrada**: fazia
  `document.body.innerHTML = ""` a cada render, destruindo o FAB e a faixa
  do shell. O shell os recriava pelo MutationObserver → corrida de
  remontagem. Agora o Hold só remove os próprios nós e preserva
  `[data-atlas-ui]`.

**PENDENTE:** não foi possível reproduzir em navegador real (download do
Chromium bloqueado pela política de rede do ambiente). Se o botão ainda
rolar, rodar no console do Chrome:

    var o=document.querySelector('.atlas-oraculo');
    console.log(getComputedStyle(o).position, o.parentNode.tagName);
    for(var p=o.parentElement;p;p=p.parentElement){var s=getComputedStyle(p);
    if(s.transform!=='none'||s.filter!=='none'||s.contain!=='none')
    console.log('CULPADO:',p.className||p.tagName,s.transform,s.filter,s.contain);}

### Correção de robustez
- `core/currency.js` — erro síncrono no fetch escapava do `.catch()`.

## Sessão 28/07/2026 — Ponto 6  [FEITO]

### Faixa escura removida, "Voltar ao Atlas" no rodapé da sidebar
- `core/ui/atlas-shell.js` — `buildStrip()` virou `mountBackFoot()`. O shell
  acha a sidebar do módulo (tenta `#sidebar`, `.sidebar`, `aside.side`,
  `.rail`, `nav.nav`, `.nav`) e injeta o botão como ÚLTIMO filho.
  Se sobrar faixa de versão antiga no DOM, ela é removida.
- `core/ui/atlas-shell.css` — bloco inteiro da faixa apagado, incluindo
  `body { padding-top: 52px }` e `.sidebar { top: 52px }`. No lugar,
  `.atlas-backfoot` + `[data-atlas-sidebar="on"] { display:flex; column }`
  para o `margin-top:auto` colar o botão no rodapé.

### Detalhe importante: DeFi
O DeFi usa barra HORIZONTAL no topo, não tem sidebar — não recebe o botão
de rodapé. Por isso a regra que esconde os botões nativos passou a depender
de `html[data-atlas-backfoot="on"]`, que o shell só marca DEPOIS de injetar
o substituto. Sem isso o DeFi ficaria sem nenhum botão de voltar.

### Botões nativos (todos cobertos, sem duplicata)
- Hold `.nav-back` · Trade `.nav__back` · RWA `.side-back`/`.side-foot`
  → escondidos, substituídos pelo do shell.
- Academy não tinha nenhum → agora tem.
- DeFi `.nav-back` → PRESERVADO (é o único dele).

### Testado
5 módulos carregados em jsdom: faixa ausente, botão presente, dentro da
sidebar, como último item, apontando para `dashboard.html`.

## Sessão 28/07/2026 — Correções após teste do Jeferson

### Trade sem "Voltar ao Atlas"  [CAUSA ENCONTRADA E CORRIGIDA]
O shell injetava o botão no `<nav class="nav">` VAZIO do HTML estático.
Depois, `trade/assets/js/components/sidebar.js` fazia `el.innerHTML = ...`
e apagava. O observer do shell vigiava só `{childList:true}` no body —
mutação DENTRO do nav não disparava nada. Resultado: Trade ficava sem
botão nenhum (o nativo `.nav__back`, no topo, estava escondido pelo CSS).

Correção em `core/ui/atlas-shell.js`:
- observer agora usa `{childList:true, subtree:true}`;
- se o botão sumiu, `mountBackFoot()` roda IMEDIATAMENTE dentro do callback,
  sem esperar o debounce de 40ms (o Trade re-renderiza em sequência e ficava
  reiniciando o timer → rodapé vazio por ~500ms, flicker visível).

### Oráculo ainda rolando  [TRAVA POR MEDIÇÃO]
`!important` + `anchorGuard` não resolveram — a causa continua não
identificada (sem navegador real neste ambiente para reproduzir).
Trocada a estratégia: em vez de caçar a regra culpada, MEDIR o resultado.

`checkPin()` em `core/ui/atlas-shell.js`:
- a cada scroll/resize (via requestAnimationFrame), compara onde o botão
  ESTÁ com onde DEVERIA estar (canto inferior direito da janela);
- desvio > 2px = `position:fixed` não está valendo;
- então assume o controle: `position:absolute` + `top/left` em coordenadas
  de página, recalculado a cada frame de scroll.
- Também escuta scroll em fase de captura (módulos que rolam container
  interno em vez da janela).
- Se o `fixed` funcionar, a trava nunca liga. Custo zero nesse caso.
- Avisa uma vez no console quando ativa.

PENDENTE: descobrir a causa raiz do fixed quebrado. A trava resolve o
sintoma; a causa continua desconhecida.

## Sessão 28/07/2026 — Pontos 7 + 9  [FEITO]

### Configurações centralizadas, com seção por módulo
`core/atlas-module-settings.js` — ARQUIVO ÚNICO. Um SCHEMA no topo define
os módulos e seus campos; a tela se monta sozinha a partir dele. Para
adicionar opção nova: acrescentar um campo no SCHEMA, nada de HTML.

**Truque que evitou reescrever os módulos:** a tela central grava no MESMO
lugar do localStorage que cada módulo já lê —
`HOLD_STATE_V2.config` e `atlas.state.v1.prefs`. Os módulos não sabem que
a tela mudou de lugar e continuam funcionando sem uma linha alterada.

Seções: Hold (4 campos) · Trade (3 campos + arquivamento) · DeFi e RWA
(sem opções próprias, só nota explicando que usam as globais).

### Removido dos módulos
- `hold/js/pages/configuracoes.js` — apagado; rota fora da NAV.
- `trade/modules/configuracoes/` — apagado (js + css); script e link fora
  do `trade/index.html`.
- `defi/configuracoes.html` — apagado; link fora da navegação.

### Função que quase se perdeu  [RESGATADA]
`archiveOld` / `archivedCount` / `restoreArchived` continuam em
`trade/assets/js/core/state.js`, mas a ÚNICA tela que os chamava era a
config do Trade — apagá-la deixou as funções órfãs e inalcançáveis.
Foram trazidas para a seção Trade da tela central, implementadas direto
sobre o JSON de `atlas.state.v1` (espelhando a lógica original), para não
precisar carregar o Trade inteiro dentro de configuracoes.html.
O botão mostra a contagem e desabilita quando não há nada arquivado.

### NÃO migrado (decisão consciente)
- "Redefinir para dados de exemplo" (Trade e DeFi): os seeds já foram
  zerados; restaurar agora é papel do Exportar/Importar backup.
- Aparência/idioma do DeFi: já eram duplicata das globais.

### Testado
20+ asserções: leitura do que os módulos já gravaram, escrita sem destruir
dados vizinhos (ativos do Hold e trades do Trade intactos), switches e
campos, restauração de arquivados, e ausência das configs nos 3 módulos.

## Sessão 28/07/2026 — Ponto 10: identidade visual  [FEITO — 1ª passada]

### Onde ficou
TUDO em `themes/atlas-effects.css` (seções 9 a 15). Nenhum dos 40 CSS de
módulo foi tocado. Um arquivo muda o visual do site inteiro — que era a
exigência do Jeferson.

### Conceito: "instrumento de infraestrutura"
O site deve ler como painel de controle de capital on-chain, não como
dashboard genérico.

- **§9 Campo esquemático** — malha técnica 64px + dois brilhos radiais na
  cor do módulo, atrás de tudo, com máscara para sumir nas bordas.
- **§10 Superfícies instrumentadas** — fio de luz que nasce no centro do
  topo do card e se abre a 72% no hover.
- **§11 Cantoneiras de HUD** — dois cantos em "L" (mask de 4 segmentos),
  SÓ nos KPIs. É a assinatura; espalhar viraria ruído.
- **§12 Número é dado** — mono + tabular-nums em todo valor e em toda
  tabela. É o que mais separa "planilha" de "terminal".
- **§13 Entrada dos indicadores** — KPIs sobem ao carregar.
- **§14 Revelação no scroll** — `animation-timeline: view()`, CSS puro,
  sem JS/observer, dentro de @supports.
- **§15 Respiro** — bordas viram fio, sombras largas e suaves,
  scrollbar discreta, :focus-visible sempre visível.

### Armadilhas encontradas e resolvidas
1. `body > * { position: relative }` — sobrescreveria o `position:absolute`
   de qualquer filho e quebraria layout nos módulos. Trocado por
   `body::before { z-index: -1 }` + fundo sólido movido para o `<html>`
   (pinta acima do canvas, abaixo do conteúdo, sem tocar em filho nenhum).
2. Descrevi uma "varredura de liquidação" e implementei só um fade —
   sobrou keyframe morto, `overflow:hidden` (cortaria o sparkline) e
   `background-position` sem uso. Código morto removido.
3. O Trade JÁ tinha `.card::before` (fio estático). O meu carrega depois e
   substitui pelo animado — mesma ideia, agora igual em todos os módulos.
   Adicionado `right/bottom: auto` para não depender da regra de
   over-constrained do CSS contra o `inset: 0 0 auto 0` dele.

### Respeita
`data-anim="off"` (kill switch das Configurações) e
`prefers-reduced-motion`. Validado com postcss: 99 regras, 269 declarações.

### PENDENTE
Sem navegador neste ambiente, não consegui VER o resultado. Precisa do
olho do Jeferson. Ajustes prováveis: intensidade da malha de fundo,
opacidade das cantoneiras, e se o hover está exagerado ou tímido.

## Sessão 28/07/2026 — Carteiras + header do DeFi  [FEITO]

### Header do DeFi (só aqui, a pedido)
`defi/js/components.js` — removido o chip "Patrimônio" do topo: repetia o
título "Patrimônio DeFi" que já aparece logo abaixo.
`defi/css/global.css` — `.brand-name` de 16px → 19px.

### Diálogo de carteira UNIFICADO  [ARQUIVO ÚNICO]
`core/ui/atlas-wallet-dialog.js` (novo) + estilos em `core/ui/atlas-shell.css` (§5).

Antes existiam TRÊS jeitos de criar carteira:
  · DeFi      → `window.prompt()` (caixa cinza do navegador)
  · Hold      → `U.modal()` próprio
  · Dashboard → `window.prompt()`
Agora os três chamam `AtlasWalletDialog.open()`.

Recursos: centrado na tela, fundo escurecido + desfocado, fio de luz do
acento no topo, seletor de 16 emojis, prévia ao vivo do selo, botão
travado até ter nome, Enter confirma, Esc/clique fora fecham,
role=dialog + aria-modal.

O texto explica o escopo — é a única coisa que a pessoa não descobre
sozinha depois de criar:
  Global  → "Aparece em todos os módulos e soma no patrimônio total."
  Local   → "Vive só dentro do módulo X. Não entra no total do ATLAS."

### Ícones por tipo (site inteiro)
`js/wallets.js` — novo `typeIcon(type)`:
  global  → globo (meridianos + paralelo) = vale no sistema inteiro
  isolada → cofre (caixa com mostrador)   = guardado dentro de um módulo

### Emoji na carteira (site inteiro)
- `js/wallets.js` — campo `emoji` no modelo, + `setEmoji()`, `badge()`
  (emoji se houver, senão as iniciais) e `emojiSet()` com 16 opções de
  vocabulário de mercado.
- Repasse corrigido em `defi/js/data.js` e `hold/js/state.js`, que
  descartavam o emoji no caminho até `AtlasWallets.create()`.
- Selos com emoji perdem a cor sólida de fundo (`.wsel-swatch.has-emoji`).

### Correção encontrada no teste
Abrir um diálogo logo após fechar outro deixava os dois no DOM por 180ms
(tempo da animação de saída), empilhados no mesmo z-index. `open()` agora
remove qualquer resto na hora.

### Carregamento
13 páginas HTML receberam `<script src=".../core/ui/atlas-wallet-dialog.js">`
logo após `wallets.js`.

## Sessão 28/07/2026 — Correções nas carteiras (após teste do Jeferson)

### 1. Ícone "+" gigante no Hold  [CAUSA ENCONTRADA]
`U.icon(name, cls)` do Hold recebe CLASSE CSS no 2º argumento, não tamanho.
`U.icon("plus", 13)` gerava `class="ico 13"` — SVG sem dimensão, que estica
para preencher o espaço. Corrigido para `U.icon("plus")` + regra em
`core/ui/atlas-shell.css` fixando 14px em `.wsel-add svg`.
ATENÇÃO: o DeFi usa a MESMA chamada mas o helper dele aceita tamanho —
assinaturas diferentes com o mesmo nome entre módulos. Cuidado ao copiar
código de um módulo para outro.

### 2. Menu de carteira não fechava  [CAUSA ENCONTRADA]
`document.addEventListener("click", ...)` era registrado DENTRO da função
de render. Como `renderTopbar()` roda a cada render, acumulava um listener
por render, cada um preso a um `wrap` já removido do DOM — o listener do
elemento atual competia com dezenas de zumbis.

Corrigido nos três lugares (Hold, DeFi, Dashboard) com o mesmo padrão:
um único listener por página, marcado com `data-wsel-close` no `<html>`,
que fecha qualquer `.wsel.open`/`.wallet-sel.open` cujo conteúdo não
contenha o alvo do clique. Clicar DENTRO do menu não fecha mais.

### 3. Diálogo descentralizado no DeFi
O CSS já centraliza. Mas se algum ancestral tiver transform/filter/
backdrop-filter, `position: fixed` deixa de valer e a caixa desce.
(Mesma família do bug do Oráculo, ainda sem causa raiz identificada.)
Adicionado `centralizar()` em `core/ui/atlas-wallet-dialog.js`: mede o
centro real da caixa contra o centro da janela e, se divergir mais de 3px,
assume o controle com `position:fixed` + `translate(-50%,-50%)`.
Avisa no console quando precisa agir — essa mensagem é a pista para achar
a causa raiz depois.

### 4. Paleta de ícones ampliada: 16 → 28, em 3 grupos
- **Ativos**: ₿ Ξ ◎ ₮ $ 🪙 💎 📊
  Os símbolos são CARACTERES de texto, não logotipos: renderizam em
  qualquer sistema, não dependem de imagem e não usam marca de terceiro.
- **Carteiras**: 🦊 👻 🐰 🔐 🏦 🧊 🛡️ 🗝️
  Usamos o bicho que cada carteira conhecida adotou (raposa, fantasma,
  coelho) — reconhecível de longe, sem copiar logotipo.
- **Estratégia**: 🌐 🌱 🚀 🐳 🔥 ⚡ 🎯 🧭 ⚙️ 💰 🏔️ 🌊

`AtlasWallets.iconGroups()` é a nova fonte; `emojiSet()` continua
existindo (lista achatada) para não quebrar chamadas antigas.

### PENDENTE (pedido do Jeferson, depende de login)
Avatar/foto de perfil e nome de usuário editáveis. Fica para a fase
Firebase — sem login não há onde guardar isso por pessoa.

## Sessão 28/07/2026 — Menu de carteira (2ª tentativa)

### O que não bastou
A 1ª correção (listener único, fase de BORBULHA) passou nos testes em
jsdom mas continuou falhando no Chrome do Jeferson. Em jsdom o clique
sempre chega ao document; num navegador real, qualquer elemento no
caminho pode chamar stopPropagation() e o evento morre antes.

### Correção definitiva: FASE DE CAPTURA
`js/wallets.js` ganhou `window.AtlasCloseMenus()` — utilitário único,
chamado por Hold, DeFi e Dashboard (as três lógicas locais foram
apagadas).

    document.addEventListener("click", fechar, true);
                                               ^^^^ captura

Na captura o evento desce da janela até o alvo, então este listener roda
SEMPRE primeiro — é imune a stopPropagation de qualquer terceiro, seja
código nosso, do Chart.js ou de qualquer coisa futura.

Também fecha em `touchstart` (mobile) e `Escape`.
Não fecha quando o clique é DENTRO do menu (contains()).
Idempotente: chamar 10x registra um listener só.

### Teste que prova
`/tmp/capture-test.js` monta um terceiro que engole o clique com
stopPropagation e confirma que o menu fecha assim mesmo. Era exatamente
o cenário que o jsdom não reproduzia.

## PENDENTE — ícones de marca (Jeferson vai enviar)
Ele vai mandar PNG/SVG SEM FUNDO de: Bitcoin, Ethereum, Solana,
Hyperliquid, Base, Arbitrum (e provavelmente Polygon, Optimism).

Tarefa quando chegarem:
1. Redimensionar e padronizar (guardar em `assets/chains/` ou
   `assets/tokens/`).
2. Substituir os selos de TEXTO por ícone de verdade em:
   - `defi/` → modal "Nova Pool", passo 1 "Escolha a blockchain"
     (hoje mostra "SO", "ET", "BA", "AR", "PO", "OP" em quadradinho)
   - listas de posições/pools (hoje "SOL"/"ORCA" em círculo)
   - qualquer lugar que mostre par de tokens
3. Adicionar ao seletor de ícone da carteira, junto dos símbolos de
   texto (₿ Ξ ◎ ₮) que já existem.
4. Um registro único mapeando chain/token → arquivo, para não espalhar
   caminho de imagem pelo código.

## Sessão 28/07/2026 — Pools: quantidade, capital e taxas  [FEITO]

### BLOCO A — wizard Nova Pool
**Passo 3 (Tokens):** campos de quantidade ao lado de cada símbolo
(`#qtyBase`, `#qtyQuote`). Valida que pelo menos um foi preenchido.

**Passo 4 (Capital):** deixou de ser digitado — agora é calculado.
`quantidade × preço = subtotal` por token, somando o capital total.
`#capital` virou hidden, alimentado pelo cálculo.

**Preço:** `core/atlas-price.js` (NOVO, arquivo único).
- Traduz símbolo → USD via CoinGecko (busca id, depois preço).
- Cache por sessão; símbolos ambíguos resolvem pelo de maior cap.
- Stablecoins (USDC/USDT/DAI/…) valem 1 sem ir à rede.
- Falha de rede devolve null e a tela segue no preenchimento manual.
- O campo continua EDITÁVEL: posição aberta em outra data precisa do
  preço daquele dia, não o de hoje. Só sobrescreve se estiver vazio.

**Passo 5 (Objetivo):** 5 caixinhas multi-seleção, no lugar do texto solto:
acumular base · acumular par · foco 100% taxas · APR alto (entrar e sair)
· manter exposição/hedge. Os dois primeiros usam o nome do token digitado.
Texto livre continua, agora reduzido (`.textarea-sm`) e opcional.

### BLOCO B — acompanhamento
Campos novos na pool: `qtyBase/qtyQuote`, `priceBase/priceQuote`,
`createdAt`, `updatedAt`, `fees[]`, `objectives[]`.

**Taxas com histórico** (`addFee`/`removeFee`/`collectFee`): cada coleta é
um registro com data, valor e status (coletada | pendente). Pendente pode
ser marcada como recebida sem perder o histórico.

**`poolSummary(id)`** separa as DUAS origens do resultado:

    varAtivos = valorAtual - capital - taxasTotal

Numa pool dá para ganhar taxa e perder em ativo ao mesmo tempo; somar
tudo num número só esconde impermanent loss. Também devolve APR
realizado (taxa/dia anualizada sobre o capital) e os dias corridos.

Dois painéis novos em `defi/js/pool.js`: "De onde veio o resultado"
(entrou com → vale hoje, com as linhas de ativo e taxa separadas) e
"Taxas" (formulário + lista editável). `rerender()` redesenha só a aba
Resumo para não perder aba nem rolagem a cada registro.

### BUG ENCONTRADO PELO TESTE
`id: "f" + Date.now().toString(36)` — duas taxas registradas no MESMO
milissegundo ganhavam o mesmo id, e remover uma apagava as duas.
Criado `Store._uid(prefixo)` com contador. Vale a pena revisar os outros
`Date.now()` usados como id no projeto.

## Sessão 28/07/2026 — Correções e ajustes nas pools

### 1. Menu da carteira — 3ª tentativa: FOLHA INVISÍVEL
Borbulha falhou. Captura falhou. Ambas passavam em jsdom e falhavam no
Chrome, por motivo não reproduzível fora do navegador.

Nova abordagem, que NÃO depende de propagação: quando um menu abre, uma
folha transparente (`.atlas-menu-scrim`, position:fixed, inset:0,
z-index:1000) é inserida ATRÁS dele. Clique fora acerta a folha — ela é o
próprio ALVO do evento, não um espectador na cadeia. O menu aberto sobe
para z-index:1001 para ficar acima.

Gerenciada por MutationObserver em `js/wallets.js` (dentro de
`AtlasCloseMenus`). As camadas de captura e Esc continuam como reforço.

### 2. Abertura de modal lenta e "pesada"  [CAUSA ENCONTRADA]
`.modal-overlay` tem `backdrop-filter: blur()` em tela cheia. Com o campo
esquemático que criei (`body::before`, gradientes + máscara), o Chrome
precisava recompor aquela camada mascarada A CADA QUADRO da animação.

Correções:
- `body::before` ganhou `transform: translateZ(0)` + `will-change` →
  vira camada de GPU própria, o blur passa a amostrar um resultado já
  composto.
- Overlay: blur 6px → 4px, fade 140ms, `pop` 170ms, `will-change` no
  `.modal`.

### 3. Data de criação editável  [PEDIDO]
Novo `#openedAt` no passo 4. Alimenta `openedAt` E `createdAt` — é dessa
data que sai o APR realizado, então pool aberta mês passado precisava
poder informar a data real. Bloqueia data futura.

### 4. Dentro / fora do range na criação  [PEDIDO]
`#rngOpts`: Dentro do range · Fora do range · Ainda em análise.
"Fora" grava `status: "range"` e `rangePos: 1`.

### 5. Encerrar pool destruía a estratégia  [BUG GRAVE]
`closePool` montava um objeto novo com 12 campos e DESCARTAVA o resto:
taxas, objetivos, diário, timeline, movimentações, quantidades e preços
de entrada. Encerrar uma posição apagava tudo que fazia dela uma
estratégia — sobrava só o número final.

Agora vai a pool INTEIRA para o histórico (cópia integral), mais:
- `closeSummary` — fotografia do resultado já decomposto (ativo x taxa)
  calculada ANTES de sair da lista ativa;
- linha de "Encerramento" na timeline com o motivo e os números;
- `reopenPool(id)` — desfaz um encerramento por engano, com tudo intacto.

## 28/07/2026 — CAUSA RAIZ ENCONTRADA (Oráculo, diálogo e menu)

O console do Jeferson entregou:
    [AtlasShell] O botão do Oráculo está preso num elemento que quebra
    position:fixed (transform/filter/contain). Elemento: <body>

E o painel de estilos mostrou o porquê:
    @keyframes atlasPageIn { from { transform: translateY(10px) } ... }
    body { animation: atlasPageIn .45s ease both; }

### Por que isso quebra tudo
Elemento com animação que TOCA em transform vira bloco de contenção para
`position: fixed`. Com `fill-mode: both` a animação nunca sai da fase de
preenchimento — então o body permanecia bloco de contenção PARA SEMPRE,
mesmo com o quadro final em `transform: none`.

Ou seja: TODO `position: fixed` da página estava quebrado o tempo inteiro.

### Explica os TRÊS sintomas de uma vez
1. **Oráculo rolando** — ancorado no documento, não na janela.
2. **Diálogo de carteira fora do centro** — `inset: 0` media a caixa do
   body, não a viewport.
3. **Menu da carteira não fechando** — a folha invisível
   (`.atlas-menu-scrim`, position:fixed inset:0) ficava ancorada no TOPO
   DO DOCUMENTO. Com a página rolada, ela ficava acima da área visível e
   nunca recebia o clique. Por isso as três tentativas (borbulha,
   captura, folha) falhavam no Chrome e passavam em jsdom — jsdom não
   faz layout, então nunca reproduziu.

### Correção
Estava em QUATRO arquivos: `trade/assets/css/base.css`,
`hold/css/global.css`, `defi/css/global.css`, `css/global.css`.
Em todos, `body` passou a usar `@keyframes atlasPageFade` (só opacidade).
O transform continua nos FILHOS (`.page > *`, `#app-view > *`,
`.view__inner > *`) — eles não são ancestrais de nada com position:fixed.

### Trava contra regressão
`themes/atlas-effects.css` §16 (carrega por último, é a última palavra):
    body { animation-name: atlas-body-in !important;
           transform: none !important; filter: none !important; }

E `test-fixed.js`: varre os 39 CSS, descobre quais keyframes tocam em
transform/filter e falha se algum estiver aplicado a body/html. Também
barra transform/filter direto no body.

### Os remendos de JS ficam
`checkPin()` (Oráculo) e `centralizar()` (diálogo) continuam no código
como rede de segurança — com a causa corrigida eles nunca disparam, e
custam zero nesse caso. Se voltarem a avisar no console, é sinal de que
alguém reintroduziu um bloco de contenção.
