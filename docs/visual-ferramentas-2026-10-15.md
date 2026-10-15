# Visual novo das Ferramentas — 15/10/2026 (piloto)

Registro para quem mexer depois (Claude ou Codex). Leia antes de alterar
o fundo ou os cards das Ferramentas.

## O pedido

O dono achou o layout das Ferramentas "muito feio": fundo sem graça, card
sem efeito e só um ícone pequeno (a "gotinha" do Scanner). Ele quer:

1. **Fundo com cenário**, não liso.
2. **Card com imagem própria** preenchendo o fundo todo.
3. **Efeito no card.**
4. Usar repositórios do GitHub que subam a qualidade visual.

**Decisão do dono sobre o alcance:** aplicar primeiro na **página
Ferramentas e em todas as ferramentas**. Se ele gostar, leva para o
resto do site. Por isso tudo foi feito em arquivos próprios e
"desligáveis", sem mexer no `themes/atlas-sereno.css`.

## Relação com o "visual sereno"

O visual sereno (spec de 18/09) proíbe glow, spotlight, grade e efeito
de levantar o card no hover. Este piloto **muda de propósito** duas
coisas, só nas Ferramentas: o fundo deixa de ser liso (vira cenário) e
os cards ganham movimento 3D. Continua valendo: **sem glow/halo** (o
brilho da Atropos está desligado), sem grade, sem spotlight e sem feixe.

## O que entrou

### Repositórios
Catálogo completo em [referencias/REPOSITORIOS.md](../referencias/REPOSITORIOS.md).

| Repositório | Onde | Uso |
|---|---|---|
| paper-design/shaders 0.0.81 | `assets/vendor/paper-shaders-0.0.81/` | cenário do fundo (WebGL) |
| nolimits4web/atropos 2.0.2 | `assets/vendor/atropos-2.0.2.min.{js,css}` | cards 3D |
| uiverse-io/galaxy | `referencias/uiverse-galaxy/` (submódulo) | acabamento; seta do "Abrir ferramenta" |

### Arquivos novos
- `core/ui/atlas-cenario.js` (módulo ES): cria `.atlas-cenario` fixo
  atrás da página e monta o *mesh gradient*. Põe a classe
  `atlas-com-cenario` no `<html>`. Paletas em `PALETAS` (`atlas`,
  `ambar`), escolhidas por `<html data-cenario="…">`. Velocidade 0,12;
  com "menos movimento" fica 0 (parado). Densidade 1x e teto de
  1280×720 px (o degradê é macio, isso poupa a GPU). Faz `dispose()` no
  `pagehide`.
- `core/ui/atlas-cenario.css`: posiciona a camada (`z-index: -1`),
  deixa o `body` (e o `.fx-app` do Finanças) transparente **só com o
  cenário ligado e fora do tema claro**, tem o plano B em CSS sem WebGL e
  um véu leve por cima.
- `core/ui/atlas-cards3d.js`: acha `[data-atlas-3d]`, embrulha na
  estrutura da Atropos (`.atropos.atlas-3d > .atropos-scale >
  .atropos-rotate > .atropos-inner`) e liga com `shadow: false`,
  `highlight: false`, rotação máxima de 9° e `rotateTouch: 'scroll-y'`
  (no celular a rolagem continua).
- `assets/ferramentas/card-fin.webp`, `card-scan.webp`, `card-mcap.webp`:
  uma arte por ferramenta. A primeira rodada (Higgsfield `z_image`: tigela
  com lupa, pizza) foi trocada no mesmo dia pelas fotorrealistas da
  rodada 2: moedas e nota de 100 dólares (Finanças), corrente de cubos de
  vidro (Scanner) e calculadora com painéis de dados (Calculadora).

### Arquivos alterados
- `pages/ferramentas.html`: os cards viraram `tool-card tool-card--art`
  com `data-atlas-3d`. O ícone SVG saiu e entrou `<img
  class="tool-card__art" data-atropos-offset="-4">` + `.tool-card__veil`;
  texto, chips e botão ficam em `.tool-card__body` (`offset 2`), e o selo
  em `offset 5`. No `<head>`, entram Atropos, cenário e cards3d, com
  `?v=` para furar o cache.
- `css/ferramentas.css`: bloco "CARD COM ARTE PRÓPRIA" no fim. A arte
  ocupa os 68% de cima, o véu escurece a partir de 36% e o card tem altura
  mínima de 540 px (500 no celular). Os seletores começam com `html
  .tools-grid` para vencer a regra de card clicável do sereno. A seta do
  Uiverse está em `.tool-card__arrow`. Saíram as cores dos ícones
  `--fin/--scan/--mcap`, que não eram mais usadas.
- Cenário (só `<link>` + `<script type="module">` antes do `</head>`):
  `Ferramentas/scanner-pools/index.html`,
  `Ferramentas/calculadora-market-cap/index.html` e todas as páginas de
  `Ferramentas/entradas-saidas/financas/` menos `offline.html`.

## Como adicionar uma ferramenta nova com arte

1. Gerar ou desenhar uma arte 3:4 com o assunto **na metade de cima** e o
   fundo azul-noite escuro (o texto fica embaixo). Exportar WebP 720×960.
2. Salvar em `assets/ferramentas/card-<nome>.webp`.
3. Duplicar um `<a class="tool-card tool-card--art" … data-atlas-3d>` e
   ajustar `src` e `object-position` da arte.
4. Na página da ferramenta, incluir as duas linhas do cenário (copiar de
   `Ferramentas/calculadora-market-cap/index.html`).

## Como desligar (voltar ao visual anterior)

- Cenário: remover o `<link>` e o `<script type="module">` de
  `atlas-cenario` da página.
- Cards 3D: remover `atlas-cards3d.js`. Os cards continuam com a arte,
  só sem a inclinação.
- Tudo de uma vez: `git revert` do commit deste piloto.

## Verificação feita (15/10/2026, navegador do Claude, modo dev)

- Ferramentas em 1600×900: cenário montado (canvas WebGL), três cards
  embrulhados pela Atropos, inclinação e parallax no hover e seta completa no
  hover. Sem erros no console.
- Celular 375 px: sem rolagem horizontal, card inteiro legível.
- Scanner Pools, Calculadora e Finanças (Entradas) com o cenário; a
  tabela do Scanner continua legível. No Finanças, a troca para o tema
  claro esconde o cenário e a volta ao escuro funciona.
- O escurecimento de 2–3 s logo ao abrir qualquer página é a entrada
  padrão do ATLAS (também acontece em Relatórios) e não vem deste piloto.

## Rodada 2 das artes (15/10/2026) — mais realismo

O dono aprovou o layout e o **cenário animado** (ficam como estão) e pediu
artes **fotorrealistas**. Finanças mantém a ideia (moedas + nota de
dólar). Scanner troca a tigela por **blockchain/DeFi (cubos encadeados)**.
Calculadora troca a pizza por uma **calculadora avançada com números e
dados**. Ele gera no ChatGPT com os prompts abaixo e envia os arquivos;
aqui elas são convertidas para WebP 720×960 e substituem as atuais.

Guia comum: retrato, foto de estúdio com luz principal de cima à direita
e contorno na cor do card, câmera em 3/4 levemente de cima, fundo
desfocado, assunto nos 60% de cima, 40% de baixo vazios e escuros
terminando em `#0A1122`, sem texto, sem logos, sem neon.

| Card | Cor principal | Apoio |
|---|---|---|
| Finanças | ouro `#F5B544` | verde da nota `#6EE7B7` |
| Scanner Pools | ciano `#22D3EE` | violeta `#8B5CF6` |
| Calculadora | azul elétrico `#3B82F6` | verde `#4ADE80` |

Os prompts exatos estão na conversa de 15/10 e repetidos aqui:

- **Finanças:** Photorealistic studio product photograph, vertical 2:3 portrait. Three neat stacks of real gold coins with finely serrated edges, subtle wear marks and true metallic reflections, on a dark glossy surface. A single real US 100-dollar banknote floats above them, gently curved in mid-air, paper fibers and print texture visible. Key light from the upper right, warm gold rim light (#F5B544) on the coins, soft mint-green reflection (#6EE7B7) from the banknote. Shallow depth of field, 85mm lens, 3/4 view from slightly above. Deep midnight navy background (#0B1120) with a soft vignette. Subject fills the upper 60% of the frame; the lower 40% is empty, dark and smooth, fading to solid #0A1122 at the very bottom edge. No text, no logos, no frame or card behind the objects, no neon glow, no illustration or cartoon style.
- **Scanner Pools:** Photorealistic 3D render that looks like a real studio photograph, vertical 2:3 portrait. A blockchain: a chain of five or six frosted-glass cubes with brushed dark-metal edges, receding diagonally into depth, each cube connected to the next by thin glowing cyan light filaments (#22D3EE). Inside the nearest cubes, tiny suspended particles and faint data dots, like liquidity flowing between blocks. Subtle violet rim light (#8B5CF6) on the cube edges, key light from the upper right, realistic glass refraction and caustics on a dark reflective floor. Shallow depth of field, 3/4 view from slightly above, far cubes softly blurred. Deep midnight navy background (#0B1120). Subject fills the upper 60% of the frame; the lower 40% is empty, dark and smooth, fading to solid #0A1122 at the bottom edge. No text, no logos, no coin symbols, no neon overload, no cartoon or flat style.
- **Calculadora de Market Cap:** Photorealistic studio product photograph, vertical 2:3 portrait. A premium financial calculator made of dark anodized aluminum with glass keys, its screen lit with soft blue light (#3B82F6). Floating above it, three thin layered translucent glass panels show realistic financial data: a candlestick chart with green (#4ADE80) and red candles, a donut chart and columns of small numbers, as if projected holograms, crisp but subtle. Key light from the upper right, electric-blue rim light on the calculator edges, realistic reflections on a dark glossy desk. Shallow depth of field, 85mm lens, 3/4 view from slightly above. Deep midnight navy background (#0B1120). Subject fills the upper 60% of the frame; the lower 40% is empty, dark and smooth, fading to solid #0A1122 at the bottom edge. No readable words, no brand logos, no cartoon style, no neon glow.

**Aplicado (15/10/2026):** o dono gerou as três no ChatGPT (1024×1536,
2:3) e enviou. Elas viraram `assets/ferramentas/card-{fin,scan,mcap}.webp`
em 720×1080 (40–54 KB), substituindo as do Higgsfield, com `?v=2` no
`src` para furar o cache. Como as fotos são mais altas, a faixa da arte
em `css/ferramentas.css` passou de 68% para **80%** da altura do card, e
o enquadramento ficou `object-position` 50% 6% no Finanças (a nota
inteira aparece), 50% 18% no Scanner e 50% 12% na Calculadora.

## Bug corrigido: card não abria a ferramenta (15/10/2026)

**Sintoma (relatado pelo dono):** o efeito 3D funcionava, mas clicar no
card não abria a ferramenta.

**Duas causas, as duas por causa do card que gira junto com o mouse:**
1. **Arraste nativo da imagem.** Apertar sobre a `<img>` e mexer uns
   pixels fazia o navegador iniciar o arraste da imagem (`dragstart`) e
   cancelar o clique. Correção: `pointer-events: none` e
   `-webkit-user-drag: none` na `.tool-card__art` e no card
   (`css/ferramentas.css`), além de `draggable="false"` no card e nas
   imagens (`core/ui/atlas-cards3d.js`).
2. **Clique entregue ao embrulho.** O botão desce sobre o link e sobe
   num ponto que, com o giro, já é o `.atropos-scale`. O navegador
   entrega o `click` ao ancestral comum, que fica fora do `<a>`.
   Correção: `repassarClique()` em `atlas-cards3d.js` lembra se o
   `pointerdown` começou no card e, se o `click` cair fora do link,
   navega para o `href` (Ctrl/Cmd/Shift/botão do meio abrem em outra aba).

**Conferido:** apertar na imagem do Finanças e arrastar 6 px abre o
Finanças; clique simples abre o Scanner e a Calculadora.

### Depois da correção: "continua não abrindo" era cache

O dono relatou que continuava sem abrir (console com erros só de uma
extensão de carteira, `evmAsk.js`, que não é do ATLAS). Testado no Chrome
real dele, no site publicado, logado: os três cards abriram pela imagem e
pelo botão. A versão publicada (build `c9a4bb6`, 18:35 UTC) já tinha a
correção. A causa era **página antiga em cache**:
- GitHub Pages manda `Cache-Control: max-age=600` (10 min). Uma aba aberta
  logo antes da publicação segue com o HTML velho, que aponta para o JS
  velho. Basta Ctrl+Shift+R.
- No localhost, `python -m http.server` não manda cabeçalho de cache e o
  Chrome guardava HTML e JS (inclusive com 304 falso). **Correção
  definitiva:** `servidor-local.py` na raiz (o mesmo servidor com
  `Cache-Control: no-store` e sem 304). O `Abrir ATLAS.bat` e o
  `.claude/launch.json` passaram a usá-lo. Se já houver uma janela do
  servidor antigo aberta, feche-a uma vez para o `.bat` subir o novo.

## Próximo passo (decisão do dono)

Se aprovar, levar o cenário para o restante do site. O caminho mais
curto é incluir as duas linhas do cenário nas páginas de `pages/`, nos
módulos (`hold/`, `trade/`, `defi/`, `RWA/`, `wallets/`, `academy/`,
`mercado/`) e conferir, módulo a módulo, as cascas que pintam fundo
opaco (como o `.fx-app` do Finanças). Depois disso, atualizar a spec do
visual sereno.
