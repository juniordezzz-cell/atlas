"""GeckoTerminal — sem chave, ~30 req/min. Sondado em 2026-09-19.

GET https://api.geckoterminal.com/api/v2/networks/{net}/tokens/multi/{a,b,...}  (até 30)
data[].attributes: address, price_usd, volume_usd.h24, total_reserve_in_usd
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import TokenQuote
from ..networks import normalize_address, to_provider
from ..router.errors import NotSupported
from .base import Provider, chunks, fnum

BASE = "https://api.geckoterminal.com/api/v2"
BATCH = 30


class GeckoTerminal(Provider):
    name = "geckoterminal"

    def token_quotes(self, network: str, addresses: list[str]) -> list[TokenQuote]:
        net = to_provider(self.name, network)
        if not net:
            raise NotSupported(f"rede {network}")
        now = datetime.now(timezone.utc)
        out: list[TokenQuote] = []
        for batch in chunks(addresses, BATCH):
            data = self.get_json(
                f"{BASE}/networks/{net}/tokens/multi/{','.join(batch)}",
                headers={"Accept": "application/json"},
            )
            for item in data.get("data") or []:
                a = item.get("attributes") or {}
                price = fnum(a.get("price_usd"))
                if not price:
                    continue
                out.append(
                    TokenQuote(
                        network=network,
                        address=normalize_address(network, a.get("address", "")),
                        price_usd=price,
                        volume_24h_usd=fnum((a.get("volume_usd") or {}).get("h24")),
                        liquidity_usd=fnum(a.get("total_reserve_in_usd")),
                        source=self.name,
                        observed_at=now,
                    )
                )
        return out
