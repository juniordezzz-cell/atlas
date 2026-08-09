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
