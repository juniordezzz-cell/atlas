# Oráculo: prints de abertura de pool

Desenho aprovado pelo usuário em 29/09/2026: anexar print; explicar tokens, quantidades, valor, protocolo e faixa lidos; permitir correções; confirmar leitura; solicitar carteira; apresentar resumo final; gravar somente após nova confirmação. “Monta igual, ajustamos depois” salva um rascunho com pendências, sem afetar saldo. Apenas registro interno, sem blockchain.

1. Criar contrato tipado de extração e testes de ausência, números, faixa/unidade e discrepância capital/composição.
2. Criar função Supabase `oraculo-imagem` isolada, com Firebase Auth, proprietário, CORS, imagem limitada, modelo gratuito com visão, chave existente SCANNER_OPENROUTER_API_KEY e reserva de uso compartilhada já existente. Retornar JSON validado, sem executar ferramentas ou operações.
3. Criar máquina de estados local e testes reais do Store/Caixa: leitura → confirmação → carteira → resumo → confirmação final. Revalidar saldo; aceitar “sim”; cancelar; rascunhos persistentes separados de posições e ledger.
4. Integrar anexo/colar imagem e formulário de revisão no Oráculo. Exibir miniatura e aviso de envio ao serviço; não persistir imagem em backup. Retomar rascunhos na aba Pools.
5. Testar navegador isolado com gateway simulado (sem consumir chave), testes do gateway e regressões. Revisar, documentar, publicar frontend e fornecer bundle autossuficiente para implantação manual da função. Não declarar visão ativa sem a função publicada.

Escopo desta etapa: prints de abertura de pool. Leitura de comprovantes de swap e reconciliação de saldo serão uma etapa separada; nenhuma conta é corrigida automaticamente com imagem de saldo.
