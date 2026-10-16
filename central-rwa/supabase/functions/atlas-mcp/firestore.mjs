import { b64url } from './crypto.mjs';

const codificador = new TextEncoder();

function pemParaDer(pem) {
  const corpo = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
}

export function docIdFirestore(chave) {
  return String(chave).replace(/\./g, '__');
}

export class ConflitoGravacao extends Error {}

const LIMITE_BACKUPS = 50;

function valorFirestore(v) {
  return v === null || v === undefined ? { nullValue: null } : { stringValue: String(v) };
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

  const raiz = () => `projects/${conta.project_id}/databases/(default)/documents`;
  const nomeUsuario = (uid) => {
    if (!/^[A-Za-z0-9]{1,128}$/.test(String(uid))) throw new Error('uid inválido');
    return `${raiz()}/atlas_users/${uid}`;
  };
  const nomeChave = (uid, chave) => {
    if (!/^atlas\.[a-z0-9.]+$/.test(String(chave))) throw new Error('chave inválida');
    return `${nomeUsuario(uid)}/store/${docIdFirestore(chave)}`;
  };
  const api = (caminho) => `https://firestore.googleapis.com/v1/${caminho}`;

  async function chamar(url, corpo) {
    return fetcher(url, { method: 'POST', headers: { Authorization: 'Bearer ' + (await tokenGoogle()), 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(10000) });
  }

  async function lerDocs(uid, chaves) {
    const pares = await Promise.all(chaves.map(async (chave) => {
      const r = await fetcher(api(nomeChave(uid, chave)), { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) return [chave, { bruto: null, updateTime: null, mcpOp: null }];
      if (!r.ok) throw new Error('firestore ' + r.status);
      const d = await r.json();
      const bruto = d.fields?.value?.stringValue;
      return [chave, { bruto: typeof bruto === 'string' ? bruto : null, updateTime: d.updateTime || null, mcpOp: d.fields?.mcpOp?.stringValue || null }];
    }));
    return Object.fromEntries(pares);
  }

  async function podarBackups(uid) {
    const r = await chamar(api(`${nomeUsuario(uid)}:runQuery`), { structuredQuery: { from: [{ collectionId: 'mcp_backup' }], select: { fields: [{ fieldPath: '__name__' }] }, orderBy: [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }], offset: LIMITE_BACKUPS, limit: 20 } });
    if (!r.ok) return;
    const velhos = (await r.json()).map((x) => x.document?.name).filter(Boolean);
    if (velhos.length) await chamar(api(`${raiz()}:commit`), { writes: velhos.map((name) => ({ delete: name })) });
  }

  async function gravar(uid, { opId, mudancas, bases, backup, marcarDesfeito }) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(opId))) throw new Error('opId inválido');
    const writes = Object.entries(mudancas).map(([chave, valor]) => {
      const name = nomeChave(uid, chave);
      const currentDocument = bases[chave] ? { updateTime: bases[chave] } : { exists: false };
      if (valor === null) return { delete: name, currentDocument };
      return {
        update: { name, fields: { value: { stringValue: valor }, device: { stringValue: 'claude-mcp' }, mcpOp: { stringValue: opId } } },
        currentDocument,
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      };
    });
    writes.push({
      update: {
        name: `${nomeUsuario(uid)}/mcp_backup/${opId}`,
        fields: {
          ferramenta: { stringValue: String(backup.ferramenta) },
          resumo: { stringValue: String(backup.resumo).slice(0, 2000) },
          antes: { mapValue: { fields: Object.fromEntries(Object.entries(backup.antes).map(([k, v]) => [k, valorFirestore(v)])) } },
        },
      },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'criado', setToServerValue: 'REQUEST_TIME' }],
    });
    if (marcarDesfeito) {
      writes.push({ update: { name: `${nomeUsuario(uid)}/mcp_backup/${marcarDesfeito}`, fields: { desfeito: { booleanValue: true } } }, updateMask: { fieldPaths: ['desfeito'] }, currentDocument: { exists: true } });
    }
    const r = await chamar(api(`${raiz()}:commit`), { writes });
    if (!r.ok) {
      let status = '';
      try { status = (await r.json()).error?.status || ''; } catch { status = ''; }
      if (r.status === 409 || ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(status)) throw new ConflitoGravacao(status || String(r.status));
      throw new Error('commit ' + r.status + ' ' + status);
    }
    try { await podarBackups(uid); } catch { /* poda é opcional */ }
  }

  function decodificarBackup(doc) {
    if (!doc?.name) return null;
    const f = doc.fields || {};
    const antes = Object.fromEntries(Object.entries(f.antes?.mapValue?.fields || {}).map(([k, v]) => [k, typeof v.stringValue === 'string' ? v.stringValue : null]));
    return { id: doc.name.split('/').pop(), ferramenta: f.ferramenta?.stringValue || '', resumo: f.resumo?.stringValue || '', antes, desfeito: f.desfeito?.booleanValue === true };
  }

  async function ultimoBackup(uid) {
    const r = await chamar(api(`${nomeUsuario(uid)}:runQuery`), { structuredQuery: { from: [{ collectionId: 'mcp_backup' }], orderBy: [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }], limit: 1 } });
    if (!r.ok) throw new Error('firestore ' + r.status);
    return decodificarBackup((await r.json())[0]?.document);
  }

  async function lerBackup(uid, id) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id))) return null;
    const r = await fetcher(api(`${nomeUsuario(uid)}/mcp_backup/${id}`), { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('firestore ' + r.status);
    return decodificarBackup(await r.json());
  }

  return { lerChave, lerDocs, gravar, ultimoBackup, lerBackup };
}
