import { b64url } from './crypto.mjs';

const codificador = new TextEncoder();

function pemParaDer(pem) {
  const corpo = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
}

export function docIdFirestore(chave) {
  return String(chave).replace(/\./g, '__');
}

export function criarFirestore({ contaServico, fetcher, agora = () => Date.now() }) {
  let conta = null;
  try { conta = typeof contaServico === 'string' ? JSON.parse(contaServico) : contaServico; } catch { conta = null; }
  if (!conta?.client_email || !conta?.private_key || !conta?.project_id) throw new Error('Conta de serviço incompleta.');
  let cache = null;

  async function tokenGoogle() {
    if (cache && cache.exp - 60000 > agora()) return cache.token;
    const iat = Math.floor(agora() / 1000);
    const cab = b64url(codificador.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const corpo = b64url(codificador.encode(JSON.stringify({ iss: conta.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })));
    const chave = await crypto.subtle.importKey('pkcs8', pemParaDer(conta.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, codificador.encode(cab + '.' + corpo)));
    const r = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cab}.${corpo}.${b64url(sig)}` }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('token google ' + r.status);
    const j = await r.json();
    cache = { token: j.access_token, exp: agora() + (Number(j.expires_in) || 3600) * 1000 };
    return cache.token;
  }

  async function lerChave(uid, chave) {
    if (!/^[A-Za-z0-9]{1,128}$/.test(String(uid))) throw new Error('uid inválido');
    if (!/^atlas\.[a-z0-9.]+$/.test(String(chave))) throw new Error('chave inválida');
    const url = `https://firestore.googleapis.com/v1/projects/${conta.project_id}/databases/(default)/documents/atlas_users/${uid}/store/${docIdFirestore(chave)}`;
    const r = await fetcher(url, { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { valor: null, atualizado: null };
    if (!r.ok) throw new Error('firestore ' + r.status);
    const d = await r.json();
    const bruto = d.fields?.value?.stringValue;
    const atualizado = d.fields?.updatedAt?.timestampValue || d.updateTime || null;
    if (typeof bruto !== 'string') return { valor: null, atualizado };
    try { return { valor: JSON.parse(bruto), atualizado }; } catch { return { valor: null, atualizado, corrompido: true }; }
  }

  return { lerChave };
}
