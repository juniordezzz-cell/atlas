"""Mapeamento token ↔ ativo de referência.

A confiança decide o que pode entrar na camada A (>= MIN_CONFIDENCE_TIER_A).
O arquivo config/mapping_overrides.yaml sempre vence a heurística.
"""

from __future__ import annotations

import re

MIN_CONFIDENCE_TIER_A = 0.8

CONF_ISSUER_API = 1.0  # o próprio emissor informa o ativo (ex.: xStocks underlyingSymbol)
CONF_OVERRIDE = 1.0
CONF_CATEGORY = 0.9  # categoria fechada (ex.: ouro tokenizado → ouro)
CONF_SUFFIX_KNOWN = 0.8  # sufixo do emissor removido e o ticker existe no universo conhecido
CONF_SUFFIX_UNKNOWN = 0.5  # sufixo removido, mas o ticker não foi confirmado
CONF_KEYWORD = 0.6  # palavra-chave no nome (ex.: "gold")

_TICKER = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")


def strip_suffix(symbol: str, suffix: str) -> str | None:
    s = symbol.strip()
    if suffix:
        if not s.lower().endswith(suffix.lower()) or len(s) <= len(suffix):
            return None
        s = s[: -len(suffix)]
    s = s.upper()
    return s if _TICKER.match(s) else None


def map_by_suffix(symbol: str, suffix: str, known_tickers: set[str]) -> tuple[str | None, float, str]:
    ticker = strip_suffix(symbol, suffix)
    if not ticker:
        return None, 0.0, "sufixo"
    conf = CONF_SUFFIX_KNOWN if ticker in known_tickers else CONF_SUFFIX_UNKNOWN
    return ticker, conf, "sufixo"


KEYWORDS = {
    "GOLD": ("gold", "xau"),
    "SILVER": ("silver", "xag"),
    "WTI": ("wti", "crude", "oil"),
}


def map_by_keyword(name: str, symbol: str) -> tuple[str | None, float, str]:
    text = f"{name} {symbol}".lower()
    for ticker, words in KEYWORDS.items():
        if any(w in text for w in words):
            return ticker, CONF_KEYWORD, "palavra-chave"
    return None, 0.0, "palavra-chave"


def yahoo_symbol(ticker: str) -> str:
    """BRK.B → BRK-B (formato do Yahoo)."""
    return ticker.replace(".", "-")
