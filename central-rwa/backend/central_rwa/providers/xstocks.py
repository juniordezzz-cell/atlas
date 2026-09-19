"""xStocks (Backed) — API pública, sem chave. Sondado em 2026-09-19.

GET https://api.xstocks.fi/api/v2/public/assets?page=N  (100 por página; pageSize máx. 100)
  -> {"nodes": [...], "page": {"currentPage", "hasNextPage"}}
  node: symbol, underlyingSymbol, name, isTradingHalted, deployments[{network, address}]
Cabeçalho x-ratelimit-limit: 1000 (janela não documentada).
O endpoint /public/assets/{symbol}/price-data demorou ~20s e devolveu {"quote": null}
com o mercado fechado — por isso NÃO é usado como fonte de preço.
"""

from __future__ import annotations

from ..mapping import CONF_ISSUER_API
from ..models import TokenListing
from ..networks import ACTIVE_NETWORKS, from_provider, normalize_address
from .base import Provider

BASE = "https://api.xstocks.fi/api/v2"
MAX_PAGES = 50


class XStocks(Provider):
    name = "xstocks"

    def catalog(self, known_tickers: set[str] | None = None) -> list[TokenListing]:
        out: list[TokenListing] = []
        page = 0
        while page < MAX_PAGES:
            data = self.get_json(f"{BASE}/public/assets", params={"page": page, "pageSize": 100})
            for node in data.get("nodes") or []:
                out.extend(self._listings(node))
            if not (data.get("page") or {}).get("hasNextPage"):
                break
            page += 1
        return out

    def _listings(self, node: dict) -> list[TokenListing]:
        underlying = (node.get("underlyingSymbol") or (node.get("underlying") or {}).get("symbol") or "").upper() or None
        out = []
        for dep in node.get("deployments") or []:
            net = from_provider(self.name, dep.get("network", ""))
            if net not in ACTIVE_NETWORKS or not dep.get("address"):
                continue
            out.append(
                TokenListing(
                    issuer="xstocks",
                    network=net,
                    address=normalize_address(net, dep["address"]),
                    symbol=node.get("symbol", ""),
                    name=node.get("name"),
                    reference_ticker=underlying,
                    mapping_confidence=CONF_ISSUER_API if underlying else 0.0,
                    mapping_origin="api_emissor",
                    source=self.name,
                )
            )
        return out
