"""Onde o coletor procura e com que régua. Espelha as listas do Scanner no site
(Ferramentas/scanner-pools/index.html: LLAMA_CHAINS, MY_DEXES, GECKO_SOURCES),
conferidas nas APIs em 22–23/09/2026."""

from __future__ import annotations

import re

TVL_MIN = 100_000.0
VOL_MIN = 50_000.0
GECKO_PAGINAS = 10
GECKO_INTERVALO_S = 2.2
CACHE_TOKEN_DIAS = 7
LEITURAS_DIAS = 30
FALHAS_PARA_SUMIR = 3
# Consultas de segurança de token por coleta: a 2,2 s cada, 300 cabem em ~11 min.
# O resto fica para as próximas coletas (cache de 7 dias) e, até lá, conta como Caça.
MAX_TOKENS_POR_COLETA = 300

# chain na DefiLlama -> rótulo da rede no ATLAS
LLAMA_CHAINS: dict[str, str] = {
    "Solana": "Solana", "Base": "Base", "Arbitrum": "Arbitrum", "BSC": "BNB Chain",
    "Ethereum": "Ethereum", "OP Mainnet": "Optimism", "Polygon": "Polygon",
    "Avalanche": "Avalanche", "Sui": "Sui", "Hyperliquid L1": "HyperEVM",
    "Robinhood Chain": "Robinhood",
}

# rótulo da rede -> slug da rede na GeckoTerminal (conferido em /networks em 23/09/2026)
GECKO_NET: dict[str, str] = {
    "Solana": "solana", "Base": "base", "Arbitrum": "arbitrum", "BNB Chain": "bsc",
    "Ethereum": "eth", "Optimism": "optimism", "Polygon": "polygon_pos",
    "Avalanche": "avax", "Sui": "sui-network", "HyperEVM": "hyperevm", "Robinhood": "robinhood",
}

_PROJETOS: dict[str, str] = {
    "uniswap-v4": "Uniswap", "uniswap-v3": "Uniswap", "uniswap-v2": "Uniswap", "uniswap": "Uniswap",
    "raydium-clmm": "Raydium", "raydium-amm": "Raydium", "raydium": "Raydium",
    "orca-dex": "Orca", "orca": "Orca", "orca-whirlpool": "Orca", "orca-whirlpools": "Orca",
    "pancakeswap-amm-v3": "PancakeSwap", "pancakeswap-amm": "PancakeSwap", "pancakeswap-amm-v2": "PancakeSwap",
    "meteora-dlmm": "Meteora", "meteora-amm": "Meteora", "meteora-dammv2": "Meteora",
    "aerodrome-slipstream": "Aerodrome", "aerodrome-v1": "Aerodrome", "aerodrome": "Aerodrome",
    "velodrome-v2": "Velodrome", "velodrome-v3": "Velodrome", "velodrome-slipstream": "Velodrome",
    "camelot-v2": "Camelot", "camelot-v3": "Camelot",
    "thena-v1": "THENA", "thena-fusion": "THENA", "thena": "THENA",
    "kamino-liquidity": "Kamino", "sushiswap": "SushiSwap", "sushiswap-v3": "SushiSwap",
    "curve-dex": "Curve", "quickswap-dex": "QuickSwap", "quickswap-v3": "QuickSwap",
    "joe-v2.2": "LFJ", "joe-v2.1": "LFJ", "joe-v2": "LFJ", "joe-dex": "LFJ",
    "pharaoh-v3": "Pharaoh", "pharaoh-exchange": "Pharaoh", "cetus-clmm": "Cetus", "cetus-amm": "Cetus",
    "hyperswap-v3": "HyperSwap", "hyperswap-v2": "HyperSwap", "project-x": "Project X",
    "ramses-cl-v2": "Ramses", "ramses-v2": "Ramses",
}

# DEXes que a DefiLlama cobre com volume + APR de taxa
LLAMA_PROJECTS: set[str] = {
    "Uniswap", "Raydium", "Orca", "Aerodrome", "Camelot", "Kamino", "SushiSwap", "Curve",
    "QuickSwap", "LFJ", "Pharaoh", "Cetus", "HyperSwap", "Project X", "Ramses",
}

# DEXes puxadas da GeckoTerminal (a DefiLlama não traz volume delas)
GECKO_SOURCES: dict[str, list[dict]] = {
    "PancakeSwap": [
        {"rede": "BNB Chain", "dexes": ["pancakeswap-v3-bsc", "pancakeswap_v2"]},
        {"rede": "Base", "dexes": ["pancakeswap-v3-base", "pancakeswap-v2-base", "pancakeswap-infinity-clmm-base"]},
        {"rede": "Arbitrum", "dexes": ["pancakeswap-v3-arbitrum", "pancakeswap-v2-arbitrum", "pancakeswap-stableswap-arbitrum"]},
        {"rede": "Robinhood", "dexes": ["pancakeswap-v3-robinhood", "pancakeswap-v2-robinhood"]},
    ],
    "Uniswap": [{"rede": "Robinhood", "dexes": ["uniswap-v3-robinhood", "uniswap-v2-robinhood", "uniswap-v4-robinhood"]}],
    "Meteora": [{"rede": "Solana", "dexes": ["meteora", "meteora-damm-v2"]}],
    "Velodrome": [{"rede": "Optimism", "dexes": ["velodrome-finance-slipstream", "velodrome-slipstream-v2-optimism", "velodrome-finance-v2"]}],
    "THENA": [{"rede": "BNB Chain", "dexes": ["thena-fusion", "thena-v3", "thena"]}],
}

# Tokens que contam como sólidos sem consulta (stables, majors e embrulhados).
MAJORS: set[str] = {
    "USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC",
    "BTC", "WBTC", "CBBTC", "BTCB", "TBTC",
    "ETH", "WETH", "WSTETH", "STETH", "CBETH", "RETH", "WEETH",
    "SOL", "WSOL", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF",
    "BNB", "WBNB", "AVAX", "WAVAX", "POL", "MATIC", "WPOL", "SUI", "HYPE", "WHYPE",
}

_TAXA_FIXA_V2 = {"uniswap-v2": 0.3, "sushiswap": 0.3}
_TAXA_EM_BP = {"cetus-clmm", "cetus-amm"}
_RWA = re.compile(r"^[A-Z]{1,6}X$")          # xStocks: NVDAx, SPYx... (comparado em maiúsculas)
RWA_EXTRA: set[str] = {"XAUT", "PAXG", "BUIDL", "USTB", "USYC", "OUSG"}


def pretty_project(slug: str) -> str:
    s = (slug or "").lower()
    if s in _PROJETOS:
        return _PROJETOS[s]
    return " ".join(w.capitalize() for w in s.split("-") if w) or "—"


def parse_llama_fee(meta, projeto: str) -> float:
    m = re.search(r"([\d.]+)\s*%", "" if meta is None else str(meta))
    p = (projeto or "").lower()
    if m:
        v = float(m.group(1))
        return v / 100 if p in _TAXA_EM_BP else v
    return _TAXA_FIXA_V2.get(p, 0.0)


def eh_rwa(simbolo: str) -> bool:
    s = (simbolo or "").upper()
    return bool(_RWA.match(s)) or s in RWA_EXTRA
