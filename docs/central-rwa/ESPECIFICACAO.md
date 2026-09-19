# ATLAS — CENTRAL RWA
## Documento-base de arquitetura e insights — v2.1

> **Status:** conceitual / pré-MVP
> **Versão:** v2.3 — 2026-09-19 (pronta para a Fase 1)
> **Objetivo:** organizar a visão completa antes de iniciar a implementação no Claude Code.
> **Escopo:** a Central RWA é **100% focada em ativos tradicionais tokenizados**: ações, ETFs e commodities (ouro, prata, petróleo). Bitcoin, Solana (como ativo), altcoins e cripto em geral estão **fora** deste documento.

---

# 0. O QUE MUDOU

## v1 → v2
- A Central RWA substitui o módulo `RWA/` atual.
- A Central não tem carteira do usuário, compra nem patrimônio (o hold fica no Hold, via CoinGecko).
- Backend em Python + banco de dados; orçamento de APIs zero.
- Alertas no feed da Central; Telegram adiado.
- Agentes com paper trading e placar.

## v2 → v2.1
- **Escopo fechado em ações tokenizadas.** Todo o universo cripto (Bitcoin, Solana como ativo, altcoins, DeFi genérico) saiu do documento.
- **Gatilho de US$ 10M removido** (era uma referência de Bitcoin). O gatilho de preço das ações passa a ser **±4% a ±5%**.
- **Histórico simplificado:** o token acompanha o preço da ação. Basta estudar o histórico da ação para saber como o token vai se comportar.
- **Nova seção de fontes (17)**, com dezenas de APIs gratuitas mapeadas por categoria.
- **Roteador de APIs (seção 18):** quando uma fonte atinge o limite, o sistema passa automaticamente para a próxima.

## v2.1 → v2.2
- **Commodities e ETFs entram:** ouro, prata, petróleo e ETFs tokenizados, não só ações.
- **Gatilho:** variação **acima de 5%**.
- **Atualização em camadas (seção 5.3):** lista de observação a cada **6h**; demais ativos a cada **24h**.
- **Redes iniciais:** Solana, Ethereum, Robinhood Chain e BNB Chain.
- **Infraestrutura (seção 16):** o sistema roda por **jobs agendados**, sem servidor ligado 24/7. Plano recomendado com custo zero e alternativas.
- **Lista inicial de ativos** definida (seção 3.4).

## v2.2 → v2.3
- **Plano A confirmado:** GitHub Actions + Supabase. Os planos B e C ficam registrados em `INFRA_ALTERNATIVAS.md`.
- **Títulos do Tesouro tokenizados entram** (seção 3.1).
- **Regras do paper trading v1** aprovadas como ponto de partida (seção 9.4). Os agentes de swing e de pools serão aprimorados depois.

---

# 1. VISÃO CENTRAL

A Central RWA não é só um painel de cotações nem um bot de trade.

É um **sistema de inteligência sobre ações tokenizadas**: vários agentes especializados coletam dados, estudam o histórico das ações, detectam eventos, cruzam informações e entregam ao usuário apenas o que merece atenção.

O sistema funciona de forma **autônoma**: o backend monitora o mercado continuamente, mesmo com o Atlas fechado.

### Fluxo conceitual

```text
AÇÕES TRADICIONAIS (preço, volume, histórico, notícias)
        +
AÇÕES TOKENIZADAS (preço, volume, fluxo on-chain, pools)
        ↓
COLETORES (Python) ──► ROTEADOR DE APIs ──► várias fontes gratuitas
        ↓
BANCO DE DADOS
        ↓
AGENTES ESPECIALIZADOS
        ↓
AGENTE SUPERVISOR
        ↓
FEED DA CENTRAL RWA
```

---

# 2. PRINCÍPIO FUNDAMENTAL

O sistema não tenta prever o futuro com uma IA dizendo:

> "Acho que vai subir."

A ordem é:

**DADOS → HISTÓRICO → MATEMÁTICA → CONTEXTO → CONCLUSÃO OBJETIVA**

A IA explica e correlaciona evidências. Sempre que possível, uma afirmação deve trazer:

- fonte;
- período;
- métrica;
- amostra;
- comparação histórica;
- grau de incerteza.

**Separação obrigatória:** dado real ≠ inferência ≠ interpretação. Cada item do feed indica em qual categoria está.

---

# 3. ESCOPO

## 3.1 O que entra

**Qualquer ativo tradicional tokenizado.** Não precisa ser ação.

| Classe | Exemplos de ativo | Exemplos de token | Referência de preço/histórico |
|---|---|---|---|
| **Ações** | NVIDIA, Tesla, Apple, Microsoft, Amazon, Meta, Alphabet | NVDAx, TSLAx, tokens Ondo/Robinhood/bStocks | A própria ação (Nasdaq/NYSE) |
| **ETFs** | S&P 500 (SPY), Nasdaq-100 (QQQ), ouro (GLD), prata (SLV), petróleo (USO) | SPYx, QQQx, versões Ondo | O próprio ETF |
| **Ouro** | Ouro físico | XAUT, PAXG | Ouro spot / futuro (GC) |
| **Prata** | Prata física | Tokens de prata | Prata spot / futuro (SI) |
| **Petróleo** | WTI / Brent | WTIC; LITRO (lançamento previsto para jan/2027) | Futuro de WTI (CL) / Brent |
| **Ações brasileiras** | PetroRio (PRIO3) etc., quando existirem com liquidez | A mapear | A própria ação na B3 |
| **Títulos do Tesouro (T-bills)** | Títulos de curto prazo dos EUA | BUIDL (BlackRock), OUSG/USDY (Ondo), BENJI (Franklin), USTB (Superstate), USYC e outros | Rendimento dos T-bills (Tesouro dos EUA / FRED) |

A lógica da seção 7 vale para todas as classes: **o token acompanha o preço do ativo de referência**, e a estatística sai do histórico desse ativo.

> **T-bills são diferentes:** o preço do token fica praticamente parado (em torno de US$ 1 ou subindo devagar com o rendimento). O gatilho de 5% **não se aplica** a eles. Nos T-bills, o que importa é:
> - **fluxo:** mint e burn grandes (dinheiro entrando ou saindo do produto) e mudança de oferta total;
> - **rendimento:** mudança no rendimento pago vs. taxa dos T-bills;
> - **descolamento:** preço do token se afastando do valor da cota (NAV), o que é sinal de problema.

Um ativo entra no monitoramento se:

1. existe um token que representa a ação em alguma rede; e
2. o token tem liquidez/volume acima do piso definido (seção 5).

A descoberta de novos tokens é **automática** (catálogo dos emissores, seção 4.3). O usuário também pode fixar ativos manualmente.

## 3.2 O que não entra

- Bitcoin, Ethereum, Solana e demais criptomoedas **como ativo de análise**;
- altcoins, memecoins, tokens DeFi;
- DeFi genérico (fica no módulo DeFi do Atlas);
- carteira do usuário e patrimônio (fica no Hold).

> **Sobre redes:** Ethereum, Solana, Arbitrum etc. aparecem neste documento **só como infraestrutura**, ou seja, o lugar onde o token da ação está registrado. O sistema lê essas redes para ver o token, mas não analisa a criptomoeda da rede.

## 3.3 Mapa de responsabilidades no Atlas

| Onde | O quê |
|---|---|
| **Central RWA** | Feed, movimentações, carteiras rastreadas, oportunidades swing, pools de ativos tokenizados, placar dos agentes |
| **Hold** | Posição do usuário em ativos tokenizados (quantidade/valor), com preço via CoinGecko |
| **DeFi** | Estratégias DeFi genéricas (fora da Central) |

## 3.4 Lista inicial de ativos

**Lista de observação (atualizada a cada 6h):**

| Classe | Ativos |
|---|---|
| Ações | NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL |
| ETFs | SPY, QQQ |
| Commodities | Ouro (XAUT / PAXG), Petróleo (WTI) |

> O usuário ainda vai enviar outros ativos para essa lista.

**Demais ativos (atualizados a cada 24h):** todo ativo tokenizado descoberto pelo catálogo (seção 4.2) que passar no piso de liquidez (seção 5).

---

# 4. CENTRAL RWA

## 4.1 Seções

- **Feed:** notícias, alertas e eventos em ordem cronológica.
- **Movimentações grandes:** swaps, trades e transferências de tokens de ações acima do piso.
- **Rastreador de carteiras:** carteiras relevantes (baleias, fundos, emissores, exchanges) e o que elas fazem com tokens de ações.
- **Oportunidades swing:** setups detectados pelos agentes, com estatística histórica da ação.
- **Pools:** pools de liquidez e estratégias de opções em tokens de ações.
- **Ficha do ativo:** ação e token lado a lado (preço, volume, histórico, eventos, notícias).
- **Placar dos agentes:** desempenho real (paper trading) de cada agente.

A posição de cada seção no menu será definida depois. O nome no menu passa a ser **Central RWA**.

## 4.2 Emissores de ações tokenizadas (multi-fonte)

| Emissor / produto | Redes principais | Observação |
|---|---|---|
| **xStocks** (Backed, em aquisição pela Kraken) | Solana, Ethereum, Arbitrum, Mantle, Ink, TON | 1:1; negociado também em Kraken e Bybit; API pública sem chave |
| **Ondo Global Markets** | Ethereum (+ outras redes) | 100+ ações/ETFs; API REST + WebSocket (verificar acesso gratuito) |
| **Robinhood Stock Tokens** | Arbitrum / Robinhood Chain (chain ID 4663) | Mainnet da Robinhood Chain desde 01/07/2026 |
| **Dinari (dShares)** | EVM | 724 ações lançadas em ago/2026; rota regulada para os EUA |
| **Bitget / Reality (rTokens)** | CEX + on-chain | Lastro via Alpaca |
| **bStocks, Colb Finance, Paimon Finance** | BNB Chain | Ações/ETFs dos EUA e alguns ativos pré-IPO |
| **Tether (XAUT), Paxos (PAXG)** | Ethereum (+ outras) | Ouro tokenizado 1:1 |
| **WTIC / LITRO** | Ethereum / a confirmar | Petróleo tokenizado (LITRO só em 2027) |
| **Emissores brasileiros** | A mapear | Para ações da B3 tokenizadas |

> A **BNB Chain** já passou de US$ 5,2 bilhões em volume acumulado de ações tokenizadas, à frente da Solana. A Ondo tem 260+ ativos em Solana, Ethereum e BNB Chain. Os xStocks chegaram à BNB Chain em abr/2026.

Para cada emissor, registrar: redes, contratos, modelo de lastro, horário de mint/burn, carteiras públicas do emissor e risco do emissor.

## 4.3 Redes (infraestrutura)

Todas as redes onde existam ativos tokenizados com liquidez. As principais hoje: **Ethereum, Solana, BNB Chain, Robinhood Chain, Arbitrum, Base, Mantle, Ink, TON, Plume**.

### Redes da primeira fase

| Rede | Por quê |
|---|---|
| **Solana** | xStocks, Ondo |
| **Ethereum** | Ondo, xStocks, ouro (XAUT/PAXG) |
| **Robinhood Chain** | Stock Tokens da Robinhood (L2 da Ethereum, feita com Arbitrum; chain ID 4663) |
| **BNB Chain** | Ondo, xStocks, bStocks, Colb, Paimon; é a rede com maior volume acumulado de ações tokenizadas |

A coleta é abstraída **por rede**: adicionar uma rede nova significa adicionar um coletor, sem mexer nos agentes.

---

# 5. REGRAS DE MOVIMENTAÇÃO E GATILHOS

## 5.1 O que é "movimentação"

- swaps em DEX;
- trades em CEX (Kraken, Bybit, Bitget etc.);
- transferências entre carteiras;
- mint/burn do emissor (dinheiro entrando ou saindo do produto);
- entradas e saídas de exchanges;
- adição e remoção de liquidez em pools.

## 5.2 Filtros e gatilhos

| Regra | Valor inicial | Observação |
|---|---|---|
| Piso de transação | **US$ 100.000** | Abaixo disso é descartado (ruído) |
| Piso de ativo | Liquidez/volume do token **> US$ 100.000** | Evita tokens irrelevantes |
| **Gatilho de preço** | Variação **acima de 5%** (alta ou baixa) | Para NVIDIA, Tesla ou ouro, mais de 5% já é um movimento forte |
| Volume anormal | 2x / 3x / 5x a média | No ativo e no token |

Todos os limites são **parâmetros por ativo**, e não constantes no código. A calibração vem do placar (seção 15).

**Como a variação é medida:** a cada atualização, compara-se o preço atual com o **fechamento anterior** do ativo de referência e com o preço do token **24h antes**. Se qualquer um passar de 5%, o evento é gerado.

## 5.3 Frequência de atualização (em camadas)

Atualizar todos os ativos o tempo todo estouraria os limites gratuitos. Por isso:

| Camada | Ativos | Frequência | Horários (UTC, sugestão) |
|---|---|---|---|
| **A — Observação** | Lista da seção 3.4 + os que o usuário estiver pesquisando | **A cada 6h** | 00h, 06h, 12h, 18h |
| **B — Geral** | Todos os outros que passam no piso | **A cada 24h** | 00h |
| **C — Histórico** | Série diária de 10+ anos | **Uma vez** + 1 dia novo por dia | 00h |

Regras:
- Um ativo pode **subir para a camada A** automaticamente quando dispara um evento (ex.: passou de 5%) e **volta para a B** depois de alguns dias sem eventos.
- O usuário pode mover ativos entre as camadas manualmente.
- As movimentações on-chain (seção 6) são coletadas **retroativamente** a cada execução: o coletor busca tudo o que aconteceu desde o último bloco lido, então nada se perde entre uma execução e outra.
- O feed da Central mostra o **horário da última atualização** de cada ativo.

**Estimativa de consumo:** ~20 ativos na camada A × 4 execuções/dia + ~200 na camada B × 1 execução/dia. As fontes que aceitam consulta em lote (ex.: DexScreener, até 30 tokens por chamada) cobrem isso com poucas centenas de chamadas por dia, bem dentro dos limites gratuitos da seção 17.

---

# 6. RASTREADOR DE CARTEIRAS

## 6.1 Quem é rastreado

Carteiras **de terceiros** que movimentam tokens de ações:

- baleias (grandes detentores);
- fundos e market makers;
- carteiras dos emissores (mint/burn); a xStocks, por exemplo, publica as próprias carteiras na API;
- exchanges (hot/cold wallets).

A Central **não rastreia a carteira do usuário** (isso fica no Hold).

## 6.2 Como a lista é montada

1. **Automática:** o agente supervisor detecta movimentações atípicas de alto volume e adiciona as carteiras de origem e destino a uma lista de observação.
2. **Rotulagem:** o endereço é cruzado com bases públicas de endereços conhecidos (seção 17.6), sempre com **data do rótulo e nível de confiança**.
3. **Manual:** o usuário pode adicionar, renomear ou remover carteiras.

## 6.3 O que é mostrado por carteira

- rótulo + confiança;
- tokens de ações que detém;
- movimentações recentes acima do piso;
- histórico de acerto: depois das compras e vendas dessa carteira, o que aconteceu com o preço em 1d, 3d e 7d.

---

# 7. HISTÓRICO: A AÇÃO É A REFERÊNCIA

## 7.1 A lógica

O token acompanha o preço da ação. Se a NVIDIA está a US$ 220 na Nasdaq, o token está praticamente no mesmo preço (diferença de centavos a ~US$ 1). Se a ação vai de 220 para 230, o token vai junto.

Por isso:

> **Para saber como o token vai se comportar, estuda-se o histórico da ação.**

As ações tokenizadas são recentes e têm pouco histórico próprio. Já a ação tem 10, 20 ou mais anos de dados, e é daí que sai toda a estatística.

```text
HISTÓRICO DA AÇÃO (ex.: 10+ anos de NVDA)
    ↓
estatística de eventos (quedas, altas, volume, recuperação)
    ↓
aplicada diretamente ao TOKEN
```

## 7.2 O que o sistema acompanha além disso (leve)

- **Diferença de preço token × ação:** só como checagem. Se a diferença sair do normal (ex.: > 1–2%), vira um evento no feed, porque pode ser oportunidade ou problema do emissor.
- **Movimento com a bolsa fechada:** o token pode negociar à noite e no fim de semana. Um movimento forte nesse horário também vira evento, já que antecipa a abertura da ação.

---

# 8. ARQUITETURA MULTIAGENTE

Nada de um único agente gigante. Cada agente tem uma responsabilidade clara e entrada e saída definidas, e grava tudo no banco de dados.

```text
AGENTE SUPERVISOR
│
├── Agente de Fluxo (movimentações + carteiras)
├── Agente de Swing Trade
│     ├── camada 1: Analista (estatística sobre o histórico da ação)
│     └── camada 2: Operador simulado (paper trading + placar)
├── Agente de Pools / Opções
└── Agente de Notícias
```

## 8.1 Agente Supervisor

- monitora o mercado e o resultado dos demais agentes;
- compila movimentações atípicas de alto volume em listas;
- detecta conflitos entre agentes e pede verificação;
- decide o que vai para o feed e com qual nível (seção 21);
- **não inventa dados**: trabalha só sobre o que os agentes e os coletores produziram.

## 8.2 Agente de Fluxo

- consome os coletores on-chain e de CEX;
- aplica os filtros da seção 5;
- classifica o tipo de movimentação;
- alimenta o Rastreador de Carteiras.

---

# 9. AGENTE DE SWING TRADE

## 9.1 Parâmetros

| Parâmetro | Valor inicial |
|---|---|
| Horizonte | **1 a 7 dias** (máximo 10) |
| Gatilho | Variação **acima de 5%** (alta ou baixa), medida como na seção 5.2 |
| Verificação | A cada 6h (camada A) ou 24h (camada B) |
| Ativos | Todo ativo tokenizado que passar no piso da seção 5 |

## 9.2 Duas camadas

**Camada 1 — Analista (estatística):**
quando um gatilho dispara, busca no histórico da ação os eventos semelhantes (seção 13) e calcula como a ação se comportou de 1 a 10 dias depois.

**Camada 2 — Operador simulado (paper trading):**
com base na camada 1, abre uma **posição simulada** (entrada, stop, alvo, prazo máximo), acompanha até o fechamento e registra o resultado. **Nenhuma ordem real é executada.**

## 9.3 Placar (scorecard)

Cada agente tem um placar na Central:

- número de posições simuladas;
- taxa de acerto;
- retorno médio e mediano;
- pior perda (drawdown);
- resultado por tipo de setup (queda brusca × alta brusca);
- resultado por ativo;
- comparação com "não fazer nada" (buy & hold do ativo no mesmo período).

O placar é o que diz se um agente merece confiança, e não a opinião da IA.

## 9.4 Regras do paper trading — v1 (ponto de partida)

> Aprovadas para a primeira versão. **Serão aprimoradas depois**, com base no placar.

| Regra | v1 |
|---|---|
| Entrada | Preço do token na atualização seguinte ao gatilho |
| Direção | A que o histórico indicar. Se a maioria dos eventos semelhantes **recuperou**, simula compra. Se a maioria **continuou caindo**, o agente **fica de fora** (tokens à vista não permitem venda a descoberto) |
| Amostra mínima | Só opera se houver pelo menos 10 eventos semelhantes no histórico |
| Alvo | Mediana do movimento histórico no horizonte |
| Stop | Pior movimento típico da amostra (percentil 20), limitado a -8% |
| Prazo | 7 dias; fechamento forçado no 10º dia |
| Tamanho | Posição nominal fixa (ex.: US$ 1.000) só para medir o resultado em % |
| Custos | Descontar uma taxa estimada por operação (ex.: 0,3% ida e volta) para o placar não ficar otimista |

---

# 10. AGENTE DE POOLS / OPÇÕES

## 10.1 Escopo

- Só pools e opções **de tokens de ações** (ex.: NVDAx/USDC, TSLAx/USDC).
- Especialista em:
  - **liquidez concentrada com range apertado**;
  - **estratégias de opções** sobre ações tokenizadas, quando houver mercado on-chain.
- Busca oportunidades em **todas as redes**, usando scanners de liquidez como parâmetro (reaproveitar a lógica de `Ferramentas/scanner-pools` quando fizer sentido).

## 10.2 O que avalia em uma pool

- TVL e profundidade;
- volume / TVL (giro);
- taxas geradas vs. APR anunciado;
- volatilidade histórica **da ação** vs. largura do range (risco de sair do range);
- perda impermanente estimada;
- comportamento com a bolsa fechada.

## 10.3 Evolução futura

Cruzar com as **pools favoritas do usuário** para ter atualização diária de movimentações e status (em range / fora de range, fees acumuladas, alertas).

---

# 11. AGENTE DE NOTÍCIAS

Função própria e permanente. Pesquisa uma **janela histórica configurável** (ex.: últimas 72h), não só o que saiu agora.

Pipeline:

1. coletar (fontes da seção 17.5);
2. eliminar duplicatas;
3. identificar a notícia original;
4. classificar relevância;
5. extrair fatos;
6. separar fato de opinião;
7. ligar a notícia à ação e ao token;
8. entregar ao Supervisor e ao feed.

Prioridade máxima:
- **resultados trimestrais, guidance e fatos relevantes** (SEC / RI);
- **notícias dos emissores de tokens** (novo token, pausa de mint, mudança de lastro, problema regulatório).

---

# 12. MOTOR DE EVENTOS

## Preço (ativo e token)
- acima de 5% (gatilho), acima de 10%;
- novas máximas e mínimas;
- rompimentos e reversões;
- gap de abertura.

## Volume
- 2x, 3x, 5x a média (ação e token).

## Fluxo on-chain
- movimentação acima de US$ 100k;
- mint/burn relevante do emissor;
- entrada e saída de exchange;
- carteira rastreada entrando ou saindo.

## Específico de ação tokenizada
- diferença token × ação fora do normal;
- movimento forte do token com a bolsa fechada;
- mudança de liquidez da pool principal;
- notícia relevante do emissor.

## Pools
- pool sai do range;
- TVL entra ou sai de forma anormal;
- APR muda bruscamente.

---

# 13. EVENTOS HISTORICAMENTE SEMELHANTES

Quando ocorre um evento (ex.: *NVDA -5,4% em 1 pregão, volume 2,1x a média*), o sistema procura no histórico da ação os eventos parecidos e calcula:

- número de ocorrências;
- retorno após 1d, 3d, 5d, 7d e 10d;
- máximo movimento positivo e negativo no período;
- média e mediana;
- frequência de recuperação;
- frequência de continuação.

### Exemplo de saída

```text
NVIDIA — EVENTO DETECTADO
Token: NVDAx (Solana) · preço do token alinhado à ação

Queda: -5,4% em 1 pregão
Volume: 2,1x a média de 20 dias

Eventos semelhantes na NVDA (2014–2026): 31

+3% em até 5 dias:     20/31
-3% adicional em 5d:    8/31
Mediana em 7 dias:     +2,8%
Pior caso em 7 dias:  -11,2%
```

O sistema **nunca** transforma isso em "NVDA vai subir". Ele diz: *"eventos semelhantes tiveram historicamente este comportamento"*.

---

# 14. MEMÓRIA

## 14.1 Eventos

```text
EVENT_ID | DATA/HORA | AÇÃO | TOKEN | REDE | TIPO | CONDIÇÕES | MÉTRICAS
CONTEXTO | NOTÍCIAS | BOLSA ABERTA? | DIFERENÇA TOKEN×AÇÃO
RESULTADO 1D | 3D | 7D | 10D | FONTES
```

## 14.2 Movimentações e carteiras

```text
TX_HASH | REDE | DATA/HORA | TOKEN | VALOR USD | TIPO
ORIGEM | DESTINO | RÓTULOS (+ confiança) | EVENTO RELACIONADO
```

## 14.3 Posições simuladas

```text
POSITION_ID | AGENTE | ATIVO | SETUP | EVENTO GATILHO
ENTRADA | STOP | ALVO | PRAZO | ABERTURA | FECHAMENTO | MOTIVO DO FECHAMENTO
RESULTADO % | ESTATÍSTICA QUE JUSTIFICOU
```

## 14.4 Uso das fontes (para o roteador)

```text
PROVEDOR | CAPACIDADE | DATA | CHAMADAS | ERROS | 429s | LATÊNCIA MÉDIA | STATUS
```

---

# 15. AUTOMELHORIA

"Automelhoria" **não** significa uma IA alterando o próprio código.

Significa:

**mais dados → mais histórico → melhor comparação → melhor calibração**

Na prática:

- o **placar** dos agentes (seção 9.3) mostra o que funciona;
- os limites (US$ 100k, ±4–5%) são recalibrados com base no placar, **por decisão registrada**, e não automaticamente;
- falsos positivos e falsos negativos são contados;
- a qualidade de cada fonte é medida (atraso, falhas, divergência de preço entre fontes).

---

# 16. BACKEND

## 16.1 Arquitetura

```text
COLETORES (Python, agendados)
    ├── catálogo de tokens (emissores)
    ├── preço/volume dos tokens (DEX + CEX + oráculos)
    ├── fluxo on-chain por rede
    ├── preço e histórico das ações
    ├── notícias
    └── rótulos de endereços
          │
          ▼
    ROTEADOR DE APIs (seção 18)
          │
          ▼
BANCO DE DADOS
          ↓
AGENTES (Python) → gravam eventos, posições e o feed
          ↓
API LEVE (leitura)
          ↓
CENTRAL RWA (front do Atlas)
```

## 16.2 Mudança importante: não precisa de servidor 24/7

Com a atualização em camadas (6h / 24h), o sistema **não precisa de um servidor ligado o tempo todo**. Ele precisa de **jobs agendados**: acorda, coleta, calcula, grava no banco e desliga. Isso é muito mais barato, e dá para fazer de graça.

```text
A cada 6h:   job "camada A"  → coleta → eventos → agentes → feed
A cada 24h:  job "camada B"  → coleta → eventos → agentes → feed
             job "histórico" → +1 dia de histórico por ativo
             job "placar"    → fecha e avalia posições simuladas
```

## 16.3 Opções pesquisadas (2026-09-19)

### Onde rodar os jobs

| Opção | Custo | Limite | Prós | Contras |
|---|---|---|---|---|
| **GitHub Actions (cron)** | Grátis | Repositório privado: 2.000 min/mês. Público: ilimitado | Sem servidor para manter; logs de cada execução; o código já fica no GitHub | O horário do cron pode atrasar alguns minutos; em repositório público, o GitHub desativa o agendamento após 60 dias sem atividade |
| **Oracle Cloud Always Free** | Grátis (pede cartão só para verificação) | ARM com 2 OCPU / 12 GB RAM (cortado pela metade em jun/2026), 200 GB de disco | Máquina de verdade, ligada 24/7; aguenta tudo, inclusive tempo real no futuro | Pode faltar capacidade na região; a Oracle **recupera máquinas ociosas** (CPU, rede e memória < 20% por 7 dias); você administra o servidor |
| **Koyeb (free)** | Grátis | 1 serviço, 512 MB RAM, 0,1 vCPU | Simples | Fraco; desliga quando fica ocioso |
| **Render (free)** | Grátis | — | Simples | Desliga após 15 min sem uso; o Postgres grátis expira em 30 dias |
| **Railway / Fly.io** | Crédito de teste / pago | — | — | Não existe mais plano grátis de verdade |
| **PC do usuário (Agendador do Windows)** | Grátis | — | Zero configuração de nuvem | Só roda com o PC ligado |
| **VPS pago básico** | ~US$ 5–7/mês | 1–2 vCPU, 2–4 GB | Estável, sem surpresas | Não é zero |

### Onde guardar os dados

| Opção | Espaço grátis | Tipo | Observação |
|---|---|---|---|
| **Supabase** | 500 MB por projeto (2 projetos) | Postgres | Pausa após 1 semana **sem atividade**, o que não acontece aqui porque os jobs gravam a cada 6h. Gera API REST automática que o front do Atlas pode ler direto, e **aceita login do Firebase** (que o Atlas já usa) |
| **Neon** | 0,5 GB por projeto | Postgres | Desliga após 5 min sem uso e religa sozinho na próxima consulta |
| **CockroachDB** | 10 GB | Compatível com Postgres | Mais espaço; menos ferramentas prontas |
| **Turso** | 5 GB | SQLite na nuvem | Bom espaço; leve |
| **Cloudflare D1** | 5 GB | SQLite | Melhor com jobs rodando dentro da Cloudflare |
| **MongoDB Atlas (M0)** | 512 MB | Documentos | Pior para estatística e séries temporais |
| **Firestore (Firebase)** | 1 GB | Documentos | O Atlas já usa; ruim para séries históricas e cálculos |
| **Oracle Autonomous DB** | 2 × 20 GB | Oracle SQL | Muito espaço; mais complexo |

### Quanto espaço o sistema precisa

| Dado | Volume estimado |
|---|---|
| Histórico diário de 10 anos, ~200 ativos | ~500 mil linhas ≈ 50–80 MB |
| Preços dos tokens (6h/24h) | poucos MB por ano |
| Movimentações acima de US$ 100k | poucos MB por ano |
| Eventos, feed, posições simuladas | poucos MB por ano |

**Conclusão:** 500 MB aguentam o primeiro ano com folga, desde que o sistema **não guarde respostas brutas das APIs** (guardar só o dado normalizado).

## 16.4 Decisão

**Plano A — CONFIRMADO (custo zero):**

```text
GitHub Actions (repositório privado, cron 6h/24h)
        ↓
Supabase (Postgres, 500 MB)
        ↓
Central RWA lê do Supabase, com o login do Firebase que o Atlas já tem
```

- Consumo estimado: 4 execuções/dia × ~5–8 min + jobs diários ≈ **800–1.300 min/mês**, dentro dos 2.000 gratuitos.
- Sem servidor para administrar e sem a "API leve": o próprio Supabase serve os dados ao front.

**Planos B e C** (registrados para o futuro em `INFRA_ALTERNATIVAS.md`):
- **B:** Oracle Cloud Always Free (máquina 24/7), se precisar de tempo real ou de mais espaço.
- **C:** VPS de ~US$ 5–7/mês + o mesmo Supabase, se os gratuitos incomodarem.

A arquitetura é a mesma nos três planos. Mudar de A para B ou C é só trocar **onde** o job roda.

## 16.5 Princípios

- **Nenhum coletor chama uma API diretamente.** Tudo passa pelo roteador.
- **Cache agressivo:** o que não mudou não é buscado de novo (histórico diário de 10 anos é baixado uma vez e depois só se atualiza o último dia).
- **IA só onde agrega:** resumo de notícias e texto do feed. Detecção, filtros e estatística são código determinístico, com custo zero de IA.
- **Chaves de API ficam só no backend**, nunca no front.

---

# 17. FONTES DE DADOS (ORÇAMENTO ZERO)

> Pesquisa feita em 2026-09-19. Limites de planos gratuitos **mudam com frequência**: só em 2026, o Etherscan cortou redes do plano gratuito (jul/2026), o Dune restringiu o plano grátis (set/2026) e o Pyth passou a exigir chave (ago/2026). Por isso a arquitetura depende de **várias fontes + roteador**, e não de uma fonte específica. Todo limite abaixo deve ser reconfirmado ao integrar.

## 17.1 Catálogo e preço direto dos emissores

| Fonte | Chave? | Limite gratuito | Uso |
|---|---|---|---|
| **xStocks API** (docs.xstocks.fi) | Não (endpoints públicos) | Não publicado | Lista de ativos, contratos por rede, preço, multiplicadores, prova de reservas, eventos corporativos, **carteiras públicas do emissor** |
| **Ondo Global Markets API** | A verificar | A verificar | Preço em tempo real e histórico (OHLC), mint/redeem |
| **Robinhood Chain docs** | Não | — | Contratos dos Stock Tokens |
| **rwa.xyz** | Cadastro | Parte grátis, API completa paga | Catálogo e visão agregada do mercado de ações tokenizadas (usar como referência/checagem) |

## 17.2 Preço, volume e pools dos tokens

| Fonte | Chave? | Limite gratuito | Uso |
|---|---|---|---|
| **DexScreener** | Não | 300 req/min (pares), 60 req/min (perfis) | Preço, volume e liquidez por par em todas as redes |
| **GeckoTerminal** | Não | 30 req/min | Pools, OHLCV de pools, trades |
| **DefiLlama** | Não | Sem limite para uso normal | Preço de tokens, pools/yields, dados RWA agregados |
| **CoinGecko (Demo)** | Sim (grátis) | ~30 req/min, ~10k/mês | Preço agregado (o mesmo do Hold) |
| **CoinMarketCap (Basic)** | Sim (grátis) | ~10–15k créditos/mês | Preço agregado, redundância |
| **CoinPaprika** | Não | 20k req/mês, 10 req/s | Preço agregado, redundância |
| **Jupiter Price API** | Sim (grátis) | ~25M créditos/mês | Preço de tokens em Solana (xStocks) |
| **Birdeye** | Sim (grátis) | ~30k CU/mês, 1 req/s | Solana: preço, trades |
| **Mobula** | Sim (grátis) | ~300k créditos/mês | Preço multi-rede, carteiras |
| **Codex** | Sim | ~10k req/mês | Preço e trades multi-rede |
| **CEXs: Kraken, Bybit, Bitget** | Não (dados públicos) | Limites por exchange | Preço e volume dos tokens de ações negociados em CEX (grande parte do volume está aqui) |
| **Chainlink (Tokenized Equity Feeds)** | Não (leitura on-chain via RPC) | Custo = chamadas de RPC | Preço de referência oficial do emissor (xStocks, Ondo, Robinhood) + status de mercado |
| **Pyth (Hermes)** | Sim (desde ago/2026) | Endpoint público com atualização a cada 10s | Preço de ações dos EUA 24/5 — referência cruzada |

## 17.3 Fluxo on-chain (transferências, mint/burn, carteiras)

| Fonte | Chave? | Limite gratuito | Redes |
|---|---|---|---|
| **Blockscout** | Sim (grátis) | 100k créditos/dia (~5k chamadas), 5 req/s | 120+ redes EVM, inclusive as cortadas do Etherscan grátis |
| **Etherscan V2** | Sim (grátis) | 5 req/s, 100k/dia, 1.000 registros/consulta | Multi-rede EVM (sem Base, BNB, Optimism e Avalanche no plano grátis) |
| **Alchemy** | Sim (grátis) | ~30M CU/mês | EVMs + Solana; tem API de transferências de tokens |
| **QuickNode** | Sim (grátis) | ~10M créditos/mês | EVMs + Solana |
| **Ankr** | Público / chave grátis | Faixa gratuita | RPC multi-rede |
| **Moralis** | Sim (grátis) | ~40k CU/dia | EVMs + Solana; transferências, carteiras |
| **Helius** | Sim (grátis) | ~1M créditos, 10 req/s | Solana (xStocks) |
| **GoldRush (Covalent)** | Sim | Trial / plano gratuito limitado (verificar) | 100+ redes |
| **Bitquery** | Sim (grátis) | Pontos limitados, 10 req/min | Multi-rede, streams de trades |
| **The Graph** | Sim (grátis) | 100k consultas/mês | Subgraphs de DEXs (Uniswap etc.) |
| **SQD (Subsquid)** | Varia | A verificar | Indexação; tem guia específico da Robinhood Chain |
| **RPCs públicos das redes** | Não | Instáveis, limites baixos | Último recurso do roteador |

## 17.4 Ações tradicionais (preço e histórico)

| Fonte | Chave? | Limite gratuito | Uso |
|---|---|---|---|
| **Yahoo Finance (yfinance)** | Não | Não oficial; bloqueia IP por excesso | Histórico diário longo (10+ anos). Baixar uma vez com cache |
| **Stooq** | Sim (grátis, desde abr/2026) | Cota diária não publicada | Histórico diário em CSV, ações dos EUA e outros mercados |
| **Finnhub** | Sim (grátis) | 60 req/min | Cotação (com atraso), notícias da empresa, calendário de resultados |
| **Twelve Data** | Sim (grátis) | 800 req/dia, 8 req/min | Cotação e séries históricas |
| **Alpha Vantage** | Sim (grátis) | 25 req/dia | Histórico diário, notícias com sentimento |
| **Tiingo** | Sim (grátis) | ~1.000 req/dia | Histórico diário EOD |
| **Polygon.io / Massive** | Sim (grátis) | 5 req/min, fim de dia | Histórico e agregados |
| **Alpaca Market Data** | Sim (conta grátis) | 200 req/min; tempo real só IEX | Cotação intradiária e barras históricas |
| **EODHD** | Sim (grátis) | 20 req/dia, 1 ano de histórico | Redundância |
| **Marketstack** | Sim (grátis) | 100 req/mês | Redundância mínima |
| **brapi.dev** (Brasil) | Sim (grátis) | 15k req/mês | Ações da B3 (PRIO3 etc.) |
| **Yahoo / Stooq (futuros e spot)** | — | Como acima | Ouro (GC), prata (SI), petróleo WTI (CL), Brent |
| **FRED (Fed de St. Louis)** | Sim (grátis) | Generoso | Série diária histórica de petróleo WTI e Brent (fonte oficial) |
| **SEC EDGAR** | Não (exige User-Agent) | ~10 req/s | Resultados, 8-K, fatos relevantes das empresas dos EUA |

## 17.5 Notícias

| Fonte | Chave? | Limite gratuito | Uso |
|---|---|---|---|
| **Finnhub (company news)** | Sim | Dentro dos 60 req/min | Notícias por ticker |
| **Marketaux** | Sim | ~100 req/dia | Notícias por ticker com sentimento |
| **Alpha Vantage News & Sentiment** | Sim | Dentro dos 25 req/dia | Notícias com sentimento |
| **NewsAPI.org** | Sim | 1.000 req/dia (**proíbe uso comercial** no plano grátis) | Cobertura ampla |
| **NewsData.io** | Sim | ~500 req/dia | Cobertura ampla |
| **The Guardian Open Platform** | Sim | ~5.000 req/dia | Notícias gerais/econômicas |
| **GDELT** | Não | Aberto | Eventos globais, histórico |
| **SEC EDGAR / páginas de RI** | Não | — | Fonte primária de resultados e fatos relevantes |
| **RSS** | Não | — | Portais financeiros, blogs e anúncios dos emissores (xStocks, Ondo, Robinhood, Dinari) |

## 17.6 Rótulos de endereços

| Fonte | Chave? | Uso |
|---|---|---|
| **xStocks API (carteiras públicas)** | Não | Carteiras oficiais do emissor |
| **Blockscout (tags públicas)** | Sim (grátis) | Rótulos de contratos e endereços |
| **Listas open source no GitHub** (ex.: projetos de rótulos de EVM) | Não | Exchanges, bridges, entidades conhecidas |
| **Rótulo próprio do Atlas** | — | Registro manual + inferido, com data e confiança |

---

# 18. ROTEADOR DE APIs

## 18.1 Objetivo

Nenhuma fonte gratuita aguenta sozinha um sistema que roda 24/7. O roteador garante que, **quando uma fonte atinge o limite ou falha, a próxima assume automaticamente**, sem o agente perceber.

## 18.2 Como funciona

```text
AGENTE pede: "preço do token NVDAx em Solana"
        ↓
ROTEADOR identifica a CAPACIDADE: token_price.solana
        ↓
Lista de provedores dessa capacidade, em ordem de prioridade:
   1. DexScreener
   2. Jupiter
   3. GeckoTerminal
   4. Birdeye
   5. DefiLlama
   6. CoinGecko
        ↓
Pula quem estiver: sem cota / em cooldown / com falha recente
        ↓
Chama o primeiro disponível
        ↓
   OK   → normaliza, grava no cache, devolve
   429  → marca cooldown, tenta o próximo
   erro → conta falha, tenta o próximo
```

## 18.3 Regras

1. **Capacidades, não APIs.** Os agentes pedem "preço de ação", "histórico diário", "transferências do token X na rede Y", "notícias do ticker Z". O roteador decide quem responde.
2. **Contador de cota por provedor:** por segundo, minuto, dia e mês, conforme o plano de cada um. O roteador para de chamar **antes** de estourar, em vez de esperar o erro 429.
3. **Cooldown:** um provedor que devolveu 429 ou foi bloqueado fica fora por um tempo que cresce a cada nova falha (backoff exponencial).
4. **Circuit breaker:** depois de N falhas seguidas, o provedor é desligado temporariamente e testado de novo de tempos em tempos.
5. **Cache antes de tudo:** se o dado está no cache e ainda vale, nenhuma API é chamada.
6. **Resposta normalizada:** todo provedor devolve o mesmo formato interno (ex.: `{ativo, preço, moeda, timestamp, fonte}`). Trocar a fonte não muda nada para o agente.
7. **Validação cruzada:** para dados críticos (preço que dispara um gatilho), o roteador confirma em **pelo menos 2 fontes** antes de gerar o evento.
8. **Fonte registrada:** todo dado gravado leva o nome do provedor que o entregou (exigência da seção 2).
9. **Saúde das fontes:** um painel interno mostra, por provedor, as chamadas, os erros, os 429 e a latência (tabela 14.4).
10. **Configuração em arquivo:** provedores, prioridades e limites ficam em um arquivo de configuração (ex.: `providers.yaml`). Um provedor que mudou de plano é ajustado ali, sem mexer no código.
11. **Várias chaves gratuitas:** onde os termos permitirem, o roteador aceita mais de uma chave do mesmo provedor. **Não criar contas falsas nem violar termos de uso.**

## 18.4 Capacidades iniciais

| Capacidade | Provedores (ordem inicial) |
|---|---|
| `catalogo_tokens` | xStocks API → Ondo API → docs Robinhood → rwa.xyz |
| `preco_token` | DexScreener → Jupiter (Solana) → GeckoTerminal → Birdeye → DefiLlama → CoinGecko → CoinPaprika → CoinMarketCap → Mobula |
| `preco_referencia` | Chainlink (on-chain) → xStocks API → Ondo API → Pyth |
| `preco_cex` | Kraken → Bybit → Bitget |
| `pools` | GeckoTerminal → DexScreener → DefiLlama → The Graph |
| `transferencias_evm` | Blockscout → Etherscan V2 → Alchemy → Moralis → QuickNode → Ankr → RPC público |
| `transferencias_solana` | Helius → Alchemy → QuickNode → Moralis → RPC público |
| `acao_historico_diario` | Yahoo → Stooq → Tiingo → Twelve Data → Polygon → Alpha Vantage → EODHD |
| `commodity_historico_diario` | Yahoo → Stooq → FRED (petróleo) → Twelve Data |
| `tbill_rendimento` | Treasury Fiscal Data API (Tesouro dos EUA, sem chave) → FRED |
| `tbill_oferta` | Leitura on-chain da oferta total (RPC/Blockscout) → DefiLlama RWA → rwa.xyz |
| `acao_cotacao` | Finnhub → Alpaca → Twelve Data → Yahoo |
| `acao_b3` | brapi → Yahoo |
| `noticias_ticker` | Finnhub → Marketaux → Alpha Vantage → NewsData → RSS |
| `fatos_relevantes` | SEC EDGAR → RSS de RI |
| `rotulos_endereco` | xStocks → Blockscout → listas open source → rótulo próprio |

---

# 19. EXECUÇÃO

Nesta fase: **nenhuma ordem real.**

```text
ANALISAR → SIMULAR (paper trading) → INFORMAR → USUÁRIO DECIDE
```

A integração de execução é um projeto separado e futuro, e só depois que o placar dos agentes justificar.

---

# 20. SAÍDA: FEED DA CENTRAL RWA

Os alertas aparecem **dentro da Central RWA**, em formato de feed/painel:

- ordem cronológica, com filtro por tipo (fluxo, swing, pool, notícia) e por ativo;
- cada item mostra: o que aconteceu, por que é incomum, números, fonte e nível;
- cada item abre a análise completa (ficha do ativo + eventos semelhantes).

**Telegram:** fora desta fase. O feed é montado de forma que o Telegram possa ser plugado depois sem refazer nada.

---

# 21. NÍVEIS DE ALERTA

- **INFO:** movimento interessante (ex.: movimentação on-chain grande, notícia relevante).
- **ATENÇÃO:** variação acima de 5% (o gatilho).
- **EXTREMO:** muito fora do comportamento histórico da ação (ex.: ±10%, ou raro na amostra).

Configuráveis pelo usuário: ativos, magnitude mínima, janela temporal, amostra histórica mínima e tipos de evento.

---

# 22. PERFIS DE RISCO

Conservador / Moderado / Agressivo são classificações operacionais do sistema, **não garantia de risco real**.

Consideram:

- volatilidade histórica da ação;
- liquidez do token;
- risco do emissor e modelo de lastro;
- rede utilizada;
- concentração (poucas carteiras detendo a maior parte do token).

---

# 23. FILOSOFIA DE INVESTIGAÇÃO

1. O que aconteceu?
2. Quanto?
3. Quando começou?
4. Isso é normal para essa ação?
5. Quantas vezes algo semelhante aconteceu?
6. O que aconteceu depois?
7. Existem notícias relacionadas?
8. O fluxo on-chain confirma ou contradiz?
9. O token acompanhou a ação?
10. Qual é o tamanho e a qualidade da amostra?

---

# 24. ROADMAP

## FASE 0 — ESPECIFICAÇÃO
- fechar as decisões em aberto (seção 28);
- escolher banco e hospedagem;
- criar as contas gratuitas das APIs e confirmar os limites.

## FASE 1 — ROTEADOR + DATA ENGINE
- infraestrutura do Plano A (GitHub Actions + Supabase);
- roteador de APIs (seção 18) com cache, cota e fallback;
- catálogo de ativos tokenizados (emissor, rede, contrato, ativo de referência);
- histórico dos ativos de referência (10+ anos);
- camadas de atualização (6h / 24h);
- preço e volume dos tokens.

## FASE 2 — FLUXO
- coletores on-chain (Solana, Ethereum, Robinhood Chain, BNB Chain);
- filtro de US$ 100k;
- rótulos de endereços;
- rastreador de carteiras.

## FASE 3 — EVENT ENGINE + HISTÓRICO
- detecção de eventos (seção 12);
- eventos semelhantes (seção 13).

## FASE 4 — AGENTE SWING
- camada 1 (analista);
- camada 2 (paper trading);
- placar.

## FASE 5 — CENTRAL RWA (UI)
- substituir o módulo `RWA/`;
- feed, movimentações, carteiras, oportunidades, ficha do ativo, placar.

## FASE 6 — AGENTE DE POOLS
- scanner de pools de ações tokenizadas;
- estratégias de range apertado / opções;
- (depois) pools favoritas do usuário.

## FASE 7 — AGENTE DE NOTÍCIAS + SUPERVISOR
- notícias ligadas à ação e ao token;
- supervisor consolidando tudo no feed.

> A UI (fase 5) pode começar antes com dados de exemplo, mas só é considerada pronta com dados reais.

---

# 25. PRINCIPAL REGRA DE DESENVOLVIMENTO

Não construir tudo ao mesmo tempo.

A arquitetura suporta o sistema final, mas a implementação acontece em **módulos verificáveis**. Cada módulo funciona antes de adicionar o próximo.

O Claude Code é usado para implementação, integração, testes, refatoração, documentação e manutenção. Decisões de arquitetura acontecem **antes** da implementação.

---

# 26. OBJETIVO FINAL

O usuário pode estar trabalhando, estudando ou fazendo outra coisa. Ao abrir a Central RWA, encontra:

> **"Atlas encontrou algo que merece sua atenção."**

E, em cada item: o que aconteceu, por que é incomum, dados atuais, contexto, notícias, histórico da ação, estatística de eventos semelhantes, fluxo on-chain, fontes e limitações.

O usuário continua tomando a decisão. O Atlas faz o trabalho pesado de **observar, pesquisar, cruzar, calcular, comparar, simular e resumir**.

---

# 27. DECISÕES TOMADAS

| # | Decisão |
|---|---|
| 1 | A Central RWA substitui o módulo `RWA/` |
| 2 | Ativos tradicionais tokenizados (ações, ETFs, ouro, prata, petróleo); nada de Bitcoin, Solana como ativo ou cripto em geral |
| 3 | A Central não tem carteira do usuário, compra nem patrimônio |
| 4 | Hold via CoinGecko; DeFi genérico fica no DeFi |
| 5 | Todas as redes, como infraestrutura |
| 6 | Multi-fonte obrigatório + roteador com fallback automático |
| 7 | Piso de US$ 100k por transação e por ativo |
| 8 | Gatilho de preço: variação acima de 5% (vs. fechamento anterior do ativo / 24h do token) |
| 9 | Rastreador de carteiras de terceiros, lista compilada pelo supervisor + manual |
| 10 | Agente swing: 1–7 dias (máx. 10) |
| 11 | Duas camadas: estatística + paper trading com placar por agente |
| 12 | Agente de pools só para ativos tokenizados |
| 13 | O histórico do ativo de referência é a base da estatística do token |
| 14 | Backend com Python + banco de dados |
| 15 | Orçamento de APIs: zero |
| 16 | Alertas no feed da Central; Telegram adiado |
| 17 | Nenhuma execução real nesta fase |
| 18 | Atualização em camadas: lista de observação a cada 6h, demais a cada 24h |
| 19 | Redes da primeira fase: Solana, Ethereum, Robinhood Chain, BNB Chain |
| 20 | Lista inicial: NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL, SPY, QQQ, ouro, petróleo (o usuário vai acrescentar outros) |
| 21 | Jobs agendados em vez de servidor 24/7 |
| 22 | Infraestrutura: Plano A (GitHub Actions + Supabase); B e C registrados em `INFRA_ALTERNATIVAS.md` |
| 23 | Títulos do Tesouro tokenizados entram, com regras próprias (fluxo, rendimento, descolamento) |
| 24 | Histórico de 10 anos dos ativos de referência |
| 25 | Paper trading v1 conforme a seção 9.4 (será aprimorado) |

---

# 28. EM ABERTO (não bloqueiam a Fase 1)

1. Ativos adicionais da lista de observação (o usuário vai enviar).
2. Evolução dos agentes de swing e de pools (depois da primeira versão rodar).
3. Como calcular a similaridade entre eventos (quais variáveis e pesos), a decidir na Fase 3.
4. Onde fica a chave da API de IA e qual é o limite de uso de IA, a decidir na Fase 7.
5. Onde cada seção da Central aparece no menu do Atlas, a decidir na Fase 5.

**O prompt de implementação da Fase 1 está em `PROMPT_FASE1.md`.**
