# Repositórios do ATLAS

Catálogo de **todo código de terceiros** que o ATLAS usa ou guarda como
modelo: o que é cada repositório, onde está no projeto e o que ele faz
aqui. Quando o dono perguntar "quais repositórios tem no ATLAS?", a
resposta está aqui.

> **Regra para qualquer agente (Claude ou Codex):** trouxe um repositório
> novo, atualizou a versão de um ou tirou algum? Atualize este arquivo
> no mesmo commit.

Última revisão: **21/10/2026**.

---

## Como os repositórios entram no ATLAS

O ATLAS é HTML/CSS/JS puro, **sem build e sem npm**. Por isso há dois
jeitos de um repositório entrar:

| Jeito | Onde fica | Quando usar |
|---|---|---|
| **Biblioteca que roda** | `assets/vendor/<nome>-<versão>…` (arquivos copiados do pacote oficial, com a versão no nome) | Quando o código pode ser carregado direto pela página. |
| **Referência (submódulo git)** | `referencias/<nome>/` | Quando o código é React/Tailwind/etc. ou é um acervo grande. **Nada daqui é carregado pelas páginas**: cada efeito é reescrito em CSS/JS puro, com o original como modelo. |

Clonar o ATLAS já com as referências: `git clone --recurse-submodules …`.
Num clone que já existe: `git submodule update --init`.

---

## 1. Visual — os três de 15/10/2026

Pedido do dono: o visual das Ferramentas estava sem graça (fundo liso,
card sem efeito, só um ícone pequeno). Os três abaixo foram escolhidos
para resolver isso. Por enquanto entram **só na página Ferramentas e
nas ferramentas** (piloto). Se o dono aprovar, vão para o resto do site.
Registro completo: [docs/visual-ferramentas-2026-10-15.md](../docs/visual-ferramentas-2026-10-15.md).

### 1.1 Paper Shaders — o cenário do fundo

- **Repositório:** <https://github.com/paper-design/shaders> · site com os exemplos: <https://shaders.paper.design>
- **Licença:** Apache-2.0 (os arquivos `LICENSE` e `NOTICE` vão junto na pasta).
- **Versão no ATLAS:** 0.0.81 (pacote npm `@paper-design/shaders`).
- **Onde está:** `assets/vendor/paper-shaders-0.0.81/` (biblioteca que roda).
- **O que é:** fundos em WebGL que se mexem devagar, como um degradê de
  cores que flui (*mesh gradient*), gradiente com grão e ondas. Não depende de
  nenhuma outra biblioteca e roda em JS puro. Também pode ficar parado, sem
  custo nenhum.
- **O que faz no ATLAS:** é o "cenário" atrás das telas. Tira o
  azul-marinho chapado e dá profundidade, com as cores do ATLAS
  (azul-petróleo, azul-noite e um toque de violeta).
- **Quem usa:** `core/ui/atlas-cenario.js` + `core/ui/atlas-cenario.css`.
  Estão na página Ferramentas, no Scanner Pools, na Calculadora de Market
  Cap e nas páginas do Finanças.
- **Cuidados:** quem pediu "menos movimento" no sistema recebe o quadro
  parado. Sem WebGL, cai num degradê em CSS. No tema claro, o cenário não
  aparece. A versão ainda é 0.x, então a atualização é manual: baixar o pacote
  novo, copiar o `dist/` (sem `.d.ts`/`.map`) para uma pasta com a versão nova
  e trocar o caminho no `import` de `atlas-cenario.js`.

### 1.2 Atropos — o efeito 3D dos cards

- **Repositório:** <https://github.com/nolimits4web/atropos> · site: <https://atroposjs.com>
- **Licença:** MIT (`assets/vendor/atropos-2.0.2.LICENSE`).
- **Versão no ATLAS:** 2.0.2.
- **Onde está:** `assets/vendor/atropos-2.0.2.min.js` e `atropos-2.0.2.min.css`.
- **O que é:** card 3D em camadas. Quando o mouse passa, o card inclina e cada
  camada anda numa profundidade diferente (parallax). Tem uns 2 KB,
  funciona no toque do celular e roda em JS puro.
- **O que faz no ATLAS:** nos cards da página Ferramentas, a imagem de fundo
  vai numa camada funda e o título e o selo "Grátis" ficam na frente, então a
  imagem parece estar "dentro" do card.
- **Quem usa:** `core/ui/atlas-cards3d.js`. Qualquer elemento com
  `data-atlas-3d` vira card 3D, e as camadas internas dizem a profundidade em
  `data-atropos-offset` (negativo = mais fundo).
- **Cuidados:** o brilho (`highlight`) e a sombra própria estão desligados,
  porque o ATLAS não usa glow. Com "menos movimento" ligado, o card fica parado.

### 1.3 Uiverse Galaxy — acervo de detalhes prontos

- **Repositório:** <https://github.com/uiverse-io/galaxy> · navegar com
  prévia: <https://uiverse.io>
- **Licença:** MIT. Créditos ao autor e ao Uiverse são bem-vindos (não
  obrigatórios); deixamos sempre o nome do arquivo original no comentário do CSS.
- **Onde está:** `referencias/uiverse-galaxy/` (submódulo, **só referência**).
- **O que é:** mais de 3.000 peças em HTML e CSS puro (botões, cards,
  carregadores, checkboxes, formulários, tooltips…), uma por arquivo, em
  pastas por tipo (`Buttons/`, `Cards/`, `loaders/`…).
- **O que faz no ATLAS:** fonte de acabamento, como botões, selos e pequenas
  animações. **Não** é usado para a estrutura das páginas.
- **Já portado:** a seta do "Abrir ferramenta" (`.tool-card__arrow` em
  `css/ferramentas.css`), que veio de `Buttons/satyamchaudharydev_modern-sheep-10.html`.
- **Como usar:** achar a peça no uiverse.io ou com `grep` na pasta, copiar
  a ideia para o CSS do ATLAS com os nossos tokens de cor e citar o
  arquivo de origem num comentário.

### 1.4 Three.js — cenas 3D do Academy (21/10/2026)

- **Repositório:** <https://github.com/mrdoob/three.js> · site: <https://threejs.org>
- **Licença:** MIT (`assets/vendor/three-0.170.0/LICENSE`).
- **Versão no ATLAS:** 0.170.0 (pacote npm `three`, só `build/three.module.min.js`).
- **Onde está:** `assets/vendor/three-0.170.0/`.
- **O que é:** biblioteca de 3D em WebGL. Roda como módulo JS (`import`), sem build.
- **O que faz no ATLAS:** no curso do Academy, desenha a trilha dos 10 módulos
  como blocos encadeados (Visão geral) e a cadeia de 4 blocos que quebra quando
  um bloco é alterado (Módulo 1, aula 12).
- **Quem usa:** `academy/nivel-1/curso/assets/js/academy-3d.js`, carregado sob
  demanda por `academy-visual.js` só quando há WebGL. Sem WebGL, ficam os SVGs.
- **Cuidados:** o arquivo tem ~690 KB; por isso só baixa quando uma cena aparece.
  Para atualizar: baixar `build/three.module.min.js` e `LICENSE` da versão nova
  para uma pasta nova e trocar o caminho no `import` de `academy-3d.js`.

### 1.5 GSAP + ScrollTrigger — animação com a rolagem (21/10/2026)

- **Repositório:** <https://github.com/greensock/GSAP> · site: <https://gsap.com>
- **Licença:** "Standard no charge license" da GSAP, uso gratuito, inclusive os
  plugins (`assets/vendor/gsap-3.13.0/LICENSE.txt`).
- **Versão no ATLAS:** 3.13.0 (`dist/gsap.min.js` e `dist/ScrollTrigger.min.js`).
- **Onde está:** `assets/vendor/gsap-3.13.0/`.
- **O que faz no ATLAS:** no curso do Academy, as aulas e o palco da direita
  aparecem conforme a rolagem, o índice marca a aula que está na tela e a barra
  de progresso do módulo enche.
- **Quem usa:** `academy/nivel-1/curso/assets/js/academy-visual.js`. Com "menos
  movimento" ligado, só a marcação do índice continua; nada se mexe.

---

## 2. Visual — referências anteriores

### 2.1 Magic UI

- **Repositório:** <https://github.com/magicuidesign/magicui> · MIT
- **Onde está:** `referencias/magicui/` (submódulo, só referência).
- **O que é:** componentes animados em React + Tailwind + Motion.
- **O que faz no ATLAS:** modelo para efeitos reescritos em JS/CSS puro.
  Ficaram o *number-ticker* (números que contam), o *blur-fade* e o
  *marquee* (fita de cotações, só no Command Center do Academy).
  *Spotlight* e *border-beam* foram removidos a pedido do dono (visual sereno).
- Componentes originais: `referencias/magicui/apps/www/registry/magicui/*.tsx`.

---

## 3. Bibliotecas que rodam no site (`assets/vendor/`)

| Biblioteca | Repositório | Versão | O que faz no ATLAS |
|---|---|---|---|
| Firebase JS SDK (app, auth, firestore — versões *compat*) | <https://github.com/firebase/firebase-js-sdk> | 10.14.1 | Login com Google e trava de acesso (`core/atlas-firebase.js`, `core/atlas-secure.js`); Firestore para a nuvem. |
| Chart.js | <https://github.com/chartjs/Chart.js> | 4.4.1 | Gráficos do Dashboard, Carteiras e DeFi. |
| Paper Shaders | ver 1.1 | 0.0.81 | Cenário do fundo. |
| Atropos | ver 1.2 | 2.0.2 | Cards 3D. |
| Three.js | ver 1.4 | 0.170.0 | Cenas 3D do Academy. |
| GSAP + ScrollTrigger | ver 1.5 | 3.13.0 | Animação ligada à rolagem no Academy. |

**Fontes** servidas pelo próprio ATLAS (`assets/fonts/`, via
`themes/atlas-fonts.css`): **Inter** (<https://github.com/rsms/inter>) e
**JetBrains Mono** (<https://github.com/JetBrains/JetBrainsMono>). As páginas do
Finanças e algumas do DeFi ainda puxam as mesmas fontes do Google Fonts.

---

## 4. Backend da Central RWA (`central-rwa/backend`, Python)

Instalados pelo `pyproject.toml`, não ficam no git:
`httpx` (chamadas HTTP), `pydantic` (validação de dados), `PyYAML`
(configuração), `psycopg` (Postgres/Supabase). Para testes: `pytest`, `respx`
(simula as APIs) e `pgserver` (Postgres embutido).

---

## 5. Serviços externos (não são repositórios, mas o ATLAS depende deles)

| Serviço | Para quê |
|---|---|
| CoinGecko, Coinpaprika, Coinlore, Binance | Preços e dados de tokens |
| DefiLlama (yields, coins, stablecoins) e GeckoTerminal | Pools, TVL, volume (o Scanner confere um contra o outro) |
| alternative.me | Índice de medo e ganância |
| Supabase | Banco do Scanner/Central RWA, coleta agendada e Edge Functions |
| OpenRouter | IA do Oráculo e do Scanner (chave só no servidor, nunca no navegador) |

---

## 6. Fora do projeto — ferramentas de trabalho no PC do dono

Não fazem parte do código do ATLAS, mas são usadas para construí-lo:

| Nome | Repositório | Onde está | Para quê |
|---|---|---|---|
| UI UX Pro Max (o "repositório de UX") | <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> | `~/.claude/skills/ui-ux-pro-max` | Auditoria e regras de UX/UI (skill do Claude) |
| Superpowers | <https://github.com/anthropics/claude-plugins-official> (plugin `superpowers`) | plugins do Claude Code | Métodos de trabalho (planos, specs, depuração) |
| Awesome Claude Plugins | <https://github.com/composio-community/awesome-claude-plugins> | plugins do Claude Code | Plugins extras (commit, review, frontend-design…) |
| Vercel Labs Skills | <https://github.com/vercel-labs/skills> | listado em `Desktop/Repositoris GIT HUB/Repositorios.py` | Coleção de skills |

---

## 7. O próprio ATLAS

<https://github.com/juniordezzz-cell/atlas> (público; publicado no GitHub Pages).
