"""Regras autorizadas em 26/09/2026; ver spec scanner-regras-design.
`caca` é o valor legado para Pendentes de análise, reservado a meme detectada.
Dados incompletos não são prova de meme nem garantia de segurança."""

from __future__ import annotations

from datetime import datetime
from math import isfinite

from . import config
from .modelos import Candidata, Leitura, TokenInfo

APR_MAX = 10_000.0
WASH_RAZAO = 50.0
DEV_MAX = 20.0
IDADE_MIN_DIAS = 30
MCAP_MIN = 10_000_000.0
HOLDERS_MIN = 1_000


def passa_pre_corte(c: Candidata) -> bool:
    return isfinite(c.tvl) and isfinite(c.vol_24h) and c.tvl >= 100_000 and c.vol_24h / c.tvl > 0.50


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
    if not passa_pre_corte(c):
        return "barrada", ["TVL abaixo de US$ 100 mil ou razão de 24h <= 0,50"]
    meme = c.sinais.get("memecoin") or {}
    if meme.get("detectada"):
        if c.vol_24h / c.tvl <= 2.0:
            return "barrada", ["memecoin: razão de 24h <= 2,00"]
        return "caca", ["memecoin detectada: aguarda decisão por pool"]
    return "solida", []
