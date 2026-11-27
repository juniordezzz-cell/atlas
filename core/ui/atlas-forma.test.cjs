/* ATLAS · core/ui/atlas-forma.test.cjs  (27/11/2026)
   Trava da forma suave: todo canto do site sai da escala única
   --atlas-r-* definida em core/ui/atlas-shell.css.

       node --test core/ui/atlas-forma.test.cjs

   Se falhar: troque o número solto pelo degrau da escala, sempre com o
   valor de reserva, por exemplo  border-radius: var(--atlas-r-sm, 12px);
     xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · pill 999px · círculo 50%
   Não crie um valor novo para "só esta tela": foi assim que o site chegou
   a 30 valores diferentes e ficou quadrado.
   Spec: docs/superpowers/specs/2026-11-27-forma-suave-design.md */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');
const FORA = /^(referencias|docs|laboratorio|estudio|node_modules)\/|vendor\/|\.min\.|^sw\.js$/;

/* arquivos do site (sem as pastas de terceiros, laboratório e documentos) */
function arquivos() {
  const out = [];
  (function anda(dir) {
    for (const nome of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      if (nome.name.startsWith('.')) continue;
      const rel = dir ? dir + '/' + nome.name : nome.name;
      if (FORA.test(rel + (nome.isDirectory() ? '/' : ''))) continue;
      if (nome.isDirectory()) anda(rel);
      else if (/\.(css|html|js)$/.test(nome.name)) out.push(rel);
    }
  })('');
  return out;
}

const PROP = /border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;"'`}!<>\n]+)/g;
const DEGRAU = /var\(--atlas-r-(xxs|xs|sm|md|lg|xl|pill),\s*([^)]+)\)/g;
// tira os var(...) (com a reserva dentro) e vê se sobrou número com px
const semVar = (v) => v.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
const ESCALA = { xxs: '4px', xs: '8px', sm: '12px', md: '16px', lg: '20px', xl: '24px', pill: '999px' };

const LISTA = arquivos();
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

test('o leitor acha os arquivos do site', () => {
  assert.ok(LISTA.length > 100, 'só achou ' + LISTA.length + ' arquivos');
  assert.ok(LISTA.includes('core/ui/atlas-shell.css'));
});

test('nenhum border-radius com px solto (use a escala --atlas-r-*)', () => {
  const ruins = [];
  for (const f of LISTA) {
    const s = ler(f);
    for (const m of s.matchAll(PROP)) {
      if (/\d*\.?\d+px/.test(semVar(m[1]))) {
        const linha = s.slice(0, m.index).split('\n').length;
        ruins.push(f + ':' + linha + '  ' + m[0].trim());
      }
    }
  }
  assert.deepEqual(ruins, [], 'cantos fora da escala:\n' + ruins.join('\n'));
});

test('a reserva de cada degrau bate com a escala', () => {
  const ruins = [];
  for (const f of LISTA) {
    for (const m of ler(f).matchAll(DEGRAU)) if (m[2].trim() !== ESCALA[m[1]]) ruins.push(f + '  ' + m[0]);
  }
  assert.deepEqual(ruins, [], 'reserva diferente do degrau:\n' + ruins.join('\n'));
});

test('a escala --atlas-r-* é definida num lugar só (core/ui/atlas-shell.css)', () => {
  const donos = LISTA.filter((f) => /--atlas-r-(xxs|xs|sm|md|lg|xl|pill)\s*:/.test(ler(f)));
  assert.deepEqual(donos, ['core/ui/atlas-shell.css']);
});

test('a escala tem os sete degraus com os valores da spec', () => {
  const s = ler('core/ui/atlas-shell.css');
  for (const [k, v] of Object.entries(ESCALA)) {
    assert.match(s, new RegExp('--atlas-r-' + k + ':\\s*' + v + ';'), 'falta --atlas-r-' + k + ': ' + v);
  }
});
