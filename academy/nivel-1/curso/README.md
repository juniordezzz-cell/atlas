# Atlas Academy

Este é o **Nível 1** do Academy do ATLAS. Abra pelo site (menu Academy → Cursos → Nível 1, ou `academy/nivel-1/`), sempre por http. A página `academy/nivel-1/index.html` traz o menu e a marca do ATLAS e carrega este curso num iframe, para que o CSS do curso (Tailwind com preflight) não vaze para o site. A rota do curso (`#m6/labs`) aparece no endereço da página de fora.

Desde 20/10/2026, o menu lateral próprio do curso deu lugar a uma linha no topo com "Nível 1 › módulo ▾" (lista dos 10 módulos com ✓), atalhos para Glossário, Fontes e Notas e a busca. O estilo dessa linha está em `assets/css/atlas-embed.css`. A pasta `modules/` do original (redirecionamentos) não veio.

## Estudar

- Cada módulo mostra todos os tópicos. Os assuntos mais difíceis ficam no fim, em "Indo além (opcional)". O filtro Iniciante, Intermediário e Avançado foi removido em 20/10/2026.
- Use Aulas, Laboratórios, Infográficos, Avaliação e Fontes em qualquer módulo.
- Nas aulas do formato novo, os botões de "Termos desta aula" abrem a definição logo abaixo, sem sair da aula; "ver no Glossário →" leva à página do glossário.
- Blockchain tem 19 tópicos; DeFi tem 32. A comparação de crédito se refere explicitamente a Aave V3 e Compound III, com menções à diferença de Compound v2. Não representa cobertura de todas as versões de Aave.
- Os exemplos usam números hipotéticos e não são cotações. Cada gráfico novo inclui descrição e tabela. Os laboratórios originais foram preservados com rótulos de simulação.
- Notas, favoritos, avaliações e última posição ficam no armazenamento deste navegador. A conclusão exige uma tentativa perfeita na avaliação; leitura revisada é registrada separadamente.
- Exporte anotações em Recursos → Minhas anotações. Limpar dados do navegador pode apagar o progresso. Armazenamento de páginas locais depende do navegador; quando indisponível, os dados ficam apenas na sessão.
- O conteúdo e os laboratórios abrem sem internet; fontes externas exigem acesso à internet. Nenhuma carteira é conectada e nenhuma operação é enviada à rede.

## Organização

- `assets/js/course.js`: conteúdo editorial no formato antigo (`sections`), exemplos, avaliações, glossário e fontes.
- `assets/js/content/registry.js`: `AcademyContent.register`, que troca um módulo pelo formato novo (aulas em blocos) e soma fontes e termos.
- `assets/js/content/mN.js`: conteúdo de cada módulo no formato novo. Hoje só o `m1.js` (Criptografia) tem conteúdo.
- `assets/js/labs/mN.js`: laboratórios novos de cada módulo (`AcademyLabs.mN`).
- `assets/js/academy-render.js`: desenha a história, as aulas em blocos e a aba Infográficos do formato novo.
- `assets/js/modules.js`: templates dos dez laboratórios originais, sem repetir as aulas.
- `assets/js/main.js`: mecanismos dos laboratórios originais.
- `assets/js/academy.js`: navegação, progresso, acessibilidade estrutural, gráficos SVG e novos simuladores.
- `assets/css/style.css`: identidade e layout responsivo.
- `assets/css/legacy.css`: estilos necessários aos laboratórios preservados.
- `assets/css/aulas.css`: estilos dos blocos do formato novo (figura, analogia, dado, linha do tempo e Indo além).
- `assets/css/utilities.css`: estilos utilitários compilados localmente.
- `assets/vendor/`: Chart.js 4.4.8 e Lucide 0.468.0, versões fixadas. Fontes tipográficas usam fallbacks do sistema.

Fontes dos módulos antigos consultadas em 02/10/2026; nos módulos novos, cada dado traz a própria data. Links e versões podem evoluir; o material evita tratar parâmetros didáticos como valores atuais.

## Desenvolvimento e verificação

Com Node.js instalado, execute `npm install` e `npm test` dentro desta pasta (`node_modules/` fica fora do git). Para reconstruir o CSS utilitário, execute `npm run build:css`. Isso não é necessário para estudar: os arquivos prontos estão incluídos.

Os testes usam DOM simulado. São cinco arquivos em `tests/`: `academy.test.cjs`, `registry.test.cjs`, `render.test.cjs`, `content.test.cjs` (validador do conteúdo novo) e `labs-m1.test.cjs`. Eles verificam navegação, avaliações, persistência, matemática, segurança de interpolação e ciclo de gráficos com uma implementação simulada de Chart. Eles não substituem a validação visual em navegador real. A abertura automatizada de arquivos locais foi bloqueada pelo navegador da sessão de edição; por isso, a renderização em telas reais permanece sem validação.
