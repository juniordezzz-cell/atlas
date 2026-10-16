# Hold: Ativos vira mesa + fichas, Métricas vira laboratório de risco

Data: 16/10/2026 · Decidido com o dono depois da reforma do Painel
(`2026-10-16-painel-pizzas-3d-design.md`).

## Por que

Painel, Ativos e Métricas mostravam quase a mesma coisa: os mesmos quatro
números no topo, alocação por setor duas vezes, peso por posição repetindo a
pizza. Agora cada aba responde uma pergunta:

| Aba | Pergunta | Já feito? |
|---|---|---|
| Painel | Como está a carteira? | sim (pizzas 3D) |
| Ativos | O que eu faço com cada ativo? | este documento |
| Métricas | Quanto risco eu corro? | este documento |

## Ativos — "exatamente assim" (palavras do dono)

O dono mandou os dois esboços e pediu **exatamente** eles, os dois visíveis
na aba ao mesmo tempo: à esquerda a mesa, à direita as fichas; no celular,
mesa em cima e fichas embaixo. Sem botão de alternar vista, sem colunas a
mais.

**Topo da aba.** Título "Ativos", botões "Atualizar preços" e "Registrar
compra" (como hoje). **Sai** a faixa de quatro números (repete o Painel). Os
filtros (Investidos / Watchlist / Vendidos / Todos) e a busca ficam, acima da
mesa — o esboço diz "filtros, busca e ações direto na linha".

**Mesa — cartão "Posições e watchlist"** (eyebrow "ATIVOS").
Colunas, nesta ordem e só estas:
1. **Ativo** — ticker (com o ícone do token, regra do site: `data-atlas-token`).
2. **Preço · 24h · 7d** — preço atual, variação de 24 h e de 7 dias, em verde
   ou vermelho (`2,43 -1,2% +4,0%`).
3. **Result.** — resultado em aberto em % sobre o preço médio.
4. **Trade** — um botão por linha. Abre a janela de operação que já existe
   (`Forms.trade(id, "buy")`), que tem a troca Comprar/Vender no topo; o dono:
   "trade pode ser tanto uma compra quanto uma venda".

Linha de watchlist: apagada, "0,90 · watchlist" no lugar das variações, "—"
no resultado, botão Trade igual. Clicar na linha (fora do botão) abre a
página do ativo que já existe (`#/ativos?id=…`), onde continuam quantidade,
preço médio, valor, editar, excluir e histórico.

**Fichas — cartão "Uma ficha por ativo"** (eyebrow "ATIVOS").
Grade de duas colunas, uma ficha por **posição** (não watchlist):
- ticker e resultado em % na mesma linha (verde/vermelho);
- gráfico de linha de 30 dias do preço, sem eixos, linha fina;
- embaixo, "US$ 26 · 48%" (valor da posição · peso na carteira).
Clicar na ficha abre a página do ativo.

**Escolhas minhas (para o dono conferir):**
- Cor da linha da ficha segue a direção dos 30 dias (fim > início = verde),
  não o resultado — é o que o desenho mostra.
- Fichas seguem o filtro só quando ele é Investidos ou Todos; em Watchlist e
  Vendidos o cartão de fichas mostra uma frase curta em vez de ficar vazio.
- Ativo que não é cripto (preço manual) mostra "—" nas variações e ficha sem
  gráfico, com "preço informado".

## Métricas — laboratório de risco

Pergunta: **quanto risco a carteira de hoje corre?** Quatro respostas, as que
o dono escolheu: volatilidade, pior queda, correlação e quanto do risco vem
de cada ativo.

**Base de cálculo (decidido):** os últimos **90 dias** de preço diário de
cada ativo (CoinGecko `chart(id, 90)`), aplicados às **quantidades de hoje**:
"como esta carteira teria se comportado". Assim funciona desde o primeiro
dia, sem esperar o ATLAS medir. A tela diz isso numa linha.

**O que sai:** a faixa de números atual, "Alocação por setor", "Peso por
posição" e "O universo e a carteira" — tudo já está no Painel ou em Ativos.

**O que entra:**
1. **Faixa de três números:** Volatilidade (anualizada, "68% ao ano"), Pior
   queda em 90 dias (do pico ao fundo, "-31%", com as datas), Pior dia
   ("-12% em 03/09").
2. **Correlação — "Quem cai junto":** mapa de calor ativo × ativo, uma cor
   (azul), mais escuro = anda mais junto; número no quadrado ao passar o
   mouse. No máximo as 8 maiores posições.
3. **De onde vem o risco:** barras horizontais, uma por ativo, % do risco
   total (somam 100 %), ao lado do peso em dólar — a leitura é "MORPHO é 48%
   do dinheiro e 61% do risco".
4. Cada bloco com **uma frase** do que o número quer dizer, sem fórmula na
   tela.

**Fórmulas (para quem constrói):**
- Valor diário `V_t = Σ qᵢ · Pᵢ,t`; retorno diário `r_t = V_t / V_{t-1} − 1`.
- Volatilidade = desvio padrão de `r_t` × √365 (cripto negocia todo dia).
- Pior queda = maior queda de `V` em relação ao pico anterior, nos 90 dias.
- Correlação = Pearson dos retornos diários de cada par.
- Contribuição ao risco do ativo i = `wᵢ · (Σw)ᵢ / (wᵀΣw)`, com `w` = pesos
  de hoje e `Σ` = covariância dos retornos; soma 100 %.

**Casos:**
- Ativo sem histórico (não é cripto, ou a CoinGecko não tem): fica fora do
  cálculo e a tela lista "fora do cálculo: X".
- Menos de 2 ativos com histórico: correlação vira uma frase ("precisa de pelo
  menos dois ativos"); os demais números saem com um só.
- Carteira vazia: a tela fica no lugar, zerada (regra do dono de 08/10).
- A CoinGecko falhou (429/rede): aviso claro e botão de tentar de novo; nunca
  número inventado nem velho com cara de novo.

## Dados e chamadas (compartilhado pelas duas abas)

- Um módulo novo carrega, por ativo com id da CoinGecko, a série de 90 dias,
  com cache próprio enxuto em localStorage (pontos diários, validade de 6 h).
  A ficha usa os últimos 30 dias da mesma série — uma chamada serve às duas
  abas.
- Variações de 24 h e 7 d: uma chamada em lote (`/coins/markets` com
  `ids=…&price_change_percentage=24h,7d`), validade de 2 min.
- A versão grátis da CoinGecko limita chamadas: buscar em sequência curta,
  as maiores posições primeiro, e mostrar a tela já com o que chegou.
- Id do ativo: `cg_id` do cadastro ou `AtlasTokens.cgId(ticker)`.

## Decisões tomadas depois da revisão (minhas, para o dono conferir)

- **Carteira:** Ativos e Métricas seguem o seletor central de carteiras,
  igual ao Painel ("Todas" soma tudo; escolher uma filtra). Quantidades,
  pesos, resultado e "valor · peso" das fichas vêm da carteira em uso.
- **Vendidos na mesa:** resultado "—" (o esboço só tem o % em aberto); o
  realizado continua na página do ativo.
- **Quantidades fixas nos 90 dias:** sim, mesmo para posição comprada há
  20 dias — é a pergunta "como esta carteira teria se comportado", e a tela
  diz isso.
- **Stablecoin:** entra na volatilidade, na pior queda e no "de onde vem o
  risco" (ela de fato reduz o risco da carteira); fica fora do mapa de
  correlação (correlação de algo parado é ruído).
- **Histórico curto:** usa a janela comum a todos, se tiver ≥ 30 dias; o
  ativo que encurtaria a janela abaixo disso sai do cálculo e é listado em
  "fora do cálculo". A tela diz quantos dias entraram.
- **Série diária:** a CoinGecko devolve pontos horários em 90 dias; o módulo
  reduz para o último ponto de cada dia (UTC). Busca pelo `chart()` existente
  (passa pelo AtlasHttp) e guarda a versão diária enxuta no cache próprio de 6 h.
- **Trade na watchlist:** abre em Comprar; a janela já cuida de não deixar
  vender o que não tem.
- **Fichas e filtros:** em Todos, fichas só das posições abertas; a busca
  filtra a mesa e as fichas juntas.
- **Um ativo só:** "de onde vem o risco" vira uma frase (100% num ativo),
  como a correlação.

## Fora do escopo

- O Painel (já feito) e a página de detalhe do ativo (fica como está).
- Benchmark contra BTC, Sharpe, VaR, metas de alocação.
- Gráfico 3D em Ativos ou Métricas: aqui o visual é o sereno do site.

## Seria um fracasso se

- Ativos tiver qualquer coluna ou número além dos esboços.
- Um número de risco aparecer sem dizer de onde veio (90 dias, quantidades de
  hoje) ou for calculado com dado faltando sem avisar.
- A aba travar esperando a CoinGecko.

## Deixado para quem constrói

- Nome e local do módulo de séries (sugestão: `core/atlas-series.js`).
- Desenho exato do mapa de calor e das barras, dentro do visual sereno.
- Ordem das chamadas e espera entre elas.

## Como conferir

Navegador do Claude com `?atlas-dev=1` (dados de teste só nele): carteira
vazia, 1, 4 e 10 posições, uma não cripto, uma sem `cg_id`; CoinGecko
bloqueada (simular falha); escuro, claro, 1600 px e 375 px. Conferir à mão um
caso pequeno (2 ativos, série conhecida) contra as fórmulas acima — com teste
em Node para as funções de cálculo.
