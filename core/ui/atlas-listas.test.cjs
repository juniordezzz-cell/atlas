/* ATLAS · core/ui/atlas-listas.test.cjs
   Confere que as listas do menu lateral (core/ui/atlas-listas.js) batem
   com o que as páginas mostram:
     - Ferramentas: os cards de pages/ferramentas.html, na mesma ordem;
     - Academy: as abas de academy/index.html (fora o "Início").

       node --test core/ui/atlas-listas.test.cjs

   Se falhar depois de criar ou renomear uma ferramenta: ajuste o card na
   página ou a linha na lista, até os dois dizerem a mesma coisa. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./atlas-listas.js');

const RAIZ = path.join(__dirname, '..', '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

/* hrefs dos cards, na ordem em que aparecem na página */
function cardsDaPagina() {
  const html = ler('pages/ferramentas.html').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<a\s+class="tool-card[^"]*"\s+href="\.\.\/([^"]+)"/g;
  const out = []; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

test('Ferramentas · a página tem cards (o leitor do teste ainda funciona)', () => {
  assert.ok(cardsDaPagina().length >= 5, 'nenhum card achado: o formato do <a class="tool-card"> mudou?');
});

test('Ferramentas · lista e cards são os mesmos, na mesma ordem', () => {
  const cards = cardsDaPagina();
  const lista = L.FERRAMENTAS.map((f) => f.href);
  const soNaPagina = cards.filter((h) => !lista.includes(h));
  const soNaLista = lista.filter((h) => !cards.includes(h));
  assert.deepEqual(soNaPagina, [], 'card sem linha em core/ui/atlas-listas.js: ' + soNaPagina.join(', '));
  assert.deepEqual(soNaLista, [], 'linha da lista sem card em pages/ferramentas.html: ' + soNaLista.join(', '));
  assert.deepEqual(lista, cards, 'mesma coisa, ordem diferente: a lista segue a ordem dos cards');
});

test('Ferramentas · cada item aponta para uma página que existe', () => {
  for (const f of L.FERRAMENTAS) {
    assert.ok(fs.existsSync(path.join(RAIZ, f.href)), f.nome + ': ' + f.href + ' não existe');
  }
});

test('Ferramentas · o slug é a pasta dentro de Ferramentas/ (marca o item da página aberta)', () => {
  for (const f of L.FERRAMENTAS) {
    assert.ok(f.href.startsWith('Ferramentas/' + f.slug + '/'), f.slug + ' não bate com ' + f.href);
  }
});

test('Academy · lista e abas da página são as mesmas', () => {
  const html = ler('academy/index.html');
  const abas = [...html.matchAll(/id="ac-tab-([a-z0-9-]+)"/g)].map((m) => m[1]).filter((s) => s !== 'inicio');
  assert.ok(abas.length >= 2, 'nenhuma aba achada: o id="ac-tab-…" mudou?');
  assert.deepEqual([...L.ACADEMY.map((a) => a.slug)].sort(), [...abas].sort());
  for (const a of L.ACADEMY) assert.equal(a.href, 'academy/index.html#' + a.slug);
});

test('Listas · todo item tem nome, ícone e slug sem repetir', () => {
  for (const nome of ['FERRAMENTAS', 'ACADEMY']) {
    const lista = L[nome];
    const slugs = lista.map((i) => i.slug);
    assert.equal(new Set(slugs).size, slugs.length, nome + ': slug repetido');
    for (const i of lista) {
      assert.ok(i.nome && i.icon && /^[a-z0-9-]+$/.test(i.slug), nome + ': item incompleto ' + JSON.stringify(i.slug));
    }
  }
});
