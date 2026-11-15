/* ============================================================
   Laboratório de Agentes (no PC) · scanner.mjs

   Lê do Scanner Pulse só o que os agentes precisam, pela mesma visão pública
   que o site usa (chave publicável, sem login):
   - a lista de pools-alvo (scanner_pools): Solana e Base, TVL ≥ US$ 250 mil,
     giro (volume 24h ÷ TVL) > 0,5 e endereço da pool conhecido. É o mesmo
     filtro da antiga estudio.pools_alvo. ~60 KB por leitura.
   - o volume e o TVL de cada dia (scanner_leituras), para os agentes terem
     histórico de volume desde o primeiro dia. Só os dias que faltam.
   ============================================================ */

export const SUPABASE_URL = "https://opaimjoimbndwuwkxuva.supabase.co";
export const CHAVE_PUBLICAVEL = "sb_publishable_zScdAIDPAuKQ-Z5XXm-49A_hs9W-2cT"; // pública, a mesma de core/atlas-supabase-config.js
export const FILTRO = { redes: ["Solana", "Base"], tvlMin: 250_000, giroMin: 0.5 };
const POR_PAGINA = 1000; // limite de linhas por pedido do Supabase

const COLUNAS = "id,rede,dex,par,fee,tvl,vol_24h,token_a,token_b,simbolo_a,simbolo_b," +
  "end_pool:sinais->>endereco_pool,end_conf:sinais->conferencia->>endereco";

async function pedir(caminho, params, fetcher) {
  const url = `${SUPABASE_URL}/rest/v1/${caminho}?${new URLSearchParams(params)}`;
  const r = await fetcher(url, { headers: { apikey: CHAVE_PUBLICAVEL, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Scanner Pulse respondeu ${r.status} em ${caminho}`);
  return r.json();
}

/** Uma linha de scanner_pools → pool-alvo, ou null se não passa no filtro. */
export function alvoDeLinha(x) {
  const tvl = Number(x.tvl) || 0, vol = Number(x.vol_24h) || 0;
  if (!FILTRO.redes.includes(x.rede) || tvl < FILTRO.tvlMin || !(vol / tvl > FILTRO.giroMin)) return null;
  const id = String(x.id);
  const endereco = (id.startsWith("gecko:") ? id.split(":").slice(2).join(":") : null) || x.end_pool || x.end_conf;
  if (!endereco) return null;
  return {
    pool_id: id, rede: x.rede, dex: x.dex, par: x.par, endereco,
    taxa_pct: x.fee ?? null, tvl, vol_24h: vol,
    token_a: x.token_a ?? null, token_b: x.token_b ?? null, simbolo_a: x.simbolo_a ?? null, simbolo_b: x.simbolo_b ?? null,
  };
}

export async function lerAlvos(fetcher = fetch) {
  const linhas = await pedir("scanner_pools", {
    select: COLUNAS, rede: `in.(${FILTRO.redes.join(",")})`, tvl: `gte.${FILTRO.tvlMin}`, limit: "5000",
  }, fetcher);
  return linhas.map(alvoDeLinha).filter(Boolean);
}

/** Volume e TVL por dia das pools, a partir de `desde` (AAAA-MM-DD), de página em página. */
export async function lerLeituras(ids, desde, fetcher = fetch) {
  const out = [];
  for (let i = 0; i < ids.length; i += 40) {             // URL curta: 40 pools por vez
    const lote = ids.slice(i, i + 40).map((x) => `"${x.replaceAll('"', "")}"`).join(",");
    for (let offset = 0; ; offset += POR_PAGINA) {
      const pag = await pedir("scanner_leituras", {
        select: "pool_id,dia,tvl,vol_24h", pool_id: `in.(${lote})`, dia: `gte.${desde}`,
        order: "pool_id,dia", limit: String(POR_PAGINA), offset: String(offset),
      }, fetcher);
      out.push(...pag);
      if (pag.length < POR_PAGINA) break;
    }
  }
  return out;
}
