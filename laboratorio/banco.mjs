/* ============================================================
   Laboratório de Agentes (no PC) · banco.mjs

   Tudo o que o Laboratório guarda fica num arquivo SQLite no próprio PC
   (laboratorio/dados/laboratorio.db, fora do GitHub). Usa o SQLite que já
   vem no Node: nada para instalar.

   Tempos em segundos desde 1970 (UTC). Valores em dólar.
   Guarda: pools-alvo, retratos de hora em hora, volume diário do Scanner,
   velas de 1h, achados, rodadas, o que cada agente olhou na última rodada e
   o boletim. Limpeza: velas, retratos e leituras com mais de 75 dias;
   achados e boletim com mais de 365 dias.
   ============================================================ */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DIA = 86400;
const GUARDA_DIAS = 75;
const ESQUEMA = `
create table if not exists pools (
  pool_id text primary key, rede text not null, dex text, par text, endereco text not null,
  taxa_pct real, tvl real, vol_24h real, ativa integer not null default 1, vista_em integer,
  ativo text, ativo_simbolo text, cotacao text, cotacao_end text,
  preco real, preco_usd real, tvl_snap real, vol_snap real, retrato_em integer,
  fonte text, primeira_vela integer, ultima_vela integer, buscado_em integer
);
create table if not exists retratos (
  pool_id text not null, hora integer not null, preco real, preco_usd real, tvl real, vol_24h real,
  primary key (pool_id, hora)
);
create table if not exists leituras (
  pool_id text not null, dia text not null, tvl real, vol_24h real, primary key (pool_id, dia)
);
create table if not exists velas (
  pool_id text not null, hora integer not null, o real, h real, l real, c real, primary key (pool_id, hora)
);
create table if not exists achados (
  id integer primary key autoincrement, rodada integer not null, agente text not null, pool_id text not null,
  rede text, dex text, par text, modelo text, faixas integer, media_usd real, p10_usd real, custo_usd real,
  dados text not null, unique (rodada, agente, pool_id)
);
create index if not exists achados_rodada on achados (rodada);
create table if not exists rodadas (
  rodada integer primary key, pools integer, achados integer, disputas integer, conflitos integer,
  duracao_s real, resumo text
);
create table if not exists analises (
  pool_id text not null, agente text not null, rodada integer not null, dados text not null,
  primary key (pool_id, agente)
);
create table if not exists boletim (
  achado_id integer not null, horizonte_dias integer not null, rodada integer not null, agente text not null,
  pool_id text not null, acertou integer, dentro_faixa integer, ganhou_base integer, erro_usd real,
  metodo text, dados text not null, avaliado_em integer not null, primary key (achado_id, horizonte_dias)
);
create table if not exists estado (chave text primary key, valor text);
`;

const json = (v) => JSON.stringify(v ?? null);
export const diaUTC = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export class Banco {
  constructor(caminho = ":memory:") {
    if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
    this.db = new DatabaseSync(caminho);
    this.sql("pragma journal_mode = wal; pragma synchronous = normal;");
    this.sql(ESQUEMA);
  }

  /** Roda SQL sem parâmetros (o método do SQLite do Node para vários comandos). */
  sql(texto) { return this.db["exec"](texto); }

  transacao(fn) {
    this.sql("begin");
    try { const r = fn(); this.sql("commit"); return r; } catch (e) { this.sql("rollback"); throw e; }
  }

  // ---------- estado ----------
  ler(chave, padrao = null) {
    const r = this.db.prepare("select valor from estado where chave = ?").get(chave);
    return r ? JSON.parse(r.valor) : padrao;
  }
  guardar(chave, valor) {
    this.db.prepare("insert into estado (chave, valor) values (?, ?) on conflict (chave) do update set valor = excluded.valor")
      .run(chave, json(valor));
  }

  // ---------- pools ----------
  salvarAlvos(alvos, agora) {
    const up = this.db.prepare(`insert into pools (pool_id, rede, dex, par, endereco, taxa_pct, tvl, vol_24h, ativa, vista_em)
      values (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) on conflict (pool_id) do update set rede = excluded.rede, dex = excluded.dex,
      par = excluded.par, endereco = excluded.endereco, taxa_pct = excluded.taxa_pct, tvl = excluded.tvl,
      vol_24h = excluded.vol_24h, ativa = 1, vista_em = excluded.vista_em`);
    this.transacao(() => {
      this.sql("update pools set ativa = 0");
      for (const a of alvos) up.run(a.pool_id, a.rede, a.dex, a.par, a.endereco, a.taxa_pct, a.tvl, a.vol_24h, agora);
    });
  }

  poolsAtivas() {
    return this.db.prepare("select * from pools where ativa = 1 order by pool_id").all();
  }

  salvarRetratos(retratos, agora) {
    const atual = this.db.prepare("select ativo from pools where pool_id = ?");
    const zera = this.db.prepare("update pools set fonte = null, primeira_vela = null, ultima_vela = null, buscado_em = null where pool_id = ?");
    const apaga = this.db.prepare("delete from velas where pool_id = ?");
    const up = this.db.prepare(`update pools set ativo = ?, ativo_simbolo = ?, cotacao = ?, cotacao_end = ?, preco = ?,
      preco_usd = ?, tvl_snap = ?, vol_snap = ?, retrato_em = ? where pool_id = ?`);
    const ins = this.db.prepare(`insert into retratos (pool_id, hora, preco, preco_usd, tvl, vol_24h) values (?, ?, ?, ?, ?, ?)
      on conflict (pool_id, hora) do update set preco = excluded.preco, preco_usd = excluded.preco_usd,
      tvl = excluded.tvl, vol_24h = excluded.vol_24h`);
    const h = Math.floor(agora / 3600) * 3600;
    this.transacao(() => {
      for (const [id, s] of retratos) {
        const ant = atual.get(id)?.ativo;
        if (ant && ant !== s.ativo) { zera.run(id); apaga.run(id); }   // o par mudou de lado: começa de novo
        up.run(s.ativo, s.ativo_simbolo, s.cotacao, s.cotacao_end, s.preco, s.preco_usd, s.tvl, s.vol_24h, agora, id);
        ins.run(id, h, s.preco, s.preco_usd, s.tvl, s.vol_24h);
      }
    });
  }

  salvarLeituras(linhas) {
    const ins = this.db.prepare(`insert into leituras (pool_id, dia, tvl, vol_24h) values (?, ?, ?, ?)
      on conflict (pool_id, dia) do update set tvl = excluded.tvl, vol_24h = excluded.vol_24h`);
    this.transacao(() => { for (const l of linhas) ins.run(l.pool_id, l.dia, l.tvl, l.vol_24h); });
    return linhas.length;
  }

  /** Último dia com leitura de cada pool ativa (null = nenhuma). */
  ultimasLeituras() {
    return this.db.prepare(`select p.pool_id, max(l.dia) as dia from pools p left join leituras l on l.pool_id = p.pool_id
      where p.ativa = 1 group by p.pool_id`).all();
  }

  // ---------- velas ----------
  /** Pools que precisam de velas agora (nunca buscadas primeiro). */
  filaVelas(agora, intervalo = 55 * 60) {
    return this.db.prepare(`select pool_id, rede, par, endereco, ativo, cotacao, cotacao_end, fonte, ultima_vela,
      preco as preco_snap from pools where ativa = 1 and ativo is not null and ativo <> ''
      and (buscado_em is null or buscado_em <= ?) order by coalesce(buscado_em, 0)`).all(agora - intervalo);
  }

  gravarVelas(poolId, fonte, velas, agora) {
    const ins = this.db.prepare(`insert into velas (pool_id, hora, o, h, l, c) values (?, ?, ?, ?, ?, ?)
      on conflict (pool_id, hora) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c`);
    this.transacao(() => {
      for (const v of velas) ins.run(poolId, v[0], v[1], v[2], v[3], v[4]);
      this.db.prepare(`update pools set fonte = ?, buscado_em = ?,
        primeira_vela = (select min(hora) from velas where pool_id = ?), ultima_vela = (select max(hora) from velas where pool_id = ?)
        where pool_id = ?`).run(fonte, agora, poolId, poolId, poolId);
    });
    return velas.length;
  }

  marcarBuscado(ids, agora) {
    const up = this.db.prepare("update pools set buscado_em = ? where pool_id = ?");
    this.transacao(() => { for (const id of ids) up.run(agora, id); });
  }

  /**
   * Velas [t, o, h, l, c, volume] de uma pool. Volume da hora = volume 24h do
   * retrato daquela hora ÷ 24; sem retrato, o volume do dia no Scanner ÷ 24.
   */
  velasComVolume(poolId, desde, ate = 4e9) {
    const vs = this.db.prepare("select hora, o, h, l, c from velas where pool_id = ? and hora >= ? and hora < ? order by hora")
      .all(poolId, desde, ate);
    const ret = new Map(this.db.prepare("select hora, vol_24h from retratos where pool_id = ? and hora >= ?")
      .all(poolId, desde).map((r) => [r.hora, r.vol_24h]));
    const lei = new Map(this.db.prepare("select dia, vol_24h from leituras where pool_id = ? and dia >= ?")
      .all(poolId, diaUTC(desde)).map((r) => [r.dia, r.vol_24h]));
    return vs.map((v) => {
      const vol = ret.get(v.hora) ?? lei.get(diaUTC(v.hora)) ?? 0;
      return [v.hora, v.o, v.h, v.l, v.c, (vol || 0) / 24];
    });
  }

  /** Pools com 7 dias ou mais de velas, no formato que os agentes recebem. */
  poolsProntas(agora, dias = 31) {
    const ps = this.db.prepare(`select * from pools where ativa = 1 and primeira_vela is not null and primeira_vela <= ?
      order by pool_id`).all(agora - 7 * DIA);
    return ps.map((p) => ({
      pool_id: p.pool_id, rede: p.rede, dex: p.dex, par: p.par, taxa_pct: p.taxa_pct, tvl: p.tvl, vol_24h: p.vol_24h,
      ativo_simbolo: p.ativo_simbolo, cotacao: p.cotacao, preco: p.preco, preco_usd: p.preco_usd,
      tvl_snap: p.tvl_snap, vol_24h_snap: p.vol_snap,
      candles: this.velasComVolume(p.pool_id, agora - dias * DIA),
    }));
  }

  // ---------- rodadas ----------
  ultimaRodada() {
    return this.db.prepare("select max(rodada) as r from rodadas").get().r ?? null;
  }

  achadosDesde(desde) {
    return this.db.prepare("select dados, rodada from achados where rodada >= ?").all(desde)
      .map((r) => ({ ...JSON.parse(r.dados), rodada: new Date(r.rodada * 1000).toISOString() }));
  }

  gravarRodada(rodada, saida) {
    const ins = this.db.prepare(`insert or ignore into achados (rodada, agente, pool_id, rede, dex, par, modelo, faixas,
      media_usd, p10_usd, custo_usd, dados) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const an = this.db.prepare(`insert into analises (pool_id, agente, rodada, dados) values (?, ?, ?, ?)
      on conflict (pool_id, agente) do update set rodada = excluded.rodada, dados = excluded.dados`);
    const rel = saida.relatorio;
    this.transacao(() => {
      for (const a of saida.achados) {
        ins.run(rodada, a.agente, a.pool_id, a.rede, a.dex, a.par, a.modelo, a.faixas, a.media_usd, a.p10_usd, a.custo_usd, json(a));
      }
      this.sql("delete from analises");
      for (const p of saida.analises || []) {
        if (p.erro) an.run(p.pool_id, "_erro", rodada, json({ erro: p.erro }));
        for (const x of p.analises || []) an.run(p.pool_id, x.agente, rodada, json(x));
      }
      this.db.prepare(`insert or replace into rodadas (rodada, pools, achados, disputas, conflitos, duracao_s, resumo)
        values (?, ?, ?, ?, ?, ?, ?)`).run(rodada, saida.pools, saida.achados.length, rel.disputas.length,
        rel.conflitos.length, saida.duracao_s, json({ status: saida.status, relatorio: rel, erros: saida.erros }));
    });
  }

  // ---------- boletim ----------
  /** Achados que completaram 7 ou 30 dias (até 3 de folga): o primeiro de cada agente, pool e dia, ainda sem nota. */
  pendentesBoletim(agora, limite = 200) {
    const out = [];
    const feitos = new Set(this.db.prepare("select agente, pool_id, horizonte_dias, rodada from boletim").all()
      .map((b) => `${b.agente}|${b.pool_id}|${b.horizonte_dias}|${diaUTC(b.rodada)}`));
    for (const h of [7, 30]) {
      const vistos = new Set();
      const rows = this.db.prepare("select id, rodada, dados from achados where rodada <= ? and rodada > ? order by rodada")
        .all(agora - h * DIA, agora - (h + 3) * DIA);
      for (const r of rows) {
        const a = JSON.parse(r.dados);
        const k = `${a.agente}|${a.pool_id}|${h}|${diaUTC(r.rodada)}`;
        if (vistos.has(k) || feitos.has(k)) continue;
        vistos.add(k);
        out.push({
          achado_id: r.id, rodada: new Date(r.rodada * 1000).toISOString(), _t: r.rodada, agente: a.agente, pool_id: a.pool_id,
          par: a.par, horizonte_dias: h, preco: a.preco, posicoes: a.posicoes, faixa_min: a.faixa_min, faixa_max: a.faixa_max,
          capital_usd: a.capital_usd, mercado: a.mercado,
        });
      }
    }
    return out.slice(0, limite);
  }

  /** Velas e TVL médio (retratos, ou leituras do Scanner) do período que se seguiu ao achado. */
  periodoReal(poolId, inicio, dias) {
    const fim = inicio + dias * DIA;
    const candles = this.velasComVolume(poolId, inicio - 3600, fim);
    let tvl = this.db.prepare("select avg(tvl) as m from retratos where pool_id = ? and hora >= ? and hora < ?").get(poolId, inicio, fim).m;
    if (tvl == null) tvl = this.db.prepare("select avg(tvl) as m from leituras where pool_id = ? and dia >= ? and dia < ?")
      .get(poolId, diaUTC(inicio), diaUTC(fim)).m;
    return { candles, tvl_usd: tvl ?? null };
  }

  gravarBoletim(resultados, agora) {
    const ins = this.db.prepare(`insert or ignore into boletim (achado_id, horizonte_dias, rodada, agente, pool_id, acertou,
      dentro_faixa, ganhou_base, erro_usd, metodo, dados, avaliado_em) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.transacao(() => {
      for (const r of resultados) {
        ins.run(r.achado_id, r.horizonte_dias, Math.floor(Date.parse(r.rodada) / 1000), r.agente, r.pool_id, r.acertou ? 1 : 0,
          r.dentro_faixa ? 1 : 0, r.ganhou_base ? 1 : 0, r.erro_usd, r.metodo, json(r), agora);
      }
    });
  }

  /** Nota de cada agente nos últimos 30 dias de avaliações (método atual). */
  resumoBoletim(agora) {
    const rows = this.db.prepare(`select agente, horizonte_dias as h, count(*) as n, avg(acertou) as ac, avg(dentro_faixa) as df,
      avg(ganhou_base) as gb, avg(erro_usd) as erro from boletim where metodo = 'atual' and avaliado_em >= ?
      group by agente, horizonte_dias`).all(agora - 30 * DIA);
    const out = {};
    for (const r of rows) {
      (out[r.agente] ||= {})[`${r.h}d`] = {
        avaliados: r.n, acertos_pct: +(100 * r.ac).toFixed(1), dentro_faixa_pct: +(100 * r.df).toFixed(1),
        ganhou_base_pct: +(100 * r.gb).toFixed(1), erro_medio_usd: +r.erro.toFixed(2),
      };
    }
    return out;
  }

  // ---------- manutenção ----------
  manutencao(agora) {
    const corte = agora - GUARDA_DIAS * DIA;
    this.transacao(() => {
      this.db.prepare("delete from velas where hora < ?").run(corte);
      this.db.prepare("delete from retratos where hora < ?").run(corte);
      this.db.prepare("delete from leituras where dia < ?").run(diaUTC(corte));
      this.db.prepare("delete from achados where rodada < ?").run(agora - 365 * DIA);
      this.db.prepare("delete from boletim where avaliado_em < ?").run(agora - 365 * DIA);
      this.db.prepare("delete from rodadas where rodada < ?").run(agora - 365 * DIA);
      this.sql("update pools set primeira_vela = (select min(hora) from velas v where v.pool_id = pools.pool_id)");
    });
  }

  fechar() { this.db.close(); }
}
