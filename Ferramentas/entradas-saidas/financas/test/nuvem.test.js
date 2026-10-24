/* js/ui/nuvem.js com um Firebase de mentira: dois "aparelhos"
   (celular e computador) falando com o mesmo documento. */
import test from "node:test";
import assert from "node:assert/strict";

/* nuvem em memória: um documento, vários ouvintes */
const nuvem = { doc: null, ouvintes: new Set() };
function snap() {
  return { exists: !!nuvem.doc, data: () => nuvem.doc };
}
const fakeFirebase = (uid) => ({
  apps: [1],
  auth: () => ({ onAuthStateChanged: (cb) => setTimeout(() => cb({ uid }), 0) }),
  firestore: Object.assign(() => ({
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({
      set: (d) => { nuvem.doc = { json: d.json }; nuvem.ouvintes.forEach((f) => setTimeout(() => f(snap()), 0)); return Promise.resolve(); },
      onSnapshot: (f) => { nuvem.ouvintes.add(f); setTimeout(() => f(snap()), 0); return () => nuvem.ouvintes.delete(f); }
    }) }) }) })
  }), { FieldValue: { serverTimestamp: () => 0 } })
});

class LS { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} }

/* Cada aparelho: o próprio localStorage e a própria cópia do módulo. */
async function aparelho(nome, lancs) {
  const ls = new LS();
  if (lancs) ls.setItem("finance-dashboard-state", JSON.stringify({ versao: 2, lancamentos: lancs }));
  const alvo = new EventTarget();
  globalThis.window = { firebase: fakeFirebase("u1"), addEventListener: alvo.addEventListener.bind(alvo), dispatchEvent: alvo.dispatchEvent.bind(alvo) };
  globalThis.localStorage = ls;
  await import(`../js/ui/nuvem.js?${nome}`);
  await espera();
  const ctx = { ls, janela: globalThis.window };
  return {
    ler: () => JSON.parse(ls.getItem("finance-dashboard-state")),
    // grava como as telas gravam (no contexto deste aparelho)
    lancar: (l) => {
      const s = JSON.parse(ls.getItem("finance-dashboard-state"));
      s.lancamentos.push(l);
      ls.setItem("finance-dashboard-state", JSON.stringify(s));
      ctx.janela.dispatchEvent(new CustomEvent("financas:mudou"));
    }
  };
}
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const L = (id, extra = {}) => ({ id, data: "2026-10-12", tipo: "saida", centavos: 1000, descricao: "Uber", categoria: "Transporte", criadoEm: 1, ...extra });

test("computador com dados sobe; celular vazio recebe tudo e não apaga nada", async () => {
  const pc = await aparelho("pc", [L("a"), L("b", { centavos: 2000 })]);
  assert.equal(JSON.parse(nuvem.doc.json).lancamentos.length, 2);
  const cel = await aparelho("cel", null);
  assert.equal(cel.ler().lancamentos.length, 2);
  assert.equal(JSON.parse(nuvem.doc.json).lancamentos.length, 2);
  assert.equal(pc.ler().lancamentos.length, 2);
});
