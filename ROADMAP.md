# ATLAS · Roadmap

Registro do que foi feito e do que vem depois. Existe para que nenhuma
decisão adiada vire dívida esquecida — e para que ninguém "conserte" o
que foi adiado de propósito.

O histórico completo, item a item e com o porquê de cada escolha, está
nas mensagens de commit. Aqui fica só o mapa.

---

## Concluído

### Fase 1 — Quick wins (12 itens)
Controle de versão, favicon e meta em todas as páginas, menu móvel
(Dashboard, Relatórios e Configurações eram inutilizáveis abaixo de
860px), seis controles mortos do Dashboard ligados, 92 KB de código
morto removidos, apresentação de abertura só na primeira vez, folha de
impressão.

### Fase 2 — Melhorias importantes (10 itens)
Kit de UI único (13 `confirm`/`alert` nativos substituídos), estado
vazio guiado, movimentos e alertas vindos dos quatro módulos, uma
definição só de sidebar, skip link e armadilha de foco, Dashboard
reativo.

### Fase 3 — Refatorações estruturais (9 itens)
Moeda de exibição real (BRL/EUR/USD), ponte de tokens fechada,
tipografia unificada em Inter, biblioteca de ícones única (106 → 66),
chaves de armazenamento unificadas com migração verificada, Teses no
RWA, e a correção do bug de fonte dupla — o KPI dizia US$ 72.500
enquanto o seletor de carteira ao lado dizia US$ 0.

### Fase 4 — Polimento premium (10 de 11 itens)
Tema claro auditado com medição de contraste em 19 telas · três passos
da primeira sessão · exportação em CSV e PDF · sino como central de
alertas com estado de lido · flash no valor que muda · paleta de
comandos (Ctrl+K) · Oráculo lendo os dados reais · instalável e abrindo
offline · auditoria de acessibilidade · página pública.

### Terceira auditoria — o dado tem de ter origem, fórmula e destino

Cinco fases, a partir da pergunta "qual a fonte deste número, que conta
o produziu, e o que a tela mostrou?".

**Status da faixa** deixou de ser um campo escolhido em formulário e
virou consequência do preço (`DeFiStore.statusDe`). Sem cotação, a
posição diz *"faixa não avaliada"* — antes ela dizia "Fora do Range" e
o Dashboard emitia alerta crítico sobre uma conta que ninguém tinha
feito.

**Preço** ganhou uma cadeia única para os quatro módulos
(`core/atlas-precos.js`): manual do usuário → stablecoin → id curado →
busca por símbolo idêntico → DEX. A regra é do sistema inteiro: a API é
o caminho principal, e quando nenhuma fonte reconhece o ativo quem
informa o preço é o usuário.

**Busca de pool do DefiLlama** foi removida, e o par passou a ser 100%
manual na ordem digitada. **RWA** ganhou quantidade e preço unitário —
o autopreenchimento escrevia preço unitário em campo de valor total.
**Taxa** ganhou estados e destino, separada da valorização dos ativos.
**Caixa** passou a existir: `wallets/walletCaixa.js` e a tela
`carteiras.html`.

**Staking e Lending** ganharam o modelo das pools. Eram duas abas que
somavam no patrimônio a partir de um campo `value` gravado e não tinham
como ser criadas — sem função no store, sem formulário, sem botão. Agora
o valor é derivado de quantidade × preço, o capital sai do caixa e volta
ao encerrar, e o rendimento tem os mesmos estados da taxa de pool.

---

## Fases futuras

As três abaixo **não são pendências nem bloqueios**: são etapas
planejadas, com data a definir pelo dono do produto. A estrutura para
receber cada uma já está no código.

### A · Autenticação real

**Estado:** costura pronta, provedor a definir.
**Não exige configuração nenhuma para o sistema funcionar hoje.**

`core/atlas-auth.js` é a camada de sessão. Hoje roda em modo `local`:
registra quem entrou (para o "Sair" ter o que encerrar) e **não barra
ninguém** — sem provedor, trancar a porta com a chave na fechadura seria
teatro, e quebraria o uso atual em troca de segurança que não existe.

Quando chegar a hora, o provedor se registra e nada mais muda:

```js
AtlasAuth.registerProvider({
  nome: "firebase",
  current:  function () { return usuarioOuNull; },
  signIn:   function (creds) { return Promise; },
  signOut:  function () { return Promise; },
  onChange: function (fn) { /* opcional */ }
});
```

A partir daí `AtlasAuth.protegido()` passa a valer sozinho, o login
autentica de verdade e o "Sair" desloga de verdade — sem tocar em
nenhuma tela.

Volta junto com isto: o link "Esqueceu sua senha?" do login, retirado
porque apontava para uma tela inexistente.

### B · Página de valores e planos

**Estado:** landing pronta, preços a definir.

`landing.html` apresenta o produto e **não tem tabela de preços**, de
propósito. Planos, valores e o que é gratuito são decisão comercial do
dono — inventar uma tabela seria assumir compromisso em nome dele.

A página é seccionada (`.lp-sec`), então uma seção de planos entra sem
reestruturar nada. A intenção registrada é uma página HTML própria para
valores; quando existir, a landing aponta para ela.

### C · Oráculo

**Estado:** base funcionando, evolução a definir.

Hoje o Oráculo responde a partir dos dados do usuário — patrimônio,
resultado, teses, pendências, carteiras, fluxo e moeda — e recusa
previsão de mercado. Isso é a base, não o destino.

O ponto de extensão já existe e é usado pelo Dashboard:

```js
AtlasOraculo.registerBrain(function (ctx) {
  return { chips: [...], answer: function (q) { ... } };
});
```

Um cérebro registrado tem prioridade e cai no cérebro-base quando
devolve `null`. Comportamento, inteligência, interface e integração
serão tratados na fase própria dele.

---

## Decisões adiadas com motivo registrado

Coisas que **não** são para "consertar" sem antes ler o porquê:

- **DeFi continua multipágina.** Três critérios objetivos para
  revisitar estão em [`defi/README.md`](defi/README.md#por-que-este-módulo-é-multipágina-e-os-outros-não).
- **Idioma único (pt-BR).** O motor de i18n continua no lugar e
  dormente; o dicionário cobria a navegação e deixava o conteúdo dos
  módulos em português, o que entregava tela metade traduzida.
- **Sem biblioteca de PDF.** O navegador imprime melhor do que jsPDF e
  não custa centenas de KB de CDN. Ver `core/atlas-export.js`.
- **Macro e narrativa do RWA ficam vazias.** Os valores que estavam lá
  (Fed Funds 4,50%, CPI 2,9%, DXY 103,4, "AI Expansion Cycle") eram
  fixos no código, com gráficos de um gerador pseudoaleatório, exibidos
  como leitura de mercado. Um painel macro decorativo num sistema que
  decide alocação convida a decidir com base em dado que não existe. A
  estrutura continua pronta: quando um provedor de macro for registrado,
  as telas voltam a desenhar sozinhas.
- **O RWA tem dois modelos de ativo convivendo, de propósito.** Com
  quantidade, os totais são derivados de quantidade × preço e o preço é
  acompanhado sozinho. Sem quantidade, valem os totais informados à mão.
  Ativo cadastrado antes da terceira auditoria não tem quantidade, e o
  sistema não tem como adivinhá-la — preencher "1" faria os totais
  baterem e todo o resto mentir.
- **Um livro-razão só.** `wallets/walletCaixa.js` é a fonte da verdade
  do dinheiro; `js/atlas-movements.js` é uma VISTA sobre ele, no
  vocabulário dos Relatórios (entrada/saída/resultado) mais o
  agrupamento por período. Ele não grava nada e não deriva das
  posições — se voltar a ter armazenamento próprio, volta a divergir.
  A invariante que prova a unificação: o `net` do relatório de uma
  carteira é igual ao saldo de caixa dela.
- **No Hold, o que bloqueia a compra é o CAIXA, não a tese.** A regra
  anterior recusava comprar sem tese vinculada. Ela confundia duas
  naturezas: tese é DISCIPLINA (ausência é problema de processo, e o
  alerta "Posição sem tese" já cobra), caixa é POSSIBILIDADE (sem
  dinheiro a compra não acontece — é aritmética). Bloquear pela tese
  fazia o ATLAS recusar o registro de uma compra que ocorreu no mundo
  real, e não registrar um fato é pior que registrá-lo incompleto.
- **A curva do patrimônio é medida, não gerada.** `core/atlas-snapshots.js`
  é o livro de medições: uma leitura por dia, por módulo, por carteira.
  Antes cada módulo media dentro do próprio estado (três formatos), o
  Trade não media, e a consolidação esticava a série de UMA carteira até
  o fim bater com o total de TODAS — um passado inventado a partir de
  dado real. Dia sem medição repete o último valor em degrau; dia
  anterior à primeira medição não é desenhado. A tela diz quantos dias
  mediu de fato.
- **Preço manual vence a API.** Ele só existe quando nenhuma fonte
  reconheceu o ativo, e uma API que volta a responder com o ativo
  ERRADO (símbolo colidindo) é pior que não responder. Envelhece e
  avisa, mas não é sobrescrito sem ordem.

---

## Dados anteriores à terceira auditoria

O dono do produto optou por **apagar e recomeçar** em vez de conviver
com dado anterior ao livro de caixa. Para isso existe **Configurações →
Dados e Backup → Começar do zero**: apaga tudo o que o backup enxerga,
com a lista do que vai sumir na frente e o convite a exportar antes.

Duas coisas ficam de pé mesmo assim, e não são dívida:

- **`wallets/walletCaixaMigracao.js` continua no lugar.** Ele não é só
  para quem tinha posições antigas hoje: importar um backup gerado
  ANTES desta auditoria recria exatamente aquele estado — posições sem
  nenhum evento de caixa que as explique. A abertura de saldo é a
  resposta para isso, e some sozinha quando não há o que migrar.
- **`sizeUSD` nos trades.** Trade aberto sem capital em dólar fecha
  devolvendo zero ao caixa. É honesto (o sistema não sabe quanto foi) e
  o formulário agora exige o campo, então só alcança operação criada
  antes da auditoria — ou seja, nenhuma, neste caso.
