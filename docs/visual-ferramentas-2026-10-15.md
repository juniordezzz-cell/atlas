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
  artes 720×960 (~16–20 KB cada), geradas por IA (Higgsfield, modelo
  `z_image`) a pedido do dono, uma por ferramenta: moedas e cédula
  (Finanças), pool de vidro com lupa (Scanner) e pizza com fatia saindo
  (Calculadora).

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

## Próximo passo (decisão do dono)

Se aprovar, levar o cenário para o restante do site. O caminho mais
curto é incluir as duas linhas do cenário nas páginas de `pages/`, nos
módulos (`hold/`, `trade/`, `defi/`, `RWA/`, `wallets/`, `academy/`,
`mercado/`) e conferir, módulo a módulo, as cascas que pintam fundo
opaco (como o `.fx-app` do Finanças). Depois disso, atualizar a spec do
visual sereno.
