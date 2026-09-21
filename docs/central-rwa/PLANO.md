# Plano — da Central RWA a uma renda em dólar

Documento de decisão. Não é lista de tarefas: é o raciocínio de **por que** fazer cada
coisa, em que ordem, e **o que mata cada hipótese**. Enquanto ele não estiver fechado, o
código para de crescer. O que já está no ar continua rodando.

> Este plano contraria parte do que foi conversado. Está assim de propósito: um plano que
> só concorda não serve para arriscar dinheiro.

---

## 1. A matemática que manda em tudo

Tudo neste projeto esbarra num único número, medido nas **4.054 operações simuladas** das
10 cestas (2016–2026):

> **O desvio-padrão da diferença entre a operação e o "não fazer nada" é de 7,04 pontos
> percentuais por operação.**

O efeito que procuramos é de 1 p.p. por operação. **O ruído é sete vezes maior que o sinal.**
Disso decorre tudo o mais:

### 1.1 Quantas operações são necessárias para saber

| vantagem procurada | 1 modelo testado (t=2,0) | 100 modelos testados (t=3,3) |
|---|---|---|
| +0,5 p.p. por operação | 792 operações | 2.156 operações |
| +1,0 p.p. por operação | 198 operações | 539 operações |
| +2,0 p.p. por operação | 50 operações | 128 operações |

As 10 cestas juntas produzem **≈ 484 operações por ano**. Um agente sozinho produz de 7 a
110 por ano. Então:

- provar que **um agente específico** tem +1 p.p.: 198 operações ÷ 40 por ano = **5 anos**;
- provar que **a família de regras** tem +1 p.p., somando as 10 cestas: **5 meses** (t=2) ou
  **1,1 ano** (t=3,3).

**Consequência direta, e é a decisão mais importante deste plano:** a unidade de prova é a
**família de modelos rodando em muitos ativos ao mesmo tempo**, nunca o agente isolado.
Olhar "o agente da NVDA acertou 8 de 10" é olhar ruído. Foi exatamente o que aconteceu com
a cesta 2 (8 operações na validação) e com a cesta 1 (47 operações, todas de um ativo só).

### 1.2 Testar 100 modelos tem um preço estatístico

Testando 100 modelos sem edge nenhum, **o melhor deles aparece com t ≈ 3,03 por puro acaso**.
Com 1.000 modelos, t ≈ 3,72. O corte usual de t > 2 não serve: com 100 modelos ele aprova
~5 vencedores falsos por rodada.

Regra deste projeto: **o corte de aprovação é t > 3,3, e o número de modelos testados entra
no relatório.** Se testarmos 1.000, o corte sobe para 3,7. Quem não conta quantos modelos
testou está se enganando.

Já temos a medida disso: na grade de 486 variantes da antiga cesta 2, **25 ganharam do "não
fazer nada" no treino e 69 na validação** — exatamente o que se espera de moeda jogada para
o alto, não de uma descoberta.

### 1.3 O resultado de um ano não diz nada

Com 7,04 p.p. de desvio por operação, o resultado **anual** de um agente que opera 40 vezes
por ano tem ruído de **±44 p.p.**. Com 100 operações, ±70 p.p.

Isto é o que mata a palavra "consistente" no desenho atual: mesmo que a vantagem exista de
verdade, um ano bom e um ano ruim são indistinguíveis. **Renda consistente não vem de
acertar mais; vem de operar muitas vezes com pouca variação em cada vez.** É outro desenho.

### 1.4 A alavanca que ninguém olha: reduzir o ruído, não aumentar o acerto

O número de operações necessárias cai com o **quadrado** do ruído. Cortar o desvio de 7,04
para 2,0 p.p. reduz a amostra necessária em **12 vezes** — de 5 anos para 5 meses.

Três formas de cortar ruído, em ordem de eficácia:

1. **Medir contra o índice no mesmo período, não contra a média histórica do ativo.** Hoje o
   "não fazer nada" é o retorno médio de um dia qualquer. Se a NVDA sobe 6% porque o mercado
   inteiro subiu 5%, o agente leva crédito por 6%. Descontar o movimento do SPY na *mesma*
   janela remove a maior fonte de variação de todas. **Isto é a mudança de método mais
   barata e mais valiosa do plano.**
2. **Prazo mais curto** (a variação cresce com a raiz do tempo): 2 pregões em vez de 7 corta
   o desvio quase pela metade.
3. **Operar mais ativos por sinal** (a cesta inteira em vez do ativo que disparou): a média
   de 6 ativos tem menos ruído que 1.

---

## 2. O que já foi medido (e é ruim)

Não são impressões: são as 4.054 operações.

| agente | operações | diferença média para o "não fazer nada" | t |
|---|---|---|---|
| Referência v1 (régua) | 376 | **−1,67 p.p.** | **−7,9** |
| macro | 410 | −0,37 p.p. | −2,6 |
| bigtech | 982 | −0,26 p.p. | −2,0 |
| infra_digital | 841 | −0,28 p.p. | −2,3 |
| defesa | 781 | −0,25 p.p. | −2,1 |
| ia_chips | 233 | −1,05 p.p. | −2,2 |
| mineracao / cripto / ia_agressiva | 35 a 308 | positivas | 0,1 a 0,6 (ruído) |

Leitura honesta: **a família de regras atual não é "inconclusiva", é significativamente pior
do que ficar comprado** (t = −7,9 na régua não é azar). E nenhum dos três resultados
positivos tem amostra para significar coisa alguma.

Isso não condena o projeto. Condena **este modelo**: "caiu X% → o histórico de quedas
parecidas subiu → compro". É um indicador só, e o mais óbvio de todos.

---

## 3. Onde a vantagem pode estar — e onde quase certamente não está

Ordenado por *probabilidade de existir* × *velocidade de provar*.

### H1 — Descolamento entre o token e o ativo (o diferencial real deste projeto)

O token de ação negocia **à noite, no fim de semana e em feriado**, quando a bolsa está
fechada. O preço do token anda sozinho e, na abertura, tende a reencontrar o ativo. Esse
descolamento:

- **já é medido pelo backend** (`token_vs_ativo_acima_de_2pct`, seção 7.2 — está no resumo
  de todo job);
- acontece **várias vezes por semana, em 66 ativos** → centenas de observações por mês, não
  40 por ano;
- tem **ruído baixo** (é uma diferença entre duas cotações do mesmo ativo, não uma aposta
  direcional no mercado) — exatamente o que a seção 1.4 pede;
- é um mercado **novo, pequeno e de acesso restrito**, onde fundo grande não entra por
  questão regulatória. É a única frente em que você não está competindo com quem tem
  computador melhor.

**É a hipótese com melhor relação prêmio/prova do projeto inteiro, e o backend já coleta o
dado.** Se alguma coisa aqui der dinheiro, a chance é maior que seja isto.

Risco a medir antes de qualquer euforia: liquidez do token, spread, e custo de rede. Um
descolamento de 2% não vale nada se o spread é 3%.

### H2 — O seu sistema WM (suporte e resistência)

É o seu diferencial declarado, e tem uma tese testável por trás, que eu levo a sério:

> "O método tem expectativa positiva, mas a execução humana destrói o resultado."

Se isso for verdade, automatizar captura a diferença — e isso é mensurável: basta rodar a
regra automática no histórico e comparar com o seu resultado real. **Mas a regra precisa
virar número.** "Suporte" e "resistência" no gráfico são ambíguos; no código precisam de
definição exata: quantos toques, em que janela, com que tolerância, o que invalida.

Antes de programar qualquer coisa, preciso de você: **a descrição do WM em passos, do jeito
que você faria olhando a tela** (o que faz você marcar o nível, o que faz você entrar, onde
põe o stop, o que faz você desistir). Sem isso eu estaria inventando o seu método e testando
a minha invenção.

### H3 — O zoológico de indicadores (RSI, MACD, EMA 9/21/200)

É o que você descreveu, e é o que tem a **pior probabilidade a priori** do plano — não por
ser ruim, mas porque é o conjunto mais minerado da história, nos ativos mais líquidos do
planeta, por gente com mais dado e mais máquina. Se "RSI < 30 + MACD virando + acima da
EMA200" funcionasse nas mega caps, já teria sido arbitrado.

Ainda assim entra no plano, por dois motivos: é **de graça** (sai dos pregões que já estão
no banco, nenhuma chave nova) e é **rápido de testar em bloco**. Mas entra com as regras da
seção 1.2: corte t > 3,3, número de modelos declarado, e resultado medido na família toda.

Previsão registrada aqui para ser cobrada depois: **espero que a maioria dos 100 modelos
fique dentro do ruído e que os "vencedores" não se repitam fora do treino.** Se eu estiver
errado, ótimo — e o teste vai mostrar.

### H4 — Notícias e X

Fica por último, e não é preguiça: não existe histórico gratuito de notícia alinhado ao
pregão, então **não dá para backtestar honestamente**. Sem backtest, o único teste é o ao
vivo, que pela seção 1.1 leva anos. É a frente que mais consome chave paga e menos produz
prova. Só faz sentido depois que H1 ou H2 mostrarem algo.

---

## 4. Como medir (o padrão que faltava)

O que estava faltando e te deixou perdido: **a ficha do agente**. Todo modelo, do primeiro
ao centésimo, é descrito pelos mesmos campos, e o mesmo motor roda essa ficha no passado e
ao vivo. Sem exceção.

```
ficha do agente
  cesta            quais ativos (5 a 8, do mesmo nível de ATR%)
  indicadores      quais séries ele enxerga (hoje: variação do pregão. só isso)
  entrada          a condição exata, em cima dos indicadores
  saída            alvo, stop e prazo
  filtro           amostra mínima e o que o faz ficar de fora
  promoção         o critério para sair do estudo e ir ao vivo
```

**Três períodos, e o terceiro nunca é usado para escolher:**

| período | para que serve | quem pode olhar |
|---|---|---|
| Treino (até 2022) | escolher a regra | o pesquisador |
| Validação (2023–2025) | medir a regra escolhida | só para relatar |
| **Reserva (2026 em diante)** | **conferência final, uma vez só** | **ninguém, até a decisão** |

Hoje só existem os dois primeiros, e a validação já foi olhada muitas vezes — a cada vez ela
vira um pouco mais "treino". Por isso o terceiro período precisa existir e ficar **lacrado**.

**Critério de promoção para o ao vivo** (o que você descreveu da NVDA, virado em número):

1. a família do modelo tem t > 3,3 na validação, contando quantos modelos foram testados;
2. pelo menos 200 operações na família;
3. nenhum ativo responde por mais de 40% das operações;
4. o resultado não vira ao trocar o início da série (o teste de janela).

Só quem passa nos quatro vai ao vivo. O ao vivo **não é o selecionador** — pela seção 1.1
ele levaria anos para decidir. Ele é a **prova de que o backtest não estava mentindo**:
custo real, preço real, horário real.

---

## 5. Fases, com critério de morte

Cada fase tem um número que, se não aparecer, **mata a fase** — e seguimos para a próxima
sem apego.

| # | Fase | Entrega | Morre se |
|---|---|---|---|
| 0 | **Medir contra o índice** (seção 1.4) | Todo placar passa a descontar o SPY da mesma janela | — (é método, não hipótese) |
| 1 | **Período de reserva lacrado** | 2026+ fora de qualquer escolha | — |
| 2 | **H1 — descolamento token × ativo** | Estudo do descolamento noturno e de fim de semana, com spread e custo de rede | O descolamento médio não cobrir spread + custo |
| 3 | **H2 — WM em regras** | O seu método virado em condição testável | t < 3,3 na família, com ≥ 200 operações |
| 4 | **Camada de indicadores** | RSI, MACD, EMA, ATR e volume no YAML (sem chave nova) | — (infraestrutura) |
| 5 | **H3 — grade de modelos** | N modelos por cesta, com correção para N | Nenhum modelo passar t > 3,3 |
| 6 | **Tela Estudos × Ao vivo** | Janelas separadas, como você pediu | — |
| 7 | **Ao vivo com portão** | Só o que passou na seção 4 | — |
| 8 | **Saída para bot** | JSON estável para copiar o trade | — |

Repare na ordem: **a tela vem depois da matemática**. Organizar a tela antes de saber se
existe sinal é arrumar a vitrine de uma loja sem produto.

---

## 6. O que isso significa para "renda em dólar consistente"

Com o desenho atual (≈40 operações por ano por agente), mesmo uma vantagem real de 1 p.p.
por operação daria ±44 p.p. de ruído no ano. **Não existe renda consistente com 40 apostas
por ano.** Renda consistente precisa de:

- **muitas operações** (centenas por mês, não dezenas por ano) → favorece H1;
- **pouca variação por operação** → favorece H1 e prazos curtos;
- **pouca correlação entre elas** → operações no mesmo dia, na mesma cesta, contam quase
  como uma só. Isto reduz a amostra efetiva e precisa entrar na conta.

Uma coisa que o plano não resolve e é sua: **capital e meta**. Uma vantagem de 1 p.p. por
operação em 40 operações por ano é ~40% ao ano sobre o valor operado, no melhor cenário —
US$ 400 em US$ 1.000. Se a meta mensal for maior que isso, o problema não é o modelo: é o
capital, e nenhum agente resolve.

---

## 7. O que não fazer (a parte que mais economiza dinheiro)

- Não escolher modelo olhando a validação. Escolhe-se no treino, relata-se a validação.
- Não acreditar em resultado com menos de 100 operações, por melhor que pareça.
- Não deixar uma cesta virar um ativo só (a coluna "maior ativo" existe para isso).
- Não pôr ao vivo sem o portão da seção 4.
- Não pagar por chave de API antes de H1 ou H2 mostrarem número. Até lá, tudo cabe no
  gratuito: RSI, MACD, EMA e ATR saem dos pregões que já estão no banco.
- Não confundir tela arrumada com modelo que funciona.

---

## 8. Decisões que dependem de você

1. **O WM em passos** — a descrição do seu método, do jeito que você opera. É o único item
   que eu não consigo produzir sozinho, e é a hipótese que é sua.
2. **Capital e meta mensal em dólar** — sem isso não dá para dizer se uma vantagem de 1 p.p.
   por operação resolve o seu problema ou não.
3. **Quanto tempo você aceita esperar** antes de considerar uma frente morta. Sugiro 3 meses
   por hipótese: no ritmo das 10 cestas, é amostra para detectar vantagens grandes, e
   suficiente para desistir das pequenas.
