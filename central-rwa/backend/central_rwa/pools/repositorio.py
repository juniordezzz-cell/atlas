"""Onde as pools ficam. MemoryPoolStore serve aos testes e ao --dry-run;
PostgresPoolStore grava no Supabase, schema scanner."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, timedelta

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
