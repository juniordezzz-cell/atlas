# Academy Nível 1 — formato novo de aula e Módulo 1 piloto · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar o formato novo de aula (blocos, abertura histórica, "Indo além", Infográficos) e escrever o Módulo 1 (Criptografia, começando pela cifra de César) completo nesse formato, para o dono aprovar antes dos outros 9.

**Architecture:** cada módulo novo vive em `assets/js/content/mN.js` e se registra em `AcademyContent.register(...)`, que o encaixa em `COURSE`/`SOURCES`/`GLOSSARY`. Módulos ainda não migrados seguem no formato antigo (`sections`) e continuam funcionando. `assets/js/academy-render.js` desenha os blocos. Laboratórios novos de cada módulo ficam em `assets/js/labs/mN.js`. Para as sessões paralelas futuras não mexerem no mesmo arquivo, as 10 tags de script e os 20 arquivos-esqueleto já existem desde o Task 1.

**Tech Stack:** JS puro (sem build), SVG inline, testes Node + jsdom 26.1.0.

**Spec:** [docs/superpowers/specs/2026-10-20-academy-nivel1-conteudo-design.md](../specs/2026-10-20-academy-nivel1-conteudo-design.md). Leia junto com [docs/academy-2026-10-20.md](../../academy-2026-10-20.md).

Raiz do curso, base dos caminhos abaixo: `academy/nivel-1/curso/` (= `C/`).
Para rodar os testes, o `jsdom` precisa estar acessível: rode `npm install` em `C/` (`node_modules/` já está no `.gitignore` do curso) ou use `NODE_PATH` apontando para um `node_modules` com `jsdom@26.1.0`.

## Global Constraints

- Público: **quem nunca mexeu com cripto**. Todo termo novo é explicado na primeira vez em que aparece.
- Português do Brasil, frases curtas.
- **Nenhum número sem fonte e data.** Na dúvida, o número sai.
- Sem recomendação de investimento e sem promessa de retorno.
- Imagens: **só SVG desenhado por nós**, inline. Nada de foto baixada, CDN ou imagem remota.
- Tudo funciona offline depois de carregado.
- Estilo dos componentes novos: o atual do curso (fundo escuro, azul `#60a5fa`/ciano `#67e8f9`, bordas `#2a3b55`, traço fino).
- Módulo migrado: abertura histórica com linha do tempo, **8 a 15 aulas principais**, "Indo além" opcional, **8 a 12 questões**.
- O progresso em `localStorage['atlas-academy-v1']` não se perde (concluídos, notas, `last`). Favoritos inválidos são descartados sem quebrar.
- Os testes existentes continuam passando, com exceção das checagens de nível, que saem junto com o filtro (Task 2).
- Commit em português, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, e `git push origin HEAD` logo depois (o branch é `docs/conector-mcp-design`; o upstream configurado tem outro nome, então não use o `git push` sem argumentos).

## Review Focus

1. **Favorito salvo no formato antigo de um módulo migrado** (`"m1-3"`): a página carrega, o favorito some da lista e nada quebra. Teste no Task 2.
2. **Usuário que já concluiu o M1 com a avaliação antiga de 3 questões:** continua "Concluído". A avaliação nova não apaga a conclusão. Teste no Task 2.
3. **Texto de bloco com `<`, `&` ou aspas** (ex.: "1 < 2", "P&D"): aparece como texto, sem virar HTML. Teste no Task 2.
4. **Cifra de César com acentos, cedilha, números e pontuação** ("Ação 2!"): letras acentuadas são normalizadas (Ã → A, Ç → C), números e pontuação passam intactos, e deslocamento negativo ou maior que 25 funciona. Teste no Task 4.
5. **Busca por palavra que só existe dentro de um bloco do formato novo** (ex.: "Suetônio"): acha a aula do M1. Teste no Task 2 (com fixture) e no Task 5 (com o conteúdo real).

---

### Task 1: Registro de conteúdo, esqueletos e carga nos testes

**Files:**
- Create: `C/assets/js/content/registry.js`
- Create: `C/assets/js/content/m1.js` … `m10.js` (esqueletos de uma linha: `/* Módulo N: ainda no formato antigo (course.js). */`)
- Create: `C/assets/js/labs/m1.js` … `m10.js` (esqueletos de uma linha iguais)
- Modify: `C/index.html`. Depois de `course.js`, nesta ordem: `content/registry.js`, `content/m1.js`…`m10.js`. Depois de `main.js`: `labs/m1.js`…`m10.js`. Todos com `defer`.
- Modify: `C/tests/academy.test.cjs`. Em vez da lista fixa de arquivos, carrega os `<script src>` de `index.html` que começam com `assets/`, na ordem em que aparecem.
- Test: `C/tests/registry.test.cjs` (novo)

**Interfaces:**
- Produces:
  - `AcademyContent.register(mod)`. Exige `mod.id` igual a um id já existente em `COURSE` (`m1`…`m10`), substitui aquele item de `COURSE` **no mesmo índice** e retorna o próprio `mod`. Antes de substituir:
    - para cada `[chave, [titulo, url, desc]]` de `mod.sources`, lança `Error('Fonte duplicada: '+chave)` se a chave já existir em `SOURCES`; se não existir, inclui a chave;
    - para cada `[termo, significado]` de `mod.glossary`, inclui `[termo, significado, mod.id]` em `GLOSSARY`, lançando `Error('Termo duplicado: '+termo)` se o termo já existir (comparação sem diferenciar maiúsculas e minúsculas).
  - `AcademyContent.isNew(m) → boolean`: verdadeiro quando `Array.isArray(m.lessons)`.
  - Formato de um módulo novo (usado pelos Tasks 2, 3 e 5):
    ```
    { id, title, icon, summary, minutes, goals:[str], flow:[str],
      history:{ intro:str, timeline:[{ when:str, title:str, text:str }] },
      lessons:[{ id:str /*kebab, único no módulo*/, title:str, optional:bool,
                 blocks:[Block], sources:[chaveSOURCES] }],
      quiz:[[pergunta, [respostas], indiceCerto, explicacao]],
      sources:{ chave:[titulo, url, descricao] },   // chaves com prefixo "m1."
      glossary:[[termo, significado]] }
    Block =
      {t:'p', text} | {t:'analogy', text} | {t:'example', text}
    | {t:'figure', svg, caption, alt}
    | {t:'data', text, source, date /*AAAA-MM-DD*/}
    | {t:'table', caption, headers:[str], rows:[[str]]}
    | {t:'summary', text} | {t:'terms', terms:[str]}
    ```
    `text` é texto puro. `**trecho**` vira negrito na hora de desenhar. O `svg` é marcação escrita por nós.
  - Variáveis globais `AcademyContent` e `AcademyLabs` (objeto vazio `{}` criado em `registry.js`).

- [ ] **Step 1: Escreva `tests/registry.test.cjs`** (jsdom, carregando `course.js` + `content/registry.js` como no teste existente):
  - `register({id:'m1', …mínimo válido, sources:{'m1.x':['T','https://e.x','d']}, glossary:[['Cifra','…']]})` → `COURSE[0].id==='m1'`, `AcademyContent.isNew(COURSE[0])===true`, `COURSE.length===10`, `SOURCES['m1.x'][0]==='T'` e `GLOSSARY.some(g=>g[0]==='Cifra'&&g[2]==='m1')`.
  - Registrar outro módulo com `sources:{'m1.x':…}` lança `/Fonte duplicada: m1.x/`.
  - Registrar com `glossary:[['colateral','…']]` lança `/Termo duplicado/` (`Colateral` já existe).
  - `register({id:'m99'})` lança.
- [ ] **Step 2:** rode `node tests/registry.test.cjs` em `C/`. Esperado: FALHA (`AcademyContent is not defined`).
- [ ] **Step 3:** implemente `registry.js`, crie os 20 esqueletos, inclua as tags em `index.html` e troque a carga em `academy.test.cjs`.
- [ ] **Step 4:** rode `node tests/registry.test.cjs && node tests/academy.test.cjs`. Esperado: os dois passam (o segundo com 371 verificações). Abra `http://localhost:8777/academy/nivel-1/?atlas-dev=1` e confira que não há erro no console.
- [ ] **Step 5:** commit `Academy: registro de conteúdo por módulo e esqueletos dos 10 módulos` e push.

### Task 2: Formato novo de aula no curso (renderizador, sem filtro de nível, Infográficos)

**Files:**
- Create: `C/assets/js/academy-render.js` (tag depois de `academy.js`, também com `defer`)
- Create: `C/assets/css/aulas.css` (link depois de `atlas-embed.css`)
- Modify: `C/assets/js/academy.js`: `lessons`, `enhance`, `dashboard`, `searchResults`, `saved`, `exportNotes`, `jump`, `bookmark`, `load`, `visuals`, `markStudied`. Remover `levelControl` e `setLevel`.
- Modify: `C/tests/academy.test.cjs` (tira os laços de nível e a checagem "todo módulo tem nível 1, 2 e 3")
- Test: `C/tests/render.test.cjs` (novo; registra um módulo fixture `m3` com 2 aulas, 1 opcional, e renderiza)

**Interfaces:**
- Consumes: `AcademyContent.isNew`, o formato de módulo do Task 1.
- Produces:
  - `AcademyRender.inline(text) → html`: escapa com a mesma regra de `academy.escape` e depois troca `**x**` por `<strong>x</strong>`.
  - `AcademyRender.block(b, m) → html`, com um caso para cada `t`:

    | `t` | Saída |
    |---|---|
    | `p` | `<p>` |
    | `analogy` | `<div class="aula-analogia"><strong>Pense assim</strong>…` |
    | `example` | `.example` existente, título "Exemplo com números" |
    | `figure` | `<figure class="aula-figura" role="group">` + svg com `role="img"` e `aria-label=alt` + `<figcaption>` |
    | `data` | `<p class="aula-dado">` com o texto, link da fonte e "consultado em DD/MM/AAAA" |
    | `table` | `<div class="table-scroll"><table class="chart-table comparison">` com `<caption>` |
    | `summary` | `<p class="aula-frase"><strong>Em uma frase</strong> …` |
    | `terms` | `<p class="aula-termos">`: botões que chamam `academy.term(nome)` |

  - `AcademyRender.lesson(m, lesson, i) → html`: um `<article id="lesson-${m.id}-${lesson.id}" class="lesson">` com título numerado, blocos, fontes (`source-inline`, como hoje) e o botão ☆ Salvar com a chave `${m.id}:${lesson.id}`.
  - `AcademyRender.history(m) → html`: `<section class="aula-historia">` com a introdução e um `<ol class="timeline">` de `when` / `title` / `text`.
  - `AcademyRender.figures(m) → html`: todas as figuras do módulo, cada uma com o título da aula de onde veio. Essa saída alimenta a aba Infográficos.
  - `academy.term(nome)`: navega para `glossary` e rola até o termo. Cada `<dt>` ganha `id="termo-"+slug`.
  - Chave de favorito: `"mN:licao-id"` nos módulos novos e `"mN-indice"` nos antigos. `load()` aceita as duas e descarta as que não resolvem para uma aula existente.
- Comportamento:
  - **Todos os módulos** (novos e antigos) mostram todas as aulas, sem filtro.
  - Módulo antigo: as `sections` com `s[1]===3` vão para o fim, sob o título "Indo além (opcional)".
  - Módulo novo: aparece primeiro `history`, depois as aulas com `optional:false` e, por fim, "Indo além (opcional)" com as `optional:true`.
  - O índice lateral (`lesson-toc`) lista "Como tudo começou", as aulas e "Indo além".
  - O selo de nível (`level-badge`) some. "Mostrando X de Y" sai.
  - A aba `infographics` passa a se chamar **"Infográficos"** e mostra `AcademyRender.figures(m)` seguido do que `visuals(m)` já desenha. O id `infographics` não muda.
  - No dashboard, o bloco "Uma trilha, três profundidades" vira um parágrafo curto, sem botões de nível.
  - A busca considera, nos módulos novos, o título da aula e o texto de todos os blocos com `text`, `caption` ou `title`.
  - `markStudied()` e o restante continuam iguais. `state.level` continua sendo salvo, mas não é lido.

- [ ] **Step 1: Escreva `tests/render.test.cjs`** com o fixture:
  - `AcademyRender.inline('1 < 2 & **forte**')==='1 &lt; 2 &amp; <strong>forte</strong>'`.
  - Depois de `app.navigate('m3')`: `#lesson-m3-a` existe, `.aula-historia .timeline li` tem o número de itens do fixture, a aula opcional fica depois do título "Indo além", e `.level-select` e `.level-badge` não existem.
  - `app.switchTab('infographics')` → `#tab-infographics .aula-figura` aparece, e o botão da aba tem o texto "Infográficos".
  - `localStorage` pré-carregado com `bookmarks:['m3-0','m3:a','m2-0']` e `completed:['m3']` → depois de `academy.load()`: `bookmarks` é `['m3:a','m2-0']` e `completed` contém `'m3'`.
  - `academy.query='palavraunica';app.navigate('search')` (com `palavraunica` só dentro de um `p` do fixture) → um resultado, e o botão abre `m3`.
  - Num bloco `figure` com `alt:'x'`: `svg[role=img][aria-label="x"]`.
- [ ] **Step 2:** rode `node tests/render.test.cjs`. Esperado: FALHA.
- [ ] **Step 3:** implemente `academy-render.js`, as mudanças em `academy.js` e o CSS de `aula-analogia`, `aula-figura`, `aula-dado`, `aula-frase`, `aula-termos`, `aula-historia` e `timeline`. A linha do tempo é vertical no celular e horizontal a partir de 1100px, com rolagem.
- [ ] **Step 4:** rode `node tests/render.test.cjs && node tests/registry.test.cjs && node tests/academy.test.cjs`. Esperado: todos passam. Abra um módulo antigo (`#m6`) no navegador e confira que não há filtro e que "Indo além" aparece no fim.
- [ ] **Step 5:** commit `Academy: formato novo de aula, sem filtro de nível, aba Infográficos` e push.

### Task 3: Validador de conteúdo (as regras do spec viram teste)

**Files:**
- Create: `C/tests/content.test.cjs` (carrega o curso como no `academy.test.cjs` e confere todo módulo em que `AcademyContent.isNew(m)`)

**Interfaces:**
- Consumes: formato do Task 1 e glossário mesclado.

- [ ] **Step 1: Escreva o teste.** Ele aplica estas regras a cada módulo novo, e cada falha cita o módulo e a aula:
  - `history.intro` não vazio; `history.timeline.length >= 3`;
  - aulas principais (`!optional`) entre 8 e 15; ids de aula únicos; `quiz.length` entre 8 e 12, com `indiceCerto` válido e explicação não vazia;
  - toda aula tem `sources.length >= 1`, todas as chaves existem em `SOURCES` e há pelo menos 1 bloco `summary`;
  - todo bloco `figure` tem `caption` e `alt` não vazios, e o `svg` começa com `<svg`, não contém `<script`, `on\w+=`, `href="http` nem `xlink:href="http`;
  - todo bloco `data` tem `source` existente em `SOURCES` e `date` em formato `^\d{4}-\d{2}-\d{2}$`;
  - todo nome em `terms` existe no glossário (sem diferenciar maiúsculas e minúsculas);
  - toda fonte nova (chave com prefixo `mN.`) tem url `https://`;
  - todo `t` de bloco está na lista do Task 1.
  - Se nenhum módulo for novo, imprime "nenhum módulo no formato novo ainda" e passa.
- [ ] **Step 2:** rode `node tests/content.test.cjs`. Esperado: PASSA com a mensagem "nenhum módulo no formato novo ainda" (o M1 ainda é esqueleto). Para provar que o teste pega erro, registre temporariamente um módulo com 1 aula, confira que FALHA citando "aulas principais", e desfaça.
- [ ] **Step 3:** inclua o comando em `package.json`: `"test": "node tests/academy.test.cjs && node tests/registry.test.cjs && node tests/render.test.cjs && node tests/content.test.cjs"`.
- [ ] **Step 4:** rode `npm test` (ou os 4 comandos com `NODE_PATH`). Esperado: tudo passa.
- [ ] **Step 5:** commit `Academy: validador de conteúdo do formato novo` e push.

### Task 4: Laboratórios do M1 (cifra de César e frequência de letras)

**Files:**
- Modify: `C/assets/js/labs/m1.js`
- Modify: `C/assets/js/academy.js`, em `extraLabs` e `initExtraLabs`: se `AcademyLabs[m.id]` existir, usa `AcademyLabs[m.id].html()` no lugar do texto padrão e chama `AcademyLabs[m.id].init()` ao abrir a aba. O lab de SHA-256 que já existe no M1 continua, depois dos novos.
- Test: `C/tests/labs-m1.test.cjs`

**Interfaces:**
- Produces:
  - `AcademyLabs.m1.normalize(text) → string`: tira os acentos via NFD (Ã → A, ç → c) e mantém a caixa.
  - `AcademyLabs.m1.caesar(text, shift) → string`: aplica `normalize` e desloca só A–Z e a–z, mantendo a caixa. O deslocamento é `((shift % 26) + 26) % 26`. Todo o resto passa intacto.
  - `AcademyLabs.m1.bruteForce(text) → [{shift, text}]`: 25 itens, deslocamentos de 1 a 25, cada um com `caesar(text, -shift)`.
  - `AcademyLabs.m1.frequencies(text) → {letra: proporção}`: só a–z depois de `normalize`, em minúsculas. A soma dá 1, ou o objeto vem vazio se não houver letras.
  - `AcademyLabs.m1.html()`, `AcademyLabs.m1.init()`. A interface tem três partes:
    - **Cifrar e decifrar:** campo de texto, deslocamento de 0 a 25 com valor inicial 3 e um botão para trocar entre cifrar e decifrar. A saída aparece ao vivo e mostra o alfabeto deslocado em duas linhas alinhadas.
    - **Quebrar por tentativa:** lista as 25 saídas.
    - **Contar letras:** barras em SVG com as 26 letras e uma tabela com os valores para leitor de tela.
    - Textos iniciais: `"Veni, vidi, vici"` (cifrar) e um parágrafo em português já cifrado com deslocamento 3 (quebrar e contar).

- [ ] **Step 1: Escreva `tests/labs-m1.test.cjs`:**
  - `caesar('ABC',3)==='DEF'`;
  - `caesar('xyz',3)==='abc'`;
  - `caesar('Ação 2!',3)==='Dfdr 2!'`;
  - `caesar(caesar('Veni, vidi, vici',29),-3)==='Veni, vidi, vici'`;
  - `bruteForce('DEF').length===25` e `bruteForce('DEF')[2].text==='ABC'`;
  - `frequencies('aab').a` ≈ 2/3;
  - `Object.keys(frequencies('123')).length===0`;
  - depois de `app.navigate('m1','labs')`, existe `#cesar-saida` com o texto `"Yhql, ylgl, ylfl"`.
- [ ] **Step 2:** rode o teste. Esperado: FALHA.
- [ ] **Step 3:** implemente `labs/m1.js` e o gancho em `academy.js`. Os ids de elementos levam o prefixo `cesar-` ou `freq-`, para não colidir com os laboratórios antigos.
- [ ] **Step 4:** rode o teste novo e `npm test`. Esperado: tudo passa. No navegador, confira na aba Laboratórios do M1 que o texto muda ao vivo ao mexer no deslocamento.
- [ ] **Step 5:** commit `Academy M1: laboratórios da cifra de César e da frequência de letras` e push.

### Task 5: Escrever o Módulo 1 completo

**Files:**
- Modify: `C/assets/js/content/m1.js`: `AcademyContent.register({id:'m1', …})`, substituindo o M1 de `course.js`.
- Modify: `C/assets/js/academy.js`, só se o `flow` do M1 mudar a ponto de quebrar `transactionStep`. Esperado: não muda.

**Interfaces:**
- Consumes: formato do Task 1, blocos do Task 2, regras do Task 3, labs do Task 4.

**Conteúdo exigido.** O texto exato fica com quem escreve. Os fatos precisam ser conferidos na fonte citada antes de entrar.
- `title: 'Criptografia'`. Mantenha `icon` e `id`. `summary` reescrito para leigo. `minutes` é a estimativa real de leitura (cerca de 200 palavras por minuto, mais 15 minutos de laboratórios).
- **history:** introdução sobre segredo e mensagem, e linha do tempo com pelo menos:
  - Júlio César e a cifra de deslocamento 3 (fonte: Suetônio, *Vida dos Doze Césares*);
  - al-Kindi e a análise de frequência (século IX);
  - a cifra de Vigenère (Bellaso, 1553, atribuída a Vigenère);
  - a máquina Enigma e Bletchley Park (Rejewski, Turing);
  - DES (1977);
  - Diffie e Hellman (1976) e RSA (1977);
  - SHA-256 (padrão do NIST, 2001);
  - Bitcoin (2008), que usa SHA-256 e assinatura ECDSA na curva secp256k1.
  Confira cada data. Se a data exata de algum item não puder ser confirmada, use o período em vez de inventar um ano.
- **Aulas principais, nesta ordem** (os títulos podem mudar):
  1. O que é criptografia: mensagem, segredo, chave.
  2. A cifra de César. Figura obrigatória: dois alfabetos alinhados com seta de deslocamento 3. Aponta para o laboratório.
  3. Por que César caiu: força bruta (25 tentativas) e análise de frequência. Figura: barras de frequência calculadas com `AcademyLabs.m1.frequencies` sobre um texto de amostra em português citado. O rótulo diz "amostra", não "frequência oficial do português".
  4. Vigenère: a chave vira uma palavra. Figura: tabela pequena cifrando uma palavra.
  5. Máquinas e computadores: Enigma, Turing e o começo da criptografia moderna.
  6. Criptografia simétrica hoje (AES) e o problema de combinar a chave. Figura: duas pessoas e a mesma chave.
  7. Chave pública e chave privada. Analogia do cadeado aberto ou da caixa de correio. Figura.
  8. Hash: a impressão digital dos dados. Use o conteúdo atual como base. Figura: entradas parecidas, saídas totalmente diferentes, com exemplos reais de SHA-256 gerados com `crypto.subtle` e conferidos.
  9. Assinatura digital: provar que foi você sem mostrar a chave. Figura do fluxo assinar e verificar.
  10. Da chave privada ao endereço da carteira. Figura com a direção única chave privada → chave pública → endereço.
  11. Frase de recuperação: o que é, por que quem tem as palavras tem o dinheiro, e golpes comuns. Tabela com o que fazer e o que não fazer.
  12. O que a criptografia faz e não faz nas criptomoedas: a blockchain é pública, saldos são visíveis e a criptografia prova a autorização, não esconde o saldo. Tabela comparativa.
- **Indo além (optional):** árvores de Merkle (conteúdo atual), computação quântica e assinaturas (só o que as fontes sustentam, sem previsão de data) e "domínio da assinatura" (conteúdo atual).
- Cada aula principal tem pelo menos um `analogy` ou `example`, um `summary` e `terms` quando apresenta termo novo.
- **Quiz:** 10 questões cobrindo as aulas principais, com explicação. Inclua pelo menos uma de cifrar uma palavra curta em César.
- **Fontes:** reaproveite `hash` e as já existentes. Novas, com prefixo `m1.`: NIST FIPS 197 (AES), Diffie-Hellman 1976 ("New Directions in Cryptography"), RSA (paper de 1978 na CACM), NIST FIPS 186 (assinaturas), BIP-39 (frase de recuperação), Bitcoin whitepaper (já existe como `bitcoin`), e uma referência de história (Suetônio ou uma enciclopédia com URL estável). Sempre a URL oficial ou de arquivo estável.
- **Glossário:** termos novos sem duplicar os existentes, entre eles Cifra, Chave, Criptografia simétrica, Criptografia assimétrica, Chave pública, Chave privada, Assinatura digital, Frase de recuperação, Força bruta, Análise de frequência e Endereço.
- **Pense no leitor:** quem nunca ouviu "blockchain". O M1 pode citar blockchain e carteira só com uma explicação de uma linha e apontando para o M2 e o M3.

- [ ] **Step 1:** pesquise e confira cada fato e data da lista, anotando a fonte de cada um num rascunho na pasta de rascunhos da sessão (fora do repositório).
- [ ] **Step 2:** escreva `content/m1.js` com as figuras SVG (largura de `viewBox` até 720 e texto de pelo menos 12px na escala do celular).
- [ ] **Step 3:** rode `npm test`. Esperado: tudo passa, e `content.test.cjs` agora valida o M1 de verdade. Corrija até passar.
- [ ] **Step 4:** abra `http://localhost:8777/academy/nivel-1/#m1/content?atlas-dev=1` em 1280px e em 375px. Confira as figuras legíveis, a linha do tempo, "Indo além", a aba Infográficos com todas as figuras e a busca por "Suetônio" achando a aula. Tire um screenshot de cada.
- [ ] **Step 5:** commit `Academy M1: Criptografia reescrita para leigo, da cifra de César ao endereço` e push.

### Task 6: Revisão independente do M1, registro e parada para o dono

**Files:**
- Modify: `C/assets/js/content/m1.js` (correções)
- Modify: `docs/academy-2026-10-20.md`: nova seção "Formato novo de aula (Task 1–5)" com os arquivos, como escrever um módulo novo (copiar a estrutura do M1) e como rodar os testes.
- Modify: `C/README.md` (a seção "Organização" ganha `content/`, `labs/` e `academy-render.js`)

- [ ] **Step 1:** um revisor separado, que não escreveu o módulo, lê `content/m1.js` e reporta:
  - (a) erros factuais ou de data, conferindo nas fontes citadas;
  - (b) termos usados antes de serem explicados;
  - (c) números sem fonte e data;
  - (d) frases que um leigo não entenderia.
- [ ] **Step 2:** corrija os achados e rode `npm test`. Esperado: tudo passa.
- [ ] **Step 3:** atualize a documentação, faça o commit `Academy M1: revisão de fatos e linguagem; registro do formato novo` e o push.
- [ ] **Step 4: Pare.** Mostre ao dono o M1 no navegador (screenshots da história, de uma aula com figura e do laboratório da cifra de César) e peça a aprovação do estilo. Os módulos 2 a 10 só começam depois do "sim" dele, cada um com o seu plano curto, como manda o spec.
