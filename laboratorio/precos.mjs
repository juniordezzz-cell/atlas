/* ============================================================
   Laboratório de Agentes (no PC) · precos.mjs

   Preço de cada pool, de hora em hora. Mesma lógica da varredura que rodava
   na nuvem (central_rwa/estudio/varredura.py e fontes.py), agora em Node:

   1. DexScreener: o retrato da pool agora (preço, TVL, volume 24h) e quem é o
      "ativo" e quem é a "cotação" do par. Até 30 pools por pedido.
   2. DeFiLlama (principal): preço em dólar de cada token, um ponto por hora.
      Preço da pool = ativo ÷ cotação (ou o próprio preço em dólar, com
      cotação stable). Poucas chamadas atualizam todas as pools.
   3. GeckoTerminal (reserva): velas de 1h da própria pool, para quem a
      DeFiLlama não conhece, com preço parado há 3 h ou longe do preço da
      pool (mais de 5%). Devagar, para respeitar o limite da GeckoTerminal.

   Nada aqui fala com o banco: recebe e devolve listas.
   ============================================================ */

export const DEXSCREENER = "https://api.dexscreener.com/latest/dex/pairs";
export const LLAMA_CHART = "https://coins.llama.fi/chart";
export const GECKO = "https://api.geckoterminal.com/api/v2";
const REDE = { Solana: "solana", Base: "base" };
const POR_CHAMADA_DS = 30;
export const LLAMA_MAX_PONTOS = 500;
export const HORAS_INICIAIS = 31 * 24;
export const EM_DIA_S = 6 * 3600;
export const DIF_MAX_PRECO = 0.05;
export const PRECO_PARADO_S = 3 * 3600;
const GT_ESPERA_MS = 2500;
const GT_VELAS_INICIAIS = 1000;

export const STABLES = new Set(["USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC", "EURC"]);
// Quem faz papel de "dinheiro" no par: o ativo é o OUTRO token. Menor = mais cotação.
const COTACAO = { WETH: 1, ETH: 1, SOL: 2, WSOL: 2, CBBTC: 3, WBTC: 3, BTC: 3 };
const prioridade = (s) => { const u = String(s || "").toUpperCase(); return STABLES.has(u) ? 0 : COTACAO[u] ?? 99; };

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
export const hora = (t) => Math.floor(t / 3600) * 3600;
export const cotacaoEstavel = (s) => STABLES.has(String(s || "").toUpperCase());
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chaveEndereco = (rede, e) => (rede === "Solana" ? e : String(e).toLowerCase());

/** (ativo, cotação) entre os dois tokens de um par da DexScreener. */
export function escolherAtivo(base, quote) {
  return prioridade(base?.symbol) < prioridade(quote?.symbol) ? [quote, base] : [base, quote];
}

/** Um par da DexScreener → retrato da pool. null sem liquidez ou volume. */
export function parseParDS(par) {
  const base = par.baseToken || {}, quote = par.quoteToken || {};
  const tvl = num(par.liquidity?.usd), vol = num(par.volume?.h24);
  if (!(tvl > 0) || vol == null) return null;
  const [ativo, cot] = escolherAtivo(base, quote);
  const nativo = num(par.priceNative), usd = num(par.priceUsd);
  let preco, preco_usd;
  if (ativo === base) { preco = nativo; preco_usd = usd; }
  else { preco = nativo ? 1 / nativo : null; preco_usd = usd && nativo ? usd / nativo : null; }
  return {
    preco, preco_usd, tvl, vol_24h: vol,
    ativo: String(ativo.address || ""), ativo_simbolo: String(ativo.symbol || ""),
    cotacao: String(cot.symbol || ""), cotacao_end: String(cot.address || ""),
  };
}

/** Retrato de cada pool-alvo encontrada na DexScreener: Map pool_id → retrato. */
export async function retratos(alvos, fetcher = fetch, falhas = []) {
  const out = new Map();
  for (const rede of Object.keys(REDE)) {
    const porEnd = new Map(alvos.filter((a) => a.rede === rede).map((a) => [chaveEndereco(rede, a.endereco), a]));
    const ends = [...porEnd.keys()];
    for (let i = 0; i < ends.length; i += POR_CHAMADA_DS) {
      try {
        const r = await fetcher(`${DEXSCREENER}/${REDE[rede]}/${ends.slice(i, i + POR_CHAMADA_DS).join(",")}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        for (const par of (await r.json())?.pairs || []) {
          const a = porEnd.get(chaveEndereco(rede, String(par.pairAddress || "")));
          const s = a && parseParDS(par);
          if (s) out.set(a.pool_id, s);
        }
      } catch (e) {
        falhas.push(`dexscreener ${rede}: ${e.message}`);
      }
    }
  }
  return out;
}

/** Token no formato da DeFiLlama (solana:<mint>, base:<0x...>). */
export function chaveLlama(rede, endereco) {
  if (!endereco || !REDE[rede]) return null;
  return `${REDE[rede]}:${rede === "Solana" ? endereco : String(endereco).toLowerCase()}`;
}

/** Resposta do /chart → { chave: Map(hora → preço) }. Na mesma hora fica o ponto mais recente. */
export function parsePrecosLlama(j) {
  const out = {};
  for (const [chave, v] of Object.entries(j?.coins || {})) {
    const [rede, ...resto] = chave.split(":");
    const end = resto.join(":");
    const k = rede === "solana" ? chave : `${rede}:${end.toLowerCase()}`;
    const horas = new Map();
    for (const p of v?.prices || []) {
      const t = num(p.timestamp), preco = num(p.price);
      if (t == null || !(preco > 0)) continue;
      const h = hora(t), ant = horas.get(h);
      if (!ant || t >= ant[0]) horas.set(h, [t, preco]);
    }
    out[k] = new Map([...horas].map(([h, [, p]]) => [h, p]));
  }
  return out;
}

/** Preço do ativo na moeda da cotação, uma vela por hora [t, o, h, l, c]. */
export function velasDePrecos(ativo, cotacao) {
  const out = [];
  for (const h of [...ativo.keys()].sort((a, b) => a - b)) {
    let p = ativo.get(h);
    if (cotacao) { const c = cotacao.get(h); if (!c) continue; p = p / c; }
    out.push([h, p, p, p, p]);
  }
  return out;
}

/** OHLCV da GeckoTerminal → [[t, o, h, l, c]] crescente. */
export function parseVelasGT(j) {
  const out = new Map();
  for (const v of j?.data?.attributes?.ohlcv_list || []) {
    if (!Array.isArray(v) || v.length < 5) continue;
    const [t, o, h, l, c] = v.slice(0, 5).map(num);
    if (t == null || ![o, h, l, c].every((x) => x > 0)) continue;
    out.set(t, [t, o, h, l, c]);
  }
  return [...out.values()].sort((a, b) => a[0] - b[0]);
}

/** (token do ativo, token da cotação ou null se stable) na DeFiLlama; null = não dá. */
export function chavesDoItem(item) {
  if (item.fonte === "geckoterminal") return null;
  const ka = chaveLlama(item.rede, item.ativo);
  if (!ka) return null;
  if (cotacaoEstavel(item.cotacao)) return [ka, null];
  const kc = chaveLlama(item.rede, item.cotacao_end);
  return kc ? [ka, kc] : null;
}

/** Chamadas [tokens, início, span] que cobrem os itens: os em dia num lote; os novos, 31 dias cada. */
export function pedidosLlama(itens, agora) {
  const fim = hora(agora), pedidos = [];
  const emDia = itens.filter((i) => i.ultima_vela && agora - i.ultima_vela <= EM_DIA_S);
  const idsEmDia = new Set(emDia.map((i) => i.pool_id));
  if (emDia.length) {
    const inicio = Math.min(...emDia.map((i) => hora(i.ultima_vela)));
    const span = (fim - inicio) / 3600 + 1;
    const tokens = [...new Set(emDia.flatMap((i) => i._chaves.filter(Boolean)))].sort();
    const por = Math.max(1, Math.floor(LLAMA_MAX_PONTOS / span));
    for (let j = 0; j < tokens.length; j += por) pedidos.push([tokens.slice(j, j + por), inicio, span]);
  }
  for (const i of itens) {
    if (idsEmDia.has(i.pool_id)) continue;
    const tokens = i._chaves.filter(Boolean);
    let t = fim - (HORAS_INICIAIS - 1) * 3600;
    if (i.ultima_vela) t = Math.max(t, hora(i.ultima_vela));
    const por = Math.floor(LLAMA_MAX_PONTOS / tokens.length);
    while (t <= fim) {
      const span = Math.min(por, (fim - t) / 3600 + 1);
      pedidos.push([tokens, t, span]);
      t += span * 3600;
    }
  }
  return pedidos;
}

async function pedirLlama(tokens, inicio, span, fetcher) {
  const url = `${LLAMA_CHART}/${tokens.join(",")}?start=${inicio}&span=${span}&period=1h`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await fetcher(url);
      if (r.ok) return r.json();
    } catch { /* tenta de novo */ }
  }
  throw new Error("DeFiLlama não respondeu");
}

async function pedirGT(item, limite, fetcher) {
  const url = `${GECKO}/networks/${REDE[item.rede]}/pools/${item.endereco}/ohlcv/hour` +
    `?aggregate=1&limit=${Math.max(1, Math.min(GT_VELAS_INICIAIS, limite))}&currency=token&token=${item.ativo}`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetcher(url, { headers: { Accept: "application/json" } });
    if (r.ok) return r.json();
    if (r.status !== 429) return null;
    await dormir(15_000);
  }
  return null;
}

/**
 * Velas novas das pools. itens: [{ pool_id, rede, endereco, ativo, cotacao,
 * cotacao_end, fonte, ultima_vela (s), preco_snap }].
 * Devolve { velas: Map(pool_id → { fonte, velas }), falhas, chamadas_llama, chamadas_gt }.
 */
export async function buscarVelas(itens, agora, { fetcher = fetch, orcamentoGT = 20, esperaGT = GT_ESPERA_MS } = {}) {
  const falhas = [], velas = new Map();
  const pelaLlama = [], pelaGT = [];
  for (const it of itens) {
    const ch = chavesDoItem(it);
    if (ch) pelaLlama.push({ ...it, _chaves: ch }); else pelaGT.push(it);
  }
  const precos = {};
  let chamadasLlama = 0, llamaFalhou = false;
  for (const [tokens, inicio, span] of pedidosLlama(pelaLlama, agora)) {
    chamadasLlama++;
    try {
      for (const [k, serie] of Object.entries(parsePrecosLlama(await pedirLlama(tokens, inicio, span, fetcher)))) {
        precos[k] = precos[k] || new Map();
        for (const [h, p] of serie) precos[k].set(h, p);
      }
    } catch (e) {
      llamaFalhou = true;
      falhas.push(`defillama: ${e.message}`);
    }
  }
  for (const it of pelaLlama) {
    const [ka, kc] = it._chaves;
    if (!precos[ka] || (kc && !precos[kc])) { if (!llamaFalhou) pelaGT.push(it); continue; }
    const desde = it.ultima_vela ? hora(it.ultima_vela) : 0;
    const vs = velasDePrecos(precos[ka], kc ? precos[kc] : null).filter((v) => v[0] >= desde);
    if (!vs.length) { pelaGT.push(it); continue; }
    const ult = vs[vs.length - 1];
    const parado = agora - ult[0] > PRECO_PARADO_S;
    if (parado || (it.preco_snap && Math.abs(ult[4] / it.preco_snap - 1) > DIF_MAX_PRECO)) { pelaGT.push(it); continue; }
    velas.set(it.pool_id, { fonte: "defillama", velas: vs });
  }
  let chamadasGT = 0;
  for (const it of pelaGT) {
    if (chamadasGT >= orcamentoGT) { falhas.push(`geckoterminal: ${pelaGT.length - chamadasGT} pools ficaram para a próxima hora`); break; }
    if (chamadasGT) await dormir(esperaGT);
    chamadasGT++;
    const limite = it.ultima_vela && it.fonte === "geckoterminal" ? Math.floor((agora - it.ultima_vela) / 3600) + 2 : GT_VELAS_INICIAIS;
    try {
      const j = await pedirGT(it, limite, fetcher);
      const vs = j ? parseVelasGT(j) : [];
      if (vs.length) velas.set(it.pool_id, { fonte: "geckoterminal", velas: vs });
      else falhas.push(`velas ${it.par || it.pool_id}`);
    } catch (e) {
      falhas.push(`geckoterminal ${it.par || it.pool_id}: ${e.message}`);
    }
  }
  return { velas, falhas, chamadas_llama: chamadasLlama, chamadas_gt: chamadasGT };
}
