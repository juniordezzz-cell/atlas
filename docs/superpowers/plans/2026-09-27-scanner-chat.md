# Scanner chat implementation plan

> Execute nesta sessão, com testes antes do código e revisão independente ao final.

**Goal:** Aba ampla e painel flutuante independentes com consultas locais verificáveis.
**Architecture:** Motor puro de consultas, controlador de conversa e adaptador do scanner. OpenRouter entra na etapa seguinte.
**Tech Stack:** JavaScript sem dependências, Node test runner, HTML/CSS existentes.
**Spec:** ../../scanner-pools-metodologia-ia.md

## Constraints
TVL >=100000; razão >0,50; decisões e corte de meme preservados. Sem chave, chamadas LLM ou consulta externa nesta etapa. Dados históricos diários sem horário fabricado.

## Task 1 — consultas
Files: assistente-dados.js, assistente.test.cjs, servidor.js.
- [ ] Escrever regressões para universo completo, cortes, metas com taxa percentual, favoritas e comparação diária, falta de histórico e falha parcial.
- [ ] Rodar node --test Ferramentas/scanner-pools/assistente.test.cjs e observar falha por funcionalidade ausente.
- [ ] Implementar ScannerConsultas.consultar(pergunta, contexto) e historicoDiario(sid), preservando datas.
- [ ] Rodar testes e corrigir diferenças.

## Task 2 — interface
Files: assistente-ui.js, assistente.css, index.html, assistente-regras.json.
- [ ] Montar aba Assistente e botão flutuante com mesma conversa, sem mensagem espontânea, texto renderizado por textContent.
- [ ] Conectar contexto a state.pools, trilhoDe, srv e histórico do scanner.
- [ ] Desabilitar envios durante consulta e informar erro/dados ausentes; consultas não alteram favoritos ou decisões.
- [ ] Verificar no navegador com fixture sintética, teclado, painel e aba compartilhados.

## Task 3 — documentação e verificação
- [ ] Documentar limites locais e integração seguinte no registro compartilhado e AGENTS.
- [ ] Incluir novos testes no CI; executar suíte JS e Python exigidas.
- [ ] Revisão independente, corrigir problemas e salvar commit.
