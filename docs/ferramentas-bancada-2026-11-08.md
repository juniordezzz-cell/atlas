# Bancada de Ferramentas: as 8 calculadoras que vieram do site antigo (08/11/2026)

Registro para quem mexer depois (Claude ou Codex). Plano executado:
[2026-11-08-ferramentas-bancada.md](superpowers/plans/2026-11-08-ferramentas-bancada.md).

## O pedido

O dono tinha uma pasta `Desktop/ferramentas` com as calculadoras do site antigo
(MundoDeFi) e duas ferramentas novas feitas em 07/11 (Escada e Estratégia de
Pool). Pediu para trazer todas para o ATLAS, **sem nada do MundoDeFi**, no layout
do ATLAS, no menu Ferramentas, com capas, e publicar no GitHub. O IMD
(diagnóstico do investidor) ficou para depois.

## O que entrou

| Ferramenta | Pasta | Veio de | Seção na bancada |
|---|---|---|---|
| Conversor e Câmbio | `Ferramentas/conversor/` | `conversor.html` + `cambio.html` (juntados em 07/11) | Gerir o dinheiro |
| Escada · DCA e preço médio | `Ferramentas/escada-dca/` (gerado) | quadro de 07/11 | Planejar entradas e saídas |
| Lucro Cripto | `Ferramentas/lucro-cripto/` | `lucro-cripto.html` | Planejar entradas e saídas |
| Simulador de Trade | `Ferramentas/simulador-de-trade/` | `simulador-de-trade.html` | Planejar entradas e saídas |
| Estratégia de Pool | `Ferramentas/estrategia-de-pool/` (gerado) | quadro de 07/11 + `pool-liquidez.html` (faixa cheia V2) | DeFi e renda |
| Staking | `Ferramentas/staking/` | `staking.html` | DeFi e renda |
| Juros Compostos | `Ferramentas/juros-compostos/` | `juros-compostos.html` | DeFi e renda |
| Comparador de Ativos | `Ferramentas/comparador-de-ativos/` | `comparador-de-ativos.html` | Estudar o mercado |

As três que já existiam continuam como estavam: Finanças (Gerir o dinheiro),
Scanner Pools (foi para DeFi e renda) e Calculadora de Market Cap (Estudar o
mercado). Saiu o card "Próxima ferramenta".

## Peças comuns (`Ferramentas/_comum/`)

- `calculos.js` — contas puras (`window.AtlasCalculos` / `require`). Era o
  `ferramentas-core.js` do site, com três funções novas: `lerNumero` (número no
  formato brasileiro), `impostoCripto` e `precoEmpate`.
  Testes: `node --test Ferramentas/_comum/calculos.test.cjs` (179), também no
  workflow `.github/workflows/ferramentas-calculos.yml`.
- `ferramenta.css` — visual comum (paleta da Calculadora de Market Cap,
  cabeçalho com "← Ferramentas", campos, `.toggle`, `.resultados`, `.tabela`,
  `.grafico`, `.explica`, busca de token).
- `busca-token.js` — busca da CoinGecko com sugestões e teclado
  (`AtlasBuscaToken.ligar`, `AtlasBuscaToken.mercado`), usada pelo Lucro e pelo
  Staking.

Toda página tem o login do ATLAS (`atlas-auth.js` + `atlas-secure.js`), o
cenário de fundo e `atlas-shell.js` no fim. Rede só por `AtlasHttp`
(`core/http.js`); nenhum `fetch` direto e nenhuma chave de API no navegador.

## Escada e Estratégia de Pool: fonte única

As duas saem de `Ferramentas/_fonte-quadro/quadro-src.html` (+ `snap.json`, os
500 maiores tokens de 07/11 para quando a rede falha). Depois de editar a fonte:

```bash
node Ferramentas/_fonte-quadro/build.js
```

Isso regrava `Ferramentas/escada-dca/index.html` e
`Ferramentas/estrategia-de-pool/index.html`. Não edite os gerados à mão.
A Escada leva a venda para o Lucro Cripto (`?compra=&venda=&qtd=&token=`); a
Estratégia de Pool aponta para o Scanner Pools.

## O que saiu do MundoDeFi

Marca, links do site, PRO/planos, login Nexus e `pro-gate.js`, zonas travadas
(`data-mdf-lock-zone`), catálogo e prévias do site, cabeçalho e rodapé
injetados, metadados de SEO (`og:*`, `canonical`, `ld+json`), fontes do Google e
o Chart.js de CDN (agora `assets/vendor/chart-4.4.1.min.js`).

## Fontes de dados que mudaram

- **Comparador:** saiu a Twelve Data (a chave ficava no navegador e a prata
  dava 404). **Ouro** = PAX Gold (PAXG/USDT na Binance, histórico desde 2020).
  **S&P 500, Nasdaq 100, Nvidia e Google** = tokens de ação xStocks na CoinGecko
  (`sp500-xstock`, `nasdaq-xstock`, `nvidia-xstock`, `alphabet-xstock`), com
  cerca de 1 ano de histórico (a CoinGecko pública dá 365 dias). **Prata saiu.**
- **Conversor, Lucro, Staking, Comparador:** dólar em reais pela cotação do
  USDT na CoinGecko (antes exchangerate-api / CoinPaprika).
- **Staking:** saiu a leitura de print por OCR (Tesseract vinha de CDN).
- **Simulador:** velas pela `data-api.binance.vision`, depois `api.binance.com`,
  depois CoinGecko.

## Dados guardados no navegador

Todos com prefixo `atlas.`: `atlas.quadro.*` (Escada e Pool: token, tempo
gráfico, favoritos, cenários), `atlas.conversor.cripto.<id>`,
`atlas.conversor.cambio.v1`, `atlas.conversor.top.v1`, `atlas.juros.selic.v1`,
`atlas.trade-sim.banca.v1`. Nada das chaves antigas (`mdf:*`, `qpm:*`) é lido.

## Capas

Os 8 cards novos usaram capa provisória em SVG até 15/11/2026 (ver "Artes finais" abaixo).
O dono gera as artes no ChatGPT, no mesmo guia das capas de 15/10: foto de
estúdio fotorrealista, retrato 2:3, assunto nos 60% de cima, 40% de baixo vazios
e escuros terminando em `#0A1122`, sem texto, sem logos, sem neon. Quando
chegarem: converter com Pillow para `card-<nome>.webp` 720×1080 (qualidade 82),
trocar o `src` em `pages/ferramentas.html` (com `?v=1`) e ajustar o
`object-position`.

| Card (arquivo) | Assunto | Cor principal | Apoio |
|---|---|---|---|
| Escada (`card-escada`) | escada de vidro com moedas subindo degrau a degrau | âmbar `#F5B942` | azul `#5B8CFF` |
| Estratégia de Pool (`card-pool`) | duas lâminas de vidro formando uma faixa, com líquido entre elas | ciano `#22D3EE` | verde `#2EC785` |
| Conversor e Câmbio (`card-conv`) | cédulas de real, dólar e euro se transformando numa moeda | verde `#2EC785` | dourado `#F5B544` |
| Juros Compostos (`card-juros`) | ampulheta com moedas que se multiplicam ao cair | azul `#5B8CFF` | âmbar `#F5B942` |
| Lucro Cripto (`card-lucro`) | balança de precisão com moedas e um recibo | verde `#4ADE80` | vermelho `#F0556A` |
| Staking (`card-stake`) | moedas empilhadas trancadas num cofre de vidro, brotando novas | violeta `#8B5CF6` | verde `#2EC785` |
| Comparador de Ativos (`card-comp`) | barra de ouro, moeda e gráfico lado a lado num pódio | dourado `#F5B544` | azul `#3B82F6` |
| Simulador de Trade (`card-trade`) | mesa de operações com candles em painéis de vidro | vermelho `#F0556A` | verde `#4ADE80` |

Modelo de prompt (troque assunto e cores pela linha da tabela):

> Photorealistic studio product photograph, vertical 2:3 portrait. [ASSUNTO, em inglês], with realistic materials, reflections and fine surface detail. Key light from the upper right, [COR PRINCIPAL] rim light, soft [COR DE APOIO] reflection. Shallow depth of field, 85mm lens, 3/4 view from slightly above. Deep midnight navy background (#0B1120) with a soft vignette. Subject fills the upper 60% of the frame; the lower 40% is empty, dark and smooth, fading to solid #0A1122 at the very bottom edge. No text, no logos, no frame or card behind the objects, no neon glow, no illustration or cartoon style.

### Artes finais (15/11/2026)

Prompts refeitos na receita da Calculadora (objeto premium grande, de perto, em
3/4 + painéis de vidro flutuando com o gráfico da ferramenta); o dono gerou no
ChatGPT e mandou pelo chat. Convertidas para WebP 720×1080 (q82):

| Card | Arquivo | `object-position` |
|---|---|---|
| Escada | `card-escada.webp` | 50% 0% |
| Lucro Cripto | `card-lucro.webp` | 50% 20% |
| Estratégia de Pool | `card-pool.webp` | 50% 20% (a arte ocupa a altura toda: a base fica atrás do texto) |
| Juros Compostos | `card-juros.webp` | 50% 20% |
| Conversor e Câmbio | `card-conv.webp` | 50% 20% |
| Simulador de Trade | `card-trade.webp` | 50% 20% |
| Staking | `card-stake.webp` | 50% 20% |
| Comparador de Ativos | `card-comp.webp` | 50% 20% |

As 8 capas provisórias em SVG foram apagadas (nada mais as usava).

## Ficou para depois

- **IMD** (diagnóstico do investidor): depende do Firebase e do painel do site
  antigo; decidir onde entra (talvez no Academy).
- Ligar as ferramentas aos dados da carteira (ex.: preço médio do Hold no
  Lucro Cripto). Hoje nenhuma lê nem grava a carteira.

## Verificação feita (08/11/2026, navegador do Claude, modo dev)

- As 8 páginas a 1280 px e 375 px sem rolagem horizontal e sem erro no console.
- Contas conferidas contra 07/11: Juros (R$ 114.070,87; meta R$ 887,19/mês;
  ganho real 7,2%), Lucro (US$ 24.875,00; empate US$ 50.100,10; imposto
  R$ 20.521,88; isento abaixo de R$ 35 mil), Staking (+2,88% real; 6,77% APR),
  Estratégia de Pool (faixa cheia: −5,7% a −50%).
- Comparador sem nenhuma chamada à Twelve Data; ouro e ações carregando.
- Página Ferramentas com 11 cards, Atropos em todos, links e capas respondendo
  200.
- Login: as páginas carregam a mesma trava das outras ferramentas
  (`atlas-auth.js` + `atlas-secure.js`). O redirecionamento para o login não
  foi testado sem sessão (havia sessão aberta no navegador e não se encerra a
  sessão do dono).

## Fonte e nomes (15/11/2026)

- **Fonte:** botões, campos e listas de seleção não herdavam a fonte da página
  e saíam em Arial (abas e filtros do Scanner, chips do Oráculo, botões das
  calculadoras). Regra geral em `core/ui/atlas-shell.css`, que todo o site
  carrega: `button, input, select, textarea, optgroup { font-family: inherit; }`.
  Medido depois em 12 telas: nenhum elemento fora do Inter/JetBrains Mono.
- **Nomes:** "Scanner Pools" virou **Scanner de Pools de Liquidez** (título da
  aba, marca no topo, rodapé, rótulos do backup em `core/atlas-backup.js`) e
  "Estratégia de Pool" virou **Estratégias de Pools de Liquidez** (`build.js` e
  `quadro-src.html`, inclusive o título da imagem exportada; link no Juros
  Compostos). Pastas, chaves de armazenamento e comentários mantêm o nome antigo.
  Com o nome maior, o cabeçalho da Estratégia quebra em duas linhas a 1440 px:
  fica para o redesenho dessa página.

## Atualização 17/11/2026 — Escada vira "DCA · Preço Médio"

Pedido do dono (proposta com 5 nomes e 3 layouts; escolhido o Layout A).

- **Nome:** "DCA · Preço Médio" (`build.js`, card em `pages/ferramentas.html`,
  menu lateral, link no Lucro Cripto, título da imagem exportada). A pasta
  continua `Ferramentas/escada-dca/` para não quebrar links e cenários
  salvos. Linha no topo explica a sigla (Dollar-Cost Averaging).
- **Três colunas (só no DCA):** tokens à esquerda, gráfico no meio,
  Preço médio / DCA no tempo / Venda à direita. O `<aside>` vira
  `display: contents` e os cartões entram na grade de `.main`. As regras de
  `aside` foram presas a `.main>aside` para não atingir o menu lateral do
  site. A Estratégia de Pools mantém o layout antigo.
- **Comparar 1 compra × em etapas:** botão no topo da aba Preço médio. O
  painel (`#cmpp`) ocupa a célula do gráfico com uma entrada que vem da
  direita. Tem valor total, preço da compra única (padrão: o preço da
  primeira etapa), 2 a 5 etapas de valor igual e cenários "E se o preço
  cair / andar de lado / subir direto". Também tem "Usar o gráfico" (entre
  máxima e mínima), "Trazer da aba Preço médio", preço médio, tokens,
  quanto vale hoje, um mini-gráfico (preços, médias e tokens por compra) e
  uma frase de conclusão, inclusive quando a compra única ganha. Esc ou ×
  fecham.
- O antigo chip "Comparar" (todas as estratégias no gráfico) virou
  "Ver todas".
- **Celular:** abas Tokens · Gráfico · Preço médio (`.mtabs`, `data-mview`).
  Escolher um token volta ao gráfico. O painel abre como folha de baixo.

## Atualização 17/11/2026 — Estratégias de Pools, parte 1 (Layout A)

Proposta aprovada pelo dono (Layout A com as recomendações). Essa ferramenta
**ensina** o conceito de pool. Para simular uma pool real e ver em qual
plataforma ela está, existe o botão "Simulador de pool", que abre o
Scanner de Pools de Liquidez. O dono quer deixar o Scanner no nível da
Metrix Finance mais adiante.

- **Mesmo esqueleto do DCA**, nas duas ferramentas: três colunas e abas no
  celular. **Identidade:** borda de cima do gráfico dourada no DCA e roxa
  nas Pools; botões, chips e painel das Pools em roxo.
- **Coluna do PAR** (`.parbox`): token A (o da lista) e token B (USDC, USDT,
  SOL, ETH, BTC, ação tokenizada, original do derivado). O selo do tipo de
  par (`tipoPar()`/`TIPOS`) diz o risco: stable×stable, token×stable,
  token×RWA, blue chip×blue chip, projeto×blue chip, derivado×original.
  Também tem "Pares para estudar" (SOL/USDC, SOL/ETH, PENDLE/ETH, mSOL/SOL…).
  **Limite atual:** com B diferente de stable, as contas ainda medem B em
  dólar (aviso no selo). A conta pela relação entre os preços fica na parte 2.
- **Passo a passo** na direita: 1 · objetivo → 2 · faixa e depósito →
  3 · o que acontece. "Renda em dólar" virou "Renda com taxas".
- **Cenários embaixo do gráfico** (`#cenbar`): −30%, −10%, entrada, +10%,
  +30%, com o valor da pool (sem taxa) e a diferença para a alternativa
  do objetivo (comprar tudo hoje, segurar o token ou segurar os dois).
- **Pool × Segurar** (`#poolp`): painel sobre o gráfico, como no DCA. Mostra
  a curva de valor por preço final (pool sem e com taxa, alternativa e
  ficar em dólar), a faixa marcada e os dias dentro da faixa × APR. Também
  tem uma tabela de −50% a +50% e uma frase que diz em que preços a pool
  vence e em quais perde.
- Celular: o cabeçalho abre espaço para o botão do menu do site.

**Parte 2 (pendente):** Raio-X do APR (tempo dentro da faixa no histórico),
aumentar a posição (somar posições e novo preço médio) e pares entre
dois voláteis medidos pela relação entre os preços.
