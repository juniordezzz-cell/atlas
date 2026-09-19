# Central RWA — Cestas de ativos

Cada **cesta** é um grupo de ativos que se comportam de um jeito parecido, e cada cesta
tem **um agente** com regras próprias. Um agente por cesta (e não um por token) porque
um ativo sozinho tem eventos demais de menos: sem amostra, não há estatística.

Este arquivo é a lista em português, para conversar: *"mexe na cesta 1"*, *"acrescenta
esses ativos na cesta 3"*. A configuração que o sistema lê é
[`central-rwa/backend/config/agents.yaml`](../../central-rwa/backend/config/agents.yaml);
os dois andam juntos.

> **Como as regras são escolhidas:** olhando só os pregões **antes de 2023**. O resultado
> de **2023 em diante** (validação) é medido depois, em dados que a escolha nunca viu, e é
> o número que vale. Quando uma cesta brilha no treino e cai na validação, a regra
> decorou o passado — e o site diz isso na cara.

---

## Cesta 1 — Macro & Índices

**Critério:** mercados gigantes que se movem pouco. Uma variação de 2–3% aqui já é um
movimento grande, e mexe com trilhões.

| | |
|---|---|
| **Ativos** | Ouro (GOLD), Petróleo WTI (WTI), S&P 500 (SPY), Nasdaq-100 (QQQ) |
| **Gatilho** | 3% no pregão |
| **Estratégia** | Segue **altas** bruscas (momentum); sem alvo, sai no prazo de 7 pregões ou no stop |
| **Stop** | Queda típica dos eventos semelhantes (mediana), limitado a −8% |
| **id no sistema** | `macro` |

**Resultado (escolha feita só com dados até 2022):**

| Período | Operações | Acerto | Médio / operação | Não fazer nada |
|---|---|---|---|---|
| Treino (até 2022) | 72 | 46% | +1,56% | +0,46% |
| **Validação (2023+)** | **47** | **34%** | **+0,63%** | +0,48% |

Acerta menos da metade das vezes, mas as altas que pega são maiores que as perdas do stop.
A vantagem se manteve fora do treino, com amostra razoável.

---

## Cesta 2 — Big Tech

**Critério:** ações grandes de tecnologia, que se movem 5% com frequência.

| | |
|---|---|
| **Ativos** | NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL |
| **Gatilho** | 5% no pregão |
| **Estratégia** | Compra **quedas** bruscas quando o histórico mostra recuperação; sem alvo, prazo de 5 pregões |
| **Stop** | Pior queda típica dos semelhantes (percentil 20), limitado a −8% |
| **id no sistema** | `bigtech` |

**Resultado:**

| Período | Operações | Acerto | Médio / operação | Não fazer nada |
|---|---|---|---|---|
| Treino (até 2022) | 87 | 54% | +1,66% | +1,07% |
| **Validação (2023+)** | **8** | **50%** | **+0,42%** | +1,12% |

⚠️ **Não se sustentou.** Na validação rendeu menos do que simplesmente ficar comprado, e
com só 8 operações. Esta cesta precisa de mais ativos e de outra regra.

---

## Régua — Referência v1

Não é uma cesta temática: são as regras originais da especificação (seção 9.4) rodando em
todos os ativos da lista de observação. Serve para medir se as outras cestas são melhores
do que o ponto de partida.

| | |
|---|---|
| **Ativos** | os 11 da lista de observação |
| **Resultado** | Treino −0,54% · Validação −0,01% · Não fazer nada +1,2% |
| **id no sistema** | `swing_v1` |

---

## Como pedir mudanças

Fale pelo número da cesta. Exemplos do que dá para pedir:

- *"acrescenta esses ativos na cesta 1"* (pode mandar lista, print ou página HTML);
- *"tira o petróleo da cesta 1"*;
- *"cria a cesta 3 com semicondutores"*;
- *"na cesta 2, testa gatilho de 4%"*;
- *"testa comprar queda em vez de seguir alta na cesta 1"*.

Quando você mandar ativos novos, eu faço nesta ordem:

1. **Confiro se existe token do ativo** no catálogo (4.121 tokens nas 4 redes) e se tem
   histórico de 10 anos disponível.
2. **Acrescento à lista de observação** (`config/watchlist.yaml`) se o ativo ainda não for
   monitorado, para ele passar a ter preço a cada 6h.
3. **Rodo o experimento de novo** na cesta, escolhendo a regra só com dados até 2022.
4. **Atualizo este arquivo** com o resultado honesto, inclusive quando piorar.

### Limites que valem sempre

- Ativo sem 10 anos de histórico entra, mas com pouca amostra o agente fica de fora até
  ter eventos suficientes (mínimo de 10 eventos semelhantes).
- O gatilho é por cesta: ativos de volatilidades muito diferentes na mesma cesta atrapalham
  (um dispara toda semana, o outro nunca).
- Tudo é **paper trading**: posição simulada, nenhuma ordem real.

---

## Ideias para cestas futuras

| Cesta | Ativos candidatos | Por quê |
|---|---|---|
| Semicondutores | NVDA, AMD, AVGO, MU, TSM, SMH | Setor que se move junto, com eventos frequentes |
| Cripto-relacionadas | COIN, MSTR, HOOD, CRCL, GLXY | Volatilidade alta, reage a BTC |
| Pré-IPO tokenizadas | SPCX (SpaceX) e afins | Só existem tokenizadas; sem histórico tradicional, exige regra própria |
| Ações brasileiras | PRIO3 e outras da B3 | Quando houver token com liquidez |
| T-bills | BUIDL, OUSG, USTB | Não têm variação de 5%: precisam de regra própria (rendimento e fluxo, não preço) |
