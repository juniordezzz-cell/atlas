# Modo demonstração — Dashboard com dados de exemplo

**Data:** 2026-09-19
**Status:** aprovado em conversa

## Problema

No primeiro acesso o Dashboard mostra o cartão "Seu ATLAS está pronto — e
vazio" com instruções. O dono do produto quer que o primeiro contato mostre o
ATLAS "funcionando": números, gráficos e listas preenchidos com dados de
exemplo, com um aviso pequeno e um botão para limpar e começar do zero. O
passo a passo de uso será explicado em vídeo no YouTube.

## Regras

1. **Quando aparece:** só se NÃO houver dado real em nenhum módulo (o mesmo
   critério que hoje dispara o cartão de primeiro acesso: sem categorias, sem
   movimentações, sem pools) **e** a demonstração ainda não tiver sido
   limpa. Quem tem dado real nunca vê exemplo.
2. **Onde aparece:** só no Dashboard (`pages/dashboard.html`). Módulos,
   Relatórios, Carteiras, seletor de carteira e sino continuam lendo dados
   reais.
3. **Nada é gravado:** os exemplos são uma camada de exibição.
   `buildAtlasData()` (js/data.js) devolve um objeto fictício com o mesmo
   formato; nenhum store de módulo, caixa ou snapshot é escrito. Nada falso
   pode chegar à nuvem (core/atlas-cloud.js) quando ela for ligada.
4. **Faixa no topo do Dashboard:** "Modo demonstração — estes números são
   ilustrativos. Para usar o ATLAS com os seus dados, limpe a
   demonstração." + botão **Limpar demonstração**.
5. **Aviso ao adicionar:** enquanto a demonstração estiver ativa, toda função
   que abre um formulário de CRIAR dado (não editar) abre antes o aviso "Primeiro limpe os
   dados de demonstração para cadastrar os seus" com **Limpar e continuar** /
   **Cancelar**. Ao limpar, a ação original segue.
6. **Depois de limpar:** Dashboard zerado, **sem** o cartão de instruções. A
   escolha fica em `atlas.demo.v1`; "Apagar todos os dados" em
   Configurações a regrava como "limpo", então a demonstração não volta.

## Componentes

- **`core/atlas-demo.js`** (novo, carregado em toda página que tem o shell):
  - `AtlasDemo.estado()` / `exibindo()` / `ativar()` / `encerrar()` /
    `limpar()` — leem e gravam `atlas.demo.v1`. Quem decide é o Dashboard
    (`buildAtlasData`), o único lugar que enxerga os quatro módulos juntos.
  - `AtlasDemo.dados()` — o objeto no formato de `buildAtlasData()`.
  - `AtlasDemo.snapshot(dias)` — série de evolução para 7/30/90 dias, no
    formato que o seletor de período do Dashboard consome.
  - `AtlasDemo.bloquear(continuar)`: chamado no início de cada função que
    abre formulário de criação; com a demonstração ativa abre o aviso e,
    ao confirmar, limpa e chama `continuar()`. Proteger a FUNÇÃO (e não o
    botão) cobre todos os botões e estados vazios que abrem o mesmo
    formulário.
  - Estado em `atlas.demo.v1` (ausente | "ativo" | "limpo"), fora do
    AtlasSettings para "Restaurar padrões" não trazer a demonstração de
    volta. Módulos só bloqueiam com "ativo" (gravado pelo Dashboard ao
    exibir); Dashboard com dado real grava "limpo".
- **js/data.js:** `buildAtlasData()` monta o real; com dado real grava
  "limpo" e devolve o real; vazio e estado ≠ "limpo" grava "ativo" e
  devolve `AtlasDemo.dados()` (com saudação/perfil reais).
- **js/dashboard.js:** faixa de demonstração; seletor de período usa
  `AtlasDemo.snapshot` quando ativo; após limpar, remonta com dados reais e
  não mostra o roteiro de primeiro acesso (flag "limpo").
- **Entradas protegidas:** Hold (Forms.newAsset/newThesis/trade compra),
  Trade (Novo RD, Novo trade), DeFi (openWizard, abrirNovo de staking/
  lending), RWA (openAssetModal/abrirFormTese sem edição), Carteiras
  (abrir ação), criação de carteira (AtlasWalletDialog.open, não rename).

## Dados de exemplo

Coerentes entre si: patrimônio ≈ US$ 48.300 (Hold, DeFi, RWA, Trade e
caixa), rentabilidade positiva moderada, evolução de 90 dias gerada de forma
determinística (mesma curva a cada abertura) terminando no total, 5 redes na
distribuição por blockchain, 4 movimentações, 4 pools (Raydium, Orca, Uniswap,
Aave) e 3 alertas. Datas relativas a hoje.

## Verificação

- Navegador limpo (origem de teste): Dashboard mostra exemplos + faixa;
  módulos vazios; clique em "Adicionar ativo" (Hold) abre o aviso; "Limpar e
  continuar" abre o formulário real; Dashboard volta zerado sem roteiro.
- Origem com dado real: nunca mostra demonstração nem bloqueia.
- Nenhuma chave `atlas.*` de dados é criada pela demonstração (só a
  preferência em settings).
- Console sem erro; celular 375px sem rolagem lateral.
