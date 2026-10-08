# HOLD · Sistema de Investimento (ATLAS)

Sistema independente de gestão de investimentos de longo prazo: posições,
preço médio, resultado aberto e realizado, e decisões documentadas. Frontend puro (HTML/CSS/JS), estado centralizado
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
│   ├── forms.js           Fluxos de modal (novo ativo, editar ativo, compra/venda)
│   ├── router.js          Hash router + montagem do shell
│   └── pages/             Uma página por tela (6 telas)
├── data/
│   └── seed.js            Dados iniciais (só usados na 1ª execução)
└── assets/
```

## Telas
Painel · Ativos · Métricas · Histórico · Relatórios

Watchlist é um *filtro* dentro de Ativos, Carteira virou a central
compartilhada (`/wallets` e `carteiras.html`), e as preferências do
Hold moram em **Configurações → Hold**, na tela central.

O ATLAS **não tem mais teses** (decisão de 23/09/2026). O que o módulo
tinha gravado disso — convicção no ativo, tese vinculada, linhas "Tese
criada/revisada" no histórico — é limpo na primeira leitura
(`limparTeses()` em `js/state.js`).

## Arquitetura
- **Estado único** em `window.Store.state` (`HOLD_STATE`). A UI **nunca** muta dados
  direto — tudo passa por `Store.actions.*`, que valida a regra, altera o estado,
  **registra histórico**, **emite um evento** e **espelha no localStorage**.
- **Eventos:** `ASSET_CREATED`, `POSITION_UPDATED`, `TRADE_EXECUTED`.
- **Regras centrais aplicadas:**
  - **O que bloqueia a compra é o CAIXA.** Sem dinheiro na carteira a
    compra não acontece; pelo formulário, o que faltar entra como
    depósito automático.
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
  - **Venda realiza resultado.** Cada venda grava custo baixado (preço
    médio × quantidade), apurado e a diferença em `vendas`;
    `Store.get.realizado()` soma o resultado e `capitalRealizado()` a base.
  - **A curva de evolução é medida, não gerada** (`portfolioHistory`):
    uma leitura por dia, por carteira. Sem duas medições, a tela diz que
    não há histórico em vez de desenhar.
  - **Preço:** a cadeia única do ATLAS (`core/atlas-precos.js`) resolve
    pelo ticker; o que nenhuma fonte reconhecer é informado à mão em
    **Editar**, e o valor manual vence a API até ser limpo.
  - **Operação tem data.** Compra e venda levam a data escolhida no
    formulário (nunca no futuro); histórico, extrato e abertura da
    posição usam essa data. Em data passada de cripto, o formulário
    oferece o fechamento do dia (`AtlasPrecos.emData`).
  - **Quantidade sem resto de ponto flutuante** (`arredQtd`, 10 casas):
    0,7 − 0,4 deixava 0,29999… e a venda de "0,3" era recusada.
  - **Desfazer a última operação** (`undoLast`): cada compra/venda grava
    em `operacoes` a posição de antes e os eventos de caixa que criou.
    Só a mais recente por ativo+carteira; venda só se desfaz se o
    dinheiro ainda está no caixa. O histórico mantém a linha, riscada
    (`desfeita: true`), e ganha "Operação desfeita".
  - **Realizado por ativo** (`realizadoDoAtivo`): ativo vendido mostra
    "Posição encerrada" com o resultado, não "Ainda não investido".
  - **Preço automático só para cripto.** Ação/ETF/commodity/outro ficam
    no preço manual — a cadeia casava AAPL/TSLA/GOLD com tokens
    homônimos em DEX. Ativo vindo do autocompletar guarda `cg_id` e é
    cotado pelo id exato. Com a fonte principal fora do ar, preço de DEX
    não é aplicado e a tela avisa em vez de pedir preço manual.
    Preços com mais de 15 min se remarcam sozinhos ao abrir o Hold.
  - **Taxa (USD), da corretora ou da rede.** Na compra entra no custo:
    sai do caixa junto e sobe o preço médio. Na venda sai do apurado:
    volta menos ao caixa e o resultado é líquido. Taxa maior que o
    valor da venda é recusada.
  - **Todas as carteiras** (seletor, chave `atlas.hold.escopo.v1`):
    as leituras somam as carteiras que o Hold enxerga (globais + locais
    do Hold); o mesmo ativo em várias carteiras vira uma linha com
    preço médio ponderado (`partes` guarda as reais). Escolher uma
    carteira desliga o modo. Escritas sempre usam a carteira explícita
    da operação; a medição diária é gravada por carteira real.
  - Toda decisão gera histórico.

## Persistência
Estado salvo em `localStorage` (`atlas.hold.state.v2`).

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
- **Alertar concentração elevada** liga e desliga o alerta que o módulo
  emite de fato.
- **Limite de concentração (%)** é o número que decide o alerta, a cor da
  barra de peso na lista e o selo na tela do ativo — um dono só. Estava
  escrito como `40` em três lugares.
