"""CoinGecko — funciona sem chave (limite muito baixo: em 2026-09-19 deu 429
depois de ~6 chamadas seguidas) e melhora com a chave Demo gratuita
(cabeçalho x-cg-demo-api-key). Sondado em 2026-09-19.

Catálogo:
  GET /coins/markets?vs_currency=usd&category={id}&per_page=250&order=volume_desc
  GET /coins/list?include_platform=true   (contratos por rede, 1 chamada)
Preço:
  GET /simple/token_price/{platform}?contract_addresses=a,b&vs_currencies=usd&include_24hr_vol=true
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..mapping import CONF_CATEGORY, map_by_keyword, map_by_suffix
from ..models import TokenListing, TokenQuote
from ..networks import ACTIVE_NETWORKS, from_provider, normalize_address, to_provider
from ..router.errors import NotSupported
from .base import Provider, chunks, fnum

BASE = "https://api.coingecko.com/api/v3"
BATCH = 30


class CoinGecko(Provider):
    name = "coingecko"

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._platforms: dict[str, dict[str, str]] | None = None

    def _headers(self) -> dict:
        return {"x-cg-demo-api-key": self.api_key} if self.api_key else {}

    def _coin_platforms(self) -> dict[str, dict[str, str]]:
        if self._platforms is None:
            data = self.get_json(f"{BASE}/coins/list", params={"include_platform": "true"}, headers=self._headers())
            self._platforms = {c["id"]: (c.get("platforms") or {}) for c in data if isinstance(c, dict)}
        return self._platforms

    def catalog_category(self, rule: dict, known_tickers: set[str]) -> list[TokenListing]:
        coins = self.get_json(
            f"{BASE}/coins/markets",
            params={"vs_currency": "usd", "category": rule["id"], "per_page": 250, "order": "volume_desc"},
            headers=self._headers(),
        )
        if not isinstance(coins, list):
            return []
        platforms = self._coin_platforms()
        out: list[TokenListing] = []
        for coin in coins:
            ticker, conf, origin = self._map(rule, coin, known_tickers)
            for platform, address in (platforms.get(coin["id"]) or {}).items():
                net = from_provider(self.name, platform)
                if net not in ACTIVE_NETWORKS or not address:
                    continue
                out.append(
                    TokenListing(
                        issuer=rule.get("issuer", "desconhecido"),
                        network=net,
                        address=normalize_address(net, address),
                        symbol=coin.get("symbol", "").upper(),
                        name=coin.get("name"),
                        reference_ticker=ticker,
                        asset_class=rule.get("asset_class"),
                        mapping_confidence=conf,
                        mapping_origin=origin,
                        source=f"{self.name}:{rule['id']}",
                    )
                )
        return out

    @staticmethod
    def _map(rule: dict, coin: dict, known: set[str]) -> tuple[str | None, float, str]:
        kind = rule.get("rule")
        if kind == "fixed":
            return rule["ticker"], rule.get("confidence", CONF_CATEGORY), "categoria"
        if kind == "suffix":
            return map_by_suffix(coin.get("symbol", ""), rule.get("suffix", ""), known)
        if kind == "keyword":
            return map_by_keyword(coin.get("name", ""), coin.get("symbol", ""))
        return None, 0.0, "manual"

    def token_quotes(self, network: str, addresses: list[str]) -> list[TokenQuote]:
        platform = to_provider(self.name, network)
        if not platform:
            raise NotSupported(f"rede {network}")
        now = datetime.now(timezone.utc)
        out: list[TokenQuote] = []
        for batch in chunks(addresses, BATCH):
            data = self.get_json(
                f"{BASE}/simple/token_price/{platform}",
                params={"contract_addresses": ",".join(batch), "vs_currencies": "usd", "include_24hr_vol": "true"},
                headers=self._headers(),
            )
            for addr, v in (data or {}).items():
                price = fnum(v.get("usd"))
                if not price:
                    continue
                out.append(
                    TokenQuote(
                        network=network,
                        address=normalize_address(network, addr),
                        price_usd=price,
                        volume_24h_usd=fnum(v.get("usd_24h_vol")),
                        source=self.name,
                        observed_at=now,
                    )
                )
        return out
