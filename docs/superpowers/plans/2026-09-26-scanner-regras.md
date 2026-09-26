# Scanner regras — plano de implementação

**Goal:** ampliar coleta e aplicar classificação, cortes e revisão por pool autorizados.
**Architecture:** coletor Python + sinais persistidos no Supabase; UI JS mantém decisões no navegador.
**Spec:** ../specs/2026-09-26-scanner-regras-design.md

1. Escrever e executar regressões de fronteira (0,50 e 2,00), memecoin por ID e dados incompletos.
2. Implementar classificação e categoria meme sem mudar o schema/valor interno `caca`.
3. Complementar descoberta por contrato com orçamento e deduplicação conservadora; testar fontes.
4. Escrever regressões JS: revisão por pool, refresh, ID entre fontes, rejeição e backup.
5. Implementar ✓/✕, rótulos, guia e persistência; manter migração das preferências antigas.
6. Rodar suites Python/JS, revisar diff, documentar resultados e limitações.
7. Publicar commit pelo conector GitHub; verificar SHA remoto e workflow.

Validação concluída: 151 testes Python passaram, 2 suites Postgres puladas no Windows;
7 testes Node passaram; 22 verificações na bateria HTML passaram. Revisão independente
concluída sem bloqueios importantes após correções. Publicação usa API do conector,
pois o gh local não tem sessão autenticada.
