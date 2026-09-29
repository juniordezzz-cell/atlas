# Scanner Pools: implantação do chat OpenRouter

O código do chat fica somente em `Ferramentas/scanner-pools/` e `central-rwa/supabase/functions/scanner-chat/`. O Oráculo principal não usa essa chave. **Nunca cole a chave num arquivo do GitHub, HTML, issue ou conversa.** O segredo de produção pertence ao projeto Supabase `opaimjoimbndwuwkxuva`.

## O que precisa estar implantado

1. As migrations `20260927000001_scanner_chat_usage.sql` e `20260927000002_scanner_chat_privileges.sql`, em `central-rwa/supabase/migrations/`, criam o contador atômico de até 20 perguntas por UID Firebase/dia UTC e removem grants públicos explícitos herdados do Supabase. O workflow `central-rwa-tests.yml` aplica migrations em `main` quando o segredo de CI `SUPABASE_DB_URL` já está configurado. Confirmar a execução verde do job `deploy` ou aplicar ambas antes da função.
2. Implantar a Edge Function `scanner-chat` no mesmo projeto. A partir da pasta `central-rwa`, com Supabase CLI autenticada e acesso ao projeto: `supabase functions deploy scanner-chat --project-ref opaimjoimbndwuwkxuva`. O arquivo `supabase/config.toml` configura `verify_jwt = false` porque o navegador usa um **Firebase ID token**, que a função valida por conta própria no Firebase. A função só aceita POST de usuário autenticado, com e-mail verificado e na lista permitida. GET retorna apenas se o modelo está configurado.
3. No painel Supabase, abrir **Edge Functions → Secrets** do projeto `opaimjoimbndwuwkxuva`; criar o segredo `SCANNER_OPENROUTER_API_KEY` com o valor da chave pessoal do OpenRouter. Não cadastrar o valor em `core/atlas-supabase-config.js`. O Supabase disponibiliza o segredo à função sem republicar o código.
4. Abrir o Atlas, autenticar-se na conta autorizada e testar uma pergunta na aba **Assistente** do Scanner Pools. Sem chave ou se a cota gratuita falhar, a aba preserva as respostas e cálculos locais.

O acesso ao painel/CLI de gestão do projeto é necessário somente para implantar a função e cadastrar o segredo. Publicar este repositório via GitHub Pages **não** implanta automaticamente a Edge Function. O código não cria token de acesso Supabase nem gateway alternativo. Se a implantação por CLI não for desejada, ela pode ser feita pelo editor de Edge Functions do Dashboard, preservando os arquivos `index.ts` e `handler.mjs` e a configuração de verificação de JWT.

## Limites e segurança

- Modelo fixo: `google/gemma-4-31b-it:free`, sem fallback pago. Uma chamada ao modelo por pergunta; 1.000 tokens de saída no máximo. Modelo conversacional gratuito fixo; não há troca aleatória de modelo nem fallback pago. A disponibilidade do endpoint gratuito não é garantida.
- O contexto enviado ao provedor contém pergunta, resposta local calculada e no máximo 30 pools. Favoritos e decisões permanecem no navegador; apenas marcas necessárias à pergunta viajam nesse contexto. Não enviar dados pessoais ou chaves na pergunta.
- Dados de pool e texto do usuário são tratados como dados, não comandos. Nenhuma ação de aprovar/rejeitar pool ocorre por resposta da IA.
- Respostas são análise baseada no snapshot do scanner. APR agregado e volume/TVL não prometem lucro de posição concentrada, especialmente por variação de preço, faixa, custos e perda impermanente.
- A configuração de acesso começa com a conta do proprietário. `SCANNER_ALLOWED_EMAILS`, se necessário, é uma lista de e-mails verificados separados por vírgula, cadastrada como segredo do Supabase; alterar essa lista amplia quem pode consumir a cota.

## Verificação

Na raiz do repositório: `node --test Ferramentas/scanner-pools/*.test.cjs` e `node --test central-rwa/supabase/functions/scanner-chat/handler.test.mjs`. O teste de quota SQL está em `central-rwa/backend/tests/test_pools_postgres.py` e roda no CI com PostgreSQL de teste. Após implantar a função, `GET https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/scanner-chat` deve devolver JSON com `enabled: true` somente depois de cadastrado o segredo. Um POST sem Firebase ID token deve devolver 401.

## Atualização para contexto, memória e avaliações

1. Aguardar o job `deploy` aplicar a migration `20260928000001_scanner_chat_memory.sql`.
2. Supabase → Edge Functions → scanner-chat → Code: no deployment atual com bundle autossuficiente, substituir TODO o conteúdo de `index.ts` pelo bundle atualizado e clicar em **Deploy updates**. Não atualizar apenas `handler.mjs`, pois esse deployment não o importa. Para implantação modular via CLI, publicar ambos os arquivos canônicos. A chave permanece em Secrets. Manter Verify JWT with legacy secret desligado, porque o código valida a sessão Firebase.
3. Atlas → Scanner Pools → Assistente → Ctrl+F5. Em Minhas preferências confirmadas, carregar da conta, revisar os campos e salvar. Testar uma pergunta, depois “E entre essas, qual escolheria?”; as métricas devem vir do snapshot atual. Usar Resposta útil ou Corrigir resposta para registrar avaliação.
4. Nova conversa limpa o contexto desta sessão. Restaurar preferências iniciais remove critérios pessoais; Apagar avaliações anteriores remove exemplos de feedback. Preferências são privadas da conta, não entram no backup público do navegador.


### Correção da resposta “User Safety: safe” — 27/09/2026

A rota anterior `openrouter/free` selecionava modelos automaticamente. A resposta observada era de classificação de segurança, não uma análise de pools. Não foi obtido o ID da execução original, portanto a identidade desse modelo é uma hipótese. O defeito confirmado era aceitar qualquer texto não vazio. Agora usamos exclusivamente `google/gemma-4-31b-it:free` ([catálogo oficial](https://openrouter.ai/google/gemma-4-31b-it:free)); servidor e navegador rejeitam saídas de classificador e preservam a consulta local existente. Não há segunda chamada automática, mudança de chave, quota ou memória.

No editor Supabase que duplicou `handler.mjs`, a execução foi consolidada em um único `index.ts` autossuficiente. Para atualizar esse deployment, colar o bundle atualizado inteiro em `index.ts` e clicar em **Deploy updates**. Não usar o `index.ts` de três linhas isoladamente: ele depende do `handler.mjs` canônico. O bundle é gerado concatenando `handler.mjs` e `Deno.serve(createHandler({ env: Deno.env, fetcher: fetch }));`; não editar regras separadamente no bundle. GitHub Pages não atualiza a função Supabase.


## Atualização do método — 29/09/2026 (chat já ativo)

Não repetir cadastro da chave, migrations ou configuração da conta. A revisão modifica os filtros/resumo publicados no GitHub Pages e o prompt da Edge Function. No deployment atual autossuficiente, substituir todo o conteúdo de `scanner-chat → Code → index.ts` pelo bundle novo e clicar **Deploy updates**. O bundle deriva do `handler.mjs` atual seguido de `Deno.serve(createHandler({ env: Deno.env, fetcher: fetch }));`.

Recarregar o Atlas com Ctrl+F5. Se quiser priorização de pares específica, usar os pares já salvos em Minhas preferências confirmadas; exemplos do MD não são contratos aprovados nem filtros exclusivos. Não é obrigatório salvar novamente preferências existentes.

Validar: perguntar sobre range de 9% com giro curto e com objetivo de equilíbrio; perguntar se ETH/BTC é conservadora só pelo par; solicitar favoritas com meta de taxas. A resposta deve separar cálculo agregado de adequação pessoal e pedir dados faltantes. Testes automatizados validam seleção e instruções enviadas, não a qualidade de toda geração real do modelo.
