/* ============================================================
   Laboratório de Agentes (no PC) · rodada.mjs

   O ciclo do Laboratório. O servidor chama `passo()` a cada minuto e ele
   faz só o que está na hora:

   1. Scanner Pulse (a cada 4 h): lista de pools-alvo e volume diário.
   2. Preços (a cada hora): retrato da pool na DexScreener e velas de 1h
      (DeFiLlama; GeckoTerminal de reserva).
   3. Agentes (depois de cada busca de preços): os 8 agentes e o supervisor,
      num processo separado (trabalho.mjs).
   4. Boletim (depois de cada rodada): nota aos achados de 7 e de 30 dias.
   5. Limpeza (uma vez por dia).

   Cada etapa avisa a tela pelo `aviso(etapa, dados)`.
   ============================================================ */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lerAlvos, lerLeituras } from "./scanner.mjs";
import { retratos, buscarVelas } from "./precos.mjs";
import { diaUTC } from "./banco.mjs";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
export const TRABALHO = `${AQUI}trabalho.mjs`;
export const BOLETIM = fileURLToPath(new URL("../estudio/agentes/boletim.mjs", import.meta.url));
export const INTERVALOS = { scanner: 4 * 3600, precos: 55 * 60, limpeza: 86400 };
const DIA = 86400;
const DIAS_LEITURAS = 32;

/** Roda um script do Node com JSON na entrada e devolve o JSON da saída. */
export function rodarNode(script, entrada, { timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], { stdio: ["pipe", "pipe", "pipe"] });
    const out = [], err = [];
    const relogio = setTimeout(() => { p.kill(); reject(new Error(`${script} passou de ${timeoutMs / 1000}s`)); }, timeoutMs);
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", (e) => { clearTimeout(relogio); reject(e); });
    p.on("close", (code) => {
      clearTimeout(relogio);
      if (code !== 0) return reject(new Error(`${script} saiu com ${code}: ${Buffer.concat(err).toString().slice(-400)}`));
      try { resolve(JSON.parse(Buffer.concat(out).toString("utf8"))); } catch (e) { reject(e); }
    });
    p.stdin.end(JSON.stringify(entrada));
  });
}

export async function atualizarScanner(banco, agora, { fetcher = fetch } = {}) {
  const alvos = await lerAlvos(fetcher);
  if (!alvos.length) throw new Error("o Scanner Pulse não devolveu nenhuma pool-alvo");
  banco.salvarAlvos(alvos, agora);
  const limite = diaUTC(agora - DIAS_LEITURAS * DIA);
  const ultimos = banco.ultimasLeituras().map((x) => x.dia ?? limite);
  const desde = ultimos.reduce((m, d) => (d < m ? d : m), diaUTC(agora));
  const n = banco.salvarLeituras(await lerLeituras(alvos.map((a) => a.pool_id), desde < limite ? limite : desde, fetcher));
  banco.guardar("scanner_em", agora);
  return { alvos: alvos.length, leituras: n };
}

export async function atualizarPrecos(banco, agora, opcoes = {}) {
  const falhas = [];
  const ativas = banco.poolsAtivas();
  banco.salvarRetratos(await retratos(ativas, opcoes.fetcher ?? fetch, falhas), agora);
  const fila = banco.filaVelas(agora);
  const r = await buscarVelas(fila, agora, opcoes);
  let novas = 0;
  for (const [id, { fonte, velas }] of r.velas) novas += banco.gravarVelas(id, fonte, velas, agora);
  banco.marcarBuscado(fila.filter((f) => !r.velas.has(f.pool_id)).map((f) => f.pool_id), agora);
  banco.guardar("precos_em", agora);
  return { pools: ativas.length, fila: fila.length, com_velas: r.velas.size, velas_novas: novas,
    chamadas_llama: r.chamadas_llama, chamadas_gt: r.chamadas_gt, falhas: [...falhas, ...r.falhas] };
}

export async function rodarAgentes(banco, agora, { trabalho = TRABALHO } = {}) {
  const rodada = Math.floor(agora / 60) * 60;
  const pools = banco.poolsProntas(agora);
  if (!pools.length) return { rodada, pools: 0, achados: 0, pulada: "nenhuma pool com 7 dias de preços ainda" };
  const iso = new Date(rodada * 1000).toISOString();
  const saida = await rodarNode(trabalho, { rodada: iso, pools, achados_hoje: banco.achadosDesde(Math.floor(agora / DIA) * DIA) });
  banco.gravarRodada(rodada, saida);
  return { rodada, pools: saida.pools, achados: saida.achados.length, disputas: saida.relatorio.disputas.length,
    conflitos: saida.relatorio.conflitos.length, duracao_s: saida.duracao_s, erros: saida.erros.length };
}

export async function rodarBoletim(banco, agora, { script = BOLETIM } = {}) {
  const pend = banco.pendentesBoletim(agora);
  let avaliados = 0, acertos = 0, pulados = 0;
  if (pend.length) {
    const itens = pend.map((p) => ({ ...p, ...banco.periodoReal(p.pool_id, p._t, p.horizonte_dias) }));
    const saida = await rodarNode(script, { itens });
    banco.gravarBoletim(saida.resultados, agora);
    avaliados = saida.resultados.length;
    acertos = saida.resultados.filter((r) => r.acertou).length;
    pulados = saida.pulados.length;
  }
  const resumo = banco.resumoBoletim(agora);
  banco.guardar("boletim", resumo);
  return { avaliados, acertos, pulados };
}

/**
 * Um passo do ciclo: faz o que está na hora e devolve o que fez.
 * aviso(etapa, dados) recebe "scanner", "precos", "agentes", "boletim", "pronto" e "erro".
 */
export async function passo(banco, agora, { aviso = () => {}, ...opcoes } = {}) {
  const feito = {};
  const vencido = (chave, s) => { const t = banco.ler(chave); return t == null || agora - t >= s; };
  try {
    if (vencido("scanner_em", INTERVALOS.scanner) || !banco.poolsAtivas().length) {
      aviso("scanner");
      feito.scanner = await atualizarScanner(banco, agora, opcoes);
    }
    if (vencido("precos_em", INTERVALOS.precos)) {
      aviso("precos", { pools: banco.poolsAtivas().length });
      feito.precos = await atualizarPrecos(banco, agora, opcoes);
      aviso("agentes", { pools: banco.poolsProntas(agora).length });
      feito.agentes = await rodarAgentes(banco, agora, opcoes);
      aviso("boletim");
      try {
        feito.boletim = await rodarBoletim(banco, agora, opcoes);
      } catch (e) {   // o boletim não derruba a rodada
        feito.boletim = { erro: e.message };
      }
    }
    if (vencido("limpeza_em", INTERVALOS.limpeza)) {
      banco.manutencao(agora);
      banco.guardar("limpeza_em", agora);
      feito.limpeza = true;
    }
    banco.guardar("ultimo_passo", { em: agora, ...feito });
    if (Object.keys(feito).length) aviso("pronto", feito);
    return feito;
  } catch (e) {
    banco.guardar("ultimo_erro", { em: agora, mensagem: e.message });
    aviso("erro", { mensagem: e.message });
    throw e;
  }
}
