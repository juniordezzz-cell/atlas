# Bancada de Ferramentas: migração das 8 calculadoras para o ATLAS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer as 8 ferramentas da pasta `C:\Users\junio\Desktop\ferramentas` para `Ferramentas/<slug>/` do ATLAS, sem nenhum vestígio do MundoDeFi, com o layout, o login, a rede e o cenário do ATLAS, cards com capa na página Ferramentas, e publicar no GitHub.

**Architecture:** Cada ferramenta vira uma pasta própria em `Ferramentas/`, no mesmo padrão da Calculadora de Market Cap: `index.html` com login obrigatório, cenário e `estilo.css`; contas puras em módulo testado no Node. As contas que as calculadoras dividem (juros, staking, IL, lucro, câmbio, liquidação) ficam num módulo comum, `Ferramentas/_comum/calculos.js`, e o visual comum em `Ferramentas/_comum/ferramenta.css`. Escada e Estratégia de Pool continuam saindo de uma fonte única (`Ferramentas/_fonte-quadro/`) pelo `build.js`, agora com saída em `Ferramentas/escada-dca/index.html` e `Ferramentas/estrategia-de-pool/index.html`.

**Tech Stack:** HTML/CSS/JS puro, sem build (exceto o `build.js` do quadro, rodado à mão), `node --test` (Node 24), Chart.js de `assets/vendor/chart-4.4.1.min.js`, rede só por `AtlasHttp` (`core/http.js`), servidor `atlas` do `.claude/launch.json` (porta 8777, `?atlas-dev=1` em localhost).

**Spec:** não há documento separado. As decisões do dono estão na seção abaixo, tiradas da conversa de 07–08/11/2026. A origem é a pasta `Desktop/ferramentas`, já melhorada na rodada de 07/11 (Câmbio dentro do Conversor, Pool de Liquidez dentro da Estratégia de Pool, inflação/meta/CDI no Juros, imposto no Lucro, rendimento real no Staking).

## Decisões do dono

1. A pasta `Desktop/ferramentas` entra no ATLAS. **Tudo que for do MundoDeFi sai**: marca, links do site, PRO/planos, login Nexus, Firebase do site, catálogo e prévias do site, SEO do site.
2. As ferramentas ganham o **layout do ATLAS** e entram no **menu Ferramentas** (`pages/ferramentas.html`) com **capa**.
3. **Capas:** o dono gera no ChatGPT com os prompts da Task 11 e manda as imagens; até lá o card usa uma capa provisória.
4. **IMD fica para depois.** Não entra neste plano (depende do Firebase e do painel do MundoDeFi).
5. Depois de tudo no ATLAS e testado, a pasta `Desktop/ferramentas` vai para a **Lixeira**.
6. **Subir no GitHub** (`origin` = `juniordezzz-cell/atlas`, GitHub Pages publica a `main`).
7. Ferramentas que já existem no ATLAS e ficam como estão: **Finanças** (`Ferramentas/entradas-saidas/`, era "Entradas e saídas"), **Scanner Pools** e **Calculadora de Market Cap**. Nenhuma das 8 repete uma delas; a Estratégia de Pool é complementar ao Scanner (um acha a pool, o outro planeja a faixa).

## Global Constraints

- Pasta `Ferramentas/` com F maiúsculo (o GitHub Pages diferencia maiúsculas). Slugs em minúsculas com hífen: `escada-dca`, `estrategia-de-pool`, `conversor`, `juros-compostos`, `lucro-cripto`, `staking`, `comparador-de-ativos`, `simulador-de-trade`.
- Toda página nova carrega no `<head>`: `../../themes/atlas-fonts.css`, `../../core/ui/atlas-shell.css`, `../../core/atlas-auth.js`, `../../core/atlas-secure.js`, `../../core/ui/atlas-cenario.css?v=5` e `<script type="module" src="../../core/ui/atlas-cenario.js?v=3">`; no fim do `<body>`, `../../core/ui/atlas-shell.js`. Copiar a ordem de `Ferramentas/calculadora-market-cap/index.html`.
- Cabeçalho igual ao da Calculadora: `<a class="voltar" href="../../pages/ferramentas.html">← Ferramentas</a>`, `<h1>` com a segunda palavra em `<span>`, `<p class="sub">` e `<p class="estudo">Simulação para estudo. Não é recomendação de investimento e não usa os dados da sua carteira.</p>`.
- `<title>`: `<Nome> — ATLAS`. Sem `og:*`, `twitter:*`, `canonical`, `keywords`, `ld+json`.
- **Nenhuma ocorrência** de `mundodefi`, `MundoDeFi`, `mundo defi`, `Nexus`, `nexus-auth`, `pro-gate`, `data-mdf`, `planos.html`, `cryptotrack`, `PRO` como plano pago, nem fontes do Google. Conferido pelo comando da Task 12.
- Rede só por `AtlasHttp.getJSON(url, { ttl })` ou pelos provedores de `core/providers/` (`coingecko`, `binance`, `defillama`). Nenhum `fetch(` direto em código das ferramentas. **Nenhuma chave de API no navegador** (sai a chave da Twelve Data do Comparador).
- Sem CDN: Chart.js de `../../assets/vendor/chart-4.4.1.min.js`; fontes Inter e JetBrains Mono do `atlas-fonts.css`.
- Visual sereno (spec de 18/09): sem glow/halo, sem grade, sem spotlight, sem HUD. Paleta da Calculadora de Market Cap: `--bg:#0a0e17; --panel:#111723; --line:#1e2735; --txt:#e6ecf5; --mut:#7d8aa0; --mut2:#556074; --accent:#5b8cff; --green:#2ec785; --amber:#f5b942; --red:#f0556a`.
- Textos em português do Brasil, números no formato brasileiro. Todo texto vindo de API passa por escape antes de `innerHTML` (ou entra por `textContent`).
- `localStorage` só com prefixo `atlas.<slug>.` (ex.: `atlas.conversor.cambio.v1`). As chaves antigas `mdf:*` e `qpm:*` não são lidas.
- Regex só pelo Edit/Write, nunca gerada por script de shell.
- Cada tarefa termina com a página aberta em `http://localhost:8777/Ferramentas/<slug>/index.html?atlas-dev=1`, sem erro no console, a 1280 px e a 375 px sem rolagem horizontal.
- Não incluir nos commits as mudanças que já estavam soltas no repositório: `.claude/settings.local.json`, `Ferramentas/scanner-pools/index.html`, `portfolio-cripto.html`. Adicionar arquivos sempre pelo caminho, nunca `git add -A`.

## Review Focus

1. **API de cotação fora do ar ou no limite (429):** a ferramenta continua usável com a última cotação guardada e diz de quando ela é; sem cotação nenhuma, os campos aceitam preço digitado. Testado no navegador nas Tasks 4–10, com `AtlasHttp.clearCache()` e a rede bloqueada pelo DevTools.
2. **Número digitado no formato brasileiro** (`1.000`, `0,5`, `10.000,50`): a conta usa o valor que a pessoa quis dizer, nos campos de texto de todas as ferramentas. Teste `lerNumero` na Task 2.
3. **Abrir sem login:** toda página nova manda para `pages/login.html`. Checado na Task 12 abrindo cada URL sem `?atlas-dev=1`.
4. **Celular (375 px):** nenhuma página com rolagem horizontal; o Simulador e os quadros com gráfico empilham as colunas. Checado em cada tarefa e na varredura da Task 12.
5. **Visitante que já usava as versões antigas:** nada quebra por dado guardado com chave antiga; as chaves novas começam vazias. Coberto pela regra de prefixo e pela busca da Task 12.

---

## File Structure

```
Ferramentas/
  _comum/
    calculos.js            contas puras (ex-ferramentas-core.js) + lerNumero; window.AtlasCalculos e module.exports
    calculos.test.cjs      node --test, porta dos 176 testes de testes/teste-core.js + lerNumero
    ferramenta.css         visual comum das calculadoras (tokens, cabeçalho, campos, botões, toggle, resultados, tabelas, gráfico)
  _fonte-quadro/           quadro-src.html, build.js, snap.json (fonte única de Escada e Estratégia de Pool)
  escada-dca/index.html            gerado pelo build.js
  estrategia-de-pool/index.html    gerado pelo build.js
  conversor/index.html, app.js, estilo.css
  juros-compostos/index.html, app.js, estilo.css
  lucro-cripto/index.html, app.js, estilo.css
  staking/index.html, app.js, estilo.css
  comparador-de-ativos/index.html, app.js, estilo.css
  simulador-de-trade/index.html, app.js, estilo.css
assets/ferramentas/card-<slug>.svg   capas provisórias (Task 11)
assets/ferramentas/card-<slug>.webp  capas finais, quando o dono mandar
pages/ferramentas.html               novas seções e cards
css/ferramentas.css                  só se as seções novas pedirem ajuste
sw.js                                VERSAO nova + nota
.github/workflows/ferramentas-calculos.yml   roda node --test Ferramentas/_comum/*.test.cjs
docs/ferramentas-bancada-2026-11-08.md       registro para quem mexer depois
AGENTS.md, CLAUDE.md                 uma linha apontando para o registro
```

Em cada ferramenta, `app.js` é o script inline da página de origem, movido para arquivo, com a rede trocada por `AtlasHttp` e as contas chamando `AtlasCalculos`. `estilo.css` guarda só o que for da ferramenta; o resto vem de `ferramenta.css`.

---

### Task 1: Ramo de trabalho e cópia de origem

**Files:**
- Create: `Ferramentas/_origem-mdf/` (cópia temporária de `Desktop/ferramentas`, apagada na Task 12)
- Modify: `.gitignore` (linha `Ferramentas/_origem-mdf/`)

- [ ] **Step 1:** `git switch -c ferramentas-bancada` a partir da `main` atualizada (`git pull --ff-only`). As mudanças soltas do dono continuam soltas; não fazer stash.
- [ ] **Step 2:** Copiar `C:\Users\junio\Desktop\ferramentas` inteira para `Ferramentas/_origem-mdf/` (sem `.claude/` e sem `imd/`). É a matéria-prima das Tasks 2–10; nunca é publicada.
- [ ] **Step 3:** Acrescentar `Ferramentas/_origem-mdf/` ao `.gitignore` e confirmar com `git status --short` que a pasta não aparece.
- [ ] **Step 4:** Commit `Ferramentas: ramo da bancada e origem ignorada` (só `.gitignore`).

### Task 2: Contas comuns testadas (`_comum/calculos.js`)

**Files:**
- Create: `Ferramentas/_comum/calculos.js` (a partir de `_origem-mdf/comum/ferramentas-core.js`)
- Create: `Ferramentas/_comum/calculos.test.cjs` (a partir de `_origem-mdf/testes/teste-core.js`)
- Create: `.github/workflows/ferramentas-calculos.yml`

**Interfaces:**
- Produces: `window.AtlasCalculos` (e `module.exports` no Node) com as funções que já existem, mesmos nomes e retornos: `anualParaMensal`, `mensalParaAnual`, `aprParaApy`, `apyParaApr`, `jurosCompostos`, `valorFuturo`, `staking`, `impermanentLossPct`, `pool`, `lucroOperacao`, `janelaComum`, `retornoDesde`, `variacaoEmJanela`, `valorEmDolar`, `converterMoeda`, `precoLiquidacao`, `limiteLiquidacaoPct`, `trade`. Novas: `lerNumero(texto: string) -> number|null`, `impostoCripto({ lucroBRL, vendasMesBRL, custodia: 'br'|'ext' }) -> { imposto: number, isento: boolean, aliquota: number }`, `precoEmpate(precoCompra: number, taxaPct: number) -> number|null`.

- [ ] **Step 1: Portar os testes para `node:test`.** Cada `eq(nome, real, esperado, tol)` vira `test(nome, () => assert.ok(Math.abs(real - esperado) <= tol))` com os mesmos valores esperados. Acrescentar:

```js
test('lerNumero aceita formato brasileiro', () => {
  assert.equal(C.lerNumero('1.000'), 1000);
  assert.equal(C.lerNumero('0,5'), 0.5);
  assert.equal(C.lerNumero('10.000,50'), 10000.5);
  assert.equal(C.lerNumero('R$ 2.500'), 2500);
  assert.equal(C.lerNumero(''), null);
  assert.equal(C.lerNumero('abc'), null);
});
test('impostoCripto', () => {
  assert.deepEqual(C.impostoCripto({ lucroBRL: 10000, vendasMesBRL: 35000, custodia: 'br' }), { imposto: 0, isento: true, aliquota: 0 });
  assert.equal(C.impostoCripto({ lucroBRL: 136812.5, vendasMesBRL: 412500, custodia: 'br' }).imposto.toFixed(2), '20521.88');
  assert.equal(C.impostoCripto({ lucroBRL: 6e6, vendasMesBRL: 9e6, custodia: 'br' }).imposto, 5e6 * 0.15 + 1e6 * 0.175);
  assert.equal(C.impostoCripto({ lucroBRL: 1000, vendasMesBRL: 2000, custodia: 'ext' }).imposto, 150);
  assert.equal(C.impostoCripto({ lucroBRL: -500, vendasMesBRL: 90000, custodia: 'br' }).imposto, 0);
});
test('precoEmpate', () => {
  assert.equal(C.precoEmpate(50000, 0.1).toFixed(1), '50100.1');
  assert.equal(C.precoEmpate(10, 0), 10);
  assert.equal(C.precoEmpate(10, 100), null);
});
```

- [ ] **Step 2:** `node --test Ferramentas/_comum/calculos.test.cjs` → FALHA (módulo não existe).
- [ ] **Step 3:** Criar `calculos.js` com o conteúdo de `ferramentas-core.js`, trocando o nome global para `AtlasCalculos` e tirando os comentários que citam o site/portfólio do MundoDeFi. Implementar as três funções novas com as regras do Lucro Cripto de 07/11 (isenção até R$ 35.000 de vendas no mês para `br`; faixas 15% até R$ 5 mi, 17,5% até 10 mi, 20% até 30 mi, 22,5% acima; `ext` = 15% sem isenção; `precoEmpate = compra × (1+t)/(1−t)`, `null` se `t ≥ 1`). `lerNumero`: tira tudo que não for dígito, `,`, `.` ou `-`; se houver vírgula, os pontos são milhar e a vírgula é decimal; sem vírgula, ponto seguido de exatamente 3 dígitos é milhar.
- [ ] **Step 4:** `node --test Ferramentas/_comum/calculos.test.cjs` → todos passam (176 portados + 3 novos).
- [ ] **Step 5:** Workflow `ferramentas-calculos.yml` igual ao `central-rwa-tests.yml` (Node 24, gatilho em push/PR que toque `Ferramentas/_comum/**`), rodando `node --test Ferramentas/_comum/*.test.cjs`.
- [ ] **Step 6:** Commit `Ferramentas: contas comuns testadas (juros, staking, IL, lucro, imposto, câmbio)`.

### Task 3: Visual comum (`_comum/ferramenta.css`)

**Files:**
- Create: `Ferramentas/_comum/ferramenta.css`

**Interfaces:**
- Produces, para as Tasks 5–10: tokens da paleta (Global Constraints) em `:root`; classes `.wrap` (max 1080 px), `.top`, `.voltar`, `.sub`, `.estudo`, `.campo` (label + input/select), `.grade2` (2 colunas, 1 coluna abaixo de 560 px), `.btn` e `.btn--principal`, `.toggle` com `button[aria-selected="true"]`, `.resultados` (grade auto-fit `minmax(200px,1fr)`), `.res` com `.res__rotulo`, `.res__valor`, `.res__nota` e variantes `.res--destaque`, `.res--bom`, `.res--ruim`, `.tabela` (rolagem horizontal própria), `.grafico` (altura 240 px), `.explica` (texto educativo), `.aviso` (âmbar), `.num` (mono tabular), `[hidden]{display:none!important}`.

- [ ] **Step 1:** Escrever o CSS partindo de `Ferramentas/calculadora-market-cap/estilo.css` (cabeçalho, campos, abas) e cobrindo as classes acima. Sem `box-shadow` colorido, sem `text-shadow`, sem gradiente animado.
- [ ] **Step 2:** Página de prova `Ferramentas/_comum/amostra.html` (não linkada; apagada no Step 4) com uma instância de cada classe; abrir a 1280 e a 375 px e conferir legibilidade e ausência de rolagem horizontal.
- [ ] **Step 3:** Conferir com o cenário ligado (as duas linhas do cenário na amostra) que os painéis continuam legíveis sobre o fundo animado.
- [ ] **Step 4:** Apagar a amostra. Commit `Ferramentas: visual comum das calculadoras`.

### Task 4: Escada e Estratégia de Pool no ATLAS

**Files:**
- Create: `Ferramentas/_fonte-quadro/quadro-src.html`, `build.js`, `snap.json` (de `_origem-mdf/_fonte-quadro/`)
- Create (gerados): `Ferramentas/escada-dca/index.html`, `Ferramentas/estrategia-de-pool/index.html`

**Interfaces:**
- Consumes: `AtlasHttp.getJSON` (`core/http.js`).
- Produces: links `../../Ferramentas/estrategia-de-pool/index.html` e `../../Ferramentas/scanner-pools/index.html` usados entre as duas.

- [ ] **Step 1:** `build.js` passa a gravar em `../escada-dca/index.html` e `../estrategia-de-pool/index.html` (caminhos relativos a `_fonte-quadro`).
- [ ] **Step 2:** No `quadro-src.html`: trocar o `<head>` pelo padrão dos Global Constraints (com `../../`), tirar as fontes do Google e usar `Inter`/`JetBrains Mono` nas variáveis de fonte; incluir `../../core/http.js` antes do script principal.
- [ ] **Step 3:** O quadro tem **um** ponto de rede (a função que envolve `fetch`). Ela passa a chamar `AtlasHttp.getJSON(url, { ttl })` com `ttl` de 60 s para preços, 5 min para velas e 30 min para `yields.llama.fi`. O lado "sem rede" continua usando o `snap.json` embutido.
- [ ] **Step 4:** Paleta: mapear as variáveis de cor do quadro para os tokens do ATLAS (fundo, painel, linha, texto, acento `#5b8cff`); cores das linhas do gráfico (máxima/mínima/médio/pool) ficam, desde que sem glow. Cabeçalho com `voltar`, `sub` e `estudo`.
- [ ] **Step 5:** Chaves de `localStorage`: prefixo `qpm:` vira `atlas.quadro.` (favoritos comuns) e `atlas.escada.`/`atlas.pool.` (cenários).
- [ ] **Step 6 (melhoria):** Na Estratégia de Pool, uma linha no topo: "Procurando uma pool? Abra o **Scanner Pools**." com link; na Escada, depois do resultado de Venda, link para o **Lucro Cripto** com o preço médio no endereço (`?compra=<preço>`; o Lucro lê esse parâmetro na Task 7).
- [ ] **Step 7:** `node Ferramentas/_fonte-quadro/build.js` e abrir as duas páginas: gráfico com dados reais, 500 tokens na busca, troca de tempo gráfico, estratégia Faixa cheia (V2), Replay, sem erro no console, 375 px sem rolagem horizontal.
- [ ] **Step 8:** Commit `Ferramentas: Escada (DCA) e Estratégia de Pool no layout do ATLAS`.

### Task 5: Conversor e Câmbio

**Files:**
- Create: `Ferramentas/conversor/index.html`, `app.js`, `estilo.css` (de `_origem-mdf/conversor.html`)

**Interfaces:**
- Consumes: `AtlasCalculos.converterMoeda`, `AtlasCalculos.valorEmDolar`, `AtlasCalculos.lerNumero`; provedor `coingecko` (`search`, `pricesRaw`, `chart`) e `AtlasHttp.getJSON`.

- [ ] **Step 1:** HTML no padrão do ATLAS: cabeçalho, os dois modos (Moeda ⇄ Cripto / Moeda ⇄ Moeda), conversor, gráfico, estatísticas, tabelas, conversões populares e uma `.explica` curta no lugar do FAQ. Sai: blocos `data-mdf`, aviso com a marca, link para o portfólio do site, `ld+json`.
- [ ] **Step 2:** `app.js`: o `cgFetch` e as chamadas de câmbio passam por `AtlasHttp.getJSON` (60 s de `ttl`); sai a leitura de `window.MDF_API`. O que vinha da CoinPaprika pelo `mundodefi-api.js` passa a vir da CoinGecko (preço, mercado) e da DefiLlama (gráfico) pelos provedores.
- [ ] **Step 3:** Leitura dos campos por `AtlasCalculos.lerNumero`. Cotação guardada em `atlas.conversor.cripto.<id>.v1` e `atlas.conversor.cambio.v1`, mostrada na hora como "Cotação salva às HH:MM · atualizando…".
- [ ] **Step 4:** Checar no navegador os dois modos, a troca ⇄, `?modo=cambio` e a Review Focus 1 (rede bloqueada com cotação salva e sem ela).
- [ ] **Step 5:** Commit `Ferramentas: Conversor e Câmbio no ATLAS`.

### Task 6: Juros Compostos

**Files:**
- Create: `Ferramentas/juros-compostos/index.html`, `app.js`, `estilo.css`

**Interfaces:**
- Consumes: `AtlasCalculos.jurosCompostos`, `anualParaMensal`, `mensalParaAnual`, `lerNumero`; `AtlasHttp.getJSON` para a Selic (`https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json`, `ttl` 12 h) e o câmbio.

- [ ] **Step 1:** HTML no padrão: moeda (Real/Dólar/Euro), valor inicial, aporte, taxa (anual/mensal), período, inflação, meta, retiradas; resultados (final, investido, juros, dinheiro de hoje, meta), comparação com renda fixa, gráfico e tabela mensal. Sai a faixa de cotações do topo (ticker de BTC/dólar/euro), que não serve à conta.
- [ ] **Step 2:** `app.js` reúne o script original e os extras de 07/11 numa função `calcular()` só, sem o embrulho `jCalcular = function(){…}`. Selic guardada em `atlas.juros.selic.v1`.
- [ ] **Step 3:** Conferir no navegador o caso de 07/11: R$ 1.000 inicial, R$ 500/mês, 12% a.a., 10 anos, meta R$ 200.000 → final R$ 114.070,87, aporte para a meta R$ 887,19/mês, ganho real 7,2% a.a. com 4,5% de inflação.
- [ ] **Step 4:** Commit `Ferramentas: Juros Compostos no ATLAS`.

### Task 7: Lucro Cripto

**Files:**
- Create: `Ferramentas/lucro-cripto/index.html`, `app.js`, `estilo.css`

**Interfaces:**
- Consumes: `AtlasCalculos.lucroOperacao`, `impostoCripto`, `precoEmpate`, `lerNumero`; provedor `coingecko` (`search`, `price`) e câmbio por `AtlasHttp`.

- [ ] **Step 1:** HTML no padrão, com os campos e resultados de 07/11 (lucro, %, investido, saída, taxas, empate, imposto, sobra). A conta de imposto e de empate sai do `app.js` e passa a chamar `impostoCripto` e `precoEmpate`.
- [ ] **Step 2 (melhoria):** Ler `?compra=<preço>&token=<id>` do endereço (vindo da Escada) e preencher o preço de compra e o token.
- [ ] **Step 3:** Conferir no navegador: 1 BTC de US$ 50.000 a US$ 75.000, taxa 0,1%, dólar R$ 5,50 → lucro US$ 24.875,00, empate US$ 50.100,10, imposto R$ 20.521,88; com 0,1 BTC e custódia `br` → isento se as vendas do mês ficarem até R$ 35 mil.
- [ ] **Step 4:** Commit `Ferramentas: Lucro Cripto no ATLAS`.

### Task 8: Staking

**Files:**
- Create: `Ferramentas/staking/index.html`, `app.js`, `estilo.css`

**Interfaces:**
- Consumes: `AtlasCalculos.staking`, `aprParaApy`, `apyParaApr`, `lerNumero`; provedor `coingecko` (`search`, `price`); Chart.js do `assets/vendor`.

- [ ] **Step 1:** HTML no padrão com token, valor/quantidade, taxa APR/APY, inflação do token, cenário de preço, projeção, taxa equivalente, rendimento real, tabela "E se o preço mudar?" e gráfico de 5 anos.
- [ ] **Step 2:** Sai a leitura de print por OCR (Tesseract vinha de `cdn.jsdelivr.net`, CDN proibida no ATLAS). A `.explica` não menciona mais o recurso.
- [ ] **Step 3:** Conferir: 100 SOL, 7% APY, 4% de inflação → rendimento real +2,88%, equivalente 6,77% APR; recalcular duas vezes seguidas sem erro de gráfico.
- [ ] **Step 4:** Commit `Ferramentas: Staking no ATLAS`.

### Task 9: Comparador de Ativos

**Files:**
- Create: `Ferramentas/comparador-de-ativos/index.html`, `app.js`, `estilo.css`

**Interfaces:**
- Consumes: provedores `binance` (`chart`), `coingecko` (`search`, `chart`), `defillama` (`seriesLote`); `AtlasHttp.getJSON` para o Banco Central (CDI); `AtlasCalculos.retornoDesde`, `janelaComum`, `variacaoEmJanela`.

- [ ] **Step 1:** Tirar a Twelve Data inteira (chave no navegador e prata dando 404). **Ouro** passa a ser o PAX Gold (`pax-gold` na CoinGecko), com a legenda "Ouro (via PAXG, token lastreado em ouro)". Prata sai.
- [ ] **Step 2:** Ações e índices (Nvidia, Google, S&P 500, Nasdaq 100): procurar na CoinGecko os tokens de ação (`search` por "SPYx", "NVDAx", "GOOGLx", "QQQx"). Os que tiverem histórico de pelo menos 1 ano entram com a legenda "(token de ação)"; os que não tiverem saem da lista fixa. Registrar no doc da Task 12 o que entrou e o que saiu.
- [ ] **Step 3:** Visual pelos tokens do ATLAS (o roxo de 07/11 vira o acento `#5b8cff`), Chart.js do `assets/vendor`, cabeçalho no padrão.
- [ ] **Step 4:** Conferir no navegador: Bitcoin contra Ouro, CDI e o que sobrou das ações, em Real e em Dólar, nos períodos; nenhuma requisição para `twelvedata` na aba Rede.
- [ ] **Step 5:** Commit `Ferramentas: Comparador de Ativos no ATLAS, sem chave de API no navegador`.

### Task 10: Simulador de Trade

**Files:**
- Create: `Ferramentas/simulador-de-trade/index.html`, `app.js`, `estilo.css`

**Interfaces:**
- Consumes: `AtlasCalculos.trade`, `precoLiquidacao`, `limiteLiquidacaoPct`; provedores `binance` e `coingecko` via `AtlasHttp` (velas: `data-api.binance.vision`, depois `api.binance.com`, depois `coins/<id>/ohlc` da CoinGecko, como em 07/11).

- [ ] **Step 1:** Tirar `nexus-auth.js`, `pro-gate.js`, os atributos `data-mdf-lock-zone`, o banner e o selo PRO, o modo demonstração do site e o link para planos. O login do ATLAS já protege a página; tudo fica editável.
- [ ] **Step 2:** Banca e entradas registradas passam a ser guardadas em `atlas.trade-sim.banca.v1` (era só da sessão no site, ou nuvem para PRO).
- [ ] **Step 3:** Layout de três colunas (banca | gráfico | parâmetros) com a correção de 07/11 para uma coluna abaixo de 1180 px; desenho e arrastar linhas no gráfico funcionando no mouse e no toque.
- [ ] **Step 4:** Conferir no navegador: long e short com alavancagem, preço de liquidação, registrar entrada, desfazer, trocar tempo gráfico; 375 px sem rolagem horizontal.
- [ ] **Step 5:** Commit `Ferramentas: Simulador de Trade no ATLAS, sem trava PRO`.

### Task 11: Página Ferramentas, capas e prompts

**Files:**
- Modify: `pages/ferramentas.html`
- Modify: `css/ferramentas.css` (só se as seções novas pedirem)
- Create: `assets/ferramentas/card-{escada,pool,conv,juros,lucro,stake,comp,trade}.svg`

- [ ] **Step 1:** Reorganizar as seções (contador `.tools-sec__count` de cada uma) e tirar o card "Próxima ferramenta":
  - **Gerir o dinheiro** (2): Finanças, Conversor e Câmbio.
  - **Planejar entradas e saídas** (3): Escada · DCA e preço médio, Lucro Cripto, Simulador de Trade.
  - **DeFi e renda** (4): Scanner Pools (sai de "Gerir o dinheiro"), Estratégia de Pool, Staking, Juros Compostos.
  - **Estudar o mercado** (2): Calculadora de Market Cap, Comparador de Ativos.
- [ ] **Step 2:** Um `<a class="tool-card tool-card--art" … data-atlas-3d>` por ferramenta nova, com título, descrição de uma ou duas frases e três chips, no mesmo molde dos existentes. Atualizar a `<meta name="description">` da página.
- [ ] **Step 3:** Capa provisória por card: SVG 720×1080 com fundo `#0B1120` → `#0A1122` e um ícone simples na cor do card nos 60% de cima (cores na tabela do Step 4). O `<img class="tool-card__art">` aponta para o SVG.
- [ ] **Step 4:** Acrescentar ao registro da Task 12 os 8 prompts para o dono gerar no ChatGPT, no mesmo guia das capas de 15/10 (foto de estúdio fotorrealista, 2:3, assunto nos 60% de cima, 40% de baixo escuros terminando em `#0A1122`, sem texto, sem logos, sem neon):

| Card | Assunto | Cor principal | Apoio |
|---|---|---|---|
| Escada · DCA | escada de vidro com moedas subindo degrau a degrau | âmbar `#F5B942` | azul `#5B8CFF` |
| Estratégia de Pool | duas lâminas de vidro formando uma faixa, com líquido entre elas | ciano `#22D3EE` | verde `#2EC785` |
| Conversor e Câmbio | cédulas de real, dólar e euro se transformando numa moeda | verde `#2EC785` | dourado `#F5B544` |
| Juros Compostos | ampulheta com moedas que se multiplicam ao cair | azul `#5B8CFF` | âmbar `#F5B942` |
| Lucro Cripto | balança de precisão com moedas e um recibo | verde `#4ADE80` | vermelho `#F0556A` |
| Staking | moedas empilhadas trancadas num cofre de vidro, brotando novas | violeta `#8B5CF6` | verde `#2EC785` |
| Comparador de Ativos | barra de ouro, moeda e gráfico lado a lado num pódio | dourado `#F5B544` | azul `#3B82F6` |
| Simulador de Trade | mesa de operações com candles em painéis de vidro | vermelho `#F0556A` | verde `#4ADE80` |

- [ ] **Step 5:** Quando o dono mandar as imagens: converter com Pillow para `card-<slug>.webp` 720×1080 (qualidade 82), trocar o `src` com `?v=1` e ajustar o `object-position`. Pode acontecer depois da publicação, em commit próprio.
- [ ] **Step 6:** Abrir `pages/ferramentas.html?atlas-dev=1`: 11 cards, inclinação 3D funcionando, todos os links abrindo a ferramenta certa, 375 px sem rolagem horizontal.
- [ ] **Step 7:** Commit `Ferramentas: bancada com 11 ferramentas em 4 seções`.

### Task 12: Varredura, registro, publicação e limpeza

**Files:**
- Create: `docs/ferramentas-bancada-2026-11-08.md`
- Modify: `sw.js` (VERSAO nova e nota "entraram as 8 ferramentas da bancada"), `AGENTS.md`, `CLAUDE.md` (uma linha cada apontando para o registro)
- Delete: `Ferramentas/_origem-mdf/` (e a linha dela no `.gitignore`)

- [ ] **Step 1:** Busca de vestígios, que deve voltar vazia:

```bash
grep -rniE "mundodefi|mundo defi|nexus|pro-gate|data-mdf|planos\.html|cryptotrack|fonts\.googleapis|twelvedata|jsdelivr|fetch\(" Ferramentas/escada-dca Ferramentas/estrategia-de-pool Ferramentas/conversor Ferramentas/juros-compostos Ferramentas/lucro-cripto Ferramentas/staking Ferramentas/comparador-de-ativos Ferramentas/simulador-de-trade Ferramentas/_comum Ferramentas/_fonte-quadro
```

  O único `fetch(` permitido é o de dentro do `snap.json`, se houver; qualquer outro volta para a tarefa da ferramenta.
- [ ] **Step 2:** `node --test Ferramentas/_comum/*.test.cjs Ferramentas/scanner-pools/regras.test.cjs` → tudo passa.
- [ ] **Step 3:** No navegador, para cada uma das 8 páginas: sem erro no console, 1280 e 375 px sem rolagem horizontal, e sem `?atlas-dev=1` redireciona para o login (Review Focus 3).
- [ ] **Step 4:** Escrever o registro `docs/ferramentas-bancada-2026-11-08.md`: de onde veio cada ferramenta, o que saiu do MundoDeFi, o que mudou de fonte de dados (Comparador: o que entrou e saiu nas ações), as chaves de `localStorage`, como rodar o `build.js` do quadro, os 8 prompts de capa e o que ficou para depois (IMD; ligar as ferramentas aos dados da carteira).
- [ ] **Step 5:** Apagar `Ferramentas/_origem-mdf/` e a linha do `.gitignore`. Commit `Ferramentas: registro da bancada e nova versão do app`.
- [ ] **Step 6:** Publicar: `git switch main`, `git pull --ff-only`, `git merge --no-ff ferramentas-bancada`, `git push origin main`. Conferir no site publicado (GitHub Pages) que `pages/ferramentas.html` mostra os 11 cards.
- [ ] **Step 7:** Mandar `C:\Users\junio\Desktop\ferramentas` para a Lixeira (decisão 5), só depois do Step 6 confirmado.
