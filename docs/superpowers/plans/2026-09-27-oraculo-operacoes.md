# Oráculo: operações internas autorizadas

Escopo: registrar abertura/fechamento DeFi, swaps e transferências relatados pelo usuário. Nenhuma conexão com carteira/protocolo ou API de IA. Motor determinístico separado das consultas, com rascunho de conversa, resumo e comando confirmar/cancelar. Ambiguidade, quantidade desconhecida ou caixa insuficiente bloqueiam registro.

1. Criar testes Node do interpretador e da execução usando Store/Caixa reais em sandbox localStorage.
2. Criar core/atlas-oraculo-operacoes.js: interpretar comandos, resolver carteiras e posições, pedir campos ausentes, preparar ação e revalidar ao confirmar. Nunca criar depósito implícito. Não alterar resultado informado sem dados de fechamento.
3. Shell carrega motor sob demanda e DeFiStore quando necessário, serializa perguntas e mantém consultas existentes. Atualiza consolidação depois de gravar.
4. Testar fechamento com taxas pendentes/coletadas, novo ciclo, swap com custo contábil preservado, transferência, falta de saldo, duas posições iguais, cancelamento e dupla confirmação.
5. Documentar exemplos aceitos e limites. Publicar GitHub após verificação e revisão.
