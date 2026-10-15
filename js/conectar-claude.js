/* ATLAS · Conectar o Claude ao Atlas (OAuth do conector MCP).
   O Claude abre a função atlas-mcp, que manda para cá com ?req=<pedido assinado>.
   Aqui o dono entra com o Google do Atlas e autoriza; a função devolve o
   endereço de retorno do Claude com o código. Ver docs/atlas-mcp.md. */
(function (raiz) {
  'use strict';

  async function concluirAutorizacao({ req, user, fetcher, baseFuncao }) {
    if (!req) throw new Error('Link incompleto. Volte ao Claude e conecte de novo.');
    const idToken = await user.getIdToken();
    const r = await fetcher(String(baseFuncao).replace(/\/$/, '') + '/functions/v1/atlas-mcp/authorize/concluir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ req, idToken }),
    });
    let j = {};
    try { j = await r.json(); } catch (_) { j = {}; }
    if (!r.ok || !j.redirect) throw new Error(j.error || 'Não foi possível autorizar. Tente de novo.');
    if (!/^https:\/\/claude\.(ai|com)\/api\/mcp\/auth_callback\?/.test(j.redirect)) throw new Error('Endereço de retorno inesperado. Nada foi autorizado.');
    return j.redirect;
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { concluirAutorizacao }; return; }

  const $ = (id) => document.getElementById(id);
  const ESTADOS = ['entrar', 'permitir', 'feito', 'erro'];
  function mostrar(estado, texto) {
    ESTADOS.forEach((n) => { $('estado-' + n).hidden = n !== estado; });
    if (texto) $('msg-' + estado).textContent = texto;
  }

  const req = new URLSearchParams(raiz.location.search).get('req');
  if (!req) { mostrar('erro', 'Link incompleto. Volte ao Claude e conecte de novo.'); return; }
  if (!raiz.firebase.apps.length) raiz.firebase.initializeApp(raiz.ATLAS_FIREBASE.config);
  const auth = raiz.firebase.auth();

  auth.onAuthStateChanged((user) => {
    if (!user) { mostrar('entrar'); return; }
    $('email').textContent = user.email || '';
    mostrar('permitir');
  });

  $('btn-entrar').addEventListener('click', () => {
    const provedor = new raiz.firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provedor).catch((e) => {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(provedor);
      mostrar('erro', 'Não deu para entrar: ' + ((e && e.message) || e));
    });
  });

  $('btn-permitir').addEventListener('click', async () => {
    $('btn-permitir').disabled = true;
    try {
      const destino = await concluirAutorizacao({ req, user: auth.currentUser, fetcher: raiz.fetch.bind(raiz), baseFuncao: raiz.ATLAS_SUPABASE.url });
      mostrar('feito');
      raiz.location.replace(destino);
    } catch (e) {
      $('btn-permitir').disabled = false;
      mostrar('erro', e.message);
    }
  });

  $('btn-cancelar').addEventListener('click', () => mostrar('erro', 'Conexão cancelada. Pode fechar esta aba.'));
})(typeof window !== 'undefined' ? window : globalThis);
