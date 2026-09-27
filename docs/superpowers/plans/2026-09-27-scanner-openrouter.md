# Integração OpenRouter do Scanner — plano de implementação

**Objetivo:** conectar o chat existente a uma função Supabase protegida por Firebase ID token, com modelo gratuito e fallback local.

**Arquitetura:** o navegador calcula respostas e seleciona contexto das pools; uma Edge Function valida a sessão Firebase, confere a lista permitida, reserva cota diária no banco e encaminha contexto limitado ao OpenRouter. Chave somente como segredo de runtime `SCANNER_OPENROUTER_API_KEY`. Se não configurada ou serviço falhar, respostas locais permanecem disponíveis.

**Tecnologia:** JS/ESM testado com Node, Supabase Edge Function Deno, Postgres RPC, Firebase Authentication, OpenRouter chat completions.

## Etapas

1. Escrever testes de handler para autenticação, origens, payload, ausência de chave, cota, modelo gratuito e falhas externas; observar falha.
2. Implementar handler puro e entrada Deno `scanner-chat/index.ts`; verificar testes.
3. Criar migration para contador diário atômico e execução restrita ao papel de serviço; testar em pgserver quando disponível.
4. Escrever testes de preparo de contexto no browser; observar falha; implementar seleção compacta sem perder filtros e limites.
5. Conectar UI com `getIdToken()` e chamada da função; fallback local, estado configurado e erros claros.
6. Executar testes JS/Python, teste visual local sem segredo real, revisão, documentação de deploy e segredo.

**Critérios:** nenhuma chave no HTML ou banco público; ausência de autenticação rejeitada antes de qualquer chamada externa; apenas `openrouter/free`; no máximo uma chamada ao modelo por pergunta; não há fallback pago nem pesquisa web. Uma pergunta com resultados locais preserva números determinísticos. Não usar histórico inventado.
