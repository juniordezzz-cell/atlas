"""As três camadas do filtro (a terceira — a lista do usuário — mora no site).

Camada 1 barra sem exceção. Camada 2 separa Sólida de Caça: na dúvida (token
sem informação), Caça — nunca Sólida."""

from __future__ import annotations

from datetime import datetime

from . import config
from .modelos import Candidata, Leitura, TokenInfo

APR_MAX = 10_000.0
WASH_RAZAO = 50.0
DEV_MAX = 20.0
IDADE_MIN_DIAS = 30
MCAP_MIN = 10_000_000.0
HOLDERS_MIN = 1_000


def passa_pre_corte(c: Candidata) -> bool:
    return c.tvl >= config.TVL_MIN and c.vol_24h >= config.VOL_MIN


def motivos_barrada(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura]) -> list[str]:
    m: list[str] = []
    for i in infos:
        if i is None:
            continue
        if i.honeypot:
            m.append("honeypot")
        if i.mint_ativo:
            m.append("mint ativo")
        if i.freeze_ativo:
            m.append("freeze ativo")
        if i.dev_pct is not None and i.dev_pct > DEV_MAX:
            m.append("dev com mais de 20%")
    tem_apr = (c.apr or 0) > 0 or (c.apr_reward or 0) > 0
    if c.fee <= 0 and not tem_apr:
        m.append("sem taxa e sem APR")
    if (c.apr or 0) > APR_MAX or (c.apr_reward or 0) > APR_MAX:
        m.append("APR impossível")
    ultimas = sorted(leituras, key=lambda x: x.dia)[-3:]
    if len(ultimas) == 3 and all(l.tvl > 0 and l.vol_24h / l.tvl > WASH_RAZAO for l in ultimas):
        m.append("volume/TVL acima de 50× por 3 dias")
    return list(dict.fromkeys(m))   # sem repetição, na ordem


def token_solido(simbolo: str, info: TokenInfo | None, agora: datetime) -> bool:
    s = (simbolo or "").upper()
    if s in config.MAJORS or config.eh_rwa(simbolo):
        return True
    if info is None or info.primeira_pool_em is None:
        return False
    idade = (agora - info.primeira_pool_em).days
    return (
        idade >= IDADE_MIN_DIAS
        and (info.mcap or 0) >= MCAP_MIN
        and (info.holders or 0) >= HOLDERS_MIN
        and bool(info.coingecko_id)
    )


def trilho(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura], agora: datetime) -> tuple[str, list[str]]:
    barr = motivos_barrada(c, infos, leituras)
    if barr:
        return "barrada", barr
    fracos = [
        f"{t.simbolo}: token novo ou sem histórico"
        for t, i in ((c.token_a, infos[0]), (c.token_b, infos[1]))
        if not token_solido(t.simbolo, i, agora)
    ]
    return ("caca", fracos) if fracos else ("solida", [])
