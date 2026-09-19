"""Nome de cada rede em cada provedor. Verificado nas sondas de 2026-09-19."""

from __future__ import annotations

ACTIVE_NETWORKS = ("solana", "ethereum", "bnb_chain", "robinhood_chain")

PROVIDER_IDS: dict[str, dict[str, str]] = {
    "xstocks": {
        "solana": "Solana",
        "ethereum": "Ethereum",
        "bnb_chain": "BinanceSmartChain",
        # xStocks não emite na Robinhood Chain
    },
    "dexscreener": {
        "solana": "solana",
        "ethereum": "ethereum",
        "bnb_chain": "bsc",
        "robinhood_chain": "robinhood",
    },
    "geckoterminal": {
        "solana": "solana",
        "ethereum": "eth",
        "bnb_chain": "bsc",
        "robinhood_chain": "robinhood",
    },
    "defillama": {
        "solana": "solana",
        "ethereum": "ethereum",
        "bnb_chain": "bsc",
        "robinhood_chain": "robinhood",
    },
    "coingecko": {
        "solana": "solana",
        "ethereum": "ethereum",
        "bnb_chain": "binance-smart-chain",
        "robinhood_chain": "robinhood",
    },
}


def to_provider(provider: str, network: str) -> str | None:
    return PROVIDER_IDS.get(provider, {}).get(network)


def from_provider(provider: str, provider_network: str) -> str | None:
    for net, pid in PROVIDER_IDS.get(provider, {}).items():
        if pid == provider_network:
            return net
    return None


def normalize_address(network: str, address: str) -> str:
    """EVM não diferencia maiúsculas; Solana diferencia."""
    return address if network == "solana" else address.lower()
