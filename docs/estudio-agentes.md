# Estúdio de Agentes de Pools — registro

Seis agentes, um por modelo do simulador de pools (Faixa única, Aninhadas, Curve,
Bid-Ask, Spot, Acumulação), mais um supervisor, caçam pools em Solana e Base a
partir do Scanner Pools e simulam a própria estratégia. Os agentes só caçam e
avisam: nenhuma chave de carteira entra no sistema. Tudo em dólar e com custo
zero (Supabase Free, GitHub Actions de repositório público, APIs sem chave).

Fases: 0 Reconhecimento · **1 Motor** · 2 Varredura · 3 Agentes sem IA ·
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
| `estudio.candles` | Velas de 1h da GeckoTerminal (`currency=token&token=<ativo>`), 45 dias. Pool nova baixa 1.000 velas; depois, uma vez por hora, só as que faltam. Orçamento de 30 chamadas por execução (~5 min). |
| `estudio.candles_estado` | Ativo, cotação, quando buscou, primeira e última vela, falhas. |
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

Plano completo e relatório da Fase 0 ficam com o dono (fora do repositório).
