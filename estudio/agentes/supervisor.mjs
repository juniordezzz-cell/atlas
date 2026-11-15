/* ============================================================
   Laboratório de Agentes · agentes/supervisor.mjs

   O supervisor (Fase 3, sem IA). A cada rodada refaz o relatório do dia:
   - ranking: o achado mais recente de cada agente em cada pool, pela média
     em dólar;
   - disputas: pools com achado de dois ou mais agentes ao mesmo tempo (quem
     ganha e por quanto);
   - conflitos: achado de um agente numa pool que a regra de outro descarta
     (ex.: o Concentrador vê lateral onde a Curva vê tendência forte).
   O texto do resumo diário é da Fase 5 (IA).
   ============================================================ */

import { AGENTES } from "./regras.mjs";

const LISTA = new Set(["acumulador", "acumulador_token"]);
const NOME = Object.fromEntries(AGENTES.map((a) => [a.id, a.nome]));
export const TAMANHO_RANKING = 20;

/**
 * achadosDoDia: achados já gravados hoje (qualquer rodada) + os desta rodada.
 * analises: resultado de rodarAgentes().analises desta rodada.
 */
export function relatorioDoDia(achadosDoDia, analises = []) {
  // o mais recente de cada (agente, pool)
  const ultimo = new Map();
  for (const a of achadosDoDia) {
    const k = `${a.agente}|${a.pool_id}`, v = ultimo.get(k);
    if (!v || String(a.rodada) >= String(v.rodada)) ultimo.set(k, a);
  }
  const vigentes = [...ultimo.values()];
  const ranking = [...vigentes]
    .sort((x, y) => y.media_usd - x.media_usd)
    .slice(0, TAMANHO_RANKING)
    .map((a, i) => ({
      posicao: i + 1, agente: a.agente, nome: NOME[a.agente], pool_id: a.pool_id, par: a.par, rede: a.rede, dex: a.dex,
      modelo: a.modelo, faixas: a.faixas, media_usd: a.media_usd, p10_usd: a.p10_usd, ganho_vs_ref_usd: a.ganho_vs_ref_usd,
      rodada: a.rodada,
    }));

  // disputas: só na rodada mais recente de cada pool
  const porPool = new Map();
  for (const a of vigentes) {
    const l = porPool.get(a.pool_id) || [];
    l.push(a);
    porPool.set(a.pool_id, l);
  }
  const disputas = [];
  for (const [pool_id, l] of porPool) {
    const rodada = l.reduce((m, a) => (String(a.rodada) > m ? String(a.rodada) : m), "");
    const atuais = l.filter((a) => String(a.rodada) === rodada).sort((x, y) => y.media_usd - x.media_usd);
    if (atuais.length < 2) continue;
    disputas.push({
      pool_id, par: atuais[0].par,
      agentes: atuais.map((a) => ({ agente: a.agente, nome: NOME[a.agente], modelo: a.modelo, faixas: a.faixas, media_usd: a.media_usd })),
      vencedor: atuais[0].agente,
      diferenca_usd: atuais[0].media_usd - atuais[1].media_usd,
    });
  }
  disputas.sort((x, y) => y.diferenca_usd - x.diferenca_usd);

  // conflitos desta rodada
  const conflitos = [];
  for (const r of analises) {
    const comAchado = r.analises.filter((x) => x.achado);
    // A regra dos Acumuladores é a lista de compra, não o mercado: não entra.
    const descartam = r.analises.filter((x) => x.descarta === true && !LISTA.has(x.agente));
    for (const a of comAchado) for (const d of descartam) {
      if (a.agente === d.agente) continue;
      conflitos.push({ pool_id: r.pool_id, agente: a.agente, nome: NOME[a.agente], media_usd: a.media_usd ?? null,
        contra: d.agente, nome_contra: NOME[d.agente], motivo: d.motivo });
    }
  }
  return { ranking, disputas, conflitos };
}
