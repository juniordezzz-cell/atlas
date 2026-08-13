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

landing.html — página pública, fora do fluxo. Explica o produto para
quem ainda não entrou; o login aponta para ela.
```

> O login é **simulado**: qualquer submit entra. Ele abre uma sessão em
> `AtlasAuth` (é o que faz o "Sair" ter o que encerrar), mas no modo local
> **não barra ninguém**. Autenticação real é uma fase futura — a costura
> já está pronta, ver [`ROADMAP.md`](ROADMAP.md#a--autenticação-real).

---

## Mapa do projeto

```
atlas/
├── index.html            Boot animado
├── boas-vindas.html      Apresentação
├── login.html            Entrada (simulada)
├── landing.html          Página pública (o que o ATLAS é e faz)
├── dashboard.html        Painel consolidado dos quatro módulos
├── carteiras.html        Caixa por carteira, movimentações e taxas de pool
├── relatorios.html       Relatórios por carteira
├── configuracoes.html    Preferências, backup e restauração
│
├── core/                 ★ CAMADA CENTRAL — ver seção abaixo
├── wallets/              ★ CARTEIRAS — fonte única de verdade
├── themes/               Identidade visual e microinterações
├── css/  ·  js/          Estilos e scripts do shell da raiz
├── assets/               Imagem do Oráculo (atena.webp) e ícones
│
├── manifest.webmanifest  Instalação como aplicativo (PWA)
├── sw.js                 Service worker: abrir sem internet
├── offline.html          Tela para quem chega offline numa página nunca visitada
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
| `core/atlas-auth.js` | Sessão — modo local hoje, pronta para um provedor | `AtlasAuth` |
| `core/atlas-export.js` | Planilha (CSV) e papel/PDF, com cabeçalho de folha | `AtlasExport` |
| `core/atlas-notifications.js` | Alertas dos quatro módulos, com estado de lido | `AtlasNotifications` |
| `core/atlas-pwa.js` | Registra o service worker (nunca em `file://`) | `AtlasPWA` |
| `core/atlas-module-settings.js` | Configurações por módulo, numa tela só | `AtlasModuleSettings` |
| `core/atlas-price.js` | Preço por símbolo, com cache e stablecoins | `AtlasPrice` |
| `core/entities/theses.js` | Entidade compartilhada de Teses (versionada) | `AtlasTheses` |
| `core/ui/atlas-shell.js` | Oráculo e "Voltar ao Atlas", iguais em todo lugar | `AtlasShell`, `AtlasOraculo` |
| `core/ui/atlas-onboarding.js` | Os três passos da primeira sessão | `AtlasOnboarding` |
| `core/ui/atlas-flash.js` | Pisca o valor que mudou (verde sobe, vermelho desce) | `AtlasFlash` |
| `core/ui/atlas-palette.js` | Paleta de comandos (Ctrl+K): ir, buscar, executar | `AtlasPalette` |
| `core/ui/atlas-chart-theme.js` | Ponte de tema para dentro do `<canvas>` | `AtlasChartTheme` |
| `core/ui/atlas-calendar.js` | Calendário compartilhado | `AtlasCalendar` |
| `core/providers/*` | CoinGecko (primária) e GeckoTerminal (secundária) por trás de um registro | `AtlasProviders` |
| `core/atlas-precos.js` | A cadeia de preço do sistema: manual → id curado → busca → DEX | `AtlasPrecos` |
| `core/atlas-tokens.js` | Registro de ativos: símbolo → id da API | `AtlasTokens` |
| `wallets/*` | Carteiras: criar, renomear, excluir, ordenar, ledger | `AtlasWallets` |
| `wallets/walletCaixa.js` | Livro de caixa: o saldo é a soma dos eventos | `AtlasCaixa` |
| `js/atlas-movements.js` | Movimentos derivados das posições, para os Relatórios | `AtlasMovements` |
| `js/atlas-consolidation.js` | Soma os quatro módulos para o Dashboard | `AtlasConsolidation` |
| `js/atlas-nav.js` | Navegação móvel do shell da raiz (consome `AtlasShell.destinos()`) | `AtlasNav` |
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

### Caixa

Cada carteira tem **caixa** — dinheiro parado, disponível para alocar — e ele é
**consequência de eventos, nunca uma variável**. Não existe `setSaldo`: o caixa é
sempre a soma do livro (`wallets/walletCaixa.js`), recalculada na leitura, e por
isso não tem como divergir do extrato que o produziu.

```
deposito       + caixa    mundo externo → carteira     ↑ patrimônio
saque          − caixa    carteira → mundo externo     ↓ patrimônio
transferencia  − origem / + destino                     = patrimônio
swap           troca de ativo na mesma carteira         = patrimônio
aporte         − caixa    caixa → posição               = patrimônio
retorno        + caixa    posição → caixa               = patrimônio
```

Só **depósito** e **saque** mudam o patrimônio total; todo o resto redistribui.
Abrir posição debita o caixa e **carteira sem caixa não abre posição**; fechar
devolve capital mais resultado. A tela é [`carteiras.html`](carteiras.html).

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

## Uso offline e instalação

O ATLAS é instalável (Chrome/Edge: "Instalar aplicativo") e **abre sem
internet**. Os dados já eram locais; o que faltava era servir os
arquivos do site sem rede — trabalho de `sw.js`.

A estratégia é **rede primeiro, cache como rede de segurança**. Servir
do cache primeiro seria mais rápido e seria a decisão errada: num app
que calcula dinheiro, rodar código velho depois de uma correção é risco
real. O cache entra quando a rede falha.

Uma tela só abre offline depois de ter sido visitada ao menos uma vez
com conexão. Quem chega numa que nunca abriu vê `offline.html`, que não
depende de nada — CSS inline, um link absoluto.

Chamadas de API (preço, câmbio, pools) **não** são cacheadas pelo
service worker: preço guardado é preço errado, e `core/http.js` já tem
o próprio cache com TTL.

Em `file://` o service worker **não** é registrado — origem insegura.
Para limpar os arquivos guardados: **Configurações → Uso offline**.
Isso não apaga nenhum dado seu.

---

## Moeda

Todo valor é **armazenado em USD**, sempre. A moeda escolhida pelo usuário é uma
camada de *apresentação*: converte na hora de exibir, nunca ao gravar. Misturar
bases de moeda no armazenamento é como um sistema financeiro se corrompe em
silêncio.

**Arredondamento é trabalho da tela, nunca da camada de dados.** As casas seguem
uma régua só em todo o sistema: sem centavos a partir de mil, com centavos abaixo
disso, e quatro casas para valores menores que um centavo (a taxa de pool que uma
posição pequena gera). Camadas de cálculo devolvem o número cheio — quem exibe
decide como mostrar.

---

## Testes

`defi/testes.html` roda a bateria de verificação matemática do módulo DeFi: fluxos
de capital, taxas, PnL, impermanent loss, faixa de preço, datas e formatação. Cada
caso reconstrói o resultado esperado à mão e compara com o que o sistema calcula —
a interface não participa.

Rode depois de mexer em `defi/js/data.js`, `performance.js` ou `utils.js`. A página
salva as chaves do módulo antes de rodar e as devolve ao final, inclusive se um
caso quebrar: **nenhuma posição real é criada, alterada ou apagada**.

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

## O que vem depois

Autenticação real, página de valores e evolução do Oráculo são **fases
planejadas**, não pendências — e a estrutura para receber cada uma já
está no código. O mapa completo, com o que fazer quando a hora chegar,
está em [`ROADMAP.md`](ROADMAP.md).

---

## Convenções

- JavaScript clássico (ES5+), sem módulos ES e sem build. A ordem das tags
  `<script>` **é** a árvore de dependências.
- Cada peça compartilhada é idempotente: `if (window.X) return;`.
- Chaves de `localStorage` começam com `atlas` (ou `HOLD_` no legado) — é assim
  que `core/atlas-backup.js` encontra dados novos sozinho.
- Comentário explica **por que**, não o que. Correção de bug documenta a causa
  raiz, para ninguém desfazer sem saber o custo.
