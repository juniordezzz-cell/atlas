# Central RWA — Cestas de ativos

Cada **cesta** é um grupo de ativos que se comportam de um jeito parecido, e cada cesta
tem **um agente** com regras próprias. Um agente por cesta (e não um por token) porque
um ativo sozinho tem eventos de menos: sem amostra, não há estatística.

Este arquivo é a lista em português, para conversar: *"mexe na cesta do cripto"*,
*"acrescenta esses ativos na mineração"*. A configuração que o sistema lê é
[`central-rwa/backend/config/agents.yaml`](../../central-rwa/backend/config/agents.yaml);
os dois andam juntos.

> **Como as regras são escolhidas:** olhando só os pregões **antes de 2023**. O resultado
> de **2023 em diante** (validação) é medido depois, em dados que a escolha nunca viu, e é
> o número que vale. Quando uma cesta brilha no treino e cai na validação, a regra
> decorou o passado — e o site diz isso na cara.

---

## Regra de estrutura

Vale antes de qualquer cesta, e o `agents.yaml` recusa configuração fora dela:

- no máximo **10 cestas** no sistema;
- cada cesta com **5 a 8 ativos**;
- tema que não cabe em 8 vira **duas sub-cestas** (ex.: "IA — chips" e "IA — equipamento
  e redes"), nunca uma cesta gigante;
- a **régua** (`tipo: regua`) é a exceção: roda em todos os ativos de propósito.

O motivo não é estética: cestas de tamanhos diferentes não dão para comparar entre si.
Um agente não pode parecer melhor só porque treinou em menos ruído que o outro.

## Como uma cesta é montada

O eixo que manda é o **risco**; o tema é só o filtro para escolher os ativos dentro de
cada nível de risco. Cruzar os dois eixos direto (3 níveis × 6 temas) estouraria o limite
de 10 e criaria cesta vazia.

A classificação de risco **não é opinião**. Para cada candidato de
[`config/candidatos.yaml`](../../central-rwa/backend/config/candidatos.yaml) mede-se o
**ATR% de 14 pregões** (o quanto o ativo anda por dia, em % do preço), tira-se a mediana
dos últimos 180 dias e corta-se a lista inteira em **tercis**:

| nível | ATR% (medido em 2026-09-20) |
|---|---|
| conservador | até 3,33 |
| mediano | 3,34 a 5,66 |
| agressivo | acima de 5,66 |

`python -m central_rwa lab risco` refaz a conta. **Refazer a cada trimestre**: volatilidade
muda de regime, e um ativo mediano hoje vira agressivo se o setor entrar em hype.

Dois cuidados que valem lembrar:

- o corte é **relativo à lista de candidatos** — acrescentar 14 mineradoras de bitcoin
  empurra todo mundo para baixo no ranking (é por isso que a NVDA aparece como
  *mediana* aqui);
- todo candidato é conferido contra o **catálogo de tokens** antes de entrar. **DXY e VIX
  não existem tokenizados** e ficaram de fora.

---

## O que descobrimos antes de montar estas cestas

As duas cestas antigas ("Macro & Índices" e "Big Tech") pareciam ter 4 e 7 ativos.
Olhando quem realmente operou:

| cesta antiga | operações na validação | de quem |
|---|---|---|
| Macro & Índices (+0,63%, a que "se sustentou") | 47 | **WTI — 47 de 47** |
| Big Tech | 8 | **TSLA — 7 de 8** |

Com gatilho fixo, só o ativo mais volátil da cesta dispara: o petróleo tem ATR% de 6,29
contra 1,12 do SPY. As duas cestas eram, na prática, **um ativo só com outro nome** — e a
vantagem publicada da cesta 1 era do petróleo, não de "macro".

Por isso o ATR% virou o eixo: agora cada cesta só junta ativos que andam parecido. E toda
tabela do laboratório mostra a coluna **"maior ativo"**, para esse disfarce não passar de novo.

---

## As 10 cestas

Placar medido em 2026-09-20 com `python -m central_rwa lab placar`, série desde
2016-09-20. **Vant.** é a diferença para o "não fazer nada" (ficar comprado num dia
qualquer, mesmo prazo). O que vale é a coluna da validação.

### Conservadoras (ATR% ≤ 3,33)

Regra escolhida no treino, na união dos ativos das 4 cestas, entre 36 variantes:
gatilho de 2%, opera quedas e altas bruscas, sem alvo, prazo de 5 pregões, stop na
queda típica dos semelhantes.

> ⚠️ **Nenhuma das 36 variantes ganhou do "não fazer nada" no treino.** A publicada é a
> menos ruim (−0,36 p.p. em 2.014 operações). Não é falta de amostra — é a ideia que não
> funciona nestes ativos: quem sobe devagar e constante só paga custo a cada entrada e saída.

| cesta | ativos | treino | validação | vant. validação | maior ativo |
|---|---|---|---|---|---|
| Macro, ouro e energia | SPY, QQQ, IWM, GOLD, XLE, PPLT | −0,24% (280 op.) | +0,08% (130 op.) | **−0,18 p.p.** | QQQ 30% |
| Big Tech | AAPL, MSFT, GOOGL, AMZN, META, CSCO | +0,12% (657) | +0,47% (325) | **+0,00 p.p.** | META 21% |
| Defesa | LMT, RTX, NOC, GD, LHX, HII, ITA | +0,05% (476) | +0,03% (305) | **−0,22 p.p.** | RTX 23% |
| Infraestrutura digital | EQIX, DLR, AMT, CCI, SBAC, IRM | −0,05% (601) | +0,10% (240) | **−0,13 p.p.** | IRM 28% |

### Medianas (ATR% ≤ 5,66)

Regra escolhida no treino entre 36 variantes: gatilho de 4%, segue altas bruscas, sem
alvo, prazo de 7 pregões, stop no percentil 20.

> ⚠️ Também aqui **nenhuma das 36 ganhou do "não fazer nada" no treino**; a publicada é a
> menos ruim (−0,25 p.p. em 547 operações).

| cesta | ativos | treino | validação | vant. validação | maior ativo |
|---|---|---|---|---|---|
| IA — chips | NVDA, AVGO, TSM, ASML, AMD | −0,02% (124) | +0,62% (109) | **−0,68 p.p.** | NVDA 47% |
| IA — equipamento e redes | AMAT, KLAC, ANET, QCOM, ON, MPWR | +0,94% (188) | −0,34% (137) | **−1,32 p.p.** | AMAT 35% |
| Energia nova | FSLR, URA, NRG, NLR, VLO | +0,62% (58) | −2,01% (37) | **−2,92 p.p.** | NRG 100% |
| Commodities e mineração | SCCO, FCX, NEM, GDX, SLV, RGLD, COPX, TPL | +1,01% (177) | +0,60% (131) | **−0,11 p.p.** | FCX 28% |

### Agressivas (ATR% > 5,66)

Regra escolhida no treino entre 36 variantes: gatilho de 8%, compra quedas bruscas quando
o histórico mostra recuperação, sem alvo, prazo de 7 pregões, stop no percentil 20.

**Único nível em que a ideia funcionou no treino**: 27 das 36 variantes ganharam do "não
fazer nada" (a escolhida, +5,10 p.p. em 37 operações). Na validação, 9 das 36 — a queda
de 27 para 9 é a assinatura de quem decorou um pouco o passado.

| cesta | ativos | treino | validação | vant. validação | maior ativo |
|---|---|---|---|---|---|
| Descentralização e cripto | MSTR, MARA, RIOT, CLSK, HUT, BTBT, SBET | +7,82% (35 op.) | — (0 op.) | — | CLSK 74% (treino) |
| IA — memória e equipamento | MU, MRVL, SMCI, LRCX, INTC, TER, ONTO, LSCC | −3,44% (2) | +2,49% (42) | **+0,98 p.p.** | SMCI 74% |

Nenhuma das duas está de pé: a de cripto não abriu **nenhuma** posição na validação
(gatilho de 8% + filtro de 60%), e a de IA agressiva tem só 2 operações no treino — não
dá para dizer que a regra foi "escolhida" com 2 operações. As duas precisam de gatilho
proporcional à volatilidade para ter amostra nos dois períodos.

### Régua — Referência v1

Não é cesta temática: são as regras originais da especificação (seção 9.4) rodando nos
ativos da lista de observação. Serve para medir se as cestas são melhores do que o ponto
de partida. Treino −0,54% (253 op.) · Validação −0,07% (123 op.) contra +1,17% de não
fazer nada.

---

## O que estes números dizem

1. **No conservador e no mediano, nenhuma regra desta família ganha de ficar comprado.**
   Com 2.014 e 547 operações de treino, isso não é azar de amostra.
2. **Só o nível agressivo mostrou alguma coisa**, e ainda assim com amostra curta e muito
   concentrada em um ativo.
3. O gatilho fixo continua sendo o gargalo: é ele que faz uma cesta virar um ativo só, e
   é por isso que o próximo passo é o **gatilho proporcional à volatilidade de cada ativo**
   (um múltiplo do ATR% dele), no lugar de um percentual igual para todos.

---

## Como pedir mudanças

Fale pelo nome da cesta. Exemplos do que dá para pedir:

- *"acrescenta esses ativos na mineração"* (pode mandar lista, print ou página HTML);
- *"tira o petróleo do macro"*;
- *"cria uma cesta de semicondutores"* (se houver vaga nas 10);
- *"na cesta de cripto, testa gatilho de 6%"*;
- *"refaz a classificação de risco"* (ATR% muda de regime a cada trimestre).

Quando você mandar ativos novos, eu faço nesta ordem:

1. **Confiro se existe token do ativo** no catálogo e se tem histórico suficiente.
2. **Meço o ATR%** para saber em que nível de risco ele cai — pode não ser o que parece.
3. **Acrescento à lista de observação** (`config/watchlist.yaml`), senão ele não recebe
   preço nem histórico e o agente o reporta como "sem histórico".
4. **Rodo o experimento de novo**, escolhendo a regra só com dados até 2022.
5. **Atualizo este arquivo** com o resultado honesto, inclusive quando piorar.

### Limites que valem sempre

- Ativo sem histórico suficiente entra na lista, mas fica de fora da cesta até ter
  amostra (mínimo de 10 eventos semelhantes, e estreia anterior ao corte da validação).
- O gatilho é por cesta: ativos de volatilidades muito diferentes na mesma cesta
  atrapalham (um dispara toda semana, o outro nunca). É o que o ATR% resolve.
- Tudo é **paper trading**: posição simulada, nenhuma ordem real.
- **O resultado depende de onde a série começa.** A estatística de um evento olha todos os
  eventos anteriores do ativo, então mudar o primeiro pregão do histórico muda quantas
  operações o agente abre. Quando um número só aparece numa janela, ele não é resultado:
  é coincidência.
- **Uma cesta em que um ativo responde por quase tudo não é uma cesta.** É por isso que a
  coluna "maior ativo" existe.

---

## Ideias para cestas futuras

| Cesta | Ativos candidatos | Por quê |
|---|---|---|
| Cibersegurança | PANW, CRWD, FTNT, ZS, OKTA, RBRK | Grupo mediano fechado, já medido e sem vaga nas 10 |
| Energia tradicional | XOM, CVX, COP, OKE, WMB, PSX, LNG | Conservadora, 14 candidatos: daria duas sub-cestas |
| Pré-IPO tokenizadas | SPCX (SpaceX) e afins | Só existem tokenizadas; sem histórico tradicional, exige regra própria |
| Ações brasileiras | PRIO3 e outras da B3 | Quando houver token com liquidez |
| T-bills | BUIDL, OUSG, USTB | ATR% de 0,03: não têm variação nenhuma. Precisam de regra de rendimento e fluxo, não de preço |
