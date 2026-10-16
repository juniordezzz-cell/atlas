export function criarStore({ url, chave, fetcher }) {
  const raiz = String(url).replace(/\/$/, '');
  async function rpc(nome, args) {
    const headers = { apikey: chave, 'Content-Type': 'application/json' };
    if (String(chave).startsWith('eyJ')) headers.Authorization = 'Bearer ' + chave;
    const r = await fetcher(`${raiz}/rest/v1/rpc/${nome}`, { method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`rpc ${nome} ${r.status}`);
    return r.json();
  }
  const linha = (x) => (Array.isArray(x) ? x[0] : x) || null;
  const comoToken = (l) => (l ? { uid: l.uid, clientId: l.client_id, familia: l.familia, status: l.status } : { status: 'invalido' });
  return {
    salvarCodigo: (c) => rpc('atlas_mcp_salvar_codigo', { p_hash: c.hash, p_uid: c.uid, p_client: c.clientId, p_redirect: c.redirectUri, p_challenge: c.challenge, p_segundos: c.segundos }),
    async consumirCodigo(hash) {
      const l = linha(await rpc('atlas_mcp_consumir_codigo', { p_hash: hash }));
      return l && l.uid ? { uid: l.uid, clientId: l.client_id, redirectUri: l.redirect_uri, challenge: l.challenge } : null;
    },
    salvarToken: (t) => rpc('atlas_mcp_salvar_token', { p_hash: t.hash, p_tipo: t.tipo, p_uid: t.uid, p_client: t.clientId, p_familia: t.familia, p_segundos: t.segundos }),
    buscarToken: async (hash, limite) => comoToken(linha(await rpc('atlas_mcp_buscar_token', { p_hash: hash, p_limite: limite }))),
    usarRenovacao: async (hash) => comoToken(linha(await rpc('atlas_mcp_usar_renovacao', { p_hash: hash }))),
  };
}
