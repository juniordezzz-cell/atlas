# Conector MCP do Atlas

Projeto: [spec de 15/10/2026](superpowers/specs/2026-10-15-conector-mcp-design.md). Plano da fase 1: [plano](superpowers/plans/2026-10-15-conector-mcp-fase1.md).

## Contrato vigente (fase 1)

- Só leitura. Ferramentas: `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico`.
- Login: OAuth com PKCE S256. A identidade vem do login Google do Atlas em `pages/conectar-claude.html`. Só e-mails de `ATLAS_MCP_ALLOWED_EMAILS` (padrão `juniordezzz@gmail.com`) com e-mail verificado.
- O `uid` vem do token. Leitura só em `atlas_users/{uid}/store/{atlas.wallets.v2|atlas.hold.state.v2|atlas.caixa.v1}`.
- Tokens: acesso 1 h, renovação 30 dias com rotação; reuso de renovação revoga a família. 60 chamadas por minuto.
- Valores do Hold usam o último `preco_atual` salvo pelo site. Ativo sem preço fica fora do total. Caixa é a soma dos eventos em dólar; saldo por token fica para a fase 2.
- Revogar tudo (até existir a tela da fase 5): no SQL Editor, `select public.atlas_mcp_revogar_uid('<uid>');`.

Código: `central-rwa/supabase/functions/atlas-mcp/`. Testes: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs` e `node --test js/conectar-claude.test.cjs`.

## Implantação manual (feita pelo dono)

GitHub Pages publica a página `conectar-claude.html`, mas não publica a função.

1. **Conta de serviço do Firebase.** Console do Firebase → projeto `cryptotrack-br` → Configurações do projeto → Contas de serviço → Gerar nova chave privada. Guarde o JSON; ele não entra no repositório.
2. **Banco.** Supabase (mesmo projeto do Scanner) → SQL Editor → colar e rodar `central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql`. Conferir: `select count(*) from atlas_mcp.tokens;` devolve 0.
3. **Secrets.** Supabase → Edge Functions → Secrets:
   - `ATLAS_MCP_SECRET`: gerar com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
   - `ATLAS_FIREBASE_SERVICE_ACCOUNT`: colar o JSON inteiro do passo 1.
   - `ATLAS_MCP_BASE_URL`: `https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp`.
   - `ATLAS_MCP_ALLOWED_EMAILS`: `juniordezzz@gmail.com`.
4. **Função.** Rodar `node central-rwa/supabase/functions/atlas-mcp/build.mjs`. Supabase → Edge Functions → criar `atlas-mcp` pelo editor → colar o conteúdo inteiro de `dist/index.ts` → Deploy. Em Settings da função, desligar **Verify JWT with legacy secret**.
5. **Site.** Publicar a branch no GitHub Pages para `pages/conectar-claude.html` existir.
6. **Conferir.** `curl -s https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/.well-known/oauth-authorization-server` devolve JSON com `issuer`.
7. **Claude.** claude.ai → Configurações → Conectores → Adicionar conector personalizado → URL `https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/mcp` → Conectar → entrar com Google → Permitir.
8. **Teste.** No celular: "quais são minhas carteiras no Atlas?" e "quanto eu tenho de PYTH somando tudo?". Os números precisam bater com o site.

Para atualizar: repetir o passo 4 com o bundle novo e clicar em Deploy updates.

## Se o Claude não achar o servidor de autorização

A função vive num subcaminho (`/functions/v1/atlas-mcp`). Clientes que só procuram `/.well-known/oauth-authorization-server` na raiz do domínio não chegam nela. Se a conexão falhar antes de abrir a página de login:

1. Conferir o passo 6.
2. Publicar o mesmo `dist/index.ts` no Deno Deploy (o handler não depende do Supabase para rotear: `rotaDe` aceita caminho na raiz), com os mesmos secrets e `ATLAS_MCP_BASE_URL` igual à URL do Deno Deploy. `SUPABASE_URL` e a chave de serviço continuam apontando para o Supabase, onde ficam as tabelas.
3. Trocar a URL do conector no Claude para `<url do Deno Deploy>/mcp`.
