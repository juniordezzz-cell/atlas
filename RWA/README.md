# ATLAS · Módulo RWA

Terminal de **inteligência macro + TradFi + fluxo global** para ativos do mundo
real tokenizados (Real World Assets). Estética *dark institucional* — "Bloomberg
+ Web3 analytics", com foco em densidade de dados.

SPA em HTML, CSS e JavaScript puro (sem build, sem backend). É só abrir o
`index.html`. Roda de forma **independente**, dentro ou fora do Atlas.

---

## Como abrir

Abra `RWA/index.html` no navegador. O JSON de dados já vem embutido no
`js/store.js`, então funciona no `file://` (duplo clique). As alterações (novas
entradas no Journal, etc.) ficam salvas no navegador (`localStorage`), com
fallback em memória quando o storage não está disponível.

> Gráficos e fontes usam CDN (Chart.js + Google Fonts) — mantenha conexão na
> primeira carga.

## Plugar no Atlas

O ponto de entrada é `RWA/index.html`. O botão **RWA** do Atlas aponta para lá:

```html
<a href="RWA/index.html">RWA</a>
```

O link "Voltar ao Atlas" no rodapé da sidebar retorna para `../dashboard.html`.

---

## Arquitetura (SPA em arquivo único)

Uma única página. As telas são trocadas por um roteador de hash (`#/rota`), sem
reload. **Shell, roteador, views e formulários vivem todos em `js/rwa-app.js`.**

Essa concentração foi deliberada: a versão anterior era espalhada em
`shell.js` + `router.js` + `app.js` + sete `view-*.js`, e qualquer erro em um
deles produzia **tela branca muda**. O arquivo único é blindado — captura erro
global e mostra a falha na tela, com Chart.js, `AtlasWallets` e `AtlasAssets`
todos opcionais.

```
RWA/
├── index.html              Casca do SPA + ordem de carga dos scripts
│
├── css/
│   ├── tokens.css          Paleta e variáveis (dark institucional)
│   ├── base.css            Reset, tipografia, utilitários
│   ├── layout.css          Shell: sidebar + topbar + grids
│   ├── components.css      KPI, tabela, badges, regime, heatmap, timeline…
│   ├── animations.css      Keyframes (respeita prefers-reduced-motion)
│   └── responsive.css      Notebook · Tablet · Mobile (sidebar colapsável)
│
├── components/
│   └── ui.js               Peças de UI: kpi, panel, meter, legend (window.UI)
│
├── js/
│   ├── store.js            ★ Camada de dados única (window.RWAStore)
│   ├── utils.js            Formatação, ícones SVG, regime/score, toast (window.U)
│   ├── charts.js           Wrappers Chart.js temáticos (window.Charts)
│   └── rwa-app.js          ★ Shell + Router + Views + Formulários
│
├── data/
│   └── seed.example.json   Snapshot dos dados + derivados (referência / API)
└── assets/                 Logos/ícones opcionais
```

> **Histórico.** `js/app.js`, `js/router.js` e sete `js/view-*.js` existiam aqui
> como versão anterior desta arquitetura. Ficaram meses no disco sem nenhuma tag
> `<script>` apontando para eles, o que levava quem fosse corrigir um bug a
> editar o arquivo errado. Foram removidos — estão no histórico do git se algum
> dia forem necessários. O código em execução é o `rwa-app.js`.

### Rotas

```
#/dashboard        Visão geral (KPIs, alocações, equity curve, macro snapshot)
#/portfolio        Tabela de ativos (filtros + ordenação)
#/asset/:id        Análise completa do ativo (3 camadas + performance)
#/macro            Ambiente macro (juros, inflação, DXY, liquidez, risk-on/off)
#/risk             Risk Engine (heatmap de concentração + alertas)
#/narrative        Narrative Engine (tese macro dominante + ciclos)
#/journal          Registro de decisões (timeline estilo AXIOM)
```

### Camada de dados (`js/store.js`)

Fonte única de verdade. Toda view lê por `window.RWAStore`:

```js
RWAStore.kpis()               // patrimônio, PnL, risk score, regime
RWAStore.assets()             // ativos com pnl/peso calculados
RWAStore.asset(id)            // ativo único (3 camadas de análise)
RWAStore.allocationByClass()  // alocação por classe
RWAStore.allocationBySector() // alocação por setor
RWAStore.equityCurves()       // RWA vs HOLD vs TOTAL ATLAS
RWAStore.macro()              // juros, inflação, DXY, liquidez, risk-on/off
RWAStore.narrative()          // narrativa atual + ciclos
RWAStore.riskEngine()         // concentração, risco total, alertas
RWAStore.journal()            // decisões; addJournal(entry) registra
```

É esse contrato que o **Oráculo** vai consumir depois. Trocar o `store.js` por
uma API/feed externo não exige mexer em nenhuma view.

---

## Regime de mercado (core)

O sistema classifica o ambiente em cinco regimes, refletidos no topo, no macro e
no dashboard:

`Risk-On (Tech Expansion)` · `Risk-Off (Hedge Mode)` ·
`Liquidity Expansion` · `Liquidity Contraction` · `Transition Phase`

---

## Escalabilidade

Para crescer (novos feeds, mais ativos, API externa), basta:

- **Novo dado** → adicionar ao `store.js` (ou plugar a API na mesma interface).
- **Nova tela** → dentro de `js/rwa-app.js`: escrever o handler da view,
  registrá-lo em `Router.register("rota", handler)` e acrescentar a entrada no
  array `NAV` do topo do arquivo — a sidebar se monta a partir dele.

Nenhuma dessas mudanças toca na estrutura principal.

---

## Pendências conhecidas

- **Teses.** O RWA é o único módulo que ainda não consome a entidade
  compartilhada `AtlasTheses`. Por isso as decisões registradas aqui
  (`Narrative` e `Journal`) não aparecem no Academy junto com as de Hold,
  Trade e DeFi.
- **Tokens sem ponte.** Os cinco tokens de regime de mercado (`--r-riskon`,
  `--r-riskoff`, `--r-liqexp`, `--r-liqcon`, `--r-trans`) não passam por
  `themes/atlas-theme.css` e mantêm o valor fixo daqui, logo não acompanham o
  tema claro.

---

## Identidade

Dark mode institucional (`#0B0F1A` / cards `#111827`), azul `#4F8CFF` e roxo
macro `#8B5CF6`, bordas finas, sombras quase invisíveis, glass leve. Tipografia
Inter + JetBrains Mono para números. Sensação de terminal financeiro — densidade
e clareza acima de enfeite.
