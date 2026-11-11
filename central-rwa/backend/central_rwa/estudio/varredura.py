"""Uma varredura do estúdio: pools-alvo → snapshot (DexScreener) → velas de
1h (GeckoTerminal, com orçamento por execução) → banco → manutenção.

Roda a cada 15 min. As velas de cada pool são atualizadas no máximo uma vez
por hora; pool nova baixa 41 dias de uma vez. O orçamento de chamadas da
GeckoTerminal por execução (padrão 30, ~5 min no ritmo de 10 s) divide as
pools entre as execuções da hora.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from .fontes import POR_CHAMADA_DS, ClienteEstudio, Snapshot, parse_par_ds, parse_velas_gt

ORCAMENTO_GT = 30
INTERVALO_VELAS = timedelta(minutes=55)
VELAS_INICIAIS = 1000


def _lotes(xs: list, n: int):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def chave_endereco(rede: str, endereco: str) -> str:
    return endereco if rede == "Solana" else endereco.lower()


def snapshots(cli: ClienteEstudio, alvos: list[dict], falhas: list[str]) -> dict[str, Snapshot]:
    """Um snapshot por pool-alvo encontrada na DexScreener, por pool_id."""
    out: dict[str, Snapshot] = {}
    for rede in ("Solana", "Base"):
        da_rede = [a for a in alvos if a["rede"] == rede]
        por_end = {chave_endereco(rede, a["endereco"]): a for a in da_rede}
        for lote in _lotes(list(por_end), POR_CHAMADA_DS):
            try:
                pares = cli.pares_ds(rede, lote)
            except Exception as e:  # uma falha de lote não derruba a varredura
                falhas.append(f"dexscreener {rede}: {type(e).__name__}")
                continue
            for par in pares:
                a = por_end.get(chave_endereco(rede, str(par.get("pairAddress", ""))))
                if a and (s := parse_par_ds(par, a["pool_id"])):
                    out[a["pool_id"]] = s
    return out


def fila_velas(alvos: list[dict], estados: dict[str, dict], snaps: dict[str, Snapshot], agora: datetime) -> list[dict]:
    """Pools que precisam de velas agora: nunca buscadas primeiro, depois as
    buscadas há mais tempo. Sem ativo conhecido (sem snapshot nem estado) fica fora."""
    fila = []
    for a in alvos:
        e = estados.get(a["pool_id"]) or {}
        s = snaps.get(a["pool_id"])
        ativo = (s.ativo if s else None) or e.get("ativo")
        if not ativo:
            continue
        buscado = e.get("buscado_em")
        if buscado and agora - buscado < INTERVALO_VELAS:
            continue
        fila.append({**a, "ativo": ativo, "ativo_simbolo": (s.ativo_simbolo if s else e.get("ativo_simbolo")),
                     "cotacao": (s.cotacao if s else e.get("cotacao")),
                     "ultima_vela": e.get("ultima_vela") if e.get("ativo") == ativo else None,
                     "_ordem": buscado or datetime.min.replace(tzinfo=agora.tzinfo)})
    return sorted(fila, key=lambda x: x["_ordem"])


def limite_velas(ultima: datetime | None, agora: datetime) -> int:
    if ultima is None:
        return VELAS_INICIAIS
    horas = int((agora - ultima).total_seconds() // 3600)
    return max(2, min(VELAS_INICIAIS, horas + 2))


def varrer(cli: ClienteEstudio, store, agora: datetime, orcamento_gt: int = ORCAMENTO_GT) -> dict:
    falhas: list[str] = []
    run_id = store.iniciar(agora)
    alvos = store.alvos()
    snaps = snapshots(cli, alvos, falhas)
    taxas = {a["pool_id"]: a.get("taxa_pct") for a in alvos}
    n_snap = store.gravar_snapshots(list(snaps.values()), taxas, agora)

    estados = store.estados_velas([a["pool_id"] for a in alvos])
    fila = fila_velas(alvos, estados, snaps, agora)
    antes = cli.gecko.gecko_metricas["requisicoes"]
    pools_velas = novas = 0
    for item in fila:
        if cli.gecko.gecko_metricas["requisicoes"] - antes >= orcamento_gt:
            break
        j = cli.velas_gt(item["rede"], item["endereco"], item["ativo"], limite_velas(item["ultima_vela"], agora))
        if j is None:
            store.marcar_falha_velas(item["pool_id"], agora)
            falhas.append(f"velas {item['pool_id']}")
            continue
        velas = parse_velas_gt(j)
        novas += store.gravar_velas(item, velas, agora)
        pools_velas += 1

    store.manutencao()
    m = cli.gecko.gecko_metricas
    resumo = {
        "pools_alvo": len(alvos), "snapshots": n_snap, "sem_snapshot": len(alvos) - len(snaps),
        "fila_velas": len(fila), "candles_pools": pools_velas, "candles_novas": novas,
        "chamadas_gt": m["requisicoes"] - antes, "limites_429": m["limites_429"], "falhas": falhas,
    }
    resumo["estado"] = "erro" if not alvos or n_snap == 0 else ("parcial" if falhas else "ok")
    store.finalizar(run_id, resumo)
    return resumo
