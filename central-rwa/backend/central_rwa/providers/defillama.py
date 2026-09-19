"""DefiLlama — sem chave, sem limite publicado para uso normal. Sondado em 2026-09-19.

GET https://coins.llama.fi/prices/current/{chain:addr,chain:addr,...}
coins["chain:addr"] = {price, symbol, decimals, timestamp, confidence}
Só preço (sem volume/liquidez): serve como validação cruzada e reserva.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import TokenQuote
from ..networks import normalize_address, to_provider
from ..router.errors import NotSupported
from .base import Provider, chunks, fnum

BASE = "https://coins.llama.fi"
BATCH = 60


class DefiLlama(Provider):
    name = "defillama"

    def token_quotes(self, network: str, addresses: list[str]) -> list[TokenQuote]:
        chain = to_provider(self.name, network)
        if not chain:
            raise NotSupported(f"rede {network}")
        out: list[TokenQuote] = []
        for batch in chunks(addresses, BATCH):
            ids = ",".join(f"{chain}:{a}" for a in batch)
            data = self.get_json(f"{BASE}/prices/current/{ids}")
            for key, c in (data.get("coins") or {}).items():
                price = fnum(c.get("price"))
                if not price or (c.get("confidence") or 0) < 0.9:
                    continue
                addr = key.split(":", 1)[1]
                ts = c.get("timestamp")
                out.append(
                    TokenQuote(
                        network=network,
                        address=normalize_address(network, addr),
                        price_usd=price,
                        source=self.name,
                        observed_at=datetime.fromtimestamp(ts, timezone.utc) if ts else datetime.now(timezone.utc),
                    )
                )
        return out
