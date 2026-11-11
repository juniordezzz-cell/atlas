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

Plano completo e relatório da Fase 0 ficam com o dono (fora do repositório).
