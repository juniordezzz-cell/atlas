"""Provedores que exigem chave gratuita. Sem a chave, o roteador os pula.

ATENÇÃO: escritos a partir da documentação pública; ainda NÃO foram sondados
com chamada real (não havia chave em 2026-09-19). Ao cadastrar a chave,
rodar `python -m central_rwa probe` e registrar em docs/central-rwa/FONTES_VERIFICADAS.md.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from ..models import DailyBar, DailySeries, ReferenceQuote, TbillRate
from ..reference import ReferenceAsset
from ..router.errors import NotSupported, ProviderError, RateLimited
from .base import Provider, fnum


def _symbol(asset: ReferenceAsset, provider: str) -> str:
    sym = asset.symbol_for(provider)
    if not sym:
        raise NotSupported(f"{asset.ticker} sem símbolo em {provider}")
    return sym


class Tiingo(Provider):
    """GET https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate=&token="""

    name = "tiingo"

    def daily_history(self, asset: ReferenceAsset, start: date, end: date | None = None) -> DailySeries:
        sym = _symbol(asset, self.name)
        params = {"startDate": start.isoformat(), "token": self.api_key}
        if end:
            params["endDate"] = end.isoformat()
        data = self.get_json(f"https://api.tiingo.com/tiingo/daily/{sym}/prices", params=params)
        if not isinstance(data, list) or not data:
            raise NotSupported(f"{sym}: sem dados")
        bars = [
            DailyBar(
                day=datetime.fromisoformat(r["date"].replace("Z", "+00:00")).date(),
                open=fnum(r.get("open")),
                high=fnum(r.get("high")),
                low=fnum(r.get("low")),
                close=fnum(r["close"]),
                adj_close=fnum(r.get("adjClose")),
                volume=fnum(r.get("volume")),
            )
            for r in data
            if fnum(r.get("close")) is not None
        ]
        return DailySeries(ticker=asset.ticker, bars=bars, source=self.name)


class TwelveData(Provider):
    """GET https://api.twelvedata.com/time_series?symbol=&interval=1day&start_date=&outputsize=5000&apikey="""

    name = "twelvedata"
    BASE = "https://api.twelvedata.com"

    def _check(self, data: dict) -> dict:
        if isinstance(data, dict) and data.get("status") == "error":
            if data.get("code") == 429:
                raise RateLimited(self.name)
            raise ProviderError(self.name, str(data.get("message"))[:200])
        return data

    def daily_history(self, asset: ReferenceAsset, start: date, end: date | None = None) -> DailySeries:
        sym = _symbol(asset, self.name)
        params = {"symbol": sym, "interval": "1day", "start_date": start.isoformat(), "outputsize": 5000, "apikey": self.api_key}
        if end:
            params["end_date"] = end.isoformat()
        data = self._check(self.get_json(f"{self.BASE}/time_series", params=params))
        bars = [
            DailyBar(
                day=date.fromisoformat(v["datetime"][:10]),
                open=fnum(v.get("open")),
                high=fnum(v.get("high")),
                low=fnum(v.get("low")),
                close=fnum(v["close"]),
                volume=fnum(v.get("volume")),
            )
            for v in data.get("values") or []
            if fnum(v.get("close")) is not None
        ]
        if not bars:
            raise NotSupported(f"{sym}: sem dados")
        bars.sort(key=lambda b: b.day)
        return DailySeries(ticker=asset.ticker, bars=bars, source=self.name)

    def quote(self, asset: ReferenceAsset) -> ReferenceQuote:
        sym = _symbol(asset, self.name)
        data = self._check(self.get_json(f"{self.BASE}/quote", params={"symbol": sym, "apikey": self.api_key}))
        price = fnum(data.get("close"))
        if not price:
            raise NotSupported(f"{sym}: sem cotação")
        return ReferenceQuote(
            ticker=asset.ticker,
            price=price,
            previous_close=fnum(data.get("previous_close")),
            source=self.name,
            observed_at=datetime.now(timezone.utc),
        )


class Finnhub(Provider):
    """GET https://finnhub.io/api/v1/quote?symbol=&token=  -> {c, pc, t}"""

    name = "finnhub"

    def quote(self, asset: ReferenceAsset) -> ReferenceQuote:
        sym = _symbol(asset, self.name)
        data = self.get_json("https://finnhub.io/api/v1/quote", params={"symbol": sym, "token": self.api_key})
        price = fnum(data.get("c"))
        if not price:
            raise NotSupported(f"{sym}: sem cotação")
        return ReferenceQuote(
            ticker=asset.ticker,
            price=price,
            previous_close=fnum(data.get("pc")),
            source=self.name,
            observed_at=datetime.now(timezone.utc),
        )


class Fred(Provider):
    """GET https://api.stlouisfed.org/fred/series/observations?series_id=&api_key=&file_type=json"""

    name = "fred"
    TBILL_SERIES = {"4w": "DTB4WK", "13w": "DTB3", "26w": "DTB6", "52w": "DTB1YR"}

    def _observations(self, series: str, start: date) -> list[tuple[date, float]]:
        data = self.get_json(
            "https://api.stlouisfed.org/fred/series/observations",
            params={"series_id": series, "api_key": self.api_key, "file_type": "json", "observation_start": start.isoformat()},
        )
        out = []
        for o in data.get("observations") or []:
            v = fnum(o.get("value")) if o.get("value") != "." else None
            if v is not None:
                out.append((date.fromisoformat(o["date"]), v))
        return out

    def daily_history(self, asset: ReferenceAsset, start: date, end: date | None = None) -> DailySeries:
        series = _symbol(asset, self.name)
        bars = [DailyBar(day=d, close=v) for d, v in self._observations(series, start) if not end or d <= end]
        if not bars:
            raise NotSupported(f"{series}: sem dados")
        return DailySeries(ticker=asset.ticker, bars=bars, source=self.name)

    def tbill_rates(self, year: int) -> list[TbillRate]:
        start = date(year, 1, 1)
        out = []
        for tenor, series in self.TBILL_SERIES.items():
            out += [TbillRate(day=d, tenor=tenor, rate=v, source=self.name) for d, v in self._observations(series, start) if d.year == year]
        return out
