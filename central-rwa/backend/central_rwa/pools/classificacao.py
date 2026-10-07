"""Regras autorizadas em 26/09/2026; ver spec scanner-regras-design.
`caca` é o valor legado para Pendentes de análise, reservado a meme detectada.
Dados incompletos não são prova de meme nem garantia de segurança."""

from __future__ import annotations

from datetime import datetime
from math import isfinite

from . import config
from .modelos import Candidata, Leitura, TokenInfo
from .nota import eficiencia

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


def fraqueza_token(simbolo: str, info: TokenInfo | None, agora: datetime) -> str | None:
    """Por que o token não é sólido, ou None se é. Ligado em 07/10/2026: a
    regra existia desde 23/09 e nunca era chamada — 380 das 680 Sólidas
    tinham token sem cadastro na CoinGecko.

    Majors, stables e RWA conhecidos não precisam de consulta. Dado que a
    fonte não informa não reprova sozinho: sem idade (a DefiLlama não traz a
    data da pool), vale a combinação cadastro na CoinGecko + valor de
    mercado; sem contagem de holders, idem."""
    s = (simbolo or "").upper()
    if s in config.MAJORS or config.eh_rwa(simbolo):
        return None
    if info is None:
        return f"{s} ainda sem dados de segurança"
    if not info.coingecko_id:
        return f"{s} sem cadastro na CoinGecko"
    if (info.mcap or 0) < MCAP_MIN:
        return f"{s} com valor de mercado abaixo de US$ 10 mi"
    if info.primeira_pool_em is not None and (agora - info.primeira_pool_em).days < IDADE_MIN_DIAS:
        return f"{s} com menos de {IDADE_MIN_DIAS} dias"
    if info.holders is not None and info.holders < HOLDERS_MIN:
        return f"{s} com menos de 1.000 holders"
    return None


def token_solido(simbolo: str, info: TokenInfo | None, agora: datetime) -> bool:
    return fraqueza_token(simbolo, info, agora) is None


def classe_token(simbolo: str) -> str:
    s = (simbolo or "").upper()
    if s in config.STABLES:
        return "stable"
    if s in config.MAJORS or config.eh_rwa(simbolo):
        return "grande"
    return "outro"


def classe_par(c: Candidata) -> str:
    """stable/stable · grande/stable · grande/grande · cauda longa."""
    a, b = classe_token(c.token_a.simbolo), classe_token(c.token_b.simbolo)
    if "outro" in (a, b):
        return "cauda"
    if a == b == "stable":
        return "stable"
    if a == b == "grande":
        return "grande"
    return "grande_stable"


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
    if meme.get("estado") == "nao_verificada":
        return "caca", ["memecoin não verificada: a lista da CoinGecko veio incompleta nesta coleta"]
    fracos = [m for t, i in zip((c.token_a, c.token_b), list(infos) + [None, None])
              if (m := fraqueza_token(t.simbolo, i, agora))]
    if fracos:
        return "caca", ["token fraco: " + "; ".join(fracos)]
    r = c.vol_24h / c.tvl
    if c.criada_em is not None and (agora - c.criada_em).days < config.SUSPEITO_IDADE_DIAS and r > config.SUSPEITO_RAZAO:
        return "caca", [f"volume suspeito: pool com {(agora - c.criada_em).days} dias girando {r:.0f}× o TVL"]
    classe = classe_par(c)
    minimo = config.MIN_EFIC_DIA[classe]
    efic = eficiencia(c)
    if efic < minimo:
        return "caca", [f"rende {efic:.3f}%/dia, abaixo do mínimo de {minimo}%/dia para {config.CLASSE_ROTULO[classe]}"]
    return "solida", []
