from __future__ import annotations

import httpx

from .. import USER_AGENT
from ..config import ProvidersFile
from .coingecko import CoinGecko
from .defillama import DefiLlama
from .dexscreener import DexScreener
from .geckoterminal import GeckoTerminal
from .keyed import Finnhub, Fred, Tiingo, TwelveData
from .treasury import Treasury
from .xstocks import XStocks
from .yahoo import Yahoo

REGISTRY = {
    cls.name: cls
    for cls in (XStocks, CoinGecko, DexScreener, GeckoTerminal, DefiLlama, Yahoo, Treasury, Tiingo, TwelveData, Finnhub, Fred)
}


def build_providers(config: ProvidersFile, client: httpx.Client | None = None) -> dict:
    """Instancia os provedores declarados em providers.yaml que têm adaptador."""
    client = client or httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
    return {name: REGISTRY[name](cfg, client) for name, cfg in config.providers.items() if name in REGISTRY}
