# Interface em português e cor de ação única — 15/11/2026

Registro para quem mexer depois (Claude ou Codex). Itens 1 e 2 da lista de
profissionalismo pedida pelo dono.

## 1. Tudo em português

Levantamento automático do texto visível em cada tela e em cada aba do submenu
(antes: ~85 textos em inglês; depois: só siglas do mercado e nomes próprios).
Ficam em inglês, de propósito: **APR, APY, TVL**, os nomes dos módulos
(**Hold, Trade, DeFi, RWA**), **Swap**, **Risk-on/Risk-off** e os títulos reais
de artigos acadêmicos no Academy.

| Antes | Depois | Onde |
|---|---|---|
| Dashboard (submenu dos módulos) | Painel | DeFi, Trade, RWA (o Hold já usava) |
| Portfolio · Risk Engine · Narrative (Engine) · Journal | Portfólio · Risco · Narrativas · Diário | RWA |
| Total Portfolio Value · PnL · Risk Score · Macro Regime · Regime | Valor do portfólio · Resultado · Nota de risco · Cenário macro · Cenário | RWA |
| Equity Curve · Performance · Alertas do Risk Engine | Evolução do patrimônio · Desempenho · Alertas de risco | RWA |
| Asset · Type · Entry · Current · Weight · Score · Regime Sens. | Ativo · Tipo · Entrada · Atual · Peso · Nota · Sens. ao cenário | RWA (tabela) |
| Tech Expansion, Hedge Mode, Liquidity Expansion… | Expansão em tecnologia, Modo proteção, Expansão de liquidez… | RWA (`store.js`, só o rótulo) |
| Lending · Analytics · Chain | Empréstimos · Análises · Rede | DeFi |
| Trades · Analytics · Winrate · Profit factor | Operações · Análises · Taxa de acerto · Fator de lucro | Trade |
| "trade" nas frases da tela | "operação", com a concordância ("Nenhuma operação aberta") | Trade, Oráculo do Trade, Configurações |
| GLOBAL CRYPTO & RWA COMMAND CENTER · LIVE | PANORAMA GLOBAL · CRIPTO E RWA · AO VIVO | Mercado |
| Analytics · Yields · Alertas 24/7 · Melhores yields | Análises · Rendimentos · Alertas 24h · Melhores rendimentos | Mercado |
| Watchlist | Em observação / Observar ativo | Hold |
| Net worth · Send · Deposit · Asset/Value/Price/Allocation/Actions | Patrimônio · Enviar · Depositar · Ativo/Valor/Preço/Alocação/Ações | Carteiras |

### O que NÃO mudou (identificadores e dados salvos)

- Abas do Mercado: o código compara com o nome interno (`"Analytics"`,
  `"Yields"`, `"Alertas 24/7"`); só o rótulo usa `ROTULO_ABA`
  (`mercado/js/dashboard.js`).
- Categoria das posições DeFi: continua gravada como `"Lending"`/`"Yield"`.
  O seletor usa `value` e a legenda usa `ROTULO_CAT` (`defi/js/data.js`).
- Rotas (`#/trades`, `#/analytics`, `lending.html`…), ids e status internos
  (`watchlist`).
- Textos que ficam gravados no histórico do Trade (`state.js`).
- O motor de idiomas (`core/i18n.js`) está dormente por decisão: o site é só
  português.
- O item "Dashboard" do menu lateral (página principal) continua com esse nome.

## 2. Cor de ação única

Antes, quatro cores de botão principal: azul `#4DA3FF` (Hold), azul `#4F8CFF`
(RWA), degradê verde com brilho (DeFi), azul `#5B8CFF` (Ferramentas, que também
pintava metade dos títulos: "Lucro **Cripto**").

Agora: token `--atlas-acao` (`#00BFFF`, hover `#33CCFF`, texto
`--atlas-acao-tinta` `#04121C`) em `themes/atlas-theme.css`, aplicado em
`.btn.primary` (Hold), `.rbtn-primary` (RWA), `.btn-primary` (DeFi, sem degradê
nem sombra), `.btn--accent` (Trade, sem degradê nem sombra) e `.btn--principal`
(Ferramentas, que não carregam o tema e usam o valor direto). Dashboard,
Academy e Finanças já usavam o ciano.

Títulos das ferramentas numa cor só (`h1 span{color:inherit}` em
`_comum/ferramenta.css`, Market Cap, Comparador, Simulador e no
`_fonte-quadro/quadro-src.html`, inclusive o título da imagem exportada).

Ficam como estão, por serem informação e não ação: botões semânticos
(`.btn--profit` verde no Trade, perigo em vermelho), estado selecionado (período
ativo do Comparador, página atual do Scanner), paleta de desenho da Escada e da
Estratégia, e a cor de marca de cada módulo em detalhes e gráficos.

De passagem: o botão "Importar extrato" do Finanças estava com o fundo cinza
padrão do navegador (o estilo `.fp-link` foi feito para link); ganhou fundo
transparente.

## Verificação

- Levantamento de inglês antes/depois em 15 telas e em todas as abas do submenu.
- Botões de ação conferidos em Hold, DeFi, RWA, Trade (Operações) e Lucro.
- Testes: 296 passam.
