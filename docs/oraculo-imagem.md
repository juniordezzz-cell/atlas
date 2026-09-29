# Oráculo por imagem — 29/09/2026

## Contrato vigente

Registra somente operações internas do Atlas. Não conecta carteira ou protocolo. Não altera o assistente do Scanner.

1. Anexar ou colar um print no Oráculo. A imagem é enviada ao OpenRouter somente nessa solicitação.
2. Explicar os campos visíveis e apresentar dúvidas. Ausência de informação não autoriza inventar valores.
3. Primeiro `sim`: confirmar a leitura. Escolher a carteira existente.
4. Apresentar resumo com capital, tokens, quantidades, protocolo/rede e faixa com unidade.
5. Segundo `sim`: revalidar saldo e dados e registrar a pool, debitando caixa uma vez.

Mensagens durante a leitura não são aprovações e não ficam enfileiradas. Corrigir a leitura exige nova confirmação. Rating 6% significa -6%/+6%. Capital explícito e capital calculado incompatíveis bloqueiam o registro. Não criar depósito para cobrir caixa insuficiente.

`Monta igual, depois ajustamos` salva um rascunho, sem pool ativa ou movimento de caixa. Rascunhos aparecem em DeFi/Pools e podem ser retomados, corrigidos ou excluídos. Persistência local por UID, incluída nos backups Atlas; máximo 20, sem apagar antigos automaticamente. A imagem não é armazenada. Pendências precisam ser resolvidas antes do registro; a confirmação de revisão não preenche campos ausentes.

Swaps por imagem e reconciliação de carteira ainda não fazem parte desta etapa. Texto mantém o motor anterior.

## Implantação manual no Supabase

GitHub Pages publica a interface, mas não publica Edge Functions.

1. No mesmo projeto Supabase do Scanner: Edge Functions → criar via editor.
2. Criar função `oraculo-imagem`, com um único `index.ts` contendo o arquivo consolidado entregue. Ele reúne schema e handler, sem imports locais adicionais.
3. Publicar. Em Settings, desligar **Verify JWT with legacy secret** e salvar. O handler valida o token Firebase, e-mail verificado e usuário autorizado.
4. Reutiliza o secret existente `SCANNER_OPENROUTER_API_KEY`; não inserir chave no arquivo ou GitHub. Não exige nova migração SQL: reutiliza `scanner_chat_reserve`.
5. Entrar no Atlas, atualizar a página e testar uma imagem real; conferir a prévia antes de confirmar.

Limite compartilhado de 20 consultas por usuário/dia com o Scanner. Modelo `openrouter/free`; disponibilidade e suporte visual dependem do provedor escolhido. Erros não alteram caixa. A chave permanece no servidor. Imagens PNG/JPEG/WebP são redimensionadas no navegador e enviadas ao provedor; não anexar informação que não queira compartilhar com ele.

## Arquitetura e validação

Schema compartilhado: `core/atlas-oraculo-imagem-schema.mjs`. Estado/rascunhos: `core/atlas-oraculo-imagem-fluxo.js`. Cliente: `core/atlas-oraculo-imagem.js`. Gateway isolado: `central-rwa/supabase/functions/oraculo-imagem/`.

Testes cobrem confirmação em duas etapas, saldo insuficiente, campos incertos, rascunhos sem movimento, retomada, mensagens antecipadas, autenticação, quota e saída inválida. Integração de navegador usa gateway simulado; não comprova precisão da leitura de prints reais. Validar OCR após publicar a função.
