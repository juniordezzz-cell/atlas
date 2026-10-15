// Só para testes. Mesmo comportamento das RPCs da migração 20261015000001.
export function storeMemoria(agora = () => Date.now()) {
  const codigos = new Map(), tokens = new Map();
  return {
    codigos, tokens,
    async salvarCodigo(c) { codigos.set(c.hash, { ...c, expira: agora() + c.segundos * 1000, usado: false }); return true; },
    async consumirCodigo(hash) {
      const c = codigos.get(hash);
      if (!c || c.usado || c.expira <= agora()) return null;
      c.usado = true;
      return { uid: c.uid, clientId: c.clientId, redirectUri: c.redirectUri, challenge: c.challenge };
    },
    async salvarToken(t) { tokens.set(t.hash, { ...t, expira: agora() + t.segundos * 1000, revogado: false, minuto: null, chamadas: 0 }); return true; },
    async buscarToken(hash, limite) {
      const t = tokens.get(hash);
      if (!t || t.tipo !== 'acesso' || t.revogado || t.expira <= agora()) return { status: 'invalido' };
      const m = Math.floor(agora() / 60000);
      if (t.minuto !== m) { t.minuto = m; t.chamadas = 1; }
      else if (t.chamadas >= limite) return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'limite' };
      else t.chamadas++;
      return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'ok' };
    },
    async usarRenovacao(hash) {
      const t = tokens.get(hash);
      if (!t || t.tipo !== 'renovacao' || t.expira <= agora()) return { status: 'invalido' };
      if (t.revogado) { for (const x of tokens.values()) if (x.familia === t.familia) x.revogado = true; return { status: 'reuso' }; }
      t.revogado = true;
      return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'ok' };
    },
  };
}
