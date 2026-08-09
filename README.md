# ATLAS

**Sistema operacional financeiro** para gestão de patrimônio em cripto e ativos
reais. Reúne quatro frentes de investimento — **Hold · Trade · DeFi · RWA** —
sob um mesmo shell, com carteiras, teses, relatórios e consolidação de
patrimônio compartilhados.

HTML, CSS e JavaScript puro. **Sem build, sem dependências, sem backend.**
Os dados vivem no `localStorage` do navegador.

> Este arquivo descreve o ATLAS inteiro. Cada módulo tem o seu próprio README
> com os detalhes internos: [`hold/`](hold/README.md) · [`trade/`](trade/README.md) ·
> [`defi/`](defi/README.md) · [`RWA/`](RWA/README.md).

---

## Como rodar

Abra `index.html` no navegador. Funciona em `file://`, mas o recomendado é
servir a pasta — em `file://` o navegador bloqueia as chamadas de API por CORS
(preços do CoinGecko, catálogo de pools do DefiLlama, câmbio):

```bash
py -3 -m http.server 8777
```

Depois acesse `http://localhost:8777`.

### Fluxo de telas

```
index.html  →  boas-vindas.html  →  login.html  →  dashboard.html
   boot          apresentação        entrada        painel consolidado
```

> O login é **simulado**: qualquer submit entra. Autenticação real é uma etapa
> futura do roadmap.

---

## Mapa do projeto

```
atlas/
├── index.html            Boot animado
├── boas-vindas.html      Apresentação
├── login.html            Entrada (simulada)
├── dashboard.html        Painel consolidado dos quatro módulos
├── relatorios.html       Relatórios por carteira
├── configuracoes.html    Preferências, backup e restauração
│
├── core/                 ★ CAMADA CENTRAL — ver seção abaixo
├── wallets/              ★ CARTEIRAS — fonte única de verdade
├── themes/               Identidade visual e microinterações
├── css/  ·  js/          Estilos e scripts do shell da raiz
├── assets/               Imagem do Oráculo (atena.webp) e favicon
│
├── hold/                 Módulo de investimento de longo prazo   (SPA)
├── trade/                Módulo de operações                     (SPA)
├── defi/                 Módulo de pools, staking e lending      (MPA ¹)
├── RWA/                  Módulo de ativos do mundo real          (SPA)
└── academy/              Central de conhecimento (teses)         (SPA)
```

> ¹ O DeFi é o único módulo multipágina, **por decisão** — não por atraso. O
> porquê, o que custa e os três critérios para revisitar estão em
> [`defi/README.md`](defi/README.md#por-que-este-módulo-é-multipágina-e-os-outros-não).

---

## A camada central (`core/` e `wallets/`)

É o que faz cinco aplicações separadas se comportarem como um produto só.
**Nenhum módulo deve reimplementar nada disto.**

| Arquivo | Responsabilidade | API global |
|---|---|---|
| `core/settings.js` | Tema, idioma, moeda, formato de data e número | `AtlasSettings` |
| `core/i18n.js` | Português e inglês (chave ou texto-chave) | `AtlasI18n` |
| `core/currency.js` | Moeda de exibição e conversão (dados sempre em USD) | `AtlasCurrency` |
| `core/http.js` | Rede: timeout, retry, cache TTL, erro amigável | `AtlasHttp` |
| `core/atlas-boot.js` | Identifica o módulo e coordena repintura | `AtlasBoot` |
| `core/atlas-backup.js` | Exporta e restaura todos os dados em `.json` | `AtlasBackup` |
| `core/atlas-module-settings.js` | Configurações por módulo, numa tela só | `AtlasModuleSettings` |
| `core/atlas-price.js` | Preço por símbolo, com cache e stablecoins | `AtlasPrice` |
| `core/entities/theses.js` | Entidade compartilhada de Teses (versionada) | `AtlasTheses` |
| `core/ui/atlas-shell.js` | Oráculo e "Voltar ao Atlas", iguais em todo lugar | `AtlasShell`, `AtlasOraculo` |
| `core/ui/atlas-onboarding.js` | Os três passos da primeira sessão | `AtlasOnboarding` |
| `core/ui/atlas-chart-theme.js` | Ponte de tema para dentro do `<canvas>` | `AtlasChartTheme` |
| `core/ui/atlas-calendar.js` | Calendário compartilhado | `AtlasCalendar` |
| `core/providers/*` | CoinGecko e DefiLlama por trás de um registro | `AtlasProviders` |
| `wallets/*` | Carteiras: criar, renomear, excluir, ordenar, ledger | `AtlasWallets` |
| `js/atlas-movements.js` | Livro-razão de movimentos por carteira | `AtlasMovements` |
| `js/atlas-consolidation.js` | Soma os quatro módulos para o Dashboard | `AtlasConsolidation` |
| `js/atlas-nav.js` | Navegação móvel do shell da raiz | `AtlasNav` |
| `js/atlas-topbar.js` | Menus da barra superior (apps, alertas, perfil) | `AtlasTopbar` |

### Ordem de carga obrigatória em cada HTML

```html
<link rel="stylesheet" href="themes/atlas-theme.css">    <!-- por ÚLTIMO -->
<link rel="stylesheet" href="themes/atlas-effects.css">
<script src="core/settings.js"></script>
<script src="core/i18n.js"></script>
<script src="core/currency.js"></script>
<script src="core/atlas-boot.js"></script>
```

O CSS do tema entra por último **de propósito**: ele governa os tokens de todos
os módulos.

---

## Carteiras

Duas naturezas, e a diferença importa:

- **Global** — aparece em todos os módulos e **soma no patrimônio total**.
- **Local** — vive dentro de um módulo só e **não entra no total do ATLAS**.

O componente de seleção é **um só** (`wallets/walletSelector.js` +
`walletSelector.css`), usado por Dashboard, Hold, Trade, DeFi, RWA e Relatórios,
sempre com as mesmas funções: trocar, criar global, criar local, renomear e
excluir. Nenhum CSS de módulo tem regra de carteira — foi assim que o sistema
acabou com cinco aparências diferentes antes, e não deve voltar.

---

## Teses

Toda decisão nasce de uma **tese**, registrada dentro de um módulo. Ao concluir,
ela vai automaticamente para o **Academy** e pode ser reaberta de lá, gerando
uma nova versão sem perder o histórico. Hold, Trade e DeFi já consomem a
entidade compartilhada; o RWA ainda não.

Status oficiais: `planejada` · `andamento` · `concluida` · `arquivada`.

---

## Dados e backup

Tudo mora no `localStorage`, que vive no perfil do navegador — **não** na pasta
do projeto. Trocar os arquivos do site não apaga nada, mas formatar o PC, limpar
dados de navegação ou trocar de navegador apaga **tudo**.

Por isso existe **Configurações → Dados e Backup**: exporta um `.json` com todos
os módulos e restaura de volta. Use com regularidade.

---

## Moeda

Todo valor é **armazenado em USD**, sempre. A moeda escolhida pelo usuário é uma
camada de *apresentação*: converte na hora de exibir, nunca ao gravar. Misturar
bases de moeda no armazenamento é como um sistema financeiro se corrompe em
silêncio.

---

## Identidade visual

`themes/atlas-theme.css` é a fonte única de cor, tipografia, geometria e
movimento. Cada módulo tem um sotaque de cor próprio, acionado por
`<html data-module="...">`:

| Módulo | Sotaque |
|---|---|
| ATLAS (shell) | ciano `#00BFFF` |
| Hold | azul celeste `#4DA3FF` |
| Trade | azul elétrico `#4C9AFF` |
| DeFi | verde menta `#00E28A` |
| RWA | verde esmeralda `#10B981` |

**Regra de ouro:** nenhuma cor importante nasce dentro de um componente. Alterou
uma variável no tema → o sistema inteiro muda junto.

---

## Convenções

- JavaScript clássico (ES5+), sem módulos ES e sem build. A ordem das tags
  `<script>` **é** a árvore de dependências.
- Cada peça compartilhada é idempotente: `if (window.X) return;`.
- Chaves de `localStorage` começam com `atlas` (ou `HOLD_` no legado) — é assim
  que `core/atlas-backup.js` encontra dados novos sozinho.
- Comentário explica **por que**, não o que. Correção de bug documenta a causa
  raiz, para ninguém desfazer sem saber o custo.
