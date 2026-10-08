"""Regras autorizadas em 26/09/2026; ver spec scanner-regras-design.
`caca` é o valor legado para Pendentes de análise, reservado a meme detectada.
Dados incompletos não são prova de meme nem garantia de segurança."""

from __future__ import annotations

import re
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
        # Ação tokenizada é controlada pelo emissor por desenho (emitir,
        # congelar, guardar a oferta). Desde 08/10 os RWA são consultados para
        # saber o emissor, e isso barrava as xStocks da Solana como golpe.
        emi = config.emissor(i.simbolo, i.coingecko_id) if i.coingecko_id else None
        if config.eh_rwa(i.simbolo, i.rede) or (emi and not emi["provavel"]):
            continue
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


def fraqueza_token(simbolo: str, info: TokenInfo | None, agora: datetime, rede: str | None = None) -> str | None:
    """Por que o token não é sólido, ou None se é. Ligado em 07/10/2026: a
    regra existia desde 23/09 e nunca era chamada — 380 das 680 Sólidas
    tinham token sem cadastro na CoinGecko.

    Majors, stables e RWA conhecidos não precisam de consulta. Dado que a
    fonte não informa não reprova sozinho: sem idade (a DefiLlama não traz a
    data da pool), vale a combinação cadastro na CoinGecko + valor de
    mercado; sem contagem de holders, idem."""
    s = (simbolo or "").upper()
    if s in config.MAJORS or config.eh_rwa(simbolo, rede):
        return None
    if info is not None and config.contrato_reconhecido(info.rede, info.endereco):
        return None   # versão bridged conferida à mão (lista em config.py)
    if info is None:
        return f"{s} ainda sem dados de segurança"
    if not info.coingecko_id:
        if bridged_confiavel(info):
            return None
        return f"{s} sem cadastro na CoinGecko"
    if (info.mcap or 0) < MCAP_MIN:
        return f"{s} com valor de mercado abaixo de US$ 10 mi"
    if info.primeira_pool_em is not None and (agora - info.primeira_pool_em).days < IDADE_MIN_DIAS:
        return f"{s} com menos de {IDADE_MIN_DIAS} dias"
    if info.holders is not None and info.holders < HOLDERS_MIN:
        return f"{s} com menos de 1.000 holders"
    return None


_BRIDGED = re.compile(r"\b(wrapped|bridged|wormhole|portal|allbridge|pegged|binance-peg)\b", re.I)
BRIDGED_GT_SCORE_MIN = 70.0
BRIDGED_HOLDERS_MIN = 10_000


def bridged_confiavel(info: TokenInfo) -> bool:
    """Versão embrulhada legítima sem cadastro na CoinGecko (08/10/2026): a
    CoinGecko liga a NEAR da Ethereum e da BNB Chain, não a wNEAR da Solana.
    Aceita quando o nome na GeckoTerminal diz que é embrulhada E a nota de
    confiança dela é alta E há muitos holders — as três juntas. Uma cópia
    que só copia o nome não tem a nota nem os holders."""
    return bool(info.nome and _BRIDGED.search(info.nome)
                and (info.gt_score or 0) >= BRIDGED_GT_SCORE_MIN
                and (info.holders or 0) >= BRIDGED_HOLDERS_MIN)


def token_solido(simbolo: str, info: TokenInfo | None, agora: datetime, rede: str | None = None) -> bool:
    return fraqueza_token(simbolo, info, agora, rede) is None


def categoria_token(simbolo: str, rede: str | None = None, info: TokenInfo | None = None,
                    memes: set[str] | frozenset = frozenset()) -> str:
    """stable · bluechip · rwa · meme · altcoin (decisão do dono, 07/10/2026).
    Blue chip é só Bitcoin, Ethereum e Solana; BNB, AVAX, SUI… são altcoin.
    Meme = o ID CoinGecko do token está entre as memecoins detectadas."""
    s = (simbolo or "").upper()
    if s in config.STABLES:
        return "stable"
    if s in config.BLUECHIPS:
        return "bluechip"
    if config.eh_rwa(simbolo, rede):
        return "rwa"
    if info is not None and info.coingecko_id and info.coingecko_id in memes:
        return "meme"
    return "altcoin"


def categorias(c: Candidata, infos: list[TokenInfo | None] | None = None) -> list[str]:
    infos = list(infos or []) + [None, None]
    memes = set((c.sinais.get("memecoin") or {}).get("ids") or [])
    return [categoria_token(t.simbolo, c.rede, i, memes) for t, i in zip((c.token_a, c.token_b), infos)]


def classe_par(c: Candidata, infos: list[TokenInfo | None] | None = None) -> str:
    """A classe de risco que define o rendimento mínimo:
    stable/stable · (blue chip|RWA)/stable · (blue chip|RWA)/(blue chip|RWA) ·
    qualquer par com altcoin ou meme."""
    a, b = categorias(c, infos)
    if "altcoin" in (a, b) or "meme" in (a, b):
        return "cauda"
    if a == b == "stable":
        return "stable"
    if "stable" in (a, b):
        return "grande_stable"
    return "grande"


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
              if (m := fraqueza_token(t.simbolo, i, agora, c.rede))]
    if fracos:
        return "caca", ["token fraco: " + "; ".join(fracos)]
    r = c.vol_24h / c.tvl
    if c.criada_em is not None and (agora - c.criada_em).days < config.SUSPEITO_IDADE_DIAS and r > config.SUSPEITO_RAZAO:
        return "caca", [f"volume suspeito: pool com {(agora - c.criada_em).days} dias girando {r:.0f}× o TVL"]
    classe = classe_par(c, infos)
    minimo = config.MIN_EFIC_DIA[classe]
    efic = eficiencia(c)
    if efic < minimo:
        return "caca", [f"rende {efic:.3f}%/dia, abaixo do mínimo de {minimo}%/dia para {config.CLASSE_ROTULO[classe]}"]
    return "solida", []
