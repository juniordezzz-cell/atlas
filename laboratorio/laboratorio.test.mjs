/* Laboratório de Agentes (no PC): testes das fontes, do banco e de um ciclo inteiro com dados falsos. */
import test from "node:test";
import assert from "node:assert/strict";
import { alvoDeLinha, lerLeituras } from "./scanner.mjs";
import { escolherAtivo, parseParDS, parsePrecosLlama, velasDePrecos, pedidosLlama, chavesDoItem, buscarVelas } from "./precos.mjs";
import { Banco } from "./banco.mjs";
import { passo } from "./rodada.mjs";
import { painel } from "./servidor.mjs";

const H = 3600, DIA = 86400;
const AGORA = Math.floor(Date.parse("2026-11-15T20:10:00Z") / 1000);
const SOL = "So11111111111111111111111111111111111111112", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const POOL = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";

test("alvo do Scanner: mesmo filtro da varredura antiga", () => {
  const base = { id: "llama:x", rede: "Solana", dex: "Orca", par: "SOL/USDC", fee: 0.04, tvl: 1e6, vol_24h: 6e5, end_pool: POOL };
  assert.equal(alvoDeLinha(base).endereco, POOL);
  assert.equal(alvoDeLinha({ ...base, tvl: 200_000 }), null);          // TVL baixo
  assert.equal(alvoDeLinha({ ...base, vol_24h: 4e5 }), null);          // giro 0,4
  assert.equal(alvoDeLinha({ ...base, rede: "Ethereum" }), null);
  assert.equal(alvoDeLinha({ ...base, end_pool: null }), null);        // sem endereço
  assert.equal(alvoDeLinha({ ...base, id: "gecko:solana:ABC", end_pool: null }).endereco, "ABC");
});

test("leituras do Scanner vêm de página em página", async () => {
  const pedidos = [];
  const fetcher = async (url) => {
    const off = Number(new URL(url).searchParams.get("offset"));
    pedidos.push(off);
    const n = off === 0 ? 1000 : 3;
    return { ok: true, json: async () => Array.from({ length: n }, (_, i) => ({ pool_id: "p", dia: `d${off + i}`, tvl: 1, vol_24h: 1 })) };
  };
  const l = await lerLeituras(["p"], "2026-10-15", fetcher);
  assert.equal(l.length, 1003);
  assert.deepEqual(pedidos, [0, 1000]);
});

test("ativo e cotação do par, e preço invertido quando o ativo é o quote", () => {
  const [a, c] = escolherAtivo({ symbol: "USDC" }, { symbol: "JUP" });
  assert.equal(a.symbol, "JUP"); assert.equal(c.symbol, "USDC");
  const s = parseParDS({ baseToken: { symbol: "USDC", address: USDC }, quoteToken: { symbol: "SOL", address: SOL },
    priceNative: "0.005", priceUsd: "1", liquidity: { usd: 1e6 }, volume: { h24: 5e5 } });
  assert.equal(s.ativo_simbolo, "SOL"); assert.equal(s.cotacao, "USDC");
  assert.equal(s.preco, 200); assert.equal(s.preco_usd, 200);
});

test("preço da pool = ativo ÷ cotação, hora a hora", () => {
  const p = parsePrecosLlama({ coins: { "base:0xABC": { prices: [{ timestamp: 7200, price: 10 }, { timestamp: 7300, price: 12 }] },
    "base:0xdef": { prices: [{ timestamp: 7250, price: 4 }] } } });
  assert.deepEqual([...p["base:0xabc"]], [[7200, 12]]);              // na mesma hora, o mais recente
  assert.deepEqual(velasDePrecos(p["base:0xabc"], p["base:0xdef"]), [[7200, 3, 3, 3, 3]]);
});

test("pools em dia vão num pedido só; pool nova baixa 31 dias", () => {
  const it = (id, ultima) => ({ pool_id: id, rede: "Solana", ativo: SOL, cotacao: "USDC", ultima_vela: ultima });
  const emDia = [it("a", AGORA - 2 * H), it("b", AGORA - 3 * H)].map((x) => ({ ...x, _chaves: chavesDoItem(x) }));
  assert.equal(pedidosLlama(emDia, AGORA).length, 1);
  const nova = [{ ...it("c", null), _chaves: chavesDoItem(it("c", null)) }];
  const ped = pedidosLlama(nova, AGORA);
  assert.equal(ped.reduce((s, p) => s + p[2], 0), 31 * 24);
  assert.ok(ped.every((p) => p[2] <= 500));
});

test("preço da DeFiLlama longe do preço da pool vai para a GeckoTerminal", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    if (url.includes("coins.llama.fi")) return { ok: true, json: async () => ({ coins: { [`solana:${SOL}`]: { prices: [{ timestamp: AGORA - 600, price: 150 }] } } }) };
    return { ok: true, json: async () => ({ data: { attributes: { ohlcv_list: [[Math.floor(AGORA / H) * H, 200, 201, 199, 200, 1000]] } } }) };
  };
  const item = { pool_id: "p", rede: "Solana", endereco: POOL, ativo: SOL, cotacao: "USDC", preco_snap: 200, ultima_vela: AGORA - 2 * H };
  const r = await buscarVelas([item], AGORA, { fetcher, esperaGT: 0 });
  assert.equal(r.velas.get("p").fonte, "geckoterminal");
  assert.equal(r.chamadas_gt, 1);
});

test("volume da hora: retrato da hora, senão o volume do dia no Scanner", () => {
  const b = new Banco();
  b.salvarAlvos([{ pool_id: "p", rede: "Solana", dex: "Orca", par: "SOL/USDC", endereco: POOL, taxa_pct: 0.04, tvl: 1e6, vol_24h: 1e6 }], AGORA);
  const h0 = Math.floor(AGORA / DIA) * DIA - DIA;      // ontem 00h UTC
  b.gravarVelas("p", "defillama", [[h0, 1, 1, 1, 1], [h0 + H, 1, 1, 1, 1]], AGORA);
  b.salvarLeituras([{ pool_id: "p", dia: new Date(h0 * 1000).toISOString().slice(0, 10), tvl: 1e6, vol_24h: 2400 }]);
  b.salvarRetratos(new Map([["p", { ativo: SOL, ativo_simbolo: "SOL", cotacao: "USDC", cotacao_end: USDC, preco: 1, preco_usd: 1, tvl: 1e6, vol_24h: 4800 }]]), h0 + H + 60);
  const v = b.velasComVolume("p", h0 - H);
  assert.equal(v[0][5], 100);   // 2400 ÷ 24 (Scanner)
  assert.equal(v[1][5], 200);   // 4800 ÷ 24 (retrato da hora)
});

/** Mercado falso: uma pool SOL/USDC com 31 dias de preço que vai e volta. */
function mercadoFalso() {
  const precos = [];
  let x = 0, semente = 7;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let t = Math.floor(AGORA / H) * H - 40 * DIA; t <= AGORA; t += H) { x = 0.97 * x + 0.012 * rnd(); precos.push({ timestamp: t + 30, price: 180 * Math.exp(x) }); }
  const pedidos = { scanner: 0, leituras: 0, llama: 0, ds: 0, gt: 0 };
  const fetcher = async (url) => {
    const u = new URL(url);
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.pathname.endsWith("/scanner_pools")) {
      pedidos.scanner++;
      return ok([{ id: "llama:sol-usdc", rede: "Solana", dex: "Orca", par: "SOL/USDC", fee: 0.04, tvl: 3e6, vol_24h: 6e6, end_pool: POOL }]);
    }
    if (u.pathname.endsWith("/scanner_leituras")) {
      pedidos.leituras++;
      const dias = Array.from({ length: 33 }, (_, i) => new Date((AGORA - i * DIA) * 1000).toISOString().slice(0, 10));
      return ok(dias.map((d) => ({ pool_id: "llama:sol-usdc", dia: d, tvl: 3e6, vol_24h: 6e6 })));
    }
    if (u.host === "api.dexscreener.com") {
      pedidos.ds++;
      const p = precos[precos.length - 1].price;
      return ok({ pairs: [{ pairAddress: POOL, baseToken: { symbol: "SOL", address: SOL }, quoteToken: { symbol: "USDC", address: USDC },
        priceNative: String(p), priceUsd: String(p), liquidity: { usd: 3e6 }, volume: { h24: 6e6 } }] });
    }
    if (u.host === "coins.llama.fi") {
      pedidos.llama++;
      const inicio = Number(u.searchParams.get("start")), span = Number(u.searchParams.get("span"));
      return ok({ coins: { [`solana:${SOL}`]: { prices: precos.filter((p) => p.timestamp >= inicio && p.timestamp < inicio + span * H) } } });
    }
    pedidos.gt++;
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetcher, pedidos };
}

test("ciclo inteiro: Scanner → preços → agentes → painel, e a hora seguinte só baixa o que falta", async () => {
  const b = new Banco();
  const { fetcher, pedidos } = mercadoFalso();
  const etapas = [];
  const feito = await passo(b, AGORA, { fetcher, aviso: (e) => etapas.push(e) });
  assert.deepEqual(etapas, ["scanner", "precos", "agentes", "boletim", "pronto"]);
  assert.equal(feito.scanner.alvos, 1);
  assert.equal(feito.precos.com_velas, 1);
  assert.ok(feito.precos.velas_novas >= 30 * 24);
  assert.equal(feito.agentes.pools, 1);
  assert.equal(pedidos.gt, 0);

  const p = painel(b, AGORA, { etapa: "pronto" });
  assert.equal(p.rodada.pools, 1);
  assert.equal(p.agentes.length, 7);
  assert.equal(p.pools[0].pronta, true);
  assert.equal(p.achados.length, p.rodada.achados);
  for (const a of p.achados) assert.ok(Number.isFinite(a.media_usd) && a.par === "SOL/USDC");

  // 10 minutos depois: nada a fazer.
  assert.deepEqual(await passo(b, AGORA + 600, { fetcher }), {});
  // Uma hora depois: preços de novo, num pedido só, sem reler o Scanner.
  const antes = { ...pedidos };
  const f2 = await passo(b, AGORA + H, { fetcher });
  assert.equal(f2.scanner, undefined);
  assert.equal(pedidos.llama - antes.llama, 1);
  assert.equal(pedidos.scanner, antes.scanner);
  assert.ok(f2.precos.velas_novas <= 8);
});

test("boletim: achado de 7 dias atrás ganha nota com os preços que vieram depois", async () => {
  const b = new Banco();
  const { fetcher } = mercadoFalso();
  const antes = AGORA - 7 * DIA - 2 * H;
  // Rodada há 7 dias (com o histórico de então) e depois o ciclo de hoje.
  await passo(b, antes, { fetcher });
  const n = b.db.prepare("select count(*) as n from achados").get().n;
  b.guardar("precos_em", null);
  await passo(b, AGORA, { fetcher });
  const notas = b.db.prepare("select count(*) as n from boletim where horizonte_dias = 7").get().n;
  if (n > 0) assert.ok(notas > 0, "achados de 7 dias atrás deviam ter nota");
  assert.equal(b.pendentesBoletim(AGORA).length, 0);
});
