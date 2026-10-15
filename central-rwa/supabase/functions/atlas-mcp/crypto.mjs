const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(texto) {
  const s = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function aleatorio(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

export async function sha256b64url(texto) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto))));
}

export async function pkceConfere(verifier, challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return (await sha256b64url(verifier)) === challenge;
}

async function chaveHmac(segredo) {
  return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function assinar(obj, segredo) {
  const corpo = b64url(enc.encode(JSON.stringify(obj)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await chaveHmac(segredo), enc.encode(corpo)));
  return corpo + '.' + b64url(sig);
}

export async function verificar(token, segredo, agora = Date.now()) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  let valido = false;
  try {
    valido = await crypto.subtle.verify('HMAC', await chaveHmac(segredo), b64urlDecode(partes[1]), enc.encode(partes[0]));
  } catch { return null; }
  if (!valido) return null;
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[0]))); } catch { return null; }
  if (typeof obj?.exp === 'number' && obj.exp < agora) return null;
  return obj;
}
