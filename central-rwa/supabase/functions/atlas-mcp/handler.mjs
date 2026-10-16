import { atenderMcp } from './mcp.mjs';
import { criarStore } from './store.mjs';
import { criarFirestore } from './firestore.mjs';
import { FERRAMENTAS } from './ferramentas.mjs';
import { metadadosRecurso, metadadosServidor, metadadosOidc, registrar, autorizar, concluir, trocarToken, autenticar } from './oauth.mjs';

const ORIGEM_SITE = 'https://juniordezzz-cell.github.io';
const PAGINA_PADRAO = ORIGEM_SITE + '/atlas/pages/conectar-claude.html';
const CHAVE_WEB_FIREBASE = 'AIzaSyCvHDXyRfaozjHKL0S9zvs9C00NS6Bd8cs';

function respostaJson(corpo, status = 200, extra = {}) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
}

function chaveServicoSupabase(env) {
  try { const m = JSON.parse(env.get('SUPABASE_SECRET_KEYS') || '{}'); if (m.default) return m.default; } catch { /* formato antigo */ }
  return env.get('SUPABASE_SERVICE_ROLE_KEY');
}

async function lerJson(req) {
  const t = await req.text();
  if (t.length > 200000) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

async function lerForm(req) {
  return new URLSearchParams((await req.text()).slice(0, 20000));
}

export function rotaDe(pathname) {
  const i = pathname.indexOf('/atlas-mcp');
  const resto = i >= 0 ? pathname.slice(i + '/atlas-mcp'.length) : pathname;
  return resto.replace(/\/+$/, '') || '/';
}

export function createHandler({ env, fetcher, store: storeInjetado = null, firestore: firestoreInjetado = null, agora = () => Date.now() }) {
  let store = storeInjetado, firestore = firestoreInjetado;

  function config() {
    const base = (env.get('ATLAS_MCP_BASE_URL') || '').replace(/\/$/, '');
    const segredo = env.get('ATLAS_MCP_SECRET') || '';
    if (!base || segredo.length < 32) return null;
    if (!store) {
      const url = env.get('SUPABASE_URL'), chave = chaveServicoSupabase(env);
      if (!url || !chave) return null;
      store = criarStore({ url, chave, fetcher });
    }
    return {
      base, segredo,
      pagina: env.get('ATLAS_MCP_PAGINA') || PAGINA_PADRAO,
      permitidos: (env.get('ATLAS_MCP_ALLOWED_EMAILS') || 'juniordezzz@gmail.com').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    };
  }

  function obterFirestore() {
    if (!firestore) firestore = criarFirestore({ contaServico: env.get('ATLAS_FIREBASE_SERVICE_ACCOUNT'), fetcher });
    return firestore;
  }

  return async (req) => {
    const c = config();
    if (!c) return respostaJson({ error: 'Conector do Atlas ainda não configurado no Supabase.' }, 503);
    const url = new URL(req.url), rota = rotaDe(url.pathname), metodo = req.method;
    try {
      if (metodo === 'GET' && (rota === '/.well-known/oauth-protected-resource' || rota === '/.well-known/oauth-protected-resource/mcp')) return respostaJson(metadadosRecurso(c.base));
      if (metodo === 'GET' && rota === '/.well-known/oauth-authorization-server') return respostaJson(metadadosServidor(c.base));
      if (metodo === 'GET' && rota === '/.well-known/openid-configuration') return respostaJson(metadadosOidc(c.base));
      if (metodo === 'GET' && rota === '/jwks') return respostaJson({ keys: [] });
      if (metodo === 'POST' && rota === '/register') { const r = await registrar(await lerJson(req), { segredo: c.segredo }); return respostaJson(r.corpo, r.status); }
      if (metodo === 'GET' && rota === '/authorize') {
        const r = await autorizar(url.searchParams, { segredo: c.segredo, pagina: c.pagina, agora });
        if (r.status === 302) return new Response(null, { status: 302, headers: { Location: r.local, 'Cache-Control': 'no-store' } });
        return new Response(r.texto, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (rota === '/authorize/concluir') {
        const cors = { 'Access-Control-Allow-Origin': ORIGEM_SITE, Vary: 'Origin' };
        if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
        if (metodo !== 'POST' || req.headers.get('Origin') !== ORIGEM_SITE) return respostaJson({ error: 'Origem não autorizada.' }, 403, cors);
        const r = await concluir(await lerJson(req), { segredo: c.segredo, store, fetcher, chaveWeb: env.get('ATLAS_FIREBASE_WEB_KEY') || CHAVE_WEB_FIREBASE, permitidos: c.permitidos });
        return respostaJson(r.corpo, r.status, cors);
      }
      if (metodo === 'POST' && rota === '/token') { const r = await trocarToken(await lerForm(req), { store }); return respostaJson(r.corpo, r.status); }
      if (rota === '/mcp') {
        if (metodo !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
        const a = await autenticar(req.headers.get('Authorization'), { store });
        if (a.status === 429) return respostaJson({ error: 'Muitas chamadas; espere um minuto.' }, 429);
        if (a.status !== 200) return respostaJson({ error: 'invalid_token' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${c.base}/.well-known/oauth-protected-resource"` });
        const msg = await lerJson(req);
        if (msg === undefined) return respostaJson({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, 400);
        const contexto = { uid: a.uid, segredo: c.segredo, agora, get firestore() { return obterFirestore(); } };
        const r = await atenderMcp(msg, { ferramentas: FERRAMENTAS, contexto });
        return r.corpo === null ? new Response(null, { status: 202 }) : respostaJson(r.corpo, r.status);
      }
      return respostaJson({ error: 'Rota não encontrada.' }, 404);
    } catch (e) {
      console.error('atlas-mcp', rota, String(e?.message || e).slice(0, 120));
      return respostaJson({ error: 'Falha interna. Nada foi alterado.' }, 500);
    }
  };
}
