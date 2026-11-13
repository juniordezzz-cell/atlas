"""Onde a varredura lê as pools-alvo e grava. MemoriaEstudio serve aos testes
e ao --dry-run (alvos vindos da visão pública do Scanner); PostgresEstudio
grava no schema estudio com a credencial do papel estudio_agente."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from .. import USER_AGENT
from ..db.connect import connect
from .fontes import Snapshot

SUPABASE_URL = "https://opaimjoimbndwuwkxuva.supabase.co"
CHAVE_PUBLICAVEL = "sb_publishable_zScdAIDPAuKQ-Z5XXm-49A_hs9W-2cT"  # pública, a mesma de core/atlas-supabase-config.js


def alvo_de_linha_publica(x: dict) -> dict | None:
    """Mesmo filtro e endereço de estudio.pools_alvo, sobre public.scanner_pools."""
    tvl, vol = x.get("tvl") or 0, x.get("vol_24h") or 0
    if x.get("rede") not in ("Solana", "Base") or tvl < 250_000 or vol / tvl <= 0.5:
        return None
    s = x.get("sinais") or {}
    i = x["id"]
    end = (i.split(":", 2)[2] if i.startswith("gecko:") else None) or s.get("endereco_pool") \
        or (s.get("conferencia") or {}).get("endereco")
    if not end:
        return None
    return {"pool_id": i, "rede": x["rede"], "dex": x["dex"], "par": x["par"], "endereco": end,
            "taxa_pct": x.get("fee"), "tvl": tvl, "vol_24h": vol}


def alvos_publicos(client: httpx.Client | None = None) -> list[dict]:
    """Pools-alvo pela visão pública do Scanner (só para --dry-run, sem banco)."""
    c = client or httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT})
    r = c.get(f"{SUPABASE_URL}/rest/v1/scanner_pools",
              params={"select": "id,rede,dex,par,fee,tvl,vol_24h,sinais", "rede": "in.(Solana,Base)", "limit": "5000"},
              headers={"apikey": CHAVE_PUBLICAVEL})
    r.raise_for_status()
    return [a for x in r.json() if (a := alvo_de_linha_publica(x))]


class MemoriaEstudio:
    def __init__(self, alvos: list[dict] | None = None, carregar=alvos_publicos):
        self._alvos = alvos
        self._carregar = carregar
        self.snaps: dict[tuple[str, datetime], dict] = {}
        self.velas: dict[tuple[str, datetime], tuple] = {}
        self.estados: dict[str, dict] = {}
        self.execucoes: list[dict] = []

    def iniciar(self, agora):
        self.execucoes.append({"inicio": agora})
        return len(self.execucoes) - 1

    def alvos(self):
        if self._alvos is None:
            self._alvos = self._carregar()
        return list(self._alvos)

    def gravar_snapshots(self, snaps: list[Snapshot], taxas: dict, agora):
        for s in snaps:
            self.snaps[(s.pool_id, agora)] = {"preco": s.preco, "preco_usd": s.preco_usd, "tvl": s.tvl,
                                              "vol_24h": s.vol_24h, "giro": s.vol_24h / s.tvl, "taxa_pct": taxas.get(s.pool_id)}
        return len(snaps)

    def estados_velas(self, ids):
        return {i: dict(self.estados[i]) for i in ids if i in self.estados}

    def marcar_falha_velas(self, pool_id, agora):
        e = self.estados.setdefault(pool_id, {"falhas": 0})
        e["falhas"] = e.get("falhas", 0) + 1
        e["buscado_em"] = agora

    def gravar_velas(self, item, velas, agora):
        novas = 0
        for v in velas:
            k = (item["pool_id"], v[0])
            novas += k not in self.velas
            self.velas[k] = v[1:]
        e = self.estados.setdefault(item["pool_id"], {"falhas": 0})
        if e.get("ativo") != item["ativo"]:
            e["primeira_vela"] = None
        e.update(ativo=item["ativo"], ativo_simbolo=item.get("ativo_simbolo"), cotacao=item.get("cotacao"),
                 cotacao_end=item.get("cotacao_end"), fonte=item.get("fonte"), buscado_em=agora, falhas=0)
        if velas:
            e["ultima_vela"] = max(velas[-1][0], e.get("ultima_vela") or velas[-1][0])
            e["primeira_vela"] = min(velas[0][0], e.get("primeira_vela") or velas[0][0])
        return novas

    def volumes_hora(self, ids, desde):
        """Volume da hora ≈ média do volume 24h dos snapshots daquela hora ÷ 24."""
        soma: dict[tuple, list] = {}
        for (pid, t), sn in self.snaps.items():
            if pid in ids and t >= desde:
                h = t.replace(minute=0, second=0, microsecond=0)
                soma.setdefault((pid, h), []).append(sn["vol_24h"])
        return {k: sum(v) / len(v) / 24 for k, v in soma.items()}

    def manutencao(self):
        pass

    def finalizar(self, run_id, resumo):
        self.execucoes[run_id].update(resumo)

    def close(self):
        pass


class PostgresEstudio:
    def __init__(self, dsn: str):
        self.conn = connect(dsn, autocommit=True)

    def iniciar(self, agora):
        return self.conn.execute("insert into estudio.varredura_status (inicio) values (%s) returning id", (agora,)).fetchone()[0]

    def alvos(self):
        cur = self.conn.execute("select pool_id, rede, dex, par, endereco, taxa_pct, tvl, vol_24h from estudio.pools_alvo")
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def gravar_snapshots(self, snaps, taxas, agora):
        with self.conn.cursor() as cur:
            cur.executemany(
                "insert into estudio.snapshots (pool_id, observado_em, preco, preco_usd, tvl, vol_24h, giro, taxa_pct) "
                "values (%s,%s,%s,%s,%s,%s,%s,%s) on conflict (pool_id, observado_em) do nothing",
                [(s.pool_id, agora, s.preco, s.preco_usd, s.tvl, s.vol_24h, s.vol_24h / s.tvl, taxas.get(s.pool_id)) for s in snaps])
        return len(snaps)

    def estados_velas(self, ids):
        if not ids:
            return {}
        cur = self.conn.execute(
            "select pool_id, ativo, ativo_simbolo, cotacao, cotacao_end, fonte, buscado_em, ultima_vela, primeira_vela, falhas "
            "from estudio.candles_estado where pool_id = any(%s)", (ids,))
        cols = [d.name for d in cur.description]
        return {r[0]: dict(zip(cols, r)) for r in cur.fetchall()}

    def marcar_falha_velas(self, pool_id, agora):
        self.conn.execute(
            "insert into estudio.candles_estado (pool_id, buscado_em, falhas) values (%s, %s, 1) "
            "on conflict (pool_id) do update set buscado_em = excluded.buscado_em, falhas = estudio.candles_estado.falhas + 1",
            (pool_id, agora))

    def gravar_velas(self, item, velas, agora):
        with self.conn.transaction(), self.conn.cursor() as cur:
            # Ativo trocado (raro): as velas antigas são de outro token, saem.
            cur.execute("delete from estudio.candles c using estudio.candles_estado e "
                        "where e.pool_id = %s and c.pool_id = e.pool_id and e.ativo is distinct from %s and e.ativo is not null",
                        (item["pool_id"], item["ativo"]))
            novas = 0
            for v in velas:
                cur.execute("insert into estudio.candles (pool_id, hora, abertura, maxima, minima, fechamento, volume_usd) "
                            "values (%s,%s,%s,%s,%s,%s,%s) on conflict (pool_id, hora) do update set "
                            "abertura = excluded.abertura, maxima = excluded.maxima, minima = excluded.minima, "
                            "fechamento = excluded.fechamento, volume_usd = excluded.volume_usd "
                            "returning (xmax = 0)", (item["pool_id"], *v))
                novas += bool(cur.fetchone()[0])
            cur.execute(
                "insert into estudio.candles_estado (pool_id, ativo, ativo_simbolo, cotacao, cotacao_end, fonte, buscado_em, "
                "falhas, ultima_vela, primeira_vela) "
                "select %s, %s, %s, %s, %s, %s, %s, 0, max(hora), min(hora) from estudio.candles where pool_id = %s "
                "on conflict (pool_id) do update set ativo = excluded.ativo, ativo_simbolo = excluded.ativo_simbolo, "
                "cotacao = excluded.cotacao, cotacao_end = coalesce(excluded.cotacao_end, estudio.candles_estado.cotacao_end), "
                "fonte = excluded.fonte, buscado_em = excluded.buscado_em, falhas = 0, "
                "ultima_vela = excluded.ultima_vela, primeira_vela = excluded.primeira_vela",
                (item["pool_id"], item["ativo"], item.get("ativo_simbolo"), item.get("cotacao"), item.get("cotacao_end"),
                 item.get("fonte"), agora, item["pool_id"]))
        return novas

    def volumes_hora(self, ids, desde):
        """Volume da hora ≈ média do volume 24h dos snapshots daquela hora ÷ 24
        (snapshots de 15 min nos últimos 7 dias; resumo horário antes disso)."""
        if not ids:
            return {}
        cur = self.conn.execute(
            "select pool_id, hora, vol from ("
            "  select pool_id, date_trunc('hour', observado_em) as hora, avg(vol_24h) / 24 as vol "
            "  from estudio.snapshots where pool_id = any(%s) and observado_em >= %s group by 1, 2"
            "  union all"
            "  select pool_id, hora, vol_24h / 24 from estudio.snapshots_hora h "
            "  where pool_id = any(%s) and hora >= %s and vol_24h is not null and not exists ("
            "    select 1 from estudio.snapshots s where s.pool_id = h.pool_id "
            "    and date_trunc('hour', s.observado_em) = h.hora)"
            ") v", (ids, desde, ids, desde))
        return {(r[0], r[1]): float(r[2]) for r in cur.fetchall() if r[2] is not None}

    def manutencao(self):
        self.conn.execute("select estudio.manutencao()")

    def finalizar(self, run_id, resumo):
        self.conn.execute(
            "update estudio.varredura_status set fim = %s, pools_alvo = %s, snapshots = %s, candles_pools = %s, "
            "candles_novas = %s, chamadas_gt = %s, limites_429 = %s, falhas = %s, estado = %s, "
            "chamadas_llama = %s, velas_adiadas = %s where id = %s",
            (datetime.now(timezone.utc), resumo["pools_alvo"], resumo["snapshots"], resumo["candles_pools"],
             resumo["candles_novas"], resumo["chamadas_gt"], resumo["limites_429"], resumo["falhas"][:50],
             resumo["estado"], resumo.get("chamadas_llama", 0), bool(resumo.get("velas_adiadas")), run_id))

    def close(self):
        self.conn.close()
