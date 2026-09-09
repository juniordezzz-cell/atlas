# ATLAS

**Sistema operacional financeiro** para gestão de patrimônio em cripto e ativos
reais. Reúne quatro frentes de investimento — **Hold · Trade · DeFi · RWA** —
sob um mesmo shell, com carteiras, teses, relatórios e consolidação de
patrimônio compartilhados.

HTML, CSS e JavaScript puro. **Sem build, sem backend e sem CDN** — a única
biblioteca de terceiros é o Chart.js, servido de `assets/vendor/`, e as fontes
vêm de `assets/fonts/`. O ATLAS não faz nenhuma requisição a domínio externo
para desenhar a interface; só as cotações vão à rede.
Os dados vivem no `localStorage` do navegador.

> Este arquivo descreve o ATLAS inteiro. Cada módulo tem o seu próprio README
> com os detalhes internos: [`hold/`](hold/README.md) · [`trade/`](trade/README.md) ·
> [`defi/`](defi/README.md) · [`RWA/`](RWA/README.md).

---

## Como rodar

Abra `index.html` no navegador. Funciona em `file://`, mas o recomendado é
servir a pasta — em `file://` o navegador bloqueia as chamadas de API por CORS
(preços do CoinGecko e do GeckoTerminal, câmbio). A interface em si não precisa
de rede: fontes e Chart.js são servidos do próprio projeto.

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
> já está pronta, ver [`ROADMAP.md`](docs/ROADMAP.md#a--autenticação-real).

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
├── assets/               Imagem do Oráculo, ícones,
│                        fonts/ (Inter e JetBrains Mono) e vendor/ (Chart.js)
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
| `core/atlas-vocabulario.js` | Pergunta do Oráculo → consulta (métrica × módulo × período × carteira) | `AtlasVocabulario` |
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
Abrir posição debita o caixa e fechar devolve capital mais resultado. A tela é
[`carteiras.html`](carteiras.html).

**Carteira sem caixa não abre posição — em módulo nenhum.** A verificação vive
nos *stores* (`addPool`, `addRendimento`, `openTrade`, `executeBuy`, `addAsset`)
e no próprio livro, não nas telas: elas checam também, mas só para poder dizer
quanto falta. Assim a regra vale para importação, restauração de backup e
qualquer tela futura — e o primeiro passo do sistema é sempre um **depósito**.

---

## Preço de uma data

A cadeia de preço responde "quanto vale agora". Para registrar uma posição
aberta no passado existe `AtlasPrecos.emData(simbolo, "AAAA-MM-DD")`:
stablecoin → 1 dólar em qualquer data; senão, o histórico do provedor.

**O preço manual não entra nessa cadeia** — ele é "o preço de hoje,
informado por você", sem data associada, e carimbar uma data passada nele
seria inventar procedência. Sem histórico, devolve nulo e a tela pede o
valor à mão, como no resto do sistema.

A resposta traz `aproximado: true`: o histórico é o **fechamento de 00:00
UTC** daquele dia, não o instante da operação — que ninguém recupera. Quem
exibe é obrigado a dizer isso.

## O supervisor

`core/atlas-supervisor.js` **não calcula nada**. Cada módulo faz a sua
parte — o Hold sabe somar posições, o DeFi sabe o que é uma pool — e o
supervisor pergunta a todos e confere se as respostas fecham entre si,
com as carteiras e com o que a tela mostra. Recalcular aqui criaria uma
segunda fonte da verdade, que é o defeito que a auditoria removeu.

Ele existe porque **todo erro grave desta auditoria tinha a mesma
assinatura**: cada pedaço estava certo isoladamente, e a incoerência só
aparecia com dois pedaços lado a lado.

O que ele confere:

| Verificação | A pergunta |
|---|---|
| capital × caixa | o que saiu do caixa virou posição? |
| patrimônio | caixa + investido = depositado − sacado + resultado |
| cache da central | a cópia do saldo bate com o módulo? |
| carteiras | dinheiro em carteira apagada, isolada no total, caixa negativo |
| medições | a medição de hoje bate com o valor de agora? |
| tela | o KPI exibido é o que os dados dizem? |

**Sobre "consertar":** ele mexe em **uma coisa só** — cache derivado,
reescrito a partir da fonte. Ajustar um número para a conta fechar
apagaria o sintoma e manteria a causa, o oposto da regra de ouro nº 1.
Divergência que não seja cópia velha ele relata e não toca.

**E ele diz quando não pôde conferir.** Sem fonte para comparar,
`ok` vem `null` e a tela escreve "não conferido" — nunca "tudo certo".
Um verificador que tranquiliza sobre o vazio é pior que nenhum.

**Ele roda sozinho.** O centro de alertas o chama, então o sino vigia em
toda página, sem ninguém precisar lembrar de conferir. Um verificador que
só roda quando é chamado vigia quando é lembrado.

E ele fica **calado** no uso normal. Três áreas ficam fora do aviso
automático porque são *defasagem de instante*, não incoerência de dado —
cópia de saldo da central, tela ainda não repintada e medição do dia
anterior ao preço novo. As três se resolvem sozinhas, e um alerta que
pisca a cada compra legítima ensina a ignorar o sino. Elas continuam
visíveis na auditoria completa.

O que acende: capital que não bate com o caixa, patrimônio que não fecha
com o extrato, carteira apagada com dinheiro dentro, caixa negativo.
Nenhum desses se resolve esperando.

O painel completo está em **Configurações → Supervisão das contas**.

## O núcleo das contas

`core/atlas-contabilidade.js` define, uma vez, o que cada grandeza
significa — e é por isso que ele existe. Os dois erros de matemática
achados na terceira auditoria não eram de aritmética: as somas estavam
certas, e o que estava errado era o significado dos números somados.

```
caixa               dinheiro parado numa carteira
investido           valor de mercado das posições hoje
custo               o que foi pago por elas
patrimônio          caixa + investido
resultado aberto    não realizado (informado quando difere de valor−custo)
resultado realizado apurado em operações encerradas
base realizada      o capital que produziu esse resultado
rentabilidade       resultado total ÷ (custo + base realizada)
```

A última linha é a regra: **o denominador tem de conter a base de tudo
que está no numerador**. Quem informa resultado realizado é obrigado a
informar a base dele; sem ela a rentabilidade sai **nula** e a tela
escreve "—". Base inválida nunca vira `0%`, porque zero é uma
afirmação ("ficou de lado") e a ausência de base não é.

E a regra de ouro nº 4 vira uma função:

```js
AtlasContabilidade.conferir.dinheiroFecha({ caixa, investido,
                                            depositado, sacado, resultadoTotal })
// caixa + investido = depositado − sacado + resultado total
```

## Histórico de patrimônio

`core/atlas-snapshots.js` guarda **uma medição por dia, por módulo, por
carteira** — é a única coisa que o ATLAS não consegue refazer depois,
porque o preço de ontem não volta. O Dashboard soma as carteiras globais
e desenha só onde houve medição: dia sem leitura repete o último valor em
degrau, e o período anterior à primeira medição fica em branco. A legenda
informa quantos dias foram medidos de fato.

## Teses

Toda decisão **deveria** nascer de uma **tese**, registrada dentro de um módulo.
Ao concluir, ela vai automaticamente para o **Academy** e pode ser reaberta de
lá, gerando uma nova versão sem perder o histórico. Hold, Trade e DeFi já
consomem a entidade compartilhada; o RWA ainda não.

Status oficiais: `planejada` · `andamento` · `concluida` · `arquivada`.

A tese **cobra, não tranca**. O Hold chegou a recusar compras sem tese
vinculada, e a regra confundia duas naturezas: tese é disciplina, caixa é
possibilidade. Recusar o registro de uma compra que aconteceu no mundo real
deixa o sistema sem saber de um fato — pior que registrá-lo incompleto. O que
bloqueia uma posição, em qualquer módulo, é não haver caixa na carteira. A
ausência de tese vira alerta e fica visível até ser resolvida.

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
está em [`ROADMAP.md`](docs/ROADMAP.md).

---

## Convenções

- JavaScript clássico (ES5+), sem módulos ES e sem build. A ordem das tags
  `<script>` **é** a árvore de dependências.
- Cada peça compartilhada é idempotente: `if (window.X) return;`.
- Chaves de `localStorage` começam com `atlas` (ou `HOLD_` no legado) — é assim
  que `core/atlas-backup.js` encontra dados novos sozinho.
- Comentário explica **por que**, não o que. Correção de bug documenta a causa
  raiz, para ninguém desfazer sem saber o custo.
