# Estúdio de Agentes de Pools — registro

Seis agentes, um por modelo do simulador de pools (Faixa única, Aninhadas, Curve,
Bid-Ask, Spot, Acumulação), mais um supervisor, caçam pools em Solana e Base a
partir do Scanner Pools e simulam a própria estratégia. Os agentes só caçam e
avisam: nenhuma chave de carteira entra no sistema. Tudo em dólar e com custo
zero (Supabase Free, GitHub Actions de repositório público, APIs sem chave).

Fases: 0 Reconhecimento · 1 Motor · 2 Varredura · **3 Agentes sem IA** ·
4 Painel (escritório isométrico em voxel com os agentes trabalhando) · 5 IA.
Regra do dono: antes de cada fase, descrever o que muda e esperar o OK.

## Fase 1 — motor (11/11/2026)

Critério de pronto: o motor dá os mesmos números do simulador para as mesmas
entradas. Conferido de duas formas: o teste roda o código do HTML ao lado do
módulo e exige igualdade exata; e o ranking do caça-estratégias aberto no
navegador (padrões do simulador, rede Solana) bateu linha a linha com
`cacar()`.

| Arquivo | O que é |
|---|---|
| `estudio/referencia/simulador-pools.html` | O simulador, cópia exata. É o gabarito. |
| `estudio/motor/simulador.mjs` | Bloco `core` + `statsOf` copiados do HTML sem mudança; `caminhos`, `sub`, `validas` e `cacar` são a costura sem tela. |
| `estudio/motor/metricas.mjs` | APR de taxas, volatilidade realizada 7/30 d, lateralidade. |
| `estudio/motor/calibracao.mjs` | Pool real + candles de 1h → mercado `M` do simulador. |
| `estudio/motor/*.test.mjs` | Equivalência com o HTML, métricas e calibração (velas reais do SOL/USDC Orca). |

Para mudar uma fórmula: mude o simulador em `estudio/referencia/`, copie o bloco
para `simulador.mjs` e rode os testes. Editar só o módulo faz o teste falhar.

Definições assumidas (aprovadas com a Fase 1):

- **Simulação calibrada:** σ, μ e κ vêm dos candles; os caminhos continuam
  sorteados. Replay do histórico fica para o backtest.
- **Volatilidade realizada:** desvio-padrão amostral dos retornos log de 1h × √8760.
  Precisa de 80% das velas da janela; sem 30 dias, a calibração usa 7.
- **Lateralidade:** fração das velas de 1h dos últimos 30 dias que fecharam a
  ±10% da mediana do período.
- **κ:** regressão AR(1) do log do preço, limitada a [0, 25] (25 = cenário Lateral).
- **μ:** deriva média + σ²/2, limitada a [−60%, +80%] ao ano (cenários Baixa e Alta).
  Com 30 dias de dados é só uma pista.
- **conc:** 8% fixo (padrão do simulador) até entrar a liquidez por tick;
  `origem.concEstimada` marca isso para o achado.
- **Taxa:** em % como no Scanner (`scanner.pools.fee`, 0,3 = 0,3%).
- **Gás:** Solana $0,003, Base $0,03 (valores do simulador). Swap 0,15%.

Validação: `node --test estudio/motor/*.test.mjs` (também no workflow `scanner-testes`).

## Fase 2 — varredura (12/11/2026)

Critério de pronto: o banco recebe dados novos a cada 15 minutos por 48 horas
sem falha. Medido em `estudio.varredura_status` (uma linha por execução).

**Fluxo:** `pg_cron` (a cada 15 min) → `estudio.disparar_varredura()` →
workflow `estudio-varredura.yml` → `python -m central_rwa estudio` →
schema `estudio`.

| Peça | O que faz |
|---|---|
| `estudio.pools_alvo` (visão) | Filtro sobre `scanner.pools`: Solana e Base, ativa, não barrada, TVL ≥ $250 mil, giro > 0,5, endereço conhecido (`gecko:` no ID, `sinais.endereco_pool` ou a conferência). Em 11/11: 123 pools; 15 sem endereço ficaram de fora. |
| `estudio.snapshots` | DexScreener, até 30 pools por chamada: preço do ativo no outro token e em dólar, TVL, volume 24h, giro e taxa (vinda do Scanner). 7 dias. |
| `estudio.snapshots_hora` | Resumo por hora, 30 dias. |
| `estudio.candles` | Preço de 1h, 45 dias. Desde 13/11 vem da DeFiLlama (ver "Fontes do histórico"); a GeckoTerminal fica de reserva. |
| `estudio.candles_estado` | Ativo, cotação (símbolo e endereço), de onde vieram as velas (`fonte`), quando buscou, primeira e última vela, falhas. |
| `estudio.pools_prontas` (visão) | Alvos com pelo menos 7 dias de velas: o que os agentes vão usar. Substitui a data de criação, que falta em parte das pools. |
| `estudio.varredura_status` | Uma linha por execução: estado `ok`, `parcial` ou `erro`, contagens e falhas. |
| `estudio.manutencao()` | Ao fim de cada varredura: resume por hora e apaga o que venceu. |

**Ativo e cotação:** o "ativo" é o token volátil; a cotação é o outro, na ordem
stable > WETH/ETH > SOL > cbBTC/WBTC. Empate fica com o token base da DexScreener.
Em par com stable, o preço é em dólar; em SOL/JUP, é JUP em SOL — que é o preço
que mexe na faixa do LP.

**Acesso:** tudo com RLS e sem visão pública. O papel `estudio_agente` lê só as
visões do estúdio (não o `scanner.pools`) e grava só nas tabelas do estúdio. A
migração cria o papel sem senha; o dono ativa uma vez:

1. Supabase → SQL Editor:
   `alter role estudio_agente with login password '<senha forte, só letras e números>';`
2. GitHub → Settings → Secrets → Actions → `ESTUDIO_DB_URL` =
   `postgresql://estudio_agente.opaimjoimbndwuwkxuva:<senha>@<host do pooler>:5432/postgres`
   (o mesmo host do "Session pooler" que o `SUPABASE_DB_URL` usa).

Sem o segredo, o workflow avisa e sai sem erro.

Rodar local, sem banco: `python -m central_rwa estudio --dry-run --orcamento-gecko 6`
(alvos pela visão pública do Scanner). Em 11/11: 123/123 snapshots, 6 pools com velas
(4.403 velas), 54 s, zero 429.

Validação: `python -m pytest -q` em `central-rwa/backend`
(`test_estudio_varredura.py` com respostas reais; `test_estudio_postgres.py` com
Postgres embutido: filtro, privilégios do papel e a varredura gravando).

### Fontes do histórico (13/11/2026)

A GeckoTerminal aceita ~6 pedidos por minuto e, quando recusa, a espera entre
tentativas estourava os 14 min do workflow (três varreduras canceladas em
12–13/11). O histórico passou para a **DeFiLlama** (`coins.llama.fi/chart`,
sem chave, até 500 pontos por chamada):

- Pools em dia (velas até 6 h atrás) vão juntas: **1 chamada por hora** cobre
  todas. Pool nova ou atrasada baixa 31 dias em 2 ou 3 chamadas.
- Vela = preço do ativo ÷ preço da cotação em dólar (cotação stable: o preço em
  dólar), uma por hora (abertura = máxima = mínima = fechamento). O motor só usa
  o fechamento.
- Volume da hora = média do volume 24h dos snapshots daquela hora ÷ 24. Dia sem
  volume conhecido não entra nas regras de volume dos agentes.
- **Reserva (GeckoTerminal)**, até 15 chamadas por execução e 2 tentativas por
  pedido, para: token que a DeFiLlama não tem (embrulhados de outra rede, como
  SOL e JitoSOL na Base ou WBTC na Solana), preço parado há mais de 3 h, ou
  preço a mais de 5% do preço da pool no snapshot. A pool que cai na reserva
  continua nela (`candles_estado.fonte = 'geckoterminal'`).
- **Trava:** a etapa de velas para em 7 minutos; o que sobrar fica para a
  execução seguinte (`varredura_status.velas_adiadas`).

Medido em 13/11 com as APIs reais (117 pools-alvo): histórico completo de 73
pools em 274 chamadas e ~1 min, zero recusas; na hora seguinte, 1 chamada. 44
pools ficam na reserva (31 sem token na DeFiLlama, 13 com preço diferente).

## Fase 3 — agentes sem IA (13/11/2026)

Critério de pronto: cada agente grava achados e status, e o ranking bate com o
caça-estratégias do simulador.

**Fluxo:** no mesmo workflow da varredura, depois dela, `python -m central_rwa
agentes` (no máximo uma vez por hora: o comando confere a última rodada boa em
`estudio.agentes_status`). O Python lê `estudio.pools_prontas`, o último
snapshot e 31 dias de velas, entrega tudo em JSON para
`estudio/agentes/rodar.mjs` e grava o que voltar. Uma rodada com ~110 pools
leva menos de um minuto de motor.

**Ciclo de cada agente, por pool:** regra (procura e não descarta) → simulação
da sua estratégia com o motor da Fase 1 → comparação com a Faixa única na mesma
pool, mesma faixa e mesmos sorteios → achado se ganhar dela na média **e** a
média for positiva. Cada agente testa os N do seu modelo e fica com o melhor
pela média, o mesmo critério do caça-estratégias.

| Agente | Modelo (N) | Trabalha na pool quando… | Descarta quando… |
|---|---|---|---|
| Base | Faixa única (1) | giro ≥ 1 e estável (dia mais fraco dos últimos 7 ≥ 50% da mediana) | volume caiu 3 dias seguidos |
| Concentrador | Aninhadas (2–5) | lateralidade ≥ 0,6 | σ 7 d × √(30/365) maior que a meia-largura da faixa do meio |
| Curva | Curve (2–6) | κ ≥ 5 e giro ≥ 1 | \|μ\| ≥ 40% ao ano |
| Pontas | Bid-Ask (2–6) | σ 30 d ≥ 60% e κ ≥ 5 | σ 7 d < 20% |
| Grade | Spot (2–6) | menos de 30 dias de velas | giro < 1 |
| Acumulador | Acumulação (1–6) | ativo na lista de compra e até 10% acima da mínima de 30 dias | ativo fora da lista |

Limites, lista de compra e parâmetros ficam em `estudio/agentes/regras.mjs`.
Lista de compra (dono, 13/11): SYRUP, AAVE, ENA, BTC, BNB, AERO, UNI, LDO, SUI,
SOL, ETH, RENDER, ONDO, JTO, MORPHO, PENDLE, RAY, LINK, SKY, HYPE, JUP, PYTH,
mais ações tokenizadas (padrão xStocks, como AAPLx e CRCLx, e SPACEX). WETH,
WBTC, cbBTC e WSOL contam como ETH, BTC e SOL.

**Simulação:** capital de $1.000, 30 dias, 300 caminhos (os mesmos do
caça-estratégias), sem rebalanceamento. Faixa = preço × e^(±σ·√(30/365)); a
Acumulação usa só a parte abaixo do preço (é o próprio `build` do simulador).
Em par cotado em outro token (JUP/SOL), a simulação roda na moeda da cotação
(capital, TVL, volume e gás convertidos pelo snapshot) e volta para dólar; a
variação da própria cotação contra o dólar fica de fora, como no simulador.

**Supervisor:** a cada rodada refaz `estudio.relatorios_diarios` do dia (UTC):
ranking (achado mais recente de cada agente em cada pool, pela média), disputas
(dois agentes com achado na mesma pool) e conflitos (achado de um agente numa
pool que a regra de outro descarta; a regra do Acumulador não entra, porque é a
lista de compra). O texto é da Fase 5.

| Tabela | O que guarda |
|---|---|
| `estudio.achados` | agente, pool, modelo × N, faixas, posições, média, P10, P90, taxas, IL, custo, tempo em faixa, Faixa única de referência e o ganho sobre ela, o mercado M e as métricas da regra. 90 dias. |
| `estudio.agentes_status` | uma linha por agente e uma do supervisor: estado (`cacando`, `ok`, `sem_pools`, `erro`), melhor pool, pools vistas e trabalhadas, achados. |
| `estudio.relatorios_diarios` | uma linha por dia: ranking, disputas, conflitos, rodadas. |

Mesmo acesso da Fase 2: RLS, nada público, o papel `estudio_agente` lê e grava
só nessas tabelas. Nenhuma chave nova.

Validação: `node --test estudio/agentes/*.test.mjs` (cada estratégia igual ao
`hunt()` do HTML original e a `cacar()`, regras, lista de compra, supervisor,
conversão de cotação) e `tests/test_estudio_agentes.py` (Postgres embutido +
Node: a rodada grava achados, status e relatório; pula com menos de 55 min;
erro não bloqueia a próxima). Conferido também na tela: simulador aberto com o
mercado calibrado do SOL/USDC (velas reais de 11/11), 27 estratégias iguais às
dos agentes até a quarta casa.

Plano completo e relatório da Fase 0 ficam com o dono (fora do repositório).

## Tendência (13/11/2026)

Medição com 60 dias de preço por hora (DeFiLlama) de 20 tokens da lista de
compra e 5 pares contra SOL: o μ de 30 dias levado para "por ano" tinha margem
de erro de ±130% a ±400%, parava no teto do simulador (−60% ou +80% ao ano) em
84% das medições e marcava "tendência forte" (|μ| ≥ 0,4) em 90% delas. Isso
gerava ~100 conflitos por rodada e simulava quase toda pool com queda de 60%
ou alta de 80% ao ano.

- A simulação dos agentes roda com **μ = 0** (cenário neutro). O μ calibrado
  continua gravado em `mercado.mu_historico` e `metricas.mu`.
- A regra da Curva descarta quando `metricas.tendencia` — ln(último ÷ primeiro
  preço da janela de 30 dias) ÷ (σ·√(dias/365)) — passa de ±1,5. Na mesma
  medição isso aconteceu em 4% dos dias.
