/* ============================================================
   nuvem.js — o Finanças igual no celular e no computador
   ------------------------------------------------------------
   24/10/2026: cada aparelho tinha a sua cópia (localStorage). O dono
   importou o extrato no computador e o celular seguiu vazio.

   Agora o estado também fica em atlas_users/{uid}/financas/estado
   (a regra do Firestore só deixa o próprio usuário ler e gravar a
   subárvore dele — docs/firestore-atlas-rules.txt). O Firebase é o
   mesmo que o login carrega (core/atlas-secure.js); sem login (modo
   dev em localhost) nada disto roda e o app segue só local.

   Nunca "a mais nova apaga a outra": toda vez que chega a versão da
   nuvem, ela é JUNTADA com a local (js/core/sincronia.js) e a junção
   volta para a nuvem. O celular vazio não apaga o computador.
   ============================================================ */
import { lerEstado, salvarEstado, migrarEstado } from "../core/store.js";
import { mesclar, iguais } from "../core/sincronia.js";

const LIMITE = 900000; // o documento do Firestore aguenta 1 MB
let ref = null, remoto = null, timer = null, aparelho = "";
const estado = { situacao: "local" };

function avisar(situacao) {
  estado.situacao = situacao;
  window.dispatchEvent(new CustomEvent("financas:nuvem", { detail: situacao }));
}

export function situacaoNuvem() {
  return estado.situacao;
}

function lerDoc(data) {
  try { return migrarEstado(JSON.parse(data.json)); } catch (e) { return null; }
}

function enviar(m) {
  if (!ref) return;
  const json = JSON.stringify(m);
  if (json.length > LIMITE) { avisar("cheio"); return; }
  ref.set({ json, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(), device: aparelho })
    .then(() => avisar("ok"))
    .catch(() => avisar("erro"));
}

/* Chegou versão da nuvem (abrindo o app ou outro aparelho gravou). */
function receber(snap) {
  const daNuvem = snap.exists ? lerDoc(snap.data()) : null;
  if (snap.exists && !daNuvem) { avisar("erro"); return; } // não sobrescreve o que não conseguiu ler
  remoto = daNuvem;
  const local = lerEstado();
  const junto = daNuvem ? migrarEstado(mesclar(local, daNuvem)) : local;
  if (!iguais(junto, local)) {
    const antes = local.lancamentos.length;
    salvarEstado(junto);
    window.dispatchEvent(new CustomEvent("financas:mudou", { detail: { remoto: true, antes, depois: junto.lancamentos.length } }));
  }
  if (!daNuvem || !iguais(junto, daNuvem)) {
    if (daNuvem || junto.lancamentos.length || Object.keys(junto.aprendizado).length) enviar(junto);
  } else avisar("ok");
}

/* Mudou aqui: junta com a última versão da nuvem e manda. */
function mudouAqui(e) {
  if (e.detail && e.detail.remoto) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!ref) return;
    const local = lerEstado();
    const junto = remoto ? migrarEstado(mesclar(local, remoto)) : local;
    if (!iguais(junto, local)) salvarEstado(junto);
    remoto = junto;
    enviar(junto);
  }, 1200);
}

function idAparelho() {
  try {
    let d = localStorage.getItem("financas.aparelho");
    if (!d) { d = "ap-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("financas.aparelho", d); }
    return d;
  } catch (e) { return "ap-x"; }
}

/* O Firebase chega depois (atlas-secure carrega cinco arquivos em fila). */
function esperarFirebase(cb, vezes = 0) {
  const fb = window.firebase;
  if (fb && fb.firestore && fb.auth && fb.apps && fb.apps.length) { cb(fb); return; }
  if (window.ATLAS_DEV_SEM_LOGIN || vezes > 120) return; // ~30 s
  setTimeout(() => esperarFirebase(cb, vezes + 1), 250);
}

let desligar = null;
esperarFirebase((fb) => {
  aparelho = idAparelho();
  fb.auth().onAuthStateChanged((usuario) => {
    if (desligar) { desligar(); desligar = null; }
    if (!usuario) { ref = null; remoto = null; avisar("local"); return; }
    avisar("conectando");
    ref = fb.firestore().collection("atlas_users").doc(usuario.uid).collection("financas").doc("estado");
    desligar = ref.onSnapshot(receber, () => avisar("erro"));
  });
});

window.addEventListener("financas:mudou", mudouAqui);
