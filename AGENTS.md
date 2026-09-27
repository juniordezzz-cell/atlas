# Orientações para agentes

Antes de alterar o Scanner Pools, leia [as regras vigentes de 26/09/2026](docs/superpowers/specs/2026-09-26-scanner-regras-design.md) e [o registro de implementação](docs/scanner-pools-2026-09-26.md).
Para o chat independente, leia [a metodologia do assistente](docs/scanner-pools-metodologia-ia.md). Ele não é o Oráculo principal. Não inserir chaves no navegador; OpenRouter ainda não está integrado.

Estas regras foram pedidas diretamente pelo usuário e substituem a classificação
Sólidas/Caça e os pisos fixos da documentação de 23/09. `caca` permanece somente
como valor interno compatível com o banco; a interface diz Pendentes de análise.
Não reintroduza aprovações por símbolo, ausência de dados como prova de meme
ou falta de dados como aprovação de segurança. Preserve decisões por pool e backups.
Pedido posterior vigente: TVL >= US$ 100.000 é obrigatório na coleta e na tela,
inclusive em cache, pools manuais e aprovadas. O piso absoluto de volume continua removido.

Validação: `python -m pytest -q` em `central-rwa/backend` e
`node --test Ferramentas/scanner-pools/regras.test.cjs` na raiz.
