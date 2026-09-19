"""DexScreener — sem chave. Sondado em 2026-09-19.

GET https://api.dexscreener.com/tokens/v1/{chainId}/{addr1,addr2,...}  (até 30 endereços)
Devolve uma lista de pares; cada par tem baseToken, priceUsd, volume.h24, liquidity.usd.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from ..models import TokenQuote
from ..networks import normalize_address, to_provider
from ..router.errors import NotSupported
from .base import Provider, chunks, fnum

BASE = "https://api.dexscreener.com"
BATCH = 30


class DexScreener(Provider):
    name = "dexscreener"

    def token_quotes(self, network: str, addresses: list[str]) -> list[TokenQuote]:
        chain = to_provider(self.name, network)
        if not chain:
            raise NotSupported(f"rede {network}")
        now = datetime.now(timezone.utc)
        pairs_by_token: dict[str, list[dict]] = defaultdict(list)
        wanted = {normalize_address(network, a) for a in addresses}
        for batch in chunks(addresses, BATCH):
            data = self.get_json(f"{BASE}/tokens/v1/{chain}/{','.join(batch)}")
            for pair in data or []:
                addr = normalize_address(network, pair.get("baseToken", {}).get("address", ""))
                if addr in wanted:
                    pairs_by_token[addr].append(pair)
        return [q for addr, pairs in pairs_by_token.items() if (q := aggregate(network, addr, pairs, now, self.name))]


def aggregate(network: str, address: str, pairs: list[dict], now: datetime, source: str) -> TokenQuote | None:
    """Preço do par mais líquido; volume e liquidez somados entre os pares."""
    priced = [p for p in pairs if fnum(p.get("priceUsd"))]
    if not priced:
        return None
    best = max(priced, key=lambda p: fnum((p.get("liquidity") or {}).get("usd")) or 0)
    vol = sum(fnum((p.get("volume") or {}).get("h24")) or 0 for p in priced)
    liq = sum(fnum((p.get("liquidity") or {}).get("usd")) or 0 for p in priced)
    return TokenQuote(
        network=network,
        address=address,
        price_usd=fnum(best["priceUsd"]),
        volume_24h_usd=vol,
        liquidity_usd=liq,
        source=source,
        observed_at=now,
    )
