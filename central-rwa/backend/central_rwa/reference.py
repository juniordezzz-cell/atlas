"""Registro dos ativos de referência (ação, ETF, commodity, T-bill) e do
símbolo de cada um em cada fonte. Ações/ETFs sem entrada em
config/reference_assets.yaml recebem os símbolos padrão."""

from __future__ import annotations

from dataclasses import dataclass, field

from .config import load_yaml
from .mapping import yahoo_symbol


@dataclass
class ReferenceAsset:
    ticker: str
    name: str | None = None
    asset_class: str = "stock"
    market: str | None = None
    symbols: dict[str, str] = field(default_factory=dict)

    def symbol_for(self, provider: str) -> str | None:
        return self.symbols.get(provider)


def default_symbols(ticker: str) -> dict[str, str]:
    return {
        "yahoo": yahoo_symbol(ticker),
        "tiingo": ticker.lower().replace(".", "-"),
        "twelvedata": ticker,
        "finnhub": ticker,
    }


class ReferenceRegistry:
    def __init__(self, raw: dict):
        self.assets: dict[str, ReferenceAsset] = {}
        self.etfs: set[str] = set(raw.get("etfs") or [])
        for ticker, cfg in (raw.get("assets") or {}).items():
            cfg = cfg or {}
            cls = cfg.get("asset_class", "etf" if ticker in self.etfs else "stock")
            symbols = default_symbols(ticker) if cls in ("stock", "etf") else {}
            symbols.update(cfg.get("symbols") or {})
            self.assets[ticker] = ReferenceAsset(ticker, cfg.get("name"), cls, cfg.get("market"), symbols)

    @classmethod
    def load(cls) -> "ReferenceRegistry":
        return cls(load_yaml("reference_assets.yaml"))

    def get(self, ticker: str, asset_class: str | None = None) -> ReferenceAsset:
        if ticker not in self.assets:
            cls = asset_class or ("etf" if ticker in self.etfs else "stock")
            self.assets[ticker] = ReferenceAsset(ticker, None, cls, None, default_symbols(ticker))
        return self.assets[ticker]

    def known_tickers(self) -> set[str]:
        return set(self.assets) | self.etfs
