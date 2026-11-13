"""Uma varredura do estúdio: pools-alvo → snapshot (DexScreener) → preço por
hora (DeFiLlama; GeckoTerminal só de reserva) → banco → manutenção.

Roda a cada 15 min. As velas de cada pool são atualizadas no máximo uma vez
por hora.

Desde 13/11/2026 o histórico vem da DeFiLlama: as pools já em dia vão juntas
em poucas chamadas (até 500 pontos cada); pool nova ou atrasada baixa 31 dias
em 2 ou 3 chamadas. O preço é o do ativo dividido pelo da cotação (ou o preço
em dólar, com cotação stable), e o volume da hora vem dos próprios snapshots.
A GeckoTerminal só entra para quem a DeFiLlama não conhece, com no máximo 2
tentativas por pedido. Toda a etapa de velas para em 7 minutos: o que sobrar
fica para a execução seguinte (antes, esperas de 429 da GeckoTerminal
estouravam os 14 min do workflow).
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta

from .fontes import (LLAMA_MAX_PONTOS, POR_CHAMADA_DS, ClienteEstudio, Snapshot, chave_llama, cotacao_estavel,
                     parse_par_ds, parse_precos_llama, parse_velas_gt, velas_de_precos)

ORCAMENTO_GT = 15              # reserva: ~40 pools por hora em 4 execuções
ORCAMENTO_LLAMA = 40
PRAZO_VELAS_S = 7 * 60
INTERVALO_VELAS = timedelta(minutes=55)
VELAS_INICIAIS = 1000          # GeckoTerminal (41 dias)
HORAS_INICIAIS = 31 * 24       # DeFiLlama
EM_DIA = timedelta(hours=6)    # até aqui a pool entra no lote das "em dia"
DIF_MAX_PRECO = 0.05           # vela da DeFiLlama longe do preço da pool (snapshot): usa a GT
PRECO_PARADO = timedelta(hours=3)   # última hora com preço na DeFiLlama mais velha que isso: usa a GT


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
                     "cotacao_end": (s.cotacao_end if s else None) or e.get("cotacao_end"),
                     "fonte": e.get("fonte") if e.get("ativo") == ativo else None,
                     "preco_snap": s.preco if s else None,
                     "ultima_vela": e.get("ultima_vela") if e.get("ativo") == ativo else None,
                     "_ordem": buscado or datetime.min.replace(tzinfo=agora.tzinfo)})
    return sorted(fila, key=lambda x: x["_ordem"])


def limite_velas(ultima: datetime | None, agora: datetime) -> int:
    if ultima is None:
        return VELAS_INICIAIS
    horas = int((agora - ultima).total_seconds() // 3600)
    return max(2, min(VELAS_INICIAIS, horas + 2))


def _hora(t: datetime) -> int:
    return int(t.timestamp()) // 3600 * 3600


def chaves_do_item(item: dict) -> tuple[str, str | None] | None:
    """(token do ativo, token da cotação ou None se stable) na DeFiLlama; None = não dá.
    Pool que já caiu na GeckoTerminal (a DeFiLlama não conhecia o token ou o
    preço não batia com o da pool) continua nela."""
    if item.get("fonte") == "geckoterminal":
        return None
    ka = chave_llama(item["rede"], item.get("ativo"))
    if not ka:
        return None
    if cotacao_estavel(item.get("cotacao")):
        return ka, None
    kc = chave_llama(item["rede"], item.get("cotacao_end"))
    return (ka, kc) if kc else None


def pedidos_llama(itens: list[dict], agora: datetime) -> list[tuple[list[str], int, int]]:
    """Chamadas (tokens, início, span) que cobrem os itens: as pools em dia
    num lote só; as novas ou atrasadas, 31 dias cada, em janelas de até 500 pontos."""
    fim = _hora(agora)
    pedidos: list[tuple[list[str], int, int]] = []
    em_dia = [i for i in itens if i.get("ultima_vela") and agora - i["ultima_vela"] <= EM_DIA]
    ids_em_dia = {i["pool_id"] for i in em_dia}
    if em_dia:
        inicio = min(_hora(i["ultima_vela"]) for i in em_dia)
        span = (fim - inicio) // 3600 + 1
        tokens = sorted({k for i in em_dia for k in i["_chaves"] if k})
        por = max(1, LLAMA_MAX_PONTOS // span)
        for j in range(0, len(tokens), por):
            pedidos.append((tokens[j:j + por], inicio, span))
    for i in itens:
        if i["pool_id"] in ids_em_dia:
            continue
        tokens = [k for k in i["_chaves"] if k]
        inicio = fim - (HORAS_INICIAIS - 1) * 3600
        if i.get("ultima_vela"):
            inicio = max(inicio, _hora(i["ultima_vela"]))
        por = LLAMA_MAX_PONTOS // len(tokens)
        t = inicio
        while t <= fim:
            span = min(por, (fim - t) // 3600 + 1)
            pedidos.append((tokens, t, span))
            t += span * 3600
    return pedidos


def varrer(cli: ClienteEstudio, store, agora: datetime, orcamento_gt: int = ORCAMENTO_GT,
           orcamento_llama: int = ORCAMENTO_LLAMA, relogio=time.monotonic) -> dict:
    falhas: list[str] = []
    run_id = store.iniciar(agora)
    alvos = store.alvos()
    snaps = snapshots(cli, alvos, falhas)
    taxas = {a["pool_id"]: a.get("taxa_pct") for a in alvos}
    n_snap = store.gravar_snapshots(list(snaps.values()), taxas, agora)

    estados = store.estados_velas([a["pool_id"] for a in alvos])
    fila = fila_velas(alvos, estados, snaps, agora)
    t0 = relogio()

    def no_prazo() -> bool:
        return relogio() - t0 < PRAZO_VELAS_S

    # 1) DeFiLlama: preço por hora de todos os tokens em poucas chamadas
    pela_llama, pela_gt = [], []
    for item in fila:
        ch = chaves_do_item(item)
        if ch:
            pela_llama.append({**item, "_chaves": ch})
        else:
            pela_gt.append(item)
    precos: dict[str, dict[int, float]] = {}
    chamadas_llama = 0
    adiadas = False
    llama_falhou = False
    for tokens, inicio, span in pedidos_llama(pela_llama, agora):
        if chamadas_llama >= orcamento_llama or not no_prazo():
            adiadas = True
            break
        chamadas_llama += 1
        try:
            for k, serie in parse_precos_llama(cli.precos_llama(tokens, inicio, span)).items():
                precos.setdefault(k, {}).update(serie)
        except Exception as e:
            llama_falhou = True
            falhas.append(f"defillama: {type(e).__name__}")
    volumes = store.volumes_hora([i["pool_id"] for i in pela_llama], agora - timedelta(hours=HORAS_INICIAIS)) \
        if pela_llama else {}
    pools_llama = pools_gt = novas = preco_diferente = 0
    for item in pela_llama:
        ka, kc = item["_chaves"]
        if ka not in precos or (kc and kc not in precos):
            # A DeFiLlama não conhece o token (ou a chamada não chegou nele): reserva.
            if not adiadas and not llama_falhou:
                pela_gt.append(item)
            continue
        desde = _hora(item["ultima_vela"]) if item.get("ultima_vela") else 0
        velas = [(v[0], v[1], v[2], v[3], v[4], volumes.get((item["pool_id"], v[0]), 0.0))
                 for v in velas_de_precos(precos[ka], precos[kc] if kc else None) if v[0].timestamp() >= desde]
        if not velas:
            pela_gt.append(item)
            continue
        ref = item.get("preco_snap")
        parado = agora - velas[-1][0] > PRECO_PARADO
        if parado or (ref and abs(velas[-1][4] / ref - 1) > DIF_MAX_PRECO):
            # Preço do token na DeFiLlama parado há horas, ou que não é o preço desta
            # pool (token embrulhado, outro mercado): as velas vêm da GeckoTerminal.
            preco_diferente += 1
            pela_gt.append(item)
            continue
        novas += store.gravar_velas({**item, "fonte": "defillama"}, velas, agora)
        pools_llama += 1

    # 2) GeckoTerminal, só para quem sobrou
    antes = cli.gecko.gecko_metricas["requisicoes"]
    for item in pela_gt:
        if cli.gecko.gecko_metricas["requisicoes"] - antes >= orcamento_gt or not no_prazo():
            adiadas = True
            break
        j = cli.velas_gt(item["rede"], item["endereco"], item["ativo"], limite_velas(item["ultima_vela"], agora))
        if j is None:
            store.marcar_falha_velas(item["pool_id"], agora)
            falhas.append(f"velas {item['pool_id']}")
            continue
        velas = parse_velas_gt(j)
        novas += store.gravar_velas({**item, "fonte": "geckoterminal"}, velas, agora)
        pools_gt += 1

    store.manutencao()
    m = cli.gecko.gecko_metricas
    resumo = {
        "pools_alvo": len(alvos), "snapshots": n_snap, "sem_snapshot": len(alvos) - len(snaps),
        "fila_velas": len(fila), "candles_pools": pools_llama + pools_gt, "candles_pools_llama": pools_llama,
        "candles_pools_gt": pools_gt, "candles_novas": novas, "chamadas_llama": chamadas_llama,
        "llama_preco_diferente": preco_diferente,
        "chamadas_gt": m["requisicoes"] - antes, "limites_429": m["limites_429"], "velas_adiadas": adiadas,
        "falhas": falhas,
    }
    resumo["estado"] = "erro" if not alvos or n_snap == 0 else ("parcial" if falhas else "ok")
    store.finalizar(run_id, resumo)
    return resumo
