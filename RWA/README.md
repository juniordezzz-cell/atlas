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

O link "Voltar ao Atlas" na sidebar retorna para `../index.html`.

---

## Arquitetura (SPA modular)

Uma única página. As telas são **views** trocadas por um roteador de hash
(`#/rota`), sem reload. Cada view tem sua responsabilidade e reaproveita
componentes e a camada de dados.

```
RWA/
├── index.html              Casca do SPA + ordem de carga dos scripts
│
├── css/
│   ├── tokens.css          Paleta e variáveis (dark institucional)
│   ├── base.css            Reset, tipografia, utilitários
│   ├── layout.css          Shell: sidebar + topbar + grids
│   ├── components.css       KPI, tabela, badges, regime, heatmap, timeline…
│   ├── animations.css       Keyframes (respeita prefers-reduced-motion)
│   └── responsive.css      Notebook · Tablet · Mobile (sidebar colapsável)
│
├── components/
│   ├── shell.js            Sidebar de navegação + top bar (window.Shell)
│   └── ui.js               Peças de UI: kpi, panel, meter, legend (window.UI)
│
├── js/
│   ├── store.js            ★ Camada de dados única (window.RWAStore)
│   ├── utils.js            Formatação, ícones SVG, regime/score, toast (window.U)
│   ├── charts.js           Wrappers Chart.js temáticos (window.Charts)
│   ├── router.js           Roteador SPA por hash (window.Router)
│   ├── app.js              Bootstrap: monta shell, registra rotas, inicia
│   └── view-*.js           dashboard · portfolio · asset · macro · risk ·
│                           narrative · journal (window.Views.*)
│
├── data/
│   └── seed.example.json   Snapshot dos dados + derivados (referência / API)
└── assets/                 Logos/ícones opcionais
```

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
- **Nova tela** → criar `js/view-nova.js` com `window.Views.nova`, registrar a
  rota no `app.js` e o item na sidebar (`components/shell.js`).

Nenhuma dessas mudanças toca na estrutura principal.

---

## Identidade

Dark mode institucional (`#0B0F1A` / cards `#111827`), azul `#4F8CFF` e roxo
macro `#8B5CF6`, bordas finas, sombras quase invisíveis, glass leve. Tipografia
Inter + JetBrains Mono para números. Sensação de terminal financeiro — densidade
e clareza acima de enfeite.
