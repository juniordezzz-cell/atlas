# Laboratório de Agentes · no PC do dono

Decisão do dono em 15/11/2026: o Laboratório roda **só no PC dele**, não no
site e não na nuvem. Motivos: o tráfego de saída do Supabase (plano grátis,
5 GB/mês) tinha triplicado desde 13/11 por causa das rodadas na nuvem, e o
login do Firebase no Supabase dava trabalho de configurar.

- O workflow "Laboratório de Agentes · varredura (15 min)" foi **desativado**
  no GitHub em 15/11 (nada apagado; `gh workflow enable` religa).
- O PR 39 (login do Firebase no Supabase) foi fechado sem juntar.
- O agendamento `estudio-varredura` do pg_cron ainda chama o GitHub a cada
  15 min (recusado, custo desprezível); sai na limpeza final, junto com o
  schema `estudio`, quando o dono decidir.

## Como abrir

Dois cliques no atalho **Laboratório de Agentes** da área de trabalho (que
roda `laboratorio/abrir-laboratorio.cmd`). Ele liga o programa e abre o
navegador em `http://localhost:4321`, que só existe naquele PC (o servidor
escuta em 127.0.0.1). Fechar a janela preta desliga. Precisa só do Node 24.

## O ciclo (laboratorio/rodada.mjs, um passo por minuto)

| Quando | O quê | De onde |
|---|---|---|
| a cada 4 h | pools-alvo e volume diário | Scanner Pulse: `scanner_pools` e `scanner_leituras` (chave publicável, ~60 KB + alguns KB por leitura) |
| a cada hora | retrato da pool e velas de 1h | DexScreener; DeFiLlama (principal); GeckoTerminal (reserva) |
| depois de cada busca de preços | os 8 agentes e o supervisor | `estudio/agentes` sem mudança, em processo separado (`trabalho.mjs`) |
| depois de cada rodada | boletim de 7 e 30 dias | `estudio/agentes/boletim.mjs` |
| uma vez por dia | limpeza | velas, retratos e leituras com mais de 75 dias |

Filtro das pools: Solana e Base, TVL ≥ US$ 250 mil, giro > 0,5 e endereço
conhecido (o mesmo da antiga `estudio.pools_alvo`). Os agentes só olham
pools com 7 dias ou mais de velas; na primeira vez o programa baixa 31 dias
da DeFiLlama, então a primeira rodada já sai no mesmo dia.

Volume da hora = volume 24h do retrato daquela hora ÷ 24; sem retrato (PC
desligado, ou antes da primeira abertura), o volume do dia no Scanner ÷ 24.

## Onde ficam os dados

`laboratorio/dados/laboratorio.db` (SQLite do próprio Node), fora do GitHub.
Apagar esse arquivo faz o programa começar do zero na próxima abertura.

## A tela (laboratorio/pagina/index.html)

Quadro de oportunidades da última rodada, ordenado por quanto rende **por
dia** com o valor escolhido no topo (US$ 100, 500, 1.000, 5.000 ou outro):

- por dia = ((média + gás) × valor ÷ 1.000 − gás) ÷ 30. Taxas e perda
  crescem junto com o dinheiro; o gás de entrar e sair é fixo. Aproximado:
  vale enquanto o valor é pequeno perto do TVL da pool.
- cenário ruim = o mesmo cálculo com o p10 (pior entre os 10% piores).
- clicar na linha mostra as faixas (quanto vai em cada uma), taxas, gás,
  ganho sobre a faixa única, chance de prejuízo e o motivo do agente.
- Acumulador Token aparece em "% a mais de tokens", não em dólar.

Atualiza sozinha ao fim de cada rodada (`/api/eventos`).

## Próximos passos

3. A cidade 3D com os agentes andando, em volta deste quadro (os dados de
   quem olhou cada pool já estão em `analises`).
4. Perfis e redes novas.
