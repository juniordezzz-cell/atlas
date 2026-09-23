from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class TokenRef:
    endereco: str | None     # None quando a fonte não informa
    simbolo: str


@dataclass
class Candidata:
    """Uma pool como veio da fonte, já no formato do ATLAS."""
    id: str                  # "llama:<uuid>" ou "gecko:<net>:<endereço>"
    fonte: str               # "defillama" | "geckoterminal"
    rede: str                # rótulo do ATLAS: "BNB Chain"
    dex: str                 # "PancakeSwap"
    par: str                 # "USDT/WBNB"
    token_a: TokenRef
    token_b: TokenRef
    fee: float               # em %, 0 = desconhecida
    tvl: float
    vol_24h: float
    vol_7d: float | None
    apr: float | None        # APR de taxa, %
    apr_reward: float | None # emissões (ve(3,3)), %
    criada_em: datetime | None = None
    sinais: dict = field(default_factory=dict)   # Caça: compradores/vendedores 24h, variação 24h, mcap


@dataclass
class TokenInfo:
    rede: str
    endereco: str
    simbolo: str
    honeypot: bool | None
    mint_ativo: bool
    freeze_ativo: bool
    dev_pct: float | None
    holders: int | None
    coingecko_id: str | None
    mcap: float | None
    primeira_pool_em: datetime | None
    consultado_em: datetime


@dataclass
class Leitura:
    pool_id: str
    dia: date
    tvl: float
    vol_24h: float
    vol_7d: float | None
    apr: float | None
    fee: float


@dataclass
class PoolFinal:
    cand: Candidata
    trilho: str              # "solida" | "caca" | "barrada"
    motivos: list[str]
    nota: float              # 0–100
    componentes: dict        # {"rendimento":..,"consistencia":..,"profundidade":..,"tendencia":..}
