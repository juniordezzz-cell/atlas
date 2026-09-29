# Oráculo nas Ferramentas — contrato de continuidade

Este é o ponto de partida para Codex, Claude Code e conversas futuras antes de mudar o Oráculo ou qualquer ferramenta. Ler também `AGENTS.md` e a documentação específica citada abaixo. Atualizar este arquivo na mesma PR de toda alteração de identidade, roteamento, memória, estratégia, chave, dados ou operação do Oráculo nas Ferramentas. Registrar **comportamento publicado, pendências e validação**, sem chamar código ainda não implantado de produção.

## Decisão do proprietário (29/09/2026)

Existe **um Oráculo** no Atlas inteiro: mesmo nome, avatar `assets/atena.webp`, balão, movimento e efeitos do componente `core/ui/atlas-shell.js`/`.css`. Em cada ferramenta ele atua como uma especialização contextual do mesmo Oráculo, semelhante a um subagente, sem criar outra identidade ou outro botão flutuante. Uma especialização só recebe os dados e ferramentas de sua área; não herda permissões de outra.

| Área | Especialização e dados | Motor e limite |
| --- | --- | --- |
| Páginas principais, DeFi e carteiras | Estado e operações internas do Atlas | `core/ui/atlas-shell.js`, `core/atlas-oraculo-operacoes.js`; comandos de texto determinísticos, com prévia e confirmação. Prints usam `oraculo-imagem`, separada. Ver `docs/oraculo-operacoes.md` e `docs/oraculo-imagem.md`. |
| Scanner Pools | Pools elegíveis do scanner, preferências confirmadas, decisões, notas e histórico disponível | `Ferramentas/scanner-pools/assistente-*.js` e função Supabase `scanner-chat`. O painel é o Oráculo global; análise de pools não executa operações. Modelo só interpreta e explica candidatas calculadas localmente. |
| Finanças | Painel global do Oráculo disponível | Ainda não existe adaptador que leia os dados locais de Finanças. Não alegar que ele já analisa receitas ou despesas. |
| Outras ferramentas | Mesmo painel quando integrado | Criar adaptador de contexto e testes próprios antes de prometer respostas especializadas. |

O roteamento é por intenção. Perguntas de pools no Scanner vão ao adaptador do scanner; comandos de abrir/fechar posições continuam no motor de operações. Respostas de uma especialização não modificam outra. Nenhum texto de pool, prompt ou modelo pode executar uma transação por si só.

## Chaves, memória e implantação

O navegador nunca guarda nem recebe chave privada de modelo. `scanner-chat` usa `SCANNER_OPENROUTER_API_KEY` no Supabase; o Oráculo por imagem tem integração própria; comandos de texto não exigem chave. Não confundir identidade visual única com chave única ou permissão única. A função `scanner-chat` autentica Firebase, restringe conta e cota e recebe apenas o recorte necessário. `GitHub Pages` publica HTML/JS/CSS; **não publica Edge Functions**. Para alterações em `central-rwa/supabase/functions/scanner-chat/`, seguir `docs/scanner-pools-openrouter-deploy.md` e confirmar deployment separadamente.

Preferências confirmadas ficam em `scanner.chat_memory` por UID Firebase; feedback não altera regras automaticamente. Favoritos e decisões por pool do Scanner ainda ficam no navegador e em backup. O JSON de estratégia pessoal define prioridades e cortes adicionais sem enfraquecer os pisos obrigatórios do scanner: TVL ≥ US$ 100 mil e razão de volume 24h/TVL > 0,50. Tokens favoritos são preferência, nunca aprovação ou garantia de lucro.

## Estado em 29/09/2026

- Correção de visibilidade: Scanner e Finanças não carregam `atlas-theme.css`; o Oráculo agora define os tokens visuais necessários dentro do próprio componente nas Ferramentas. Sem os tokens de espaçamento, o botão montava no DOM com `right`/`bottom` inválidos e ficava fora da área visível. A guia do Scanner passa a se chamar **Oráculo**; o identificador interno `assistente` permanece para preservar a navegação e o código existentes.
- PRs #3 e #4 publicaram o painel global no Scanner e nas páginas conectadas de Finanças; o botão independente do Scanner é omitido quando o painel global carrega. Barra móvel de Finanças não deve ser coberta.
- A Edge Function atual pode ainda conter o prompt anterior que se chamava assistente independente. O código-fonte do novo prompt está no repositório; verificar o deployment no Supabase antes de afirmar que a identidade do modelo está sincronizada.
- A pergunta global do Scanner ainda transmite no máximo 30 candidatas ao modelo. Qualquer seleção anunciada como global precisa pontuar todas as pools elegíveis **localmente antes** desse limite, registrar o total examinado e declarar os dados ausentes.
- Não há monitoramento recorrente por Codex: o proprietário desligou a automação para evitar consumo de tokens. O coletor GitHub Actions é independente deste chat.

## Estratégia pessoal em JSON (etapa iniciada em 29/09/2026)

`Ferramentas/scanner-pools/estrategia-pools.json` é o modelo inicial editável. Seus campos são `versao: 1`, `tvlMinUsd`, `volume24hMinUsd`, `razao24hMin`, `tokensFavoritos` e `maxResultados`. Inicia com TVL US$ 100 mil, sem piso absoluto extra de volume, razão > 0,50, SOL/UNI/BNB/WBNB como tokens favoritos e até oito resultados. Os números são proposta inicial, não uma alegação de preferência histórica confirmada além dos quatro tokens mencionados pelo proprietário. A conta salva uma cópia em `scanner.chat_memory.preferences.estrategia`; notas livres, redes e pares continuam no mesmo JSON de preferências. O usuário pode editar o bloco na aba do Oráculo no Scanner.

`assistente-dados.js` calcula a lista de oportunidades **sobre todas as pools elegíveis já carregadas**, antes de reduzir os resultados para o modelo. Aplica os pisos pessoais sem afrouxar os cortes obrigatórios, mantém pares explicitamente preferidos primeiro e usa nota, tokens favoritos e marca favorita para ordenar. `assistente-api.js` envia apenas a lista calculada e informa o total examinado. O modelo explica; não pesquisa pools fora do snapshot. Sem histórico comparável, a resposta não afirma crescimento de TVL ou volume em 12h. Construir esse sinal exige leitura e comparação temporal por pool, com teste de frescor, antes de incorporá-lo ao ranking.

**Implantação:** o site publica o JSON e a ordenação via GitHub Pages, mas salvar `estrategia` na conta e atualizar a instrução do modelo exige republicar `scanner-chat` no Supabase. A interface detecta uma função antiga que descarta o campo e avisa que a estratégia não foi confirmada. Não declarar sincronização de conta até verificar o round-trip após deploy.

**Estado verificado em 29/09/2026, após PR #5:** CI passou; GitHub Pages publicou `estrategia-pools.json` com SOL/UNI/BNB/WBNB e limite inicial de oito resultados. A publicação da Edge Function **não foi verificada nem executada** nesta sessão: não havia sessão/credencial de gestão Supabase disponível. A fonte canônica para o bundle do editor é `handler.mjs` + `Deno.serve(createHandler({env:Deno.env,fetcher:fetch}));`. Depois de implantar, salvar e recarregar o JSON pela conta para confirmar persistência.

## Regras de manutenção

1. Ler `docs/scanner-pools-metodologia-ia.md`, `docs/superpowers/specs/2026-09-26-scanner-regras-design.md` e `docs/scanner-pools-2026-09-26.md` antes de mudar seleção ou elegibilidade.
2. Escrever testes para filtros, ordenação, escopo de ferramenta, memória e ausência de dados; rodar as suítes JS do Scanner e da função, além da suíte Python quando tocar o coletor.
3. Atualizar este MD e `AGENTS.md` quando o contrato mudar. Marcar separadamente **código versionado**, **site publicado** e **função Supabase implantada**.
4. Links diretos para pools são uma etapa futura solicitada pelo proprietário; não inferir URL a partir do símbolo do par.
