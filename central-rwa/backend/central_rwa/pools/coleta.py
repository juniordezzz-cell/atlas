"""Uma execução do coletor: fontes → pré-corte → segurança → trilho → nota → banco."""

from __future__ import annotations

from datetime import datetime, timedelta
from time import perf_counter

from . import config
from .classificacao import categorias, classe_par, passa_pre_corte, trilho
from .conferencia import conferir
from .fontes import parse_gecko_pools, parse_llama, parse_token_info, parse_tokens_multi
from .fontes_diretas import parse_orca, parse_raydium
from .modelos import Candidata, PoolFinal, TokenInfo
from .nota import calcular_notas
from .memes import identificar
from .descoberta import complementar

_CASO_SENSIVEL = {"Solana", "Sui"}


def normalizar_endereco(rede: str, endereco: str) -> str:
    return endereco if rede in _CASO_SENSIVEL else endereco.lower()


def reconciliar_diretas(todas: list[Candidata]) -> list[Candidata]:
    """Mantém o ID histórico da DefiLlama ao enriquecer a mesma pool nativa.

    Pares com mais de uma pool compatível ficam separados; símbolo sozinho
    nunca é usado como identidade.
    """
    def chave(c: Candidata):
        a, b = c.token_a.endereco, c.token_b.endereco
        if not a or not b:
            return None
        return (c.rede, c.dex, frozenset((normalizar_endereco(c.rede, a),
                                         normalizar_endereco(c.rede, b))), round(c.fee, 6))

    grupos: dict[tuple, list[Candidata]] = {}
    for c in todas:
        k = chave(c)
        if k:
            grupos.setdefault(k, []).append(c)
    removidas: set[str] = set()
    for grupo in grupos.values():
        antigas = [c for c in grupo if c.fonte == 'defillama']
        diretas = [c for c in grupo if c.fonte in {'orca', 'raydium'}]
        if len(antigas) != 1 or len(diretas) != 1:
            continue
        antiga, direta = antigas[0], diretas[0]
        if antiga.tvl <= 0 or abs(antiga.tvl-direta.tvl)/antiga.tvl > 0.15:
            continue
        antiga.tvl = direta.tvl
        if direta.vol_24h > 0:
            antiga.vol_24h = direta.vol_24h
        if direta.vol_7d is not None:
            antiga.vol_7d = direta.vol_7d
        if direta.fee > 0:
            antiga.fee = direta.fee
        antiga.apr = direta.apr if direta.apr is not None else antiga.apr
        antiga.sinais.update(direta.sinais)
        removidas.add(direta.id)
    return [c for c in todas if c.id not in removidas]


MEMORIA_ENDERECO_DIAS = 7


def lembrar_enderecos(store, cands: list[Candidata], agora: datetime) -> int:
    """O endereço on-chain de uma pool não muda; só TVL, volume e taxa.

    A conferência descobre o endereço (até 40 pares por coleta), mas os
    sinais eram refeitos do zero a cada coleta e ele se perdia — só 32 das
    270 pools da Uniswap tinham link direto (08/10/2026). Agora o endereço
    conferido há menos de 7 dias volta com a pool, marcado "memoria" (não
    afirma nada sobre o volume de hoje). Vencido, a pool volta para o começo
    da fila da conferência."""
    alvo = [c for c in cands if c.fonte == "defillama"]
    mem = store.enderecos_conhecidos([c.id for c in alvo]) if hasattr(store, "enderecos_conhecidos") else {}
    usados = 0
    for c in alvo:
        m = mem.get(c.id) or {}
        try:
            em = datetime.fromisoformat(str(m.get("em")))
        except ValueError:
            continue
        if m.get("endereco") and (agora - em).days < MEMORIA_ENDERECO_DIAS:
            c.sinais["conferencia"] = {"estado": "memoria", "endereco": m["endereco"], "em": m["em"]}
            usados += 1
    return usados


def unir_mesma_pool(cands: list[Candidata]) -> list[Candidata]:
    """A mesma pool on-chain vinda da DefiLlama e da GeckoTerminal vira UMA.

    A conferência descobre o endereço da pool da DefiLlama; se a GeckoTerminal
    trouxe esse mesmo endereço como outra candidata, a tela mostrava a pool
    duas vezes ("SOL/SPCXx" com taxa e "SOL/SPCXX" sem, Orca, 08/10/2026).
    Fica o ID da DefiLlama (é o que tem histórico); a taxa e a data de
    criação da GeckoTerminal completam o que a DefiLlama não informou."""
    gecko = {(c.rede, normalizar_endereco(c.rede, c.id.split(":", 2)[2])): c
             for c in cands if c.fonte == "geckoterminal" and c.id.count(":") >= 2}
    remover: set[str] = set()
    for c in cands:
        end = (c.sinais.get("conferencia") or {}).get("endereco") if c.fonte == "defillama" else None
        g = gecko.get((c.rede, normalizar_endereco(c.rede, end))) if end else None
        if g is None or g.id in remover:
            continue
        if c.fee <= 0 < g.fee:
            c.fee = g.fee
        if c.criada_em is None:
            c.criada_em = g.criada_em
        c.sinais["mesma_pool"] = g.id
        remover.add(g.id)
    return [c for c in cands if c.id not in remover]


def _candidatas(cli, status: list[dict], agora: datetime) -> list[Candidata]:
    todas: list[Candidata] = []
    try:
        llama = parse_llama(cli.llama_pools())
        todas += llama
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": "ok", "contagem": len(llama), "em": agora})
    except Exception as e:  # DefiLlama fora: segue com a GeckoTerminal
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": f"falhou: {e}"[:200], "contagem": 0, "em": agora})
    for nome, parser, metodo in [('orca', parse_orca, 'orca_pools'),
                                 ('raydium', parse_raydium, 'raydium_pools')]:
        if not hasattr(cli, metodo):
            continue
        antes = len(cli.parciais)
        try:
            cands = parser(getattr(cli, metodo)())
            todas.extend(cands)
            estado = 'parcial' if len(cli.parciais) > antes or not cands else 'ok'
        except Exception as exc:
            cands = []
            estado = f'falhou: {type(exc).__name__}'
            cli.parciais.append(f'{nome}: {type(exc).__name__}')
        status.append({'fonte': nome, 'rede': 'Solana', 'dex': nome,
                       'estado': estado, 'contagem': len(cands), 'em': agora})
    for dex, fontes_dex in config.GECKO_SOURCES.items():
        for src in fontes_dex:
            net = config.GECKO_NET[src["rede"]]
            for slug in src["dexes"]:
                antes = len(cli.parciais)
                itens = cli.gecko_pools(net, slug, config.GECKO_PAGINAS_GRANDES.get(slug, config.GECKO_PAGINAS))
                cands = parse_gecko_pools({"data": itens}, dex, src["rede"], slug)
                todas += cands
                estado = "parcial" if len(cli.parciais) > antes else "ok"
                status.append({"fonte": "geckoterminal", "rede": src["rede"], "dex": slug, "estado": estado, "contagem": len(cands), "em": agora})
    vistos: dict[str, Candidata] = {}
    for c in todas:
        vistos.setdefault(c.id, c)
    return reconciliar_diretas(list(vistos.values()))


def _dispensa_consulta(simbolo: str) -> bool:
    # RWA agora é consultado (cache de 7 dias): o ID CoinGecko diz o emissor
    return (simbolo or "").upper() in config.MAJORS


def _infos(cli, store, cands: list[Candidata], agora: datetime) -> tuple[dict[tuple[str, str], TokenInfo], int, int]:
    """Segurança de cada token. Majors e RWA conhecidos não gastam consulta;
    o resto vem do cache (7 dias) ou da GeckoTerminal."""
    pedidos: dict[str, set[str]] = {}
    primeira: dict[tuple[str, str], datetime] = {}
    peso: dict[tuple[str, str], float] = {}   # maior TVL entre as pools do token: prioridade da consulta
    for c in cands:
        for t in (c.token_a, c.token_b):
            if not t.endereco or _dispensa_consulta(t.simbolo):
                continue
            e = normalizar_endereco(c.rede, t.endereco)
            pedidos.setdefault(c.rede, set()).add(e)
            peso[(c.rede, e)] = max(peso.get((c.rede, e), 0.0), c.tvl)
            if c.criada_em and ((c.rede, e) not in primeira or c.criada_em < primeira[(c.rede, e)]):
                primeira[(c.rede, e)] = c.criada_em
    infos: dict[tuple[str, str], TokenInfo] = {}
    consultados = 0
    novos: list[TokenInfo] = []
    caches = {
        rede: store.tokens_em_cache(rede, sorted(ends), agora - timedelta(days=config.CACHE_TOKEN_DIAS))
        for rede, ends in pedidos.items()
    }
    # Quem falta, dos tokens das pools maiores para as menores, até o teto da coleta.
    faltando = sorted(((rede, e) for rede, ends in pedidos.items() for e in ends if e not in caches[rede]),
                      key=lambda k: -peso[k])
    agora_vez = set(faltando[: config.MAX_TOKENS_POR_COLETA])
    pendentes = len(faltando) - len(agora_vez)
    for rede, ends in pedidos.items():
        net = config.GECKO_NET.get(rede)
        cache = caches[rede]
        faltam = sorted((e for e in ends if (rede, e) in agora_vez), key=lambda e: -peso[(rede, e)])
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
    return infos, consultados, pendentes


def coletar(cli, store, agora: datetime) -> dict:
    status: list[dict] = []
    etapas: dict[str, float] = {}
    marco = perf_counter()
    def medir(nome: str) -> None:
        nonlocal marco
        fim = perf_counter()
        etapas[nome] = round(fim - marco, 1)
        marco = fim

    todas = _candidatas(cli, status, agora)
    medir('fontes')
    fontes_indisponiveis = {s['fonte'] for s in status
                            if s['fonte'] in {'defillama', 'orca', 'raydium', 'geckoterminal'}
                            and s['estado'] != 'ok'}
    falhas_antes = len(cli.parciais)
    todas, descoberta = complementar(cli, todas, agora)
    medir('descoberta')
    status.append({'fonte': 'descoberta', 'rede': None, 'dex': None,
                   'estado': 'parcial' if descoberta.get('pendentes') or len(cli.parciais) > falhas_antes else 'ok',
                   'contagem': descoberta['adicionadas'], 'em': agora})
    cands = [c for c in todas if passa_pre_corte(c)]
    # Segunda fonte ANTES de classificar e dar nota: número corrigido aqui é o
    # que entra na nota, no APR e no ranking. Corrigido para baixo pode sair
    # do pré-corte — por isso o corte roda de novo.
    lembrados = lembrar_enderecos(store, cands, agora)
    conf = conferir(cli, cands, config.GECKO_NET) if hasattr(cli, "gecko_busca") else {}
    for c in cands:   # data da conferência: é ela que vence em 7 dias
        cf = c.sinais.get("conferencia") or {}
        if cf.get("estado") == "conferida" and cf.get("endereco") and not cf.get("em"):
            cf["em"] = agora.isoformat()
    if conf:
        conf["enderecos_da_memoria"] = lembrados
    cands = unir_mesma_pool(cands)
    medir('conferencia')
    status.append({"fonte": "conferencia", "rede": None, "dex": None,
                   "estado": "ok" if conf else "sem conferência", "contagem": conf.get("conferidas", 0), "em": agora})
    cands = [c for c in cands if passa_pre_corte(c)]
    infos, consultados, pendentes = _infos(cli, store, cands, agora)
    medir('tokens')
    meme_ids = cli.meme_coin_ids() if hasattr(cli, 'meme_coin_ids') else set()
    medir('memecoin')
    status.append({'fonte': 'memecoin', 'rede': None, 'dex': None,
                   'estado': 'parcial' if any('memecoin:' in s for s in cli.parciais) else 'ok',
                   'contagem': len(meme_ids), 'em': agora})
    leituras = store.leituras([c.id for c in cands])
    notas = calcular_notas(cands, leituras)
    finais: list[PoolFinal] = []
    for c in cands:
        par_infos = [
            infos.get((c.rede, normalizar_endereco(c.rede, t.endereco))) if t.endereco else None
            for t in (c.token_a, c.token_b)
        ]
        identificar(c, par_infos, meme_ids, getattr(cli, 'meme_cobertura_ate', None))
        c.sinais['categoria'] = categorias(c, par_infos)
        c.sinais['classe_par'] = classe_par(c, par_infos)
        cats = c.sinais['categoria']
        c.sinais['emissor'] = [
            config.emissor(t.simbolo, i.coingecko_id if i else None, c.rede) if cat == 'rwa' else None
            for t, i, cat in zip((c.token_a, c.token_b), par_infos, cats)]
        t, motivos = trilho(c, par_infos, leituras.get(c.id, []), agora)
        nota, comp = notas[c.id]
        finais.append(PoolFinal(c, t, motivos, nota, comp))
    gravacao = store.gravar(finais, agora.date(), agora, fontes_indisponiveis)
    store.gravar_status(status)
    medir('classificacao_e_gravacao')
    return {
        "tempos_s": etapas,
        "gecko": getattr(cli, 'gecko_metricas', {}),
        "lidas": len(todas),
        "pre_corte": len(cands),
        "solidas": sum(f.trilho == "solida" for f in finais),
        "caca": sum(f.trilho == "caca" for f in finais),
        "barradas": sum(f.trilho == "barrada" for f in finais),
        "conferencia": conf,
        "descoberta": descoberta,
        "tokens_consultados": consultados,
        "tokens_pendentes": pendentes,
        "parciais": list(cli.parciais) + [s["estado"] for s in status if str(s["estado"]).startswith("falhou")],
        "gravacao": gravacao,
    }
