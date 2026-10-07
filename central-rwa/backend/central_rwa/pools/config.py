"""Onde o coletor procura e com que régua. Espelha as listas do Scanner no site
(Ferramentas/scanner-pools/index.html: LLAMA_CHAINS, MY_DEXES, GECKO_SOURCES),
conferidas nas APIs em 22–23/09/2026."""

from __future__ import annotations

import re

# Pedido posterior: TVL >= US$ 100 mil obrigatório; razão > 0,50.
# Volume absoluto não tem piso independente.
# A GeckoTerminal libera ~6 pedidos/min por IP (medido em 23/09/2026; a
# documentação fala em 30, mas acima de 6/min cada 429 custa 15 s). Com 10 s
# entre pedidos a coleta inteira fica em ~30 min, dentro dos 55 do workflow.
GECKO_INTERVALO_S = 10.0
GECKO_PAGINAS = 2                  # 20 pools por página, as mais movimentadas primeiro
GECKO_PAGINAS_GRANDES = {          # DEXs com muitas pools boas que só a GeckoTerminal cobre
    "pancakeswap-v3-bsc": 8,
    "pancakeswap_v2": 6,
    "pancakeswap-infinity-clmm": 5,
    "meteora": 4,
    "meteora-damm-v2": 3,
}
CACHE_TOKEN_DIAS = 7
LEITURAS_DIAS = 30
FALHAS_PARA_SUMIR = 3
# Consultas de segurança de token por coleta (~17 min). Com 6 coletas por dia e
# cache de 7 dias, o acervo cresce ~600 tokens/dia; até ser consultado, conta como Caça.
MAX_TOKENS_POR_COLETA = 100

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
        {"rede": "BNB Chain", "dexes": ["pancakeswap-v3-bsc", "pancakeswap_v2", "pancakeswap-infinity-clmm"]},
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
STABLES: set[str] = {"USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC"}

# Rendimento mínimo por dia (fee × razão, em %) para a pool ficar nas Sólidas,
# pela classe do par: quanto mais arriscados os ativos, mais a pool tem de
# pagar. Abaixo disso vai para Pendentes. Régua do dono, 07/10/2026.
MIN_EFIC_DIA: dict[str, float] = {"stable": 0.01, "grande_stable": 0.05, "grande": 0.10, "cauda": 0.50}
CLASSE_ROTULO: dict[str, str] = {"stable": "stable/stable", "grande_stable": "blue chip ou RWA com stable",
                                 "grande": "blue chip ou RWA com blue chip ou RWA", "cauda": "par com altcoin ou meme"}
# Volume suspeito: pool nova girando demais vai para Pendentes antes dos 3 dias
# seguidos de 50× que a barram.
SUSPEITO_IDADE_DIAS = 30
SUSPEITO_RAZAO = 20.0

_TAXA_FIXA_V2 = {"uniswap-v2": 0.3, "sushiswap": 0.3}
_TAXA_EM_BP = {"cetus-clmm", "cetus-amm"}
RWA_EXTRA: set[str] = {"XAUT", "PAXG", "BUIDL", "USTB", "USYC", "OUSG", "SP500"}

# ---------- categoria de cada token (decisão do dono, 07/10/2026) ----------
# Blue chip = Bitcoin, Ethereum e Solana (com embrulhados e staking). Stable.
# RWA = ação/ETF tokenizada e commodity. Meme = memecoin detectada. O resto,
# inclusive BNB, AVAX e SUI, é altcoin.
BLUECHIPS: set[str] = {
    "BTC", "WBTC", "CBBTC", "BTCB", "TBTC",
    "ETH", "WETH", "WSTETH", "STETH", "CBETH", "RETH", "WEETH",
    "SOL", "WSOL", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF",
}
# Tickers de ações e ETFs tokenizados. Com "x" no fim (xStocks: NVDAx,
# GOOGLX) valem em qualquer rede; sem o "x", também — salvo os AMBIGUOS, que
# têm cripto homônima (META, GME…) e só contam como ação na rede Robinhood.
# A regra antiga ("qualquer símbolo terminado em X") pegava GMX, LCX, MYX e
# SAVAX como ação, e deixava NFLX, RBLX e SPY de fora (07/10/2026).
ACOES: set[str] = {
    "AAPL", "AMZN", "GOOGL", "GOOG", "MSFT", "NVDA", "TSLA", "META", "NFLX", "AMD", "INTC", "AVGO",
    "PLTR", "MSTR", "CRCL", "COIN", "HOOD", "RBLX", "GME", "MCD", "KO", "PEP", "JPM", "V", "MA",
    "STRC", "SPCX", "TCENT", "BABA", "ORCL", "CRM", "UBER", "ABNB", "DIS", "NKE", "WMT", "COST",
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "TBLL",
}
ACOES_AMBIGUAS: set[str] = {"META", "GME", "COIN", "AMD", "V", "MA", "KO", "DIS", "DIA"}
COMMODITIES: set[str] = {"GLD", "SLV", "IAU", "USO", "PAXG", "XAUT", "SP500"}


def eh_rwa(simbolo: str, rede: str | None = None) -> bool:
    s = (simbolo or "").upper()
    if s in RWA_EXTRA or s in COMMODITIES:
        return True
    if s.endswith("X") and len(s) > 2:
        base = s[:-1]
        if base.startswith("W") and base[1:] in ACOES:     # wTCENTx: ação embrulhada
            base = base[1:]
        if base in ACOES or base in COMMODITIES:
            return True
    if s in ACOES and (s not in ACOES_AMBIGUAS or rede == "Robinhood"):
        return True
    return False


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
