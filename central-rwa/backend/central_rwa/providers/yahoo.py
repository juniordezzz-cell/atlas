"""Yahoo Finance via yfinance — sem chave, NÃO oficial. Sondado em 2026-09-19:
NVDA, GC=F, CL=F e SPY devolveram 2.514 pregões em 10 anos.
O Yahoo bloqueia IP por excesso de uso: por isso o histórico longo é baixado uma
vez (backfill) e depois só o último dia, com a cota controlada pelo roteador.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone

from ..models import DailyBar, DailySeries, ReferenceQuote
from ..reference import ReferenceAsset
from ..router.errors import NotSupported, ProviderError, RateLimited
from .base import Provider


class Yahoo(Provider):
    name = "yahoo"

    def _ticker(self, asset: ReferenceAsset):
        import yfinance as yf

        sym = asset.symbol_for("yahoo")
        if not sym:
            raise NotSupported(f"{asset.ticker} sem símbolo Yahoo")
        return yf.Ticker(sym), sym

    def daily_history(self, asset: ReferenceAsset, start: date, end: date | None = None) -> DailySeries:
        t, sym = self._ticker(asset)
        self._gate(self.name)
        try:
            df = t.history(start=start.isoformat(), end=end.isoformat() if end else None, interval="1d", auto_adjust=False)
        except Exception as e:  # yfinance embrulha tudo em exceções próprias
            msg = str(e)
            if "Too Many Requests" in msg or "Rate limited" in msg:
                raise RateLimited(self.name) from e
            raise ProviderError(self.name, f"{sym}: {msg[:200]}") from e
        if df is None or df.empty:
            raise NotSupported(f"{sym}: sem dados no período")
        bars = []
        for idx, row in df.iterrows():
            close = _f(row.get("Close"))
            if close is None:
                continue
            bars.append(
                DailyBar(
                    day=idx.date(),
                    open=_f(row.get("Open")),
                    high=_f(row.get("High")),
                    low=_f(row.get("Low")),
                    close=close,
                    adj_close=_f(row.get("Adj Close")),
                    volume=_f(row.get("Volume")),
                )
            )
        return DailySeries(ticker=asset.ticker, bars=bars, source=self.name)

    def quote(self, asset: ReferenceAsset) -> ReferenceQuote:
        t, sym = self._ticker(asset)
        self._gate(self.name)
        try:
            df = t.history(period="5d", interval="1d", auto_adjust=False)
        except Exception as e:
            raise ProviderError(self.name, f"{sym}: {str(e)[:200]}") from e
        if df is None or df.empty:
            raise NotSupported(f"{sym}: sem cotação")
        closes = [c for c in df["Close"].tolist() if _f(c) is not None]
        return ReferenceQuote(
            ticker=asset.ticker,
            price=float(closes[-1]),
            previous_close=float(closes[-2]) if len(closes) > 1 else None,
            source=self.name,
            observed_at=datetime.now(timezone.utc),
        )


def _f(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) else x
