# Histórico de pools — 29/09/2026

Na aba DeFi → Pools, o botão **Histórico de pools** apresenta ciclos abertos e encerrados. Mantém busca, rede, protocolo e escopo Esta carteira/Todas as carteiras. Expanda um ciclo para conferir capital inicial, aportes adicionais, reinvestimentos, retiradas, valor da posição, taxas, variação dos ativos e resultado em dólares. Cada nova abertura é um ciclo independente; os dados do fechamento usam `closeSummary` preservado.

A tabela de tokens distingue quantidade de entrada da última quantidade atual informada. Entrada nunca é apresentada como composição final. Zero informado é preservado. Dados ausentes aparecem como não informados. O sistema não consulta o protocolo nem deduz os tokens efetivamente retirados. Atualize a composição pela tela da posição antes de fechar se precisar preservá-la.

A conferência do caixa usa somente eventos `aporte`/`retorno` vinculados à pool e suas taxas. Mostra a lista real e suas somas. Depósitos externos e swaps não viram rendimento. Retorno do fechamento contém a posição e taxas pendentes; taxas já coletadas não são contadas duas vezes. Variação líquida do caixa de uma posição aberta não representa prejuízo: capital pode continuar alocado na posição.

Registros antigos sem `closeSummary` não ganham resultado recalculado ou taxas presumidas em zero. Abertura derivada do cadastro é identificada, e data ausente não vira a data de hoje. A página DeFi → Histórico usa o mesmo relatório; KPIs excluem resultados ausentes e indicam quantos registros não têm dados suficientes.

Implementação: `defi/js/pool-history.js` é leitura e apresentação; `closedDeTodasCarteiras()` no store fornece carteira proprietária. Nenhuma migração destrutiva ou lançamento novo é feito ao abrir o histórico. A aba Pools se atualiza quando o Oráculo registra uma operação.

Validação: `node --test defi/js/pool-history.test.cjs core/atlas-oraculo-operacoes.test.cjs`. Testes com stores reais verificam aportes/taxas/retirada/reinvestimento, fechamento, lucro e caixa, ausência de dados, carteira proprietária e escape de textos. Chromium isolado verifica duas posições do mesmo par em ciclos distintos, detalhes, desktop/mobile e regressões Oráculo/DeFi.

Próxima etapa separada: prints e reconciliação assistida por IA usando segredo OpenRouter existente no Supabase. Ainda não implementada nesta alteração. Nunca colocar chave API no GitHub ou navegador.
