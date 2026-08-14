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
  - **O que bloqueia a compra é o CAIXA, não a tese.** A regra anterior
    recusava comprar sem tese vinculada. Tese é *disciplina* — a ausência
    é problema de processo, e o alerta "Posição sem tese" já cobra.
    Caixa é *possibilidade*: sem dinheiro a compra não acontece. Bloquear
    pela tese fazia o ATLAS recusar o registro de uma compra que ocorreu
    no mundo real. A posição nasce marcada com `semTese` até ela existir.
  - **Um ticker, um ativo.** `createAsset` recusa ticker repetido, sem
    diferenciar maiúsculas.
  - **O status do ativo é derivado, nunca digitado** (`Store.get.statusDe`):
    tem posição → investido; sem posição e com venda no histórico →
    vendido; senão → watchlist. Era um campo gravado, e o formulário
    oferecia "Investido" numa lista — dava para possuir no papel sem
    comprar nada.
  - **Nenhuma operação faz dinheiro sumir.** Compra debita o caixa da
    carteira ativa; venda credita o apurado inteiro de volta. Venda exige
    preço positivo — a zero, a posição sairia da carteira sem nada voltar.
  - **A curva de evolução é medida, não gerada** (`portfolioHistory`):
    uma leitura por dia, por carteira. Sem duas medições, a tela diz que
    não há histórico em vez de desenhar.
  - **Preço:** a cadeia única do ATLAS (`core/atlas-precos.js`) resolve
    pelo ticker; o que nenhuma fonte reconhecer é informado à mão em
    **Editar**, e o valor manual vence a API até ser limpo.
  - Toda decisão gera histórico.
  - Toda tese pode ser revisada.
  - Toda venda depende de invalidação ou realização da tese (motivo obrigatório).

## Persistência
Estado salvo em `localStorage` (`atlas.hold.state.v2`). As **teses** não moram
aqui: a fonte da verdade é a entidade compartilhada `AtlasTheses`
(`core/entities/theses.js`), com os status `planejada`, `andamento`,
`concluida` e `arquivada`. Em Configurações há exportar/importar JSON.

## Integração com o ATLAS
O sistema é auto-contido. Para lançar a partir do Atlas, o botão **HOLD** deve
apontar para `Hold/index.html` (link direto, `<iframe>` ou nova aba). Rotas internas
usam hash, então dá para abrir direto num módulo, ex.: `Hold/index.html#/carteira`.
