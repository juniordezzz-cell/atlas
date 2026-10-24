/* ============================================================
   sincronia.js — juntar o Finanças de dois aparelhos
   ------------------------------------------------------------
   24/10/2026: o dono importou o extrato no computador e o celular
   continuou vazio (cada aparelho tinha a sua cópia). A nuvem
   (js/ui/nuvem.js) guarda o estado, e este arquivo decide como
   juntar duas versões. Não é "a mais nova vence" — isso deixaria o
   celular vazio apagar o computador. É:

   • lançamentos: a união pelo id; o mesmo id nos dois lados → vale o
     editado por último (editadoEm, senão criadoEm);
   • apagados: `removidos` { id: quando } viaja junto e vence a união
     (apagou num aparelho, some no outro);
   • extrato importado nos DOIS aparelhos: ids diferentes, mesmo
     lançamento. Para cada dia+valor+nome fica o maior número de
     cópias que um lado tinha; as sobras (as criadas por último) viram
     apagadas, e os dois aparelhos escolhem igual;
   • aprendizado: união; metas: a editada por último.
   Puro e determinístico: mesclar(a, b) e mesclar(b, a) dão o mesmo.
   ============================================================ */
import { chaveRepetido } from "./extrato.js";

const quando = (l) => Math.max(Number(l.editadoEm) || 0, Number(l.criadoEm) || 0);
const ordem = (a, b) => (Number(a.criadoEm) || 0) - (Number(b.criadoEm) || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* Para empate no mesmo id: o editado por último; empate de novo, o
   de texto "maior" (só para os dois lados escolherem igual). */
function escolher(x, y) {
  const qx = quando(x), qy = quando(y);
  if (qx !== qy) return qx > qy ? x : y;
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y;
}

export function mesclar(a, b) {
  const A = a || {}, B = b || {};
  const removidos = { ...(A.removidos || {}) };
  for (const [id, t] of Object.entries(B.removidos || {})) removidos[id] = Math.max(removidos[id] || 0, Number(t) || 0);

  const porId = new Map();
  for (const l of [...(A.lancamentos || []), ...(B.lancamentos || [])]) {
    porId.set(l.id, porId.has(l.id) ? escolher(porId.get(l.id), l) : l);
  }

  // extrato importado nos dois lados: fica o maior número de cópias de um lado
  const idsA = new Set((A.lancamentos || []).map((l) => l.id));
  const idsB = new Set((B.lancamentos || []).map((l) => l.id));
  const grupos = new Map();
  for (const l of porId.values()) {
    if (l.origem !== "extrato" || removidos[l.id]) continue;
    const k = chaveRepetido(l);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  for (const lista of grupos.values()) {
    const ladoA = lista.filter((l) => idsA.has(l.id)).length;
    const ladoB = lista.filter((l) => idsB.has(l.id)).length;
    const manter = Math.max(ladoA, ladoB);
    lista.sort(ordem).slice(manter).forEach((l) => {
      removidos[l.id] = Math.max(removidos[l.id] || 0, quando(l));
    });
  }

  const lancamentos = [...porId.values()].filter((l) => !removidos[l.id]).sort(ordem);
  const metasDeA = (Number(A.metasEm) || 0) >= (Number(B.metasEm) || 0);
  const base = metasDeA ? A : B;
  return {
    ...B, ...A,
    versao: 2,
    lancamentos,
    removidos,
    aprendizado: { ...(B.aprendizado || {}), ...(A.aprendizado || {}) },
    metas: base.metas || { mensal: null, categorias: {} },
    metasEm: Math.max(Number(A.metasEm) || 0, Number(B.metasEm) || 0)
  };
}

/* Mesmo conteúdo? (ordem das chaves não importa) */
export function iguais(x, y) {
  return canonico(x) === canonico(y);
}

function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
