# Scanner Pools — cobertura e histórico intradiário (29/09/2026)

Primeira etapa da melhoria autorizada pelo proprietário. O foco continua no scanner; o nome e o comportamento da IA não foram alterados.

## Mudanças

- A coleta lê APIs públicas de Orca e Raydium, sem chave. Os parsers convertem TVL, volume, fee e contratos para o modelo do Atlas. IDs on-chain seguem o formato Gecko para preservar decisões por pool. Quando uma pool da DefiLlama casa de forma única por contratos, DEX, fee e TVL próximo, mantém-se o ID histórico DefiLlama, enriquecido pelos dados diretos.
- PancakeSwap V3 e V2 na BNB Chain ganham mais páginas; PancakeSwap Infinity CLMM na BNB Chain passa a ser lida. A fonte segue sujeita ao orçamento de chamadas da GeckoTerminal.
- Falha/parcialidade de uma fonte não conta como desaparecimento das pools que ela já acompanhava.
- Nova tabela `scanner.snapshots` guarda cada observação com horário real por 30 dias. A tabela diária legada continua; a visão pública `scanner_snapshots` expõe somente pools ativas e não barradas. O Radar usa snapshots ao abrir a pool e mostra variação de TVL em 12h quando existe uma observação entre 12h e 14h antes da mais recente. O volume exibido continua sendo uma janela móvel de 24h, não taxas geradas durante as 12h.
- Cron nominal a cada 2h, minuto 37 UTC, com grupo de concorrência específico para o scanner. A página relê os dados a cada 5 minutos quando está visível e avisa se a última coleta tem mais de 3h.

## Verificação e implantação

Rodar `python -m pytest -q` em `central-rwa/backend` e `node --test Ferramentas/scanner-pools/*.test.cjs` na raiz. A migration `20260929000002_scanner_snapshots.sql` precisa ser aplicada antes do coletor atualizado; o workflow do scanner executa migrations antes da coleta. Em produção, validar as próximas execuções e os contadores por fonte em `scanner_status`, a leitura de `scanner_snapshots` e a variação real no Radar.

## Limites

O agendamento do GitHub Actions não garante horário exato e ainda precisa de observação após a publicação. A busca direta é paginada e limitada; não afirma cobrir todo o universo on-chain. O corte vigente TVL >= US$100 mil e volume24h/TVL > 0,50 continua obrigatório. A maior cobertura não equivale a lucro garantido. Ainda não existe job horário separado para favoritas; o intervalo nominal atual desta etapa é 2h. A classificação de "Sólidas" continua a significar lista principal, não segurança comprovada.
