# Calculadora de Market Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terceira ferramenta da bancada do ATLAS: escolhe um token, mostra valor de mercado, FDV e a proporção circulando/falta entrar, e simula preço sonhado, "valer como" e "meu dinheiro" com régua fixa e posição no ranking.

**Architecture:** Página própria em `Ferramentas/calculadora-market-cap/` com login obrigatório. As contas e os formatos ficam em `calculo.js`, puro e testado no Node. A tela (`app.js`) só busca dados pelo provedor CoinGecko que o ATLAS já tem (`core/providers/coingecko.js`, via `AtlasHttp`, com cache) e desenha.

**Tech Stack:** HTML/CSS/JS puro (ES5, IIFE, como o resto do ATLAS), `node --test` (Node 24) para as contas, servidor `py -m http.server 8777` (`.claude/launch.json`, nome `atlas`) para ver no navegador.

**Spec:** `docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md`

## Global Constraints

- Pasta `Ferramentas/` com F maiúsculo (o GitHub Pages diferencia maiúsculas).
- Toda página nova carrega `core/atlas-auth.js` + `core/atlas-secure.js` no `<head>` (login obrigatório). Ver no navegador com `?atlas-dev=1` em localhost.
- Nenhuma chamada `fetch()` direta: rede só por `AtlasHttp`/provedor CoinGecko.
- Sem chave de API paga. Sem guardar dado do usuário, exceto o último resultado bom em cache local (`atlas.mcap.ultimo.v1`).
- Régua fixa: `bitcoin`, `ethereum`, `solana`, `aave`, `uniswap`, `hyperliquid`, nessa ordem.
- Oferta cheia = `max_supply` se existir; senão `total_supply`.
- Toda função de conta devolve `null` quando falta dado. Nunca `NaN` nem `Infinity`.
- Links externos em aba nova com `rel="noopener noreferrer"`, só `http(s)`.
- Todo texto vindo da API passa por `esc()` antes de entrar em `innerHTML`; toda URL passa por `linkSeguro()`.
- Visual sereno: sem grade, spotlight, brilho, glow ou HUD.
- Ícone do token sempre visível (imagem da CoinGecko com as iniciais como reserva).
- Textos da interface em português do Brasil, números no formato brasileiro (`US$ 1,80 bi`).
- Regex só pelo Edit/Write, nunca gerada por script de shell (o `\b` vira backspace).

## Review Focus

1. **Número digitado no formato brasileiro** ("0,5", "1.000", "10 bi"): a conta usa o valor que a pessoa quis dizer. Coberto por testes de `lerNumero` na Task 1.
2. **Token novo ou estranho, com circulação 0 ou ausente:** a coluna "hoje" diz "indisponível" e a outra segue funcionando. Coberto por testes de `oferta` na Task 1 e checado no navegador na Task 5.
3. **Token fora do top 250:** o ranking diz "abaixo do 250º lugar" e a régua funciona igual. Coberto por teste de `posicaoNoRanking` na Task 1.
4. **Limite da CoinGecko (429) enquanto a pessoa digita na busca:** espera 350 ms entre teclas, mostra a mensagem do `AtlasHttp` e não quebra. Checado no navegador na Task 3.
5. **Nome ou link maliciosos vindos da API** (`javascript:`, HTML no nome): o texto é escapado e o link é descartado. Coberto por testes de `linkSeguro`/`linksDoToken` na Task 1.

---

## File Structure

- Create `Ferramentas/calculadora-market-cap/calculo.js`: contas, leitura de número digitado, formatos, links. Sem DOM nem rede. `window.AtlasMcapCalc` e `module.exports`.
- Create `Ferramentas/calculadora-market-cap/calculo.test.cjs`: testes `node --test`.
- Create `Ferramentas/calculadora-market-cap/index.html`: casca da página, trava de login e scripts.
- Create `Ferramentas/calculadora-market-cap/estilo.css`: visual da ferramenta.
- Create `Ferramentas/calculadora-market-cap/app.js`: busca, ficha, calculadora em abas, explicação e cache do último resultado bom.
- Modify `core/providers/coingecko.js` (`topMovers`): aceitar `o.ttl` opcional. O padrão continua 90000, para não mudar os outros usos.
- Modify `pages/ferramentas.html`: seção nova "Estudar o mercado" (contador 1) com o card, logo depois da seção "Gerir o dinheiro". O "Em breve" fica onde está.
- Modify `sw.js`: `VERSAO` `atlas-v89` → `atlas-v90`, com comentário.

---

### Task 1: As contas (`calculo.js`) com testes

**Files:**
- Create: `Ferramentas/calculadora-market-cap/calculo.js`
- Test: `Ferramentas/calculadora-market-cap/calculo.test.cjs`

**Interfaces:**
- Consumes: nada.
- Produces (`AtlasMcapCalc`):
  - `REGUA: string[]` = `["bitcoin","ethereum","solana","aave","uniswap","hyperliquid"]`
  - `oferta({circulating,total,max}) -> {circulante:number|null, cheia:number|null, base:"max"|"total"|null, faltaEntrar:number|null, pctCirculando:number|null, semTeto:boolean, inconsistente:boolean}`
  - `mcapNoPreco(preco, oferta) -> number|null`
  - `precoNoMcap(mcap, oferta) -> number|null`
  - `multiplicador(alvo, atual) -> number|null`
  - `regua(mcap, projetos:[{id,name,symbol,marketCap}]) -> [{id,name,symbol,vezes}]`
  - `posicaoNoRanking(mcap, lista:[{id,name,marketCap}], excluirId?) -> {posicao:number|null, acima:item|null, abaixo:item|null, maiorQueTodos:boolean, foraDaLista:boolean, tamanhoLista:number} | null`
  - `meuDinheiro(valor, precoAtual, precoAlvo) -> {tokens, valorFinal, lucro, lucroPct} | null`
  - `lerNumero(texto) -> number|null`
  - `fmtUSD(n) -> string` ("—" para null), `fmtQtd(n) -> string`, `fmtVezes(n) -> string`, `fmtPct(fracao) -> string`
  - `linkSeguro(url) -> string|null`
  - `linksDoToken(coin:{id, links:{whitepaper, homepage}}) -> [{rotulo, url, tipo:"oficial"|"tokenomist"}]`

- [ ] **Step 1: Write the failing tests**

Create `Ferramentas/calculadora-market-cap/calculo.test.cjs`:

```js
/* Testes das contas da Calculadora de Market Cap.
   Rodar na raiz: node --test Ferramentas/calculadora-market-cap/calculo.test.cjs
   Gabarito: os números do texto original (SKY × AAVE, CoinGecko out/2026). */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./calculo.js");

const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-9), a + " ≠ " + b);

test("gabarito SKY: valor de mercado hoje e a US$ 1", () => {
  const hoje = C.mcapNoPreco(0.077, 23.4e9);
  perto(hoje, 1.8018e9, 1e3);
  const aUmDolar = C.mcapNoPreco(1, 23.4e9);
  perto(aUmDolar, 23.4e9, 1);
  perto(C.multiplicador(aUmDolar, hoje), 12.987, 0.001);
});

test("gabarito AAVE: 13× e US$ 100 em AAVE", () => {
  perto(160.78 * 13, 2090.14, 0.001);
  const r = C.meuDinheiro(100, 160.78, 1045.07);
  perto(r.tokens, 0.62197, 0.00001);
  perto(r.valorFinal, 650, 0.01);
  perto(r.lucro, 550, 0.01);
  perto(r.lucroPct, 550, 0.01);
});

test("régua: SKY a US$ 1 cabe ~9,45 AAVEs", () => {
  const r = C.regua(23.4e9, [
    { id: "aave", name: "Aave", symbol: "AAVE", marketCap: 2.476e9 },
    { id: "zero", name: "Zero", symbol: "Z", marketCap: 0 }
  ]);
  assert.equal(r.length, 1);
  perto(r[0].vezes, 9.4507, 0.0001);
  assert.deepEqual(C.regua(null, [{ id: "a", marketCap: 1 }]), []);
});

test("precoNoMcap: valer como a Solana", () => {
  perto(C.precoNoMcap(63e9, 23.4e9), 2.6923, 0.0001);
  assert.equal(C.precoNoMcap(63e9, 0), null);
});

test("oferta com teto", () => {
  const o = C.oferta({ circulating: 3e9, total: 7e9, max: 10e9 });
  assert.equal(o.cheia, 10e9);
  assert.equal(o.base, "max");
  assert.equal(o.faltaEntrar, 7e9);
  perto(o.pctCirculando, 0.3);
  assert.equal(o.semTeto, false);
  assert.equal(o.inconsistente, false);
});

test("oferta sem teto usa a total (ETH)", () => {
  const o = C.oferta({ circulating: 120e6, total: 120e6, max: null });
  assert.equal(o.base, "total");
  assert.equal(o.semTeto, true);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("oferta sem total nem máximo", () => {
  const o = C.oferta({ circulating: 5e6, total: null, max: null });
  assert.equal(o.cheia, null);
  assert.equal(o.base, null);
  assert.equal(o.faltaEntrar, null);
  assert.equal(o.pctCirculando, null);
  assert.equal(o.circulante, 5e6);
});

test("oferta com circulação zero ou ausente", () => {
  const o = C.oferta({ circulating: 0, total: 1e9, max: 1e9 });
  assert.equal(o.circulante, null);
  assert.equal(o.cheia, 1e9);
  assert.equal(o.pctCirculando, null);
  assert.equal(C.oferta(null).circulante, null);
});

test("oferta inconsistente: circulação maior que a cheia vira 100%", () => {
  const o = C.oferta({ circulating: 12e9, total: 10e9, max: 10e9 });
  assert.equal(o.inconsistente, true);
  assert.equal(o.cheia, 12e9);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("contas nunca devolvem NaN/Infinity", () => {
  assert.equal(C.mcapNoPreco(NaN, 1), null);
  assert.equal(C.mcapNoPreco(1, Infinity), null);
  assert.equal(C.mcapNoPreco(-1, 10), null);
  assert.equal(C.multiplicador(10, 0), null);
  assert.equal(C.meuDinheiro(100, 0, 1), null);
  assert.equal(C.meuDinheiro(0, 1, 1), null);
});

const LISTA = [
  { id: "bitcoin", name: "Bitcoin", marketCap: 2000e9 },
  { id: "ethereum", name: "Ethereum", marketCap: 500e9 },
  { id: "solana", name: "Solana", marketCap: 63e9 },
  { id: "jupiter", name: "Jupiter", marketCap: 1.5e9 },
  { id: "aave", name: "Aave", marketCap: 2.476e9 }
];

test("ranking: entre dois vizinhos, ignorando o próprio token", () => {
  const r = C.posicaoNoRanking(10e9, LISTA, "jupiter");
  assert.equal(r.posicao, 4);
  assert.equal(r.acima.id, "solana");
  assert.equal(r.abaixo.id, "aave");
  assert.equal(r.maiorQueTodos, false);
  assert.equal(r.foraDaLista, false);
  assert.equal(r.tamanhoLista, 4);
});

test("ranking: maior que o 1º", () => {
  const r = C.posicaoNoRanking(5000e9, LISTA);
  assert.equal(r.posicao, 1);
  assert.equal(r.maiorQueTodos, true);
  assert.equal(r.acima, null);
  assert.equal(r.abaixo.id, "bitcoin");
});

test("ranking: abaixo do último da lista", () => {
  const r = C.posicaoNoRanking(1e6, LISTA, "jupiter");
  assert.equal(r.foraDaLista, true);
  assert.equal(r.posicao, null);
  assert.equal(r.acima.id, "aave");
  assert.equal(r.abaixo, null);
  assert.equal(C.posicaoNoRanking(null, LISTA), null);
  assert.equal(C.posicaoNoRanking(1e9, []), null);
});

test("lerNumero entende o jeito brasileiro de digitar", () => {
  assert.equal(C.lerNumero("1"), 1);
  assert.equal(C.lerNumero("0,5"), 0.5);
  assert.equal(C.lerNumero("0.077"), 0.077);
  assert.equal(C.lerNumero("1.000"), 1000);
  assert.equal(C.lerNumero("1.234.567,89"), 1234567.89);
  assert.equal(C.lerNumero("1,234.5"), 1234.5);
  assert.equal(C.lerNumero("US$ 100"), 100);
  assert.equal(C.lerNumero("$2,50"), 2.5);
  assert.equal(C.lerNumero("10 bi"), 10e9);
  assert.equal(C.lerNumero("2,5 mi"), 2.5e6);
  assert.equal(C.lerNumero("3 tri"), 3e12);
  assert.equal(C.lerNumero("50k"), 50e3);
  assert.equal(C.lerNumero("50 mil"), 50e3);
});

test("lerNumero recusa o que não é número positivo", () => {
  assert.equal(C.lerNumero(""), null);
  assert.equal(C.lerNumero("   "), null);
  assert.equal(C.lerNumero("abc"), null);
  assert.equal(C.lerNumero("-5"), null);
  assert.equal(C.lerNumero("0"), null);
  assert.equal(C.lerNumero(null), null);
  assert.equal(C.lerNumero("1,2,3"), null);
});

test("formatos", () => {
  assert.equal(C.fmtUSD(1.8018e9), "US$ 1,80 bi");
  assert.equal(C.fmtUSD(23.4e9), "US$ 23,40 bi");
  assert.equal(C.fmtUSD(3.2e12), "US$ 3,20 tri");
  assert.equal(C.fmtUSD(4.5e6), "US$ 4,50 mi");
  assert.equal(C.fmtUSD(1234.5), "US$ 1.234,50");
  assert.equal(C.fmtUSD(160.78), "US$ 160,78");
  assert.equal(C.fmtUSD(0.0767), "US$ 0,0767");
  assert.equal(C.fmtUSD(0.000012345), "US$ 0,00001235");
  assert.equal(C.fmtUSD(null), "—");
  assert.equal(C.fmtQtd(23.4e9), "23,4 bi");
  assert.equal(C.fmtQtd(1298.7), "1.299");
  assert.equal(C.fmtQtd(12.345), "12,35");
  assert.equal(C.fmtQtd(0.62197), "0,622");
  assert.equal(C.fmtVezes(12.987), "13×");
  assert.equal(C.fmtVezes(9.4507), "9,5×");
  assert.equal(C.fmtVezes(0.3712), "0,37×");
  assert.equal(C.fmtVezes(4000), "4.000×");
  assert.equal(C.fmtVezes(null), "—");
  assert.equal(C.fmtPct(0.62), "62%");
  assert.equal(C.fmtPct(0.0734), "7,3%");
  assert.equal(C.fmtPct(null), "—");
});

test("linkSeguro só aceita http(s)", () => {
  assert.equal(C.linkSeguro("https://docs.jup.ag"), "https://docs.jup.ag");
  assert.equal(C.linkSeguro("http://x.io/a"), "http://x.io/a");
  assert.equal(C.linkSeguro("javascript:alert(1)"), null);
  assert.equal(C.linkSeguro("  "), null);
  assert.equal(C.linkSeguro(null), null);
});

test("linksDoToken: oficial primeiro, Tokenomist depois", () => {
  const a = C.linksDoToken({ id: "jupiter", links: { whitepaper: "https://station.jup.ag/docs", homepage: "https://jup.ag" } });
  assert.deepEqual(a.map(l => l.tipo), ["oficial", "tokenomist"]);
  assert.equal(a[0].url, "https://station.jup.ag/docs");
  assert.equal(a[1].url, "https://tokenomist.ai/jupiter");
  const b = C.linksDoToken({ id: "x", links: { whitepaper: "", homepage: "https://x.io" } });
  assert.equal(b[0].url, "https://x.io");
  const c = C.linksDoToken({ id: "y y", links: { whitepaper: "javascript:1", homepage: null } });
  assert.deepEqual(c.map(l => l.tipo), ["tokenomist"]);
  assert.equal(c[0].url, "https://tokenomist.ai/y%20y");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test Ferramentas/calculadora-market-cap/calculo.test.cjs`
Expected: FAIL with `Cannot find module './calculo.js'`.

- [ ] **Step 3: Write the implementation**

Create `Ferramentas/calculadora-market-cap/calculo.js`:

```js
/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/calculo.js

   As contas da Calculadora de Market Cap, sem tela e sem rede.
   Spec: docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md

   A ideia que tudo aqui serve: o preço da unidade não diz se um
   token é barato. Valor de mercado = preço × quantidade de tokens.
   "Hoje" usa os tokens em circulação; "quando tudo desbloquear" usa
   a oferta máxima (ou a total, se não houver máxima), o mesmo
   critério do FDV da CoinGecko.

   Regra da casa: faltou dado, devolve null. Nunca NaN nem Infinity —
   número inventado numa ferramenta que ensina a desconfiar de número
   seria a pior ironia possível.

   Exposto em: window.AtlasMcapCalc (navegador) e module.exports (Node).
   ============================================================ */
(function (root) {
  "use strict";

  var REGUA = ["bitcoin", "ethereum", "solana", "aave", "uniswap", "hyperliquid"];

  function finito(x) { return typeof x === "number" && isFinite(x); }
  function positivo(x) { return finito(x) && x > 0 ? x : null; }

  /* ---------- oferta ---------- */
  function oferta(s) {
    s = s || {};
    var circ = positivo(s.circulating);
    var total = positivo(s.total);
    var max = positivo(s.max);
    var cheia = max != null ? max : total;
    var base = max != null ? "max" : (total != null ? "total" : null);
    var inconsistente = false;
    /* Fonte às vezes informa mais tokens circulando do que o total.
       Tratamos como 100% circulando e a tela avisa. */
    if (circ != null && cheia != null && circ > cheia) {
      inconsistente = true;
      cheia = circ;
    }
    var temAmbos = circ != null && cheia != null;
    return {
      circulante: circ,
      cheia: cheia,
      base: base,
      faltaEntrar: temAmbos ? cheia - circ : null,
      pctCirculando: temAmbos ? circ / cheia : null,
      semTeto: max == null,
      inconsistente: inconsistente
    };
  }

  /* ---------- contas ---------- */
  function mcapNoPreco(preco, qtd) {
    preco = positivo(preco); qtd = positivo(qtd);
    if (preco == null || qtd == null) return null;
    var r = preco * qtd;
    return finito(r) ? r : null;
  }

  function precoNoMcap(mcap, qtd) {
    mcap = positivo(mcap); qtd = positivo(qtd);
    if (mcap == null || qtd == null) return null;
    var r = mcap / qtd;
    return finito(r) ? r : null;
  }

  function multiplicador(alvo, atual) {
    alvo = positivo(alvo); atual = positivo(atual);
    if (alvo == null || atual == null) return null;
    var r = alvo / atual;
    return finito(r) ? r : null;
  }

  function regua(mcap, projetos) {
    if (positivo(mcap) == null) return [];
    return (projetos || []).filter(function (p) {
      return p && positivo(p.marketCap) != null;
    }).map(function (p) {
      return { id: p.id, name: p.name, symbol: p.symbol, vezes: mcap / p.marketCap };
    });
  }

  /* Onde um valor de mercado cairia no ranking. lista: os maiores do
     mercado (qualquer ordem); excluirId tira o próprio token, senão
     ele competiria consigo mesmo. */
  function posicaoNoRanking(mcap, lista, excluirId) {
    if (positivo(mcap) == null) return null;
    var l = (lista || []).filter(function (c) {
      return c && c.id !== excluirId && positivo(c.marketCap) != null;
    }).sort(function (a, b) { return b.marketCap - a.marketCap; });
    if (!l.length) return null;
    for (var i = 0; i < l.length; i++) {
      if (mcap > l[i].marketCap) {
        return {
          posicao: i + 1, acima: i > 0 ? l[i - 1] : null, abaixo: l[i],
          maiorQueTodos: i === 0, foraDaLista: false, tamanhoLista: l.length
        };
      }
    }
    return {
      posicao: null, acima: l[l.length - 1], abaixo: null,
      maiorQueTodos: false, foraDaLista: true, tamanhoLista: l.length
    };
  }

  function meuDinheiro(valor, precoAtual, precoAlvo) {
    valor = positivo(valor); precoAtual = positivo(precoAtual); precoAlvo = positivo(precoAlvo);
    if (valor == null || precoAtual == null || precoAlvo == null) return null;
    var tokens = valor / precoAtual;
    var valorFinal = tokens * precoAlvo;
    var lucro = valorFinal - valor;
    return { tokens: tokens, valorFinal: valorFinal, lucro: lucro, lucroPct: lucro / valor * 100 };
  }

  /* ---------- leitura do que a pessoa digita ----------
     Jeito brasileiro primeiro: "1.000" é mil, "0,5" é meio.
     "0.077" é decimal (parte inteira zero não tem milhar).
     Aceita sufixos: k/mil, mi, bi, tri. */
  var SUFIXOS = { k: 1e3, mil: 1e3, mi: 1e6, bi: 1e9, tri: 1e12 };

  function lerNumero(texto) {
    if (texto == null) return null;
    var t = String(texto).toLowerCase().replace(/us\$|\$/g, "").replace(/\s+/g, "");
    if (!t) return null;
    var mult = 1;
    var m = t.match(/^(.*?)(tri|bi|mi|mil|k)$/);
    if (m) { t = m[1]; mult = SUFIXOS[m[2]]; }
    if (!/^[0-9.,]+$/.test(t)) return null;
    var pontos = (t.match(/\./g) || []).length;
    var virgulas = (t.match(/,/g) || []).length;
    if (pontos && virgulas) {
      /* o separador que aparece por último é o decimal */
      if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
        if (virgulas > 1) return null;
        t = t.replace(/\./g, "").replace(",", ".");
      } else {
        if (pontos > 1) return null;
        t = t.replace(/,/g, "");
      }
    } else if (virgulas) {
      if (virgulas > 1) return null;
      t = t.replace(",", ".");
    } else if (pontos > 1) {
      t = t.replace(/\./g, "");
    } else if (pontos === 1 && /^[1-9][0-9]{0,2}\.[0-9]{3}$/.test(t)) {
      t = t.replace(".", ""); /* "1.000" = mil */
    }
    var n = parseFloat(t);
    if (!finito(n)) return null;
    n = n * mult;
    return n > 0 && finito(n) ? n : null;
  }

  /* ---------- formatos ---------- */
  function br(n, minFrac, maxFrac) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
  }

  function escala(n) {
    var a = Math.abs(n);
    if (a >= 1e12) return { v: n / 1e12, s: " tri" };
    if (a >= 1e9) return { v: n / 1e9, s: " bi" };
    if (a >= 1e6) return { v: n / 1e6, s: " mi" };
    return null;
  }

  function fmtUSD(n) {
    if (!finito(n)) return "—";
    var e = escala(n);
    if (e) return "US$ " + br(e.v, 2, 2) + e.s;
    var a = Math.abs(n);
    if (a >= 1) return "US$ " + br(n, 2, 2);
    if (a === 0) return "US$ 0,00";
    return "US$ " + n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
  }

  function fmtQtd(n) {
    if (!finito(n)) return "—";
    var e = escala(n);
    if (e) return br(e.v, 0, 2) + e.s;
    var a = Math.abs(n);
    if (a >= 1000) return br(n, 0, 0);
    if (a >= 1) return br(n, 0, 2);
    return n.toLocaleString("pt-BR", { maximumSignificantDigits: 3 });
  }

  function fmtVezes(n) {
    if (!finito(n)) return "—";
    if (n >= 10) return br(n, 0, 0) + "×";
    if (n >= 1) return br(n, 0, 1) + "×";
    return br(n, 0, 2) + "×";
  }

  function fmtPct(f) {
    if (!finito(f)) return "—";
    var p = f * 100;
    return (Math.abs(p) >= 10 ? br(p, 0, 0) : br(p, 0, 1)) + "%";
  }

  /* ---------- links ---------- */
  function linkSeguro(url) {
    if (typeof url !== "string") return null;
    var u = url.trim();
    return /^https?:\/\/[^\s]+$/i.test(u) ? u : null;
  }

  function linksDoToken(coin) {
    coin = coin || {};
    var l = coin.links || {};
    var out = [];
    var oficial = linkSeguro(l.whitepaper) || linkSeguro(l.homepage);
    if (oficial) out.push({ rotulo: "Documentação oficial do projeto", url: oficial, tipo: "oficial" });
    if (coin.id) {
      out.push({
        rotulo: "Cronograma em gráfico (Tokenomist)",
        url: "https://tokenomist.ai/" + encodeURIComponent(coin.id),
        tipo: "tokenomist"
      });
    }
    return out;
  }

  var api = {
    REGUA: REGUA,
    oferta: oferta, mcapNoPreco: mcapNoPreco, precoNoMcap: precoNoMcap,
    multiplicador: multiplicador, regua: regua, posicaoNoRanking: posicaoNoRanking,
    meuDinheiro: meuDinheiro, lerNumero: lerNumero,
    fmtUSD: fmtUSD, fmtQtd: fmtQtd, fmtVezes: fmtVezes, fmtPct: fmtPct,
    linkSeguro: linkSeguro, linksDoToken: linksDoToken
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AtlasMcapCalc = api;
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test Ferramentas/calculadora-market-cap/calculo.test.cjs`
Expected: all tests PASS (19 tests, 0 fail). If a `fmt*` test fails only because of locale output, check `node -e "console.log((1234.5).toLocaleString('pt-BR'))"` prints `1.234,5`. Node 24 ships full ICU, so it should.

- [ ] **Step 5: Check for backspace characters left by tooling**

Run: `grep -c $'\x08' Ferramentas/calculadora-market-cap/calculo.js`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add Ferramentas/calculadora-market-cap/calculo.js Ferramentas/calculadora-market-cap/calculo.test.cjs
git commit -m "Calculadora de Market Cap: contas, leitura de numero e formatos com testes"
```

---

### Task 2: `topMovers` aceita TTL opcional

**Files:**
- Modify: `core/providers/coingecko.js` (função `topMovers`, ~linhas 191-210)

**Interfaces:**
- Produces: `CoinGecko.topMovers({order, perPage, category, ttl})`. `ttl` em ms, opcional, padrão 90000. Retorno igual ao atual: `[{id,symbol,name,usd,change24h,volume24h,marketCap,rank,image,category}]`.

- [ ] **Step 1: Edit `topMovers`**

Replace:

```js
      return AtlasHttp.getJSON(url, {
        ttl: 90000, headers: headers(),
```

with:

```js
      /* ttl opcional: a Calculadora de Market Cap usa o top 250 como
         régua e ranking e pede 10 min; os outros usos seguem com 90 s. */
      return AtlasHttp.getJSON(url, {
        ttl: o.ttl != null ? o.ttl : 90000, headers: headers(),
```

- [ ] **Step 2: Confirm the other callers are unaffected**

Run: `grep -rn "topMovers(" --include=*.js . | grep -v referencias`
Expected: no existing caller passes `ttl`, so all keep 90000.

- [ ] **Step 3: Commit**

```bash
git add core/providers/coingecko.js
git commit -m "CoinGecko: topMovers aceita ttl opcional (padrao 90 s mantido)"
```

---

### Task 3: Página, busca e ficha do token

**Files:**
- Create: `Ferramentas/calculadora-market-cap/index.html`
- Create: `Ferramentas/calculadora-market-cap/estilo.css`
- Create: `Ferramentas/calculadora-market-cap/app.js`

**Interfaces:**
- Consumes: `AtlasMcapCalc` (Task 1); `AtlasProviders.get("coingecko")` com `.search(q)`, `.assetFull(id)` e `.topMovers({order:"market_cap_desc", perPage:250, ttl:600000})` (Task 2).
- Produces (dentro de `app.js`, usados pela Task 4): `estado = {coin, mercado, aba, entradas:{preco, valer, valerUsd, investido, alvo}}`; `renderPainel()`; `renderExplica()`; helpers `esc(s)`, `iconeHTML(nome, simbolo, img, classe)`.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-module="tools">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Calculadora de Market Cap do ATLAS: o preço da unidade não diz se um token é barato. Veja o valor de mercado, quanto ainda vai ser desbloqueado e o tamanho que um preço sonhado exige.">
<title>Calculadora de Market Cap — ATLAS</title>
<link rel="icon" type="image/png" href="../../assets/iconeatlas.png">
<link rel="stylesheet" href="../../themes/atlas-fonts.css">
<link rel="stylesheet" href="../../core/ui/atlas-shell.css">
<link rel="stylesheet" href="estilo.css?v=mcap-1">
<!-- Trava de login do ATLAS: sem sessão autorizada, vai para pages/login.html. -->
<script src="../../core/atlas-auth.js"></script>
<script src="../../core/atlas-secure.js"></script>
</head>
<body>
<div class="wrap">

  <header class="top">
    <a class="voltar" href="../../pages/ferramentas.html">← Ferramentas</a>
    <h1>Calculadora de <span>Market Cap</span></h1>
    <p class="sub">Barato ou caro é o tamanho da pizza, não o preço da fatia.</p>
    <p class="estudo">Simulação para estudo. Não é recomendação de investimento e não usa os dados da sua carteira.</p>
  </header>

  <section class="busca" aria-label="Escolher token">
    <label for="mc-busca">Escolha um token</label>
    <div class="busca__campo">
      <input id="mc-busca" type="search" autocomplete="off" spellcheck="false"
             placeholder="Ex.: JUP, Solana, AAVE"
             role="combobox" aria-expanded="false" aria-controls="mc-sugestoes" aria-autocomplete="list">
      <ul id="mc-sugestoes" class="sugestoes" role="listbox" hidden></ul>
    </div>
    <p id="mc-aviso" class="aviso" role="status" hidden></p>
  </section>

  <section id="mc-ficha" class="ficha" aria-live="polite" hidden></section>

  <section id="mc-calc" class="calc" hidden>
    <div class="abas" role="tablist" aria-label="Modo da calculadora">
      <button type="button" role="tab" data-aba="preco" aria-selected="true">Preço sonhado</button>
      <button type="button" role="tab" data-aba="valer" aria-selected="false">Valer como</button>
      <button type="button" role="tab" data-aba="dinheiro" aria-selected="false">Meu dinheiro</button>
    </div>
    <div id="mc-painel" class="painel" role="tabpanel"></div>
  </section>

  <section id="mc-explica" class="explica" aria-label="Como ler estes números"></section>

</div>

<script src="../../core/http.js"></script>
<script src="../../core/providers/registry.js"></script>
<script src="../../core/providers/coingecko.js"></script>
<script src="calculo.js?v=mcap-1"></script>
<script src="app.js?v=mcap-1"></script>
<script src="../../core/ui/atlas-shell.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `estilo.css`**

```css
/* ATLAS · Calculadora de Market Cap — visual sereno: seções abertas,
   sem grade, brilho ou HUD. Paleta igual à do Scanner Pools. */
:root{
  --bg:#0a0e17; --panel:#111723; --line:#1e2735;
  --txt:#e6ecf5; --mut:#7d8aa0; --mut2:#556074;
  --accent:#5b8cff; --green:#2ec785; --amber:#f5b942; --red:#f0556a;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:Inter,'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.5}
.wrap{max-width:1080px;margin:0 auto;padding:22px 16px 72px}
a{color:var(--accent)}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}

.top{margin-bottom:22px}
.voltar{display:inline-block;color:var(--mut);text-decoration:none;font-size:13px;margin-bottom:10px}
.voltar:hover{color:var(--txt)}
.top h1{font-size:24px;margin:0;font-weight:700}
.top h1 span{color:var(--accent)}
.sub{color:var(--mut);margin:4px 0 0}
.estudo{color:var(--mut2);font-size:12.5px;margin:6px 0 0}

/* busca */
.busca label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:6px}
.busca__campo{position:relative;max-width:520px}
#mc-busca{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--txt);font-size:15px;padding:11px 14px}
#mc-busca:focus{outline:2px solid var(--accent);outline-offset:1px}
.sugestoes{position:absolute;z-index:5;left:0;right:0;top:calc(100% + 4px);margin:0;padding:4px;list-style:none;background:#0d1320;border:1px solid var(--line);border-radius:10px;max-height:340px;overflow:auto}
.sugestoes li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer}
.sugestoes li[aria-selected="true"],.sugestoes li:hover{background:#18213a}
.sugestoes .rank{margin-left:auto;color:var(--mut2);font-size:12px}
.aviso{margin:10px 0 0;color:var(--amber);font-size:13px}

/* ícone do token */
.tk{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;border-radius:50%;background:#1b2436;color:var(--mut);font-size:10px;font-weight:700;overflow:hidden}
.tk img{width:100%;height:100%;object-fit:cover}
.tk--g{width:44px;height:44px;font-size:13px}

/* ficha */
.ficha{margin-top:28px;padding-top:22px;border-top:1px solid var(--line)}
.ficha__cab{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ficha__cab h2{margin:0;font-size:20px}
.ficha__cab .sim{color:var(--mut);font-weight:500}
.faixa{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin:20px 0}
.faixa dt{color:var(--mut);font-size:12px}
.faixa dd{margin:2px 0 0;font-size:18px;font-weight:600}
.oferta__barra{height:12px;border-radius:6px;background:#2a2f3d;overflow:hidden;display:flex}
.oferta__barra span{background:var(--green)}
.oferta__leg{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:var(--mut)}
.oferta__leg b{color:var(--txt)}
.nota{color:var(--mut);font-size:12.5px;margin:8px 0 0}
.links{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;font-size:13.5px}

/* calculadora */
.calc{margin-top:30px;padding-top:22px;border-top:1px solid var(--line)}
.abas{display:flex;gap:6px;flex-wrap:wrap}
.abas button{background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:999px;padding:7px 14px;font:inherit;cursor:pointer}
.abas button[aria-selected="true"]{background:#18213a;color:var(--txt);border-color:#2c3a5c}
.painel{margin-top:18px}
.campos{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end}
.campo label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:5px}
.campo input,.campo select{background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;padding:9px 12px;min-width:180px}
.campo input:focus,.campo select:focus{outline:2px solid var(--accent);outline-offset:1px}
.dica{color:var(--mut2);font-size:12px;margin:6px 0 0}
.res{margin-top:20px}
.colunas{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.col h3{margin:0 0 4px;font-size:13px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.col .grande{font-size:26px;font-weight:700;margin:2px 0}
.col .linha{margin:4px 0;color:#c3ccdb}
.col ul{list-style:none;padding:0;margin:10px 0 0}
.col li{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid #161d2b;font-size:13.5px}
.indisp{color:var(--mut)}
.dinheiro{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-bottom:22px}
.pos{color:var(--green)} .neg{color:var(--red)}

/* explicação */
.explica{margin-top:40px;padding-top:22px;border-top:1px solid var(--line);color:#c3ccdb;max-width:760px}
.explica h2{color:var(--txt);font-size:18px;margin:0 0 10px}
.explica h3{color:var(--txt);font-size:15px;margin:22px 0 6px}
.explica p{margin:6px 0}

@media (max-width:700px){
  .faixa{grid-template-columns:1fr 1fr}
  .colunas,.dinheiro{grid-template-columns:1fr}
  .campo input,.campo select{min-width:0;width:100%}
  .campos .campo{flex:1 1 100%}
}
```

- [ ] **Step 3: Create `app.js` (busca, ficha, cache do último resultado bom)**

```js
/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/app.js

   A tela da Calculadora de Market Cap. As contas moram em
   calculo.js (testado no Node); aqui só se busca e se desenha.
   Spec: docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md

   Dados: provedor CoinGecko do ATLAS (core/providers/coingecko.js),
   que já tem cache e retry. O AtlasHttp não devolve dado vencido
   quando a rede falha, então guardamos o último resultado bom aqui
   (atlas.mcap.ultimo.v1) para mostrar "dados de HH:MM" sem rede.

   Segurança: todo texto vindo da API passa por esc() antes de virar
   HTML, e toda URL passa por C.linkSeguro() (só http/https).
   ============================================================ */
(function () {
  "use strict";
  var C = window.AtlasMcapCalc;
  var cg = window.AtlasProviders && window.AtlasProviders.get("coingecko");
  var $ = function (id) { return document.getElementById(id); };
  var LS_ULTIMO = "atlas.mcap.ultimo.v1";

  var estado = {
    coin: null,
    mercado: [],
    aba: "preco",
    entradas: { preco: "", valer: "solana", valerUsd: "", investido: "100", alvo: "" }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function iniciais(simbolo) { return esc(String(simbolo || "?").slice(0, 4).toUpperCase()); }

  /* Ícone sempre: imagem da CoinGecko; sem imagem, as iniciais. */
  function iconeHTML(nome, simbolo, img, classe) {
    var src = C.linkSeguro(img);
    return '<span class="tk ' + (classe || "") + '" data-atlas-token="' + esc(simbolo) + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : iniciais(simbolo)) +
      "</span>";
  }

  function aviso(texto) {
    var el = $("mc-aviso");
    el.textContent = texto || "";
    el.hidden = !texto;
  }

  /* ---------- cache do último resultado bom ---------- */
  function guardarUltimo(coin, mercado) {
    try { localStorage.setItem(LS_ULTIMO, JSON.stringify({ t: Date.now(), coin: coin, mercado: mercado })); } catch (e) {}
  }
  function lerUltimo(id) {
    try {
      var u = JSON.parse(localStorage.getItem(LS_ULTIMO) || "null");
      return u && u.coin && u.coin.id === id ? u : null;
    } catch (e) { return null; }
  }
  function hora(t) {
    var d = new Date(t);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- busca ---------- */
  var timerBusca = null, sugestoes = [], ativa = -1, seqBusca = 0;

  function fecharSugestoes() {
    var ul = $("mc-sugestoes");
    ul.hidden = true; ul.innerHTML = "";
    $("mc-busca").setAttribute("aria-expanded", "false");
    sugestoes = []; ativa = -1;
  }

  function desenharSugestoes() {
    var ul = $("mc-sugestoes");
    if (!sugestoes.length) { fecharSugestoes(); return; }
    ul.innerHTML = sugestoes.map(function (s, i) {
      return '<li role="option" id="mc-sug-' + i + '" data-i="' + i + '" aria-selected="' + (i === ativa) + '">' +
        iconeHTML(s.name, s.symbol, s.thumb) +
        "<span>" + esc(s.name) + ' <span class="sim">' + esc(s.symbol) + "</span></span>" +
        '<span class="rank">' + (s.rank && s.rank < 9999 ? "#" + s.rank : "") + "</span></li>";
    }).join("");
    ul.hidden = false;
    $("mc-busca").setAttribute("aria-expanded", "true");
    $("mc-busca").setAttribute("aria-activedescendant", ativa >= 0 ? "mc-sug-" + ativa : "");
  }

  function buscar(q) {
    var minha = ++seqBusca;
    cg.search(q).then(function (lista) {
      if (minha !== seqBusca) return;
      sugestoes = (lista || []).slice(0, 8); ativa = sugestoes.length ? 0 : -1;
      desenharSugestoes();
      aviso("");
    }).catch(function (err) {
      if (minha !== seqBusca) return;
      fecharSugestoes();
      aviso((err && err.message) || "Não consegui buscar agora. Tente em instantes.");
    });
  }

  function ligarBusca() {
    var input = $("mc-busca");
    input.addEventListener("input", function () {
      clearTimeout(timerBusca);
      var q = input.value.trim();
      if (q.length < 2) { seqBusca++; fecharSugestoes(); return; }
      timerBusca = setTimeout(function () { buscar(q); }, 350);
    });
    input.addEventListener("keydown", function (e) {
      if ($("mc-sugestoes").hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); ativa = Math.min(ativa + 1, sugestoes.length - 1); desenharSugestoes(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); ativa = Math.max(ativa - 1, 0); desenharSugestoes(); }
      else if (e.key === "Enter" && ativa >= 0) { e.preventDefault(); escolher(sugestoes[ativa]); }
      else if (e.key === "Escape") { fecharSugestoes(); }
    });
    $("mc-sugestoes").addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (!li) return;
      e.preventDefault();
      escolher(sugestoes[+li.getAttribute("data-i")]);
    });
    input.addEventListener("blur", function () { setTimeout(fecharSugestoes, 120); });
  }

  function escolher(s) {
    if (!s) return;
    fecharSugestoes();
    $("mc-busca").value = s.name + " (" + s.symbol + ")";
    var url = new URL(location.href);
    url.searchParams.set("token", s.id);
    history.replaceState(null, "", url);
    carregar(s.id);
  }

  /* ---------- carga ---------- */
  function carregarMercado() {
    return cg.topMovers({ order: "market_cap_desc", perPage: 250, ttl: 600000 })
      .catch(function () { return []; });
  }

  var seqCarga = 0;
  function carregar(id) {
    var minha = ++seqCarga;
    aviso("Carregando…");
    Promise.all([cg.assetFull(id), carregarMercado()]).then(function (r) {
      if (minha !== seqCarga) return;
      if (!r[0]) throw new Error("A CoinGecko não devolveu dados deste token.");
      estado.coin = r[0];
      estado.mercado = r[1] || [];
      if (estado.mercado.length) guardarUltimo(estado.coin, estado.mercado);
      aviso(estado.mercado.length ? "" : "Régua e ranking indisponíveis agora (limite da CoinGecko). Tente em instantes.");
      desenharTudo();
    }).catch(function (err) {
      if (minha !== seqCarga) return;
      var msg = (err && err.message) || "Não consegui carregar este token.";
      var u = lerUltimo(id);
      if (u) {
        estado.coin = u.coin; estado.mercado = u.mercado || [];
        aviso(msg + " Mostrando os dados de " + hora(u.t) + ".");
        desenharTudo();
      } else {
        aviso(msg);
      }
    });
  }

  function desenharTudo() {
    renderFicha();
    $("mc-calc").hidden = false;
    renderPainel();
    renderExplica();
  }

  /* ---------- ficha ---------- */
  function renderFicha() {
    var c = estado.coin, el = $("mc-ficha");
    var of = C.oferta(c.supply);
    var mcapHoje = c.marketCap || C.mcapNoPreco(c.usd, of.circulante);
    var fdv = c.fdv || C.mcapNoPreco(c.usd, of.cheia);

    var barra;
    if (of.pctCirculando != null) {
      barra =
        '<div class="oferta__barra" role="img" aria-label="' + esc(C.fmtPct(of.pctCirculando)) + ' circulando">' +
          '<span style="width:' + (of.pctCirculando * 100).toFixed(2) + '%"></span></div>' +
        '<div class="oferta__leg">' +
          "<span><b>" + C.fmtPct(of.pctCirculando) + " circulando</b> · " + C.fmtQtd(of.circulante) + " tokens</span>" +
          "<span><b>" + C.fmtPct(1 - of.pctCirculando) + " ainda vai entrar</b> · " + C.fmtQtd(of.faltaEntrar) + " tokens</span>" +
        "</div>";
    } else if (of.circulante == null) {
      barra = '<p class="nota">A CoinGecko não informa quantos tokens estão em circulação.</p>';
    } else {
      barra = '<p class="nota">A CoinGecko não informa a oferta total deste token. Circulando: ' + C.fmtQtd(of.circulante) + " tokens.</p>";
    }

    var notas = [];
    if (of.semTeto && of.base === "total") notas.push("Sem teto de emissão: a conta do desbloqueio usa a oferta total de hoje, que pode crescer.");
    if (of.inconsistente) notas.push("A fonte informa mais tokens circulando do que o total. Tratamos como 100% circulando.");

    var links = C.linksDoToken(c).map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.rotulo) + " ↗</a>";
    }).join("");

    el.innerHTML =
      '<div class="ficha__cab">' + iconeHTML(c.name, c.symbol, c.image, "tk--g") +
        "<h2>" + esc(c.name) + ' <span class="sim">' + esc(c.symbol) + "</span></h2></div>" +
      '<dl class="faixa">' +
        '<div><dt>Preço</dt><dd class="num">' + C.fmtUSD(c.usd) + "</dd></div>" +
        '<div><dt>Valor de mercado</dt><dd class="num">' + C.fmtUSD(mcapHoje) + "</dd></div>" +
        '<div><dt>FDV (tudo desbloqueado)</dt><dd class="num">' + C.fmtUSD(fdv) + "</dd></div>" +
        '<div><dt>Ranking</dt><dd class="num">' + (c.rank ? esc(c.rank) + "º" : "—") + "</dd></div>" +
      "</dl>" + barra +
      notas.map(function (n) { return '<p class="nota">' + esc(n) + "</p>"; }).join("") +
      (links ? '<p class="nota">Para ver quando e para quem os tokens entram:</p><div class="links">' + links + "</div>" : "");
    el.hidden = false;
  }

  /* As próximas duas funções ganham corpo nas Tasks 4 e 5. */
  function renderPainel() { $("mc-painel").textContent = ""; }
  function renderExplica() { $("mc-explica").textContent = ""; }

  /* ---------- início ---------- */
  function iniciar() {
    if (!C || !cg) { aviso("Falta um arquivo do ATLAS para buscar preços. Recarregue a página."); return; }
    ligarBusca();
    renderExplica();
    var id = new URLSearchParams(location.search).get("token");
    if (id) carregar(id);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
```

- [ ] **Step 4: Verify in the browser**

Start the preview with `preview_start {name: "atlas"}` and navigate to `http://localhost:8777/Ferramentas/calculadora-market-cap/index.html?atlas-dev=1`.
Then:
1. `read_console_messages {onlyErrors:true}`: expect no errors. If `atlas-shell.js` throws because of missing globals, remove its `<script>` from `index.html` and note that in the commit message.
2. Type `jup` in the search field and wait about 1 s. `read_page`: a list with "Jupiter" and the icon is visible.
3. Click Jupiter. `read_page`: the ficha shows price, market cap, FDV, ranking, the bar with "% circulando" / "% ainda vai entrar", and two links ("Documentação oficial do projeto ↗" and "Cronograma em gráfico (Tokenomist) ↗"). The URL now has `?token=jupiter`.
4. Navigate to `...index.html?token=ethereum&atlas-dev=1`. The ficha shows the "Sem teto de emissão" note.
5. Throttle check (Review Focus 4): type fast `a`, `aa`, `aav`, `aave` in the search. The console has no errors, and at most one search request goes out after the pause (`read_network_requests {urlPattern:"search"}`).

- [ ] **Step 5: Commit**

```bash
git add Ferramentas/calculadora-market-cap/index.html Ferramentas/calculadora-market-cap/estilo.css Ferramentas/calculadora-market-cap/app.js
git commit -m "Calculadora de Market Cap: pagina, busca e ficha do token com proporcao de desbloqueio"
```

---

### Task 4: Calculadora em três abas (preço sonhado, valer como, meu dinheiro)

**Files:**
- Modify: `Ferramentas/calculadora-market-cap/app.js` (replace the `renderPainel` stub and add the tab wiring)

**Interfaces:**
- Consumes: `estado`, `esc`, `iconeHTML`, `C.*` (Tasks 1 and 3).
- Produces: `renderPainel()` (draws the tab and its inputs) and `renderResultado()` (redraws only the result, keeping focus on the field).

- [ ] **Step 1: Replace the `renderPainel` stub**

In `app.js`, replace the line:

```js
  function renderPainel() { $("mc-painel").textContent = ""; }
```

with:

```js
  /* ---------- calculadora ---------- */
  function regua() {
    var porId = {};
    estado.mercado.forEach(function (m) { porId[m.id] = m; });
    return C.REGUA.map(function (id) { return porId[id]; }).filter(Boolean);
  }

  function mcapHoje() {
    var c = estado.coin, of = C.oferta(c.supply);
    return c.marketCap || C.mcapNoPreco(c.usd, of.circulante);
  }

  /* As duas colunas de todo resultado: tokens de hoje × tudo desbloqueado. */
  function colunas() {
    var of = C.oferta(estado.coin.supply);
    return [
      { titulo: "Com os tokens de hoje", qtd: of.circulante,
        semDado: "A CoinGecko não informa a circulação deste token." },
      { titulo: "Quando tudo desbloquear", qtd: of.cheia,
        semDado: "A CoinGecko não informa a oferta total deste token." }
    ];
  }

  function colunaVazia(col) {
    return '<div class="col"><h3>' + col.titulo + '</h3><p class="indisp">' + esc(col.semDado) + "</p></div>";
  }

  function textoRanking(mcap) {
    var r = C.posicaoNoRanking(mcap, estado.mercado, estado.coin.id);
    if (!r) return "";
    if (r.maiorQueTodos) return "Maior que " + esc(r.abaixo.name) + ", o 1º do ranking hoje.";
    if (r.foraDaLista) return "Abaixo do " + r.tamanhoLista + "º lugar do ranking.";
    return "Ficaria em " + r.posicao + "º lugar, entre " + esc(r.acima.name) + " e " + esc(r.abaixo.name) + ".";
  }

  function blocoTamanho(mcap) {
    var linhas = C.regua(mcap, regua()).map(function (p) {
      return "<li><span>" + esc(p.name) + '</span><span class="num">' + C.fmtVezes(p.vezes) + "</span></li>";
    }).join("");
    var rk = textoRanking(mcap);
    return (rk ? '<p class="linha">' + rk + "</p>" : "") +
      (linhas ? '<p class="linha">Esse tamanho equivale a:</p><ul>' + linhas + "</ul>" : "");
  }

  function colunaMcap(col, preco) {
    var mcap = C.mcapNoPreco(preco, col.qtd);
    if (mcap == null) return colunaVazia(col);
    return '<div class="col"><h3>' + col.titulo + "</h3>" +
      '<p class="grande num">' + C.fmtUSD(mcap) + "</p>" +
      '<p class="linha">' + C.fmtVezes(C.multiplicador(mcap, mcapHoje())) + " o valor de mercado de hoje</p>" +
      blocoTamanho(mcap) + "</div>";
  }

  function resultadoPreco() {
    var preco = C.lerNumero(estado.entradas.preco);
    if (preco == null) return "";
    return '<div class="colunas">' + colunas().map(function (col) { return colunaMcap(col, preco); }).join("") + "</div>";
  }

  function mcapEscolhido() {
    var e = estado.entradas;
    if (e.valer === "outro") return C.lerNumero(e.valerUsd);
    var p = regua().filter(function (x) { return x.id === e.valer; })[0];
    return p ? p.marketCap : null;
  }

  function resultadoValer() {
    var mcap = mcapEscolhido();
    if (mcap == null) return "";
    var usd = estado.coin.usd;
    return '<div class="colunas">' + colunas().map(function (col) {
      var preco = C.precoNoMcap(mcap, col.qtd);
      if (preco == null) return colunaVazia(col);
      return '<div class="col"><h3>' + col.titulo + "</h3>" +
        '<p class="grande num">' + C.fmtUSD(preco) + "</p>" +
        '<p class="linha">' + C.fmtVezes(C.multiplicador(preco, usd)) + " o preço de hoje (" + C.fmtUSD(usd) + ")</p></div>";
    }).join("") + "</div>";
  }

  function resultadoDinheiro() {
    var e = estado.entradas, c = estado.coin;
    var valor = C.lerNumero(e.investido), alvo = C.lerNumero(e.alvo);
    var r = C.meuDinheiro(valor, c.usd, alvo);
    if (!r) return "";
    var cls = r.lucro >= 0 ? "pos" : "neg";
    var sinal = r.lucro >= 0 ? "+" : "−";
    return '<div class="dinheiro">' +
      '<div class="col"><h3>Você compra</h3><p class="grande num">' + C.fmtQtd(r.tokens) + " " + esc(c.symbol) + "</p></div>" +
      '<div class="col"><h3>Valeria</h3><p class="grande num">' + C.fmtUSD(r.valorFinal) + "</p></div>" +
      '<div class="col"><h3>Resultado</h3><p class="grande num ' + cls + '">' + sinal + C.fmtUSD(Math.abs(r.lucro)) +
        '</p><p class="linha num ' + cls + '">' + sinal + C.fmtPct(Math.abs(r.lucroPct) / 100) + "</p></div>" +
      "</div>" +
      '<p class="linha">Para ' + esc(c.symbol) + " chegar a " + C.fmtUSD(alvo) + ", o projeto precisa valer:</p>" +
      '<div class="colunas">' + colunas().map(function (col) { return colunaMcap(col, alvo); }).join("") + "</div>";
  }

  function renderResultado() {
    var html = estado.aba === "preco" ? resultadoPreco()
      : estado.aba === "valer" ? resultadoValer()
      : resultadoDinheiro();
    var el = $("mc-res");
    if (el) el.innerHTML = html;
  }

  function campo(id, rotulo, valor, dica) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + "</label>" +
      '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(valor) + '">' +
      (dica ? '<p class="dica">' + dica + "</p>" : "") + "</div>";
  }

  function renderPainel() {
    var e = estado.entradas, c = estado.coin, html;
    if (estado.aba === "preco") {
      html = '<div class="campos">' + campo("mc-in-preco", "Se " + esc(c.symbol) + " chegar a (US$)", e.preco,
        "Hoje: " + C.fmtUSD(c.usd) + ". Aceita 0,5 · 1 · 2.500") + "</div>";
    } else if (estado.aba === "valer") {
      var ops = regua().map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (e.valer === p.id ? " selected" : "") + ">" +
          esc(p.name) + " (" + C.fmtUSD(p.marketCap) + ")</option>";
      }).join("");
      html = '<div class="campos"><div class="campo"><label for="mc-in-valer">Se ' + esc(c.symbol) + " valesse o mesmo que</label>" +
        '<select id="mc-in-valer">' + ops + '<option value="outro"' + (e.valer === "outro" ? " selected" : "") + ">Outro valor…</option></select></div>" +
        (e.valer === "outro" ? campo("mc-in-valerusd", "Valor de mercado (US$)", e.valerUsd, "Ex.: 10 bi · 500 mi") : "") +
        "</div>";
    } else {
      html = '<div class="campos">' +
        campo("mc-in-investido", "Quanto você investe (US$)", e.investido, "") +
        campo("mc-in-alvo", "Se " + esc(c.symbol) + " chegar a (US$)", e.alvo, "Hoje: " + C.fmtUSD(c.usd)) +
        "</div>";
    }
    $("mc-painel").innerHTML = html + '<div id="mc-res" class="res"></div>';
    renderResultado();
  }

  function ligarCalculadora() {
    document.querySelector(".abas").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-aba]");
      if (!b || !estado.coin) return;
      estado.aba = b.getAttribute("data-aba");
      document.querySelectorAll(".abas button").forEach(function (x) {
        x.setAttribute("aria-selected", String(x === b));
      });
      renderPainel();
    });
    var mapa = { "mc-in-preco": "preco", "mc-in-valerusd": "valerUsd", "mc-in-investido": "investido", "mc-in-alvo": "alvo" };
    $("mc-painel").addEventListener("input", function (ev) {
      var k = mapa[ev.target.id];
      if (!k) return;
      estado.entradas[k] = ev.target.value;
      renderResultado();
    });
    $("mc-painel").addEventListener("change", function (ev) {
      if (ev.target.id !== "mc-in-valer") return;
      estado.entradas.valer = ev.target.value;
      renderPainel(); /* "Outro valor…" mostra/esconde o campo de US$ */
    });
  }
```

- [ ] **Step 2: Wire it up in `iniciar`**

In `iniciar()`, after `ligarBusca();`, add:

```js
    ligarCalculadora();
```

- [ ] **Step 3: Verify in the browser**

Reload `http://localhost:8777/Ferramentas/calculadora-market-cap/index.html?token=jupiter&atlas-dev=1` and check with `read_page` after each action:
1. "Preço sonhado" tab: type `1`. Two columns appear ("Com os tokens de hoje" / "Quando tudo desbloquear"), each with the market cap required, "N× o valor de mercado de hoje", a ranking line and the ruler list (Bitcoin…Hyperliquid). The right column's value is greater than or equal to the left one.
2. Type `0,5`, then `2.500`. The results update and the field keeps focus (typing continues without clicking).
3. Type `abc`. The result area is empty and the console has no errors.
4. "Valer como" tab: the select lists the 6 ruler projects with their values. Choose Solana: two prices appear with "N× o preço de hoje". Choose "Outro valor…" and type `10 bi`: the prices update.
5. "Meu dinheiro" tab: with `100` and target `1`, you see tokens bought, final value, gain in green with %, and the two market-cap columns below.
6. Open `?token=bitcoin&atlas-dev=1`, "Preço sonhado" `1000000`: the ranking line says "Maior que …, o 1º do ranking hoje" (Bitcoin is excluded from its own comparison, so the 1º is Ethereum).
7. `read_console_messages {onlyErrors:true}`: empty.

- [ ] **Step 4: Commit**

```bash
git add Ferramentas/calculadora-market-cap/app.js
git commit -m "Calculadora de Market Cap: abas preco sonhado, valer como e meu dinheiro com regua e ranking"
```

---

### Task 5: Explicação, card na bancada e service worker

**Files:**
- Modify: `Ferramentas/calculadora-market-cap/app.js` (replace the `renderExplica` stub)
- Modify: `pages/ferramentas.html` (new `<section class="tools-sec">` "Estudar o mercado" after the "Gerir o dinheiro" section; the "Em breve" card stays untouched)
- Modify: `sw.js` (`VERSAO`)

**Interfaces:**
- Consumes: `estado`, `esc`, `C.*`.
- Produces: final `renderExplica()`.

- [ ] **Step 1: Replace the `renderExplica` stub**

In `app.js`, replace:

```js
  function renderExplica() { $("mc-explica").textContent = ""; }
```

with:

```js
  /* ---------- explicação ----------
     Curta e com os números do token da tela. Sem token, fala em geral. */
  function renderExplica() {
    var c = estado.coin, el = $("mc-explica");
    var of = c ? C.oferta(c.supply) : null;
    var exemplo = "";
    if (c && of && of.circulante != null && c.usd) {
      exemplo = "<p>No " + esc(c.symbol) + ": " + C.fmtUSD(c.usd) + " × " + C.fmtQtd(of.circulante) +
        " tokens = " + C.fmtUSD(C.mcapNoPreco(c.usd, of.circulante)) + " de valor de mercado.</p>";
    }
    var fdv = "";
    if (c && of && of.pctCirculando != null && of.pctCirculando < 0.999) {
      fdv = "<p>Hoje circulam " + C.fmtPct(of.pctCirculando) + " dos tokens de " + esc(c.symbol) +
        ". Os outros " + C.fmtPct(1 - of.pctCirculando) + " ainda vão entrar no mercado. Para o preço ficar parado, " +
        "o projeto precisa crescer na mesma proporção.</p>";
    }
    el.innerHTML =
      "<h2>Como ler estes números</h2>" +
      "<h3>O tamanho da pizza, não o preço da fatia</h3>" +
      "<p>O preço de um token, sozinho, não diz se ele está barato ou caro. O que diz é o valor de mercado: " +
      "<b>preço × quantidade de tokens</b>. Um token de centavos pode valer mais que um de centenas de dólares, " +
      "porque cada projeto fatia a sua pizza em um número diferente de pedaços.</p>" + exemplo +
      "<h3>Os tokens que ainda vão entrar (FDV)</h3>" +
      "<p>Muitos projetos ainda vão liberar tokens para equipe, investidores e comunidade. O FDV é o valor de mercado " +
      "se todos os tokens já existissem. Quando a coluna \"quando tudo desbloquear\" é bem maior que a de hoje, há " +
      "pressão de venda no caminho.</p>" + fdv +
      "<h3>Ter mais unidades não é vantagem</h3>" +
      "<p>Com US$ 100 você compra milhares de um token barato ou uma fração de um caro. Se os dois projetos " +
      "dobrarem de tamanho, os dois US$ 100 viram US$ 200. O lucro vem de quanto o valor de mercado cresce, " +
      "não da quantidade de tokens.</p>" +
      "<h3>Token pequeno sobe mais fácil e cai mais fácil</h3>" +
      "<p>Um projeto pequeno precisa de menos dinheiro para dobrar, e por isso mesmo pode cair ou sumir com " +
      "pouco dinheiro saindo. O que manda é a liquidez: quanto dinheiro existe de verdade para comprar e vender.</p>" +
      '<p class="nota">Antes de sonhar com um preço, multiplique pela quantidade de tokens e pergunte: esse projeto vale isso?</p>';
  }
```

`desenharTudo()` already calls `renderExplica()` after a token loads, so nothing else changes there.

- [ ] **Step 2: Add the "Estudar o mercado" section to `pages/ferramentas.html`**

The calculator is a study tool with no link to the portfolio, so it does not belong under "Gerir o dinheiro / Para onde vai o seu caixa?". Leave that section, including its "Em breve" card and its counter `2`, untouched.

Right after the `</section>` that closes the "Gerir o dinheiro" section (just before `</main>`), insert:

```html
    <!-- ============ SEÇÃO · Estudar o mercado ============
         Ferramentas de estudo: simulam e explicam, sem ler nem gravar
         nada da carteira. -->
    <section class="tools-sec">
      <div class="tools-sec__head">
        <span class="tools-sec__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="M7 15l4-4 3 3 5-6"/>
          </svg>
        </span>
        <h2 class="tools-sec__title">Estudar o mercado</h2>
        <span class="tools-sec__sub">Simulações para entender, sem mexer na carteira</span>
        <span class="tools-sec__count">1</span>
      </div>

      <div class="tools-grid">
```

then the card below, and then close the section with:

```html
      </div>
    </section>
```

The card:

```html
        <!-- FERRAMENTA · Calculadora de Market Cap
             Mora em Ferramentas/calculadora-market-cap/ (HTML + calculo.js
             testado no Node). Ensina que o preço da unidade não diz se o
             token é barato: valor de mercado, FDV e desbloqueio.
             Prefixo "mcap-" nos ids do SVG. -->
        <a class="tool-card" href="../Ferramentas/calculadora-market-cap/index.html">
          <span class="tool-card__badge tool-card__badge--free">Grátis</span>
          <!-- Ícone em volume: pizza com uma fatia saindo. -->
          <span class="tool-card__icon tool-card__icon--mcap" aria-hidden="true">
            <svg viewBox="0 0 56 56">
              <defs>
                <radialGradient id="mcap-massa" cx=".4" cy=".35" r=".9">
                  <stop offset="0" stop-color="#FDE68A"/><stop offset=".6" stop-color="#F59E0B"/><stop offset="1" stop-color="#B45309"/>
                </radialGradient>
                <linearGradient id="mcap-fatia" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#FCA5A5"/><stop offset="1" stop-color="#DC2626"/>
                </linearGradient>
              </defs>
              <ellipse cx="27" cy="50" rx="18" ry="2.6" fill="#000" opacity=".28"/>
              <!-- pizza sem a fatia -->
              <path d="M26 28 L26 8 A20 20 0 1 0 43.3 38 Z" fill="url(#mcap-massa)"/>
              <circle cx="18" cy="22" r="2.6" fill="#B91C1C" opacity=".85"/>
              <circle cx="15" cy="33" r="2.4" fill="#B91C1C" opacity=".85"/>
              <circle cx="25" cy="39" r="2.6" fill="#B91C1C" opacity=".85"/>
              <circle cx="33" cy="34" r="2.2" fill="#B91C1C" opacity=".85"/>
              <!-- a fatia, deslocada para fora -->
              <path d="M31 25 L31 5 A20 20 0 0 1 48.3 35 Z" fill="url(#mcap-fatia)"/>
              <path d="M31 5 A20 20 0 0 1 48.3 35" fill="none" stroke="#FEF3C7" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
              <circle cx="38" cy="17" r="2.2" fill="#FEF3C7" opacity=".85"/>
            </svg>
          </span>
          <h3 class="tool-card__title">Calculadora de Market Cap</h3>
          <p class="tool-card__desc">Barato ou caro é o tamanho da pizza, não o preço da fatia. Veja o valor de mercado, quanto ainda vai ser desbloqueado e o tamanho que um preço sonhado exige.</p>
          <div class="tool-card__chips">
            <span class="tool-card__chip">Preço sonhado</span>
            <span class="tool-card__chip">Valer como</span>
            <span class="tool-card__chip">Meu dinheiro</span>
          </div>
          <span class="tool-card__cta">
            Abrir ferramenta
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </span>
        </a>
```

Finally, in the page's `<meta name="description">` replace `Financas (entradas e saidas) e Scanner Pools (pools de liquidez).` with `Financas (entradas e saidas), Scanner Pools (pools de liquidez) e Calculadora de Market Cap.`

- [ ] **Step 3: Check that `.tool-card__icon--mcap` needs no extra CSS**

Run: `grep -n "tool-card__icon--scan\|tool-card__icon--fin" css/ferramentas.css`
If those modifiers have rules (background or color), add a matching `.tool-card__icon--mcap` rule next to them in `css/ferramentas.css`, copying the `--fin` rule. If there is no match, do nothing.

- [ ] **Step 4: Bump the service worker**

In `sw.js`, replace:

```js
var VERSAO = "atlas-v89";
```

with:

```js
/* v90 = entrou a Calculadora de Market Cap (Ferramentas/calculadora-
   market-cap/), ferramenta de estudo na seção nova "Estudar o mercado"
   da bancada. */
var VERSAO = "atlas-v90";
```

- [ ] **Step 5: Run the tests again**

Run: `node --test Ferramentas/calculadora-market-cap/calculo.test.cjs && node --test Ferramentas/scanner-pools/regras.test.cjs`
Expected: both PASS (the Scanner test proves the `coingecko.js` change broke nothing it covers).

- [ ] **Step 6: Final verification in the browser**

1. `http://localhost:8777/pages/ferramentas.html?atlas-dev=1`: "Gerir o dinheiro" is unchanged (Finanças, Scanner Pools, "Em breve", counter 2). Below it, the new section "Estudar o mercado" (counter 1) shows the "Calculadora de Market Cap" card with the pizza icon. Click it to open the tool. The top of the tool shows the line "Simulação para estudo…".
2. Without `?token`, the tool shows only the search and the explanation in general terms.
3. Load JUP. The explanation now shows "No JUP: …" and the "Hoje circulam X%" paragraph.
4. `resize_window {preset:"mobile"}` and reload: no horizontal scroll (`javascript_tool`: `document.documentElement.scrollWidth <= innerWidth` → `true`), the columns stack and the tabs wrap. Then `resize_window {preset:"desktop"}`.
5. `read_console_messages {onlyErrors:true}`: empty.
6. Screenshot of the tool with JUP loaded on the "Preço sonhado" tab at US$ 1, to show the owner.

- [ ] **Step 7: Commit**

```bash
git add Ferramentas/calculadora-market-cap/app.js pages/ferramentas.html sw.js css/ferramentas.css
git commit -m "Calculadora de Market Cap: explicacao, card na bancada e service worker v90"
```

(If `css/ferramentas.css` did not change in Step 3, git simply ignores it.)
