"""Uma execução do coletor: fontes → pré-corte → segurança → trilho → nota → banco."""

from __future__ import annotations

from datetime import datetime, timedelta

from . import config
from .classificacao import passa_pre_corte, trilho
from .fontes import parse_gecko_pools, parse_llama, parse_token_info, parse_tokens_multi
from .modelos import Candidata, PoolFinal, TokenInfo
from .nota import calcular_notas

_CASO_SENSIVEL = {"Solana", "Sui"}


def normalizar_endereco(rede: str, endereco: str) -> str:
    return endereco if rede in _CASO_SENSIVEL else endereco.lower()


def _candidatas(cli, status: list[dict], agora: datetime) -> list[Candidata]:
    todas: list[Candidata] = []
    try:
        llama = parse_llama(cli.llama_pools())
        todas += llama
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": "ok", "contagem": len(llama), "em": agora})
    except Exception as e:  # DefiLlama fora: segue com a GeckoTerminal
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": f"falhou: {e}"[:200], "contagem": 0, "em": agora})
    for dex, fontes_dex in config.GECKO_SOURCES.items():
        for src in fontes_dex:
            net = config.GECKO_NET[src["rede"]]
            for slug in src["dexes"]:
                antes = len(cli.parciais)
                itens = cli.gecko_pools(net, slug, config.GECKO_PAGINAS)
                cands = parse_gecko_pools({"data": itens}, dex, src["rede"])
                todas += cands
                estado = "parcial" if len(cli.parciais) > antes else "ok"
                status.append({"fonte": "geckoterminal", "rede": src["rede"], "dex": slug, "estado": estado, "contagem": len(cands), "em": agora})
    vistos: dict[str, Candidata] = {}
    for c in todas:
        vistos.setdefault(c.id, c)
    return list(vistos.values())


def _dispensa_consulta(simbolo: str) -> bool:
    return (simbolo or "").upper() in config.MAJORS or config.eh_rwa(simbolo)


def _infos(cli, store, cands: list[Candidata], agora: datetime) -> tuple[dict[tuple[str, str], TokenInfo], int]:
    """Segurança de cada token. Majors e RWA conhecidos não gastam consulta;
    o resto vem do cache (7 dias) ou da GeckoTerminal."""
    pedidos: dict[str, set[str]] = {}
    primeira: dict[tuple[str, str], datetime] = {}
    for c in cands:
        for t in (c.token_a, c.token_b):
            if not t.endereco or _dispensa_consulta(t.simbolo):
                continue
            e = normalizar_endereco(c.rede, t.endereco)
            pedidos.setdefault(c.rede, set()).add(e)
            if c.criada_em and ((c.rede, e) not in primeira or c.criada_em < primeira[(c.rede, e)]):
                primeira[(c.rede, e)] = c.criada_em
    infos: dict[tuple[str, str], TokenInfo] = {}
    consultados = 0
    novos: list[TokenInfo] = []
    for rede, ends in pedidos.items():
        net = config.GECKO_NET.get(rede)
        cache = store.tokens_em_cache(rede, sorted(ends), agora - timedelta(days=config.CACHE_TOKEN_DIAS))
        faltam = [e for e in sorted(ends) if e not in cache]
        mcaps = parse_tokens_multi(cli.tokens_multi(net, faltam)) if (net and faltam) else {}
        for e in faltam:
            payload = cli.token_info(net, e) if net else None
            consultados += 1
            if not payload:
                continue
            info = parse_token_info(payload, rede, agora)
            info.endereco = e
            info.mcap = mcaps.get(e.lower())
            novos.append(info)
            cache[e] = info
        for e, info in cache.items():
            # idade do token = pool mais antiga dele que o coletor já viu
            p = primeira.get((rede, e))
            if p and (info.primeira_pool_em is None or p < info.primeira_pool_em):
                info.primeira_pool_em = p
                novos.append(info)
            infos[(rede, e)] = info
    store.salvar_tokens(list({(t.rede, t.endereco): t for t in novos}.values()))
    return infos, consultados


def coletar(cli, store, agora: datetime) -> dict:
    status: list[dict] = []
    todas = _candidatas(cli, status, agora)
    cands = [c for c in todas if passa_pre_corte(c)]
    infos, consultados = _infos(cli, store, cands, agora)
    leituras = store.leituras([c.id for c in cands])
    notas = calcular_notas(cands, leituras)
    finais: list[PoolFinal] = []
    for c in cands:
        par_infos = [
            infos.get((c.rede, normalizar_endereco(c.rede, t.endereco))) if t.endereco else None
            for t in (c.token_a, c.token_b)
        ]
        t, motivos = trilho(c, par_infos, leituras.get(c.id, []), agora)
        nota, comp = notas[c.id]
        finais.append(PoolFinal(c, t, motivos, nota, comp))
    gravacao = store.gravar(finais, agora.date(), agora)
    store.gravar_status(status)
    return {
        "lidas": len(todas),
        "pre_corte": len(cands),
        "solidas": sum(f.trilho == "solida" for f in finais),
        "caca": sum(f.trilho == "caca" for f in finais),
        "barradas": sum(f.trilho == "barrada" for f in finais),
        "tokens_consultados": consultados,
        "parciais": list(cli.parciais) + [s["estado"] for s in status if str(s["estado"]).startswith("falhou")],
        "gravacao": gravacao,
    }
