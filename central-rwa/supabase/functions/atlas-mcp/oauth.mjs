import { aleatorio, sha256b64url, pkceConfere, assinar, verificar } from './crypto.mjs';

export const REDIRECTS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const FIREBASE_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=';
const PEDIDO_MS = 10 * 60000;

export function metadadosRecurso(base) {
  return { resource: base + '/mcp', authorization_servers: [base], bearer_methods_supported: ['header'], resource_name: 'Atlas' };
}

export function metadadosServidor(base) {
  return {
    issuer: base,
    authorization_endpoint: base + '/authorize',
    token_endpoint: base + '/token',
    registration_endpoint: base + '/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

// Clientes MCP validam /.well-known/openid-configuration com o esquema OIDC, que exige estes
// campos. O conector não emite id_token; o jwks é vazio e só existe para o documento ser válido.
export function metadadosOidc(base) {
  return { ...metadadosServidor(base), jwks_uri: base + '/jwks', subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'] };
}

export async function registrar(corpo, { segredo }) {
  const uris = corpo?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 4 || !uris.every((u) => REDIRECTS.includes(u))) {
    return { status: 400, corpo: { error: 'invalid_redirect_uri', error_description: 'Só o Claude pode se registrar neste conector.' } };
  }
  const nome = String(corpo.client_name || 'Claude').slice(0, 80);
  const client_id = await assinar({ r: uris, n: nome }, segredo);
  return { status: 201, corpo: { client_id, client_name: nome, redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' } };
}

export async function autorizar(params, { segredo, pagina, agora }) {
  const clientId = params.get('client_id');
  const cliente = await verificar(clientId, segredo);
  const redirect = params.get('redirect_uri');
  if (!cliente || !Array.isArray(cliente.r) || !cliente.r.includes(redirect)) {
    return { status: 400, texto: 'Cliente ou endereço de retorno inválido. Remova e adicione o conector de novo no Claude.' };
  }
  const challenge = params.get('code_challenge') || '';
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return { status: 400, texto: 'Pedido de autorização incompleto: PKCE S256 é obrigatório.' };
  }
  const req = await assinar({ c: clientId, r: redirect, ch: challenge, s: params.get('state') || '', exp: agora() + PEDIDO_MS }, segredo);
  return { status: 302, local: pagina + '?req=' + encodeURIComponent(req) };
}

export async function concluir(corpo, { segredo, store, fetcher, chaveWeb, permitidos }) {
  const pedido = await verificar(corpo?.req, segredo);
  if (!pedido || !pedido.c || !pedido.r || !pedido.ch) return { status: 400, corpo: { error: 'O pedido expirou. Volte ao Claude e conecte de novo.' } };
  if (typeof corpo.idToken !== 'string' || !/^[A-Za-z0-9._-]+$/.test(corpo.idToken)) return { status: 401, corpo: { error: 'Entre no Atlas para autorizar.' } };
  let user;
  try {
    const r = await fetcher(FIREBASE_LOOKUP + chaveWeb, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: corpo.idToken }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { status: 401, corpo: { error: 'Sessão expirada. Entre de novo.' } };
    user = (await r.json()).users?.[0];
  } catch { return { status: 503, corpo: { error: 'Não consegui validar a sessão. Tente de novo.' } }; }
  if (!user?.localId) return { status: 401, corpo: { error: 'Sessão inválida. Entre de novo.' } };
  if (!permitidos.includes(String(user.email || '').toLowerCase()) || ![true, 'true'].includes(user.emailVerified)) {
    return { status: 403, corpo: { error: 'Esta conta não tem permissão para conectar o Claude ao Atlas.' } };
  }
  const code = aleatorio();
  await store.salvarCodigo({ hash: await sha256b64url(code), uid: String(user.localId), clientId: pedido.c, redirectUri: pedido.r, challenge: pedido.ch, segundos: 300 });
  const q = new URLSearchParams({ code });
  if (pedido.s) q.set('state', pedido.s);
  return { status: 200, corpo: { redirect: pedido.r + '?' + q } };
}

async function emitirTokens(store, uid, clientId, familia) {
  const acesso = aleatorio(), renovacao = aleatorio();
  await store.salvarToken({ hash: await sha256b64url(acesso), tipo: 'acesso', uid, clientId, familia, segundos: 3600 });
  await store.salvarToken({ hash: await sha256b64url(renovacao), tipo: 'renovacao', uid, clientId, familia, segundos: 2592000 });
  return { access_token: acesso, token_type: 'Bearer', expires_in: 3600, refresh_token: renovacao };
}

const concessaoNegada = (descricao) => ({ status: 400, corpo: { error: 'invalid_grant', error_description: descricao } });

export async function trocarToken(form, { store }) {
  const tipo = form.get('grant_type'), clientId = form.get('client_id') || '';
  if (tipo === 'authorization_code') {
    const code = form.get('code');
    if (!code) return concessaoNegada('Código ausente.');
    const c = await store.consumirCodigo(await sha256b64url(code));
    if (!c || c.clientId !== clientId || c.redirectUri !== form.get('redirect_uri')) return concessaoNegada('Código inválido, já usado ou vencido.');
    if (!(await pkceConfere(form.get('code_verifier'), c.challenge))) return concessaoNegada('PKCE não confere.');
    return { status: 200, corpo: await emitirTokens(store, c.uid, c.clientId, aleatorio(16)) };
  }
  if (tipo === 'refresh_token') {
    const rt = form.get('refresh_token');
    if (!rt) return concessaoNegada('Token de renovação ausente.');
    const r = await store.usarRenovacao(await sha256b64url(rt));
    if (r.status !== 'ok' || r.clientId !== clientId) return concessaoNegada('Token de renovação inválido.');
    return { status: 200, corpo: await emitirTokens(store, r.uid, r.clientId, r.familia) };
  }
  return { status: 400, corpo: { error: 'unsupported_grant_type' } };
}

export async function autenticar(cabecalho, { store, limite = 60 }) {
  const t = String(cabecalho || '').match(/^Bearer ([A-Za-z0-9_-]{20,})$/)?.[1];
  if (!t) return { status: 401 };
  const r = await store.buscarToken(await sha256b64url(t), limite);
  if (r.status === 'ok') return { status: 200, uid: r.uid };
  return { status: r.status === 'limite' ? 429 : 401 };
}
