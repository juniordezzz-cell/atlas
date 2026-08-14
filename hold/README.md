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
│   ├── forms.js           Fluxos de modal (novo ativo, editar ativo, tese, trade)
│   ├── router.js          Hash router + montagem do shell
│   └── pages/             Uma página por tela (6 telas)
├── data/
│   └── seed.js            Dados iniciais (só usados na 1ª execução)
└── assets/
```

## Telas
Painel · Ativos · Teses · Métricas · Histórico · Relatórios

São seis, e são as que existem na navegação. Este README listava dez —
incluindo Carteira, Watchlist, Estudos e Configurações, que não são
rotas do módulo. Watchlist é um *filtro* dentro de Ativos, Carteira
virou a central compartilhada (`/wallets` e `carteiras.html`), Estudos
deixou de existir quando virou Tese planejada, e as preferências do
Hold moram em **Configurações → Hold**, na tela central.

## Arquitetura
- **Estado único** em `window.Store.state` (`HOLD_STATE`). A UI **nunca** muta dados
  direto — tudo passa por `Store.actions.*`, que valida a regra, altera o estado,
  **registra histórico**, **emite um evento** e **espelha no localStorage**.
- **Eventos:** `ASSET_CREATED`, `THESIS_CREATED`, `POSITION_UPDATED`,
  `THESIS_UPDATED`, `TRADE_EXECUTED`. (`STUDY_CONVERTED` continua
  declarado por compatibilidade com históricos antigos; nada o emite
  desde que Estudos viraram Teses planejadas.)
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
`concluida` e `arquivada`.

**Backup é central**, não do módulo: Configurações → Dados e Backup cobre
`atlas.hold.state.v2`, `atlas.hold.wallet.v1` e o livro de caixa, e
restaura tudo junto. O Hold já teve um "Exportar JSON" próprio que nada
lia de volta — e cujo arquivo levava as posições sem os eventos de caixa
que as explicam. Um formato de backup por sistema, não um por módulo.

## Integração com o ATLAS
O sistema é auto-contido. Para lançar a partir do Atlas, o botão **HOLD** deve
apontar para `Hold/index.html` (link direto, `<iframe>` ou nova aba). Rotas internas
usam hash, então dá para abrir direto numa tela, ex.:
`hold/index.html#/ativos` — ou num ativo específico,
`hold/index.html#/ativos?id=as_xxx`.

## Preferências (Configurações → Hold)
- **Alertar posição sem tese** e **Alertar concentração elevada** ligam e
  desligam os alertas que o módulo emite de fato.
- **Limite de concentração (%)** é o número que decide o alerta, a cor da
  barra de peso na lista e o selo na tela do ativo — um dono só. Estava
  escrito como `40` em três lugares.
- **Mostrar convicção nas listas** esconde a coluna em Ativos e Relatórios.

As três anteriores ("teses invalidadas", "teses em revisão" e a própria
convicção) existiam na tela de Configurações e **não eram lidas por
nenhuma linha do módulo** — e as duas primeiras nomeavam status que
deixaram de existir.
