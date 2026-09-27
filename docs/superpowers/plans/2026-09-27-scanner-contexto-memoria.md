# Contexto, memória e avaliação do Scanner

Objetivo autorizado: manter contexto entre perguntas, usar preferências revisáveis e avaliar a aderência das respostas ao método. Interface visual permanece na estrutura atual.

## Contratos

- `ScannerConversa.historico(messages)` envia até seis mensagens anteriores, até 1.200 caracteres cada, somente papéis user/assistant; respostas antigas não são fonte de métricas atuais.
- `ScannerConversa.contextualizar(q,c,ids)` restringe referências explícitas a candidatas anteriores ao conjunto atual, sem recuperar pools removidas nem contornar os cortes.
- A Edge Function recebe o histórico validado, consulta preferências confirmadas e mantém o prompt do método como prioridade. Memória não altera regras obrigatórias, não executa código e não retreina pesos.
- Preferências são editadas pelo proprietário, com versão e possibilidade de remoção. Escolha de armazenamento consultada ao usuário antes da implementação dependente.
- Avaliação automatizada usa cenários de filtros, cálculos, contexto, memória e proteção. Resposta cortada pelo provedor é identificada; feedback do usuário registra aprovação/correção, não vira regra automaticamente.

## Etapas de execução

1. Criar testes Node que exijam histórico limitado e escopo das candidatas anteriores com métricas atuais; rodar e confirmar falha. Implementar módulo `assistente-conversa.js` e integrar API/UI.
2. Criar testes do handler que exijam rejeição de papéis privilegiados e história desmedida; confirmar falha. Implementar envio validado do histórico e instrução que proíbe reutilizar métricas antigas como atuais.
3. Implementar armazenamento de preferências escolhido pelo usuário com testes de persistência, isolamento por conta, limites e remoção. Integrar editor explícito à aba Assistente e contexto das consultas.
4. Criar cenários automatizados que avaliem regras obrigatórias, memória sem sobrepor metodologia, continuidade e corte do provedor. Rodar suites JS e PostgreSQL/CI; revisar código e documentar comportamento.
5. Publicar GitHub e atualizar a Edge Function; se gestão Supabase não estiver acessível, fornecer o código pronto e o passo exato de atualização ao proprietário. Nenhuma nova chave é necessária.
