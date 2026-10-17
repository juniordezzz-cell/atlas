import { codigoSite } from './site-gerado.mjs';

export const CHAVES_GRAVAVEIS = ['atlas.wallets.v2', 'atlas.hold.state.v2', 'atlas.caixa.v1'];

export function criarMotor(brutos = {}) {
  const mem = new Map();
  for (const k of CHAVES_GRAVAVEIS) if (typeof brutos[k] === 'string') mem.set(k, brutos[k]);
  const armazenamento = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  const janela = codigoSite({ localStorage: armazenamento, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }, armazenamento);
  janela.Store.init();
  // Retrato depois da carga: o site grava um Hold vazio (ou normaliza o salvo) ao iniciar.
  // Isso não é obra da operação; só entra na gravação junto com uma mudança real da chave.
  const antes = new Map(CHAVES_GRAVAVEIS.map((k) => [k, mem.has(k) ? mem.get(k) : null]));
  return {
    carteiras: janela.AtlasWallets,
    caixa: janela.AtlasCaixa,
    hold: janela.Store,
    alteracoes() {
      const out = {};
      for (const k of CHAVES_GRAVAVEIS) {
        const agora = mem.has(k) ? mem.get(k) : null;
        if (agora !== antes.get(k)) out[k] = agora;
      }
      return out;
    },
  };
}
