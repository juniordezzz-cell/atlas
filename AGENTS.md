# Orientações para agentes

Ditado do Oráculo: `core/atlas-oraculo-voz.js`, carregado pelo shell, só preenche rascunhos em português. Nunca enviar ou confirmar automaticamente ao reconhecer voz. Sem chave API do Atlas; depende de SpeechRecognition do navegador. Ver `docs/oraculo-voz.md` e validar com `node --test core/atlas-oraculo-voz.test.cjs`.

Antes de alterar o Oráculo nas Ferramentas, leia [o contrato de continuidade](docs/oraculo-ferramentas.md) e atualize-o na mesma PR quando mudar comportamento, estratégia, memória, integração ou implantação. O proprietário decidiu usar uma identidade visual única do Oráculo, com especializações e permissões separadas por ferramenta.
Antes de alterar o Scanner Pools, leia [as regras vigentes de 26/09/2026](docs/superpowers/specs/2026-09-26-scanner-regras-design.md), [o registro de implementação](docs/scanner-pools-2026-09-26.md) e [a metodologia do assistente](docs/scanner-pools-metodologia-ia.md). Não inserir chaves no navegador; OpenRouter está integrado por Edge Function Supabase. Consultar a auditoria de aplicação do método de 29/09/2026 no MD e o guia de implantação antes de alterar prompt/filtros. GitHub Pages não republica a função.

Estas regras foram pedidas diretamente pelo usuário e substituem a classificação
Sólidas/Caça e os pisos fixos da documentação de 23/09. `caca` permanece somente
como valor interno compatível com o banco; a interface diz Pendentes de análise.
Não reintroduza aprovações por símbolo, ausência de dados como prova de meme
ou falta de dados como aprovação de segurança. Preserve decisões por pool e backups.
Pedido posterior vigente: TVL >= US$ 100.000 é obrigatório na coleta e na tela,
inclusive em cache, pools manuais e aprovadas. O piso absoluto de volume continua removido.

Validação: `python -m pytest -q` em `central-rwa/backend` e
`node --test Ferramentas/scanner-pools/regras.test.cjs` na raiz.

Para operações internas do Oráculo, consulte [o contrato e exemplos](docs/oraculo-operacoes.md). Comandos de texto: motor determinístico sem API. Prints: consultar [contrato e implantação](docs/oraculo-imagem.md), com extração por IA e validação matemática local; nunca executar blockchain ou criar depósitos implícitos. Preservar prévia, confirmar/cancelar, carteira proprietária e histórico separado por ciclo. Validar com `node --test core/atlas-oraculo-operacoes.test.cjs`.

Histórico da aba DeFi/Pools: consultar [contrato e validação](docs/pools-historico-2026-09-29.md). Não inferir tokens finais a partir da entrada nem recalcular lucro de encerradas sem resumo preservado. O extrato de caixa e o resultado do ciclo são contas distintas.

Visual das Ferramentas (piloto de 15/10/2026): antes de mexer no fundo ou nos cards de `pages/ferramentas.html` ou das ferramentas, leia [o registro](docs/visual-ferramentas-2026-10-15.md). O cenário (`core/ui/atlas-cenario.*`, Paper Shaders) e os cards 3D (`core/ui/atlas-cards3d.js`, Atropos) valem só nas Ferramentas até o dono aprovar levá-los ao resto do site. Continua proibido glow/halo.
Repositórios de terceiros: o catálogo é [referencias/REPOSITORIOS.md](referencias/REPOSITORIOS.md). Trouxe, atualizou ou removeu um repositório? Atualize o catálogo no mesmo commit.

Conector MCP do Atlas (Claude lendo e, em fases seguintes, registrando operações): consultar [o contrato e a implantação](docs/atlas-mcp.md) antes de alterar `central-rwa/supabase/functions/atlas-mcp/`, `pages/conectar-claude.html` ou `js/conectar-claude.js`. O conector só acessa `atlas_users/{uid do token}`; nunca aceitar `uid` como parâmetro. Validar com `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs`.
