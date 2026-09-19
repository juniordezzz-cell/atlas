"""Formatos normalizados. Todo provedor devolve estes tipos, então trocar a
fonte não muda nada para os coletores."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

AssetClass = Literal["stock", "etf", "commodity", "tbill", "br_stock"]
Network = Literal["solana", "ethereum", "bnb_chain", "robinhood_chain"]


class TokenListing(BaseModel):
    """Um token encontrado num catálogo, já ligado (ou não) ao ativo de referência."""

    issuer: str
    network: Network
    address: str
    symbol: str
    name: str | None = None
    reference_ticker: str | None = None  # None = não conseguiu mapear
    asset_class: AssetClass | None = None
    mapping_confidence: float = 0.0  # 0..1
    mapping_origin: str = ""  # api_emissor | sufixo | override | categoria
    source: str


class TokenQuote(BaseModel):
    network: Network
    address: str
    price_usd: float
    volume_24h_usd: float | None = None
    liquidity_usd: float | None = None
    source: str
    observed_at: datetime


class DailyBar(BaseModel):
    day: date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float
    adj_close: float | None = None
    volume: float | None = None


class DailySeries(BaseModel):
    ticker: str
    bars: list[DailyBar] = Field(default_factory=list)
    source: str


class ReferenceQuote(BaseModel):
    ticker: str
    price: float
    previous_close: float | None = None
    source: str
    observed_at: datetime


class TbillRate(BaseModel):
    day: date
    tenor: str  # "4w", "13w", "26w", "52w"...
    rate: float  # % ao ano (equivalente cupom quando disponível)
    source: str
