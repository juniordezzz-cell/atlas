# Scanner Pools: implantação do chat OpenRouter

O código do chat fica somente em `Ferramentas/scanner-pools/` e `central-rwa/supabase/functions/scanner-chat/`. O Oráculo principal não usa essa chave. **Nunca cole a chave num arquivo do GitHub, HTML, issue ou conversa.** O segredo de produção pertence ao projeto Supabase `opaimjoimbndwuwkxuva`.

## O que precisa estar implantado

1. As migrations `20260927000001_scanner_chat_usage.sql` e `20260927000002_scanner_chat_privileges.sql`, em `central-rwa/supabase/migrations/`, criam o contador atômico de até 20 perguntas por UID Firebase/dia UTC e removem grants públicos explícitos herdados do Supabase. O workflow `central-rwa-tests.yml` aplica migrations em `main` quando o segredo de CI `SUPABASE_DB_URL` já está configurado. Confirmar a execução verde do job `deploy` ou aplicar ambas antes da função.
2. Implantar a Edge Function `scanner-chat` no mesmo projeto. A partir da pasta `central-rwa`, com Supabase CLI autenticada e acesso ao projeto: `supabase functions deploy scanner-chat --project-ref opaimjoimbndwuwkxuva`. O arquivo `supabase/config.toml` configura `verify_jwt = false` porque o navegador usa um **Firebase ID token**, que a função valida por conta própria no Firebase. A função só aceita POST de usuário autenticado, com e-mail verificado e na lista permitida. GET retorna apenas se o modelo está configurado.
3. No painel Supabase, abrir **Edge Functions → Secrets** do projeto `opaimjoimbndwuwkxuva`; criar o segredo `SCANNER_OPENROUTER_API_KEY` com o valor da chave pessoal do OpenRouter. Não cadastrar o valor em `core/atlas-supabase-config.js`. O Supabase disponibiliza o segredo à função sem republicar o código.
4. Abrir o Atlas, autenticar-se na conta autorizada e testar uma pergunta na aba **Assistente** do Scanner Pools. Sem chave ou se a cota gratuita falhar, a aba preserva as respostas e cálculos locais.

O acesso ao painel/CLI de gestão do projeto é necessário somente para implantar a função e cadastrar o segredo. Publicar este repositório via GitHub Pages **não** implanta automaticamente a Edge Function. O código não cria token de acesso Supabase nem gateway alternativo. Se a implantação por CLI não for desejada, ela pode ser feita pelo editor de Edge Functions do Dashboard, preservando os arquivos `index.ts` e `handler.mjs` e a configuração de verificação de JWT.

## Limites e segurança

- Modelo fixo: `openrouter/free`, sem fallback pago. Uma chamada ao modelo por pergunta; 550 tokens de saída no máximo. OpenRouter escolhe o modelo gratuito disponível nessa rota, portanto não se promete identidade/modelo exato ou disponibilidade contínua.
- O contexto enviado ao provedor contém pergunta, resposta local calculada e no máximo 30 pools. Favoritos e decisões permanecem no navegador; apenas marcas necessárias à pergunta viajam nesse contexto. Não enviar dados pessoais ou chaves na pergunta.
- Dados de pool e texto do usuário são tratados como dados, não comandos. Nenhuma ação de aprovar/rejeitar pool ocorre por resposta da IA.
- Respostas são análise baseada no snapshot do scanner. APR agregado e volume/TVL não prometem lucro de posição concentrada, especialmente por variação de preço, faixa, custos e perda impermanente.
- A configuração de acesso começa com a conta do proprietário. `SCANNER_ALLOWED_EMAILS`, se necessário, é uma lista de e-mails verificados separados por vírgula, cadastrada como segredo do Supabase; alterar essa lista amplia quem pode consumir a cota.

## Verificação

Na raiz do repositório: `node --test Ferramentas/scanner-pools/*.test.cjs` e `node --test central-rwa/supabase/functions/scanner-chat/handler.test.mjs`. O teste de quota SQL está em `central-rwa/backend/tests/test_pools_postgres.py` e roda no CI com PostgreSQL de teste. Após implantar a função, `GET https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/scanner-chat` deve devolver JSON com `enabled: true` somente depois de cadastrado o segredo. Um POST sem Firebase ID token deve devolver 401.
