# ATLAS · Módulo DeFi

Software profissional de **gestão patrimonial DeFi**. Organiza posições, calcula
métricas, registra histórico e estratégias, e apresenta gráficos. Sem IA nesta
etapa — o **Oráculo** consumirá estes dados no futuro.

Feito com HTML, CSS e JavaScript puro (sem build). É só abrir o `index.html`.

---

## Como abrir

Abra `defi/index.html` no navegador. Os dados de exemplo carregam sozinhos.
As alterações (novas pools, anotações, etc.) ficam salvas no navegador
(`localStorage`); em `file://` sem storage, funcionam em memória na sessão.

> Gráficos e fontes usam CDN (Chart.js + Google Fonts), então mantenha conexão
> na primeira carga.

## Plugar no Atlas

O ponto de entrada do módulo é `defi/index.html`. Basta o botão **DeFi** do
Atlas apontar para lá:

```html
<a href="defi/index.html">DeFi</a>
```

O botão "Atlas" no canto superior direito volta para `../index.html`.

---

## Arquitetura

Totalmente modular. Cada página tem HTML próprio, CSS próprio e JS próprio,
sempre reutilizando componentes.

```
defi/
├── index.html            Dashboard (entrada)
├── pools.html            Lista de pools + assistente "Nova Pool"
├── pool.html             Página da posição (?id=) com abas
├── staking.html          Staking
├── lending.html          Lending
├── analytics.html        Gráficos (somente leitura)
├── historico.html        Posições encerradas + filtros
├── configuracoes.html    Preferências, exportação, backup
│
├── css/
│   ├── global.css        Tokens, tema, nav superior, botões, tags, status…
│   ├── cards.css         Cards financeiros e de pool, timeline, diário, abas
│   ├── dashboard.css     Grids de layout
│   ├── forms.css         Inputs, wizard, filtros, switches
│   ├── tables.css        Listas de dados (histórico, distribuições)
│   ├── animations.css    Keyframes (respeita prefers-reduced-motion)
│   └── responsive.css    Notebook · Tablet · Celular (1 coluna)
│
├── js/
│   ├── data.js           ★ Camada de dados única (DataStore + localStorage)
│   ├── utils.js          Formatação, ícones SVG, toasts, status
│   ├── components.js     Nav, card financeiro, card de pool, estado vazio
│   ├── charts.js         Wrappers temáticos sobre Chart.js
│   ├── filters.js        Motor de filtros reutilizável
│   ├── search.js         Pesquisa instantânea
│   ├── dashboard.js · pools.js · pool.js · staking.js
│   ├── lending.js · analytics.js · history.js · config.js
│
├── data/
│   └── seed.example.json Snapshot dos dados (referência / futuro import)
└── assets/               Logos/ícones opcionais
```

### Camada de dados (`js/data.js`)

É a fonte única de verdade. Toda página lê e escreve por `window.DeFiStore`:

```js
DeFiStore.kpis()             // patrimônio, lucro, pools ativas, APR médio
DeFiStore.pools()            // posições abertas
DeFiStore.pool(id)           // uma posição
DeFiStore.addPool(obj)       // cria posição
DeFiStore.addNote(id, txt)   // anota no diário
DeFiStore.closePool(id, why) // encerra → move ao histórico
DeFiStore.distribution(by)   // 'chain' | 'protocol' | 'category' | 'token'
DeFiStore.staking()          // posições de staking
DeFiStore.lending()          // posições de lending
```

É exatamente esse contrato que o **Oráculo** vai consumir depois.

---

## Escalabilidade

A arquitetura permite adicionar, sem alterar a estrutura principal:
**Borrow · Vaults · Restaking · Rewards · Bridges · Airdrops · Watchlist.**

Cada novo módulo é uma página (`novo.html`), com seu CSS e JS, reaproveitando
`components.js`, `charts.js` e o `DataStore`. Basta adicionar o item ao array
`NAV` em `js/components.js`.

---

## Design

Tema escuro, azul predominante, detalhes em roxo e ciano, glassmorphism
discreto e animações suaves. Navegação no topo (sem menu lateral). Posições
sempre em **cards**, nunca em tabela. Filosofia de software financeiro
profissional — não de protocolo, explorador ou planilha.
