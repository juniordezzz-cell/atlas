"""Onde as pools ficam. MemoryPoolStore serve aos testes e ao --dry-run;
PostgresPoolStore grava no Supabase, schema scanner."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date, datetime, timedelta

from ..db.connect import connect
from . import config
from .modelos import Leitura, PoolFinal, TokenInfo


def linha_pool(f: PoolFinal, agora: datetime) -> dict:
    c = f.cand
    return {
        "id": c.id, "fonte": c.fonte, "rede": c.rede, "dex": c.dex, "par": c.par,
        "token_a": c.token_a.endereco, "simbolo_a": c.token_a.simbolo,
        "token_b": c.token_b.endereco, "simbolo_b": c.token_b.simbolo,
        "fee": c.fee, "tvl": c.tvl, "vol_24h": c.vol_24h, "vol_7d": c.vol_7d,
        "apr": c.apr, "apr_reward": c.apr_reward, "criada_em": c.criada_em, "sinais": c.sinais,
        "trilho": f.trilho, "motivos": f.motivos, "nota": f.nota, "componentes": f.componentes,
        "ativa": True, "visto_em": agora, "falhas_seguidas": 0,
    }


class PoolStore:
    def tokens_em_cache(self, rede: str, enderecos: list[str], validade_desde: datetime) -> dict[str, TokenInfo]: ...
    def salvar_tokens(self, infos: list[TokenInfo]) -> None: ...
    def leituras(self, pool_ids: list[str]) -> dict[str, list[Leitura]]: ...
    def gravar(self, finais: list[PoolFinal], hoje: date, agora: datetime) -> dict: ...
    def gravar_status(self, itens: list[dict]) -> None: ...
    def close(self) -> None: ...


class MemoryPoolStore(PoolStore):
    def __init__(self) -> None:
        self.pools: dict[str, dict] = {}
        self.leituras_por_pool: dict[str, list[Leitura]] = {}
        self.tokens: dict[tuple[str, str], TokenInfo] = {}
        self.status: list[dict] = []

    def tokens_em_cache(self, rede, enderecos, validade_desde):
        return {e: t for e in enderecos if (t := self.tokens.get((rede, e))) and t.consultado_em >= validade_desde}

    def salvar_tokens(self, infos):
        for t in infos:
            self.tokens[(t.rede, t.endereco)] = t

    def leituras(self, pool_ids):
        return {p: list(self.leituras_por_pool.get(p, [])) for p in pool_ids}

    def gravar(self, finais, hoje, agora):
        novas = atualizadas = inativadas = 0
        vistos = set()
        for f in finais:
            pid = f.cand.id
            vistos.add(pid)
            if pid in self.pools:
                atualizadas += 1
            else:
                novas += 1
            self.pools[pid] = linha_pool(f, agora)
            ls = [l for l in self.leituras_por_pool.get(pid, []) if l.dia != hoje]
            c = f.cand
            ls.append(Leitura(pid, hoje, c.tvl, c.vol_24h, c.vol_7d, c.apr, c.fee))
            self.leituras_por_pool[pid] = ls
        for pid, row in self.pools.items():
            if pid in vistos or not row["ativa"]:
                continue
            row["falhas_seguidas"] += 1
            if row["falhas_seguidas"] >= config.FALHAS_PARA_SUMIR:
                row["ativa"] = False
                inativadas += 1
        corte = hoje - timedelta(days=config.LEITURAS_DIAS)
        for pid in self.leituras_por_pool:
            self.leituras_por_pool[pid] = [l for l in self.leituras_por_pool[pid] if l.dia > corte]
        return {"novas": novas, "atualizadas": atualizadas, "inativadas": inativadas}

    def gravar_status(self, itens):
        self.status = list(itens)

    def close(self):
        pass


# ======================================================================
# Postgres (Supabase)
# ======================================================================

_COLS = ("id", "fonte", "rede", "dex", "par", "token_a", "simbolo_a", "token_b", "simbolo_b", "fee", "tvl",
         "vol_24h", "vol_7d", "apr", "apr_reward", "criada_em", "sinais", "trilho", "motivos", "nota",
         "componentes", "ativa", "visto_em", "falhas_seguidas")


class PostgresPoolStore(PoolStore):
    def __init__(self, dsn: str) -> None:
        self.conn = connect(dsn)

    def _query(self, sql: str, params=None) -> list[tuple]:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def tokens_em_cache(self, rede, enderecos, validade_desde):
        if not enderecos:
            return {}
        rows = self._query(
            "select rede, endereco, simbolo, honeypot, mint_ativo, freeze_ativo, dev_pct, holders, coingecko_id, "
            "mcap, primeira_pool_em, consultado_em from scanner.tokens "
            "where rede=%s and endereco = any(%s) and consultado_em >= %s",
            (rede, enderecos, validade_desde),
        )
        return {r[1]: TokenInfo(*r) for r in rows}

    def salvar_tokens(self, infos):
        with self.conn.cursor() as cur:
            for t in infos:
                d = asdict(t)
                cur.execute(
                    "insert into scanner.tokens (" + ",".join(d) + ") values (" + ",".join(["%s"] * len(d)) + ") "
                    "on conflict (rede, endereco) do update set "
                    + ",".join(f"{k}=excluded.{k}" for k in d if k not in ("rede", "endereco")),
                    list(d.values()),
                )
        self.conn.commit()

    def leituras(self, pool_ids):
        out: dict[str, list[Leitura]] = {p: [] for p in pool_ids}
        if not pool_ids:
            return out
        for r in self._query(
            "select pool_id, dia, tvl, vol_24h, vol_7d, apr, fee from scanner.leituras where pool_id = any(%s) order by dia",
            (pool_ids,),
        ):
            out[r[0]].append(Leitura(*r))
        return out

    def gravar(self, finais, hoje, agora):
        ids = [f.cand.id for f in finais]
        existentes = {r[0] for r in self._query("select id from scanner.pools where id = any(%s)", (ids,))} if ids else set()
        with self.conn.cursor() as cur:
            for f in finais:
                row = linha_pool(f, agora)
                vals = [json.dumps(row[k]) if k in ("sinais", "componentes") else row[k] for k in _COLS]
                cur.execute(
                    "insert into scanner.pools (" + ",".join(_COLS) + ") values (" + ",".join(["%s"] * len(_COLS)) + ") "
                    "on conflict (id) do update set " + ",".join(f"{k}=excluded.{k}" for k in _COLS if k != "id"),
                    vals,
                )
                c = f.cand
                cur.execute(
                    "insert into scanner.leituras (pool_id, dia, tvl, vol_24h, vol_7d, apr, fee) values (%s,%s,%s,%s,%s,%s,%s) "
                    "on conflict (pool_id, dia) do update set tvl=excluded.tvl, vol_24h=excluded.vol_24h, "
                    "vol_7d=excluded.vol_7d, apr=excluded.apr, fee=excluded.fee",
                    (c.id, hoje, c.tvl, c.vol_24h, c.vol_7d, c.apr, c.fee),
                )
            cur.execute(
                "update scanner.pools set falhas_seguidas = falhas_seguidas + 1 where ativa and not (id = any(%s))", (ids,)
            )
            cur.execute(
                "update scanner.pools set ativa = false where ativa and falhas_seguidas >= %s", (config.FALHAS_PARA_SUMIR,)
            )
            inativadas = cur.rowcount
            cur.execute("delete from scanner.leituras where dia <= %s", (hoje - timedelta(days=config.LEITURAS_DIAS),))
        self.conn.commit()
        return {"novas": len(set(ids) - existentes), "atualizadas": len(existentes), "inativadas": inativadas}

    def gravar_status(self, itens):
        with self.conn.cursor() as cur:
            cur.execute("delete from scanner.status_coleta")
            for s in itens:
                cur.execute(
                    "insert into scanner.status_coleta (fonte, rede, dex, estado, contagem, em) values (%s,%s,%s,%s,%s,%s)",
                    (s["fonte"], s["rede"], s["dex"], s["estado"], s["contagem"], s["em"]),
                )
        self.conn.commit()

    def close(self):
        self.conn.close()
