# HOLD · Sistema de Investimento (ATLAS)

Sistema independente de gestão de investimentos de longo prazo baseada em tese,
análise e decisão documentada. Frontend puro (HTML/CSS/JS), estado centralizado
e persistência local — sem build, sem dependências, sem servidor.

## Como abrir
- **Local:** basta abrir `index.html` no navegador (funciona via `file://`).
- **Servido:** sirva a pasta `Hold/` por qualquer servidor estático.

Não há passo de build. Todos os scripts são carregados via `<script>` e os dados
semente vêm de `data/seed.js` (sem `fetch`), então nada quebra em `file://`.

## Estrutura
```
Hold/
├── index.html            Shell da aplicação (carrega tudo)
├── css/
│   ├── global.css        Tokens (paleta LOCKED), reset, layout, sidebar/topbar
│   └── components.css     Cards, tabelas, botões, forms, badges, modais, timeline
├── js/
│   ├── state.js          Estado central + eventos + localStorage + actions
│   ├── components.js      Construtores de UI + ícones + formatadores
│   ├── charts.js          Gráficos SVG (linha, donut, sparkline)
│   ├── forms.js           Fluxos de modal (ativo, tese, estudo, trade)
│   ├── router.js          Hash router + montagem do shell
│   └── pages/             Uma página por módulo (10 módulos)
├── data/
│   └── seed.js            Dados iniciais (só usados na 1ª execução)
└── assets/
```

## Módulos
Painel · Carteira · Watchlist · Ativos · Teses · Estudos · Métricas · Histórico · Relatórios · Configurações

## Arquitetura
- **Estado único** em `window.Store.state` (`HOLD_STATE`). A UI **nunca** muta dados
  direto — tudo passa por `Store.actions.*`, que valida a regra, altera o estado,
  **registra histórico**, **emite um evento** e **espelha no localStorage**.
- **Eventos:** `ASSET_CREATED`, `THESIS_CREATED`, `POSITION_UPDATED`,
  `STUDY_CONVERTED`, `THESIS_UPDATED`, `TRADE_EXECUTED`.
- **Regras centrais aplicadas:**
  - Nenhum ativo é *investido* sem tese (compra exige tese vinculada).
  - Toda decisão gera histórico.
  - Toda tese pode ser revisada.
  - Toda venda depende de invalidação ou realização da tese (motivo obrigatório).

## Persistência
Estado salvo em `localStorage` (`HOLD_STATE_V1`). Em Configurações há exportar/importar
JSON e restaurar dados de exemplo.

## Integração com o ATLAS
O sistema é auto-contido. Para lançar a partir do Atlas, o botão **HOLD** deve
apontar para `Hold/index.html` (link direto, `<iframe>` ou nova aba). Rotas internas
usam hash, então dá para abrir direto num módulo, ex.: `Hold/index.html#/carteira`.
