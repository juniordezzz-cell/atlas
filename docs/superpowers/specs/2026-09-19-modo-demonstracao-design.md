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
5. **Aviso ao adicionar:** enquanto a demonstração estiver ativa, todo botão
   de criar dado (marcado `data-atlas-cria`) abre o aviso "Primeiro limpe os
   dados de demonstração para cadastrar os seus" com **Limpar e continuar** /
   **Cancelar**. Ao limpar, a ação original segue (o clique é refeito).
6. **Depois de limpar:** Dashboard zerado, **sem** o cartão de instruções. A
   escolha fica em `AtlasSettings` (preferência), então "Apagar todos os
   dados" em Configurações não traz a demonstração de volta.

## Componentes

- **`core/atlas-demo.js`** (novo, carregado em toda página que tem o shell):
  - `AtlasDemo.ativo()` — true se não limpo e sem dado real. "Sem dado
    real" é calculado da consolidação real (`AtlasConsolidation.snapshot`,
    `AtlasMovements.list`, `DeFiStore` pools/staking/lending), sem depender
    do Dashboard.
  - `AtlasDemo.limpar()` — grava a preferência.
  - `AtlasDemo.dados()` — o objeto no formato de `buildAtlasData()`.
  - `AtlasDemo.snapshot(dias)` — série de evolução para 7/30/90 dias, no
    formato que o seletor de período do Dashboard consome.
  - Vigia de cliques em fase de captura: em `[data-atlas-cria]` com a
    demonstração ativa, cancela o clique, abre o aviso e, ao confirmar,
    limpa e refaz `el.click()`.
- **js/data.js:** no início de `buildAtlasData()`, se `AtlasDemo.ativo()`,
  devolve `AtlasDemo.dados()` (com saudação/perfil reais).
- **js/dashboard.js:** faixa de demonstração; seletor de período usa
  `AtlasDemo.snapshot` quando ativo; após limpar, remonta com dados reais e
  não mostra o roteiro de primeiro acesso (flag "limpo").
- **Marcação `data-atlas-cria`:** botões de criar em Hold, Trade, DeFi, RWA,
  Carteiras e no seletor de carteira ("Nova carteira").

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
