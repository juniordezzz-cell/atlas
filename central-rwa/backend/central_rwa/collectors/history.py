"""Histórico diário dos ativos de referência (10 anos) e taxas dos T-bills.

O backfill é RETOMÁVEL: um ativo que já tem o período completo é pulado, e
os upserts são idempotentes, então rodar de novo depois de uma queda
simplesmente continua de onde parou."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from ..db import Repository
from ..reference import ReferenceRegistry
from ..router import NoProviderAvailable, Router

SLACK_DAYS = 10  # tolerância no início da série (feriados, IPO recente)
OVERLAP_DAYS = 5  # a atualização diária rebusca alguns dias para pegar correções


@dataclass
class HistoryResult:
    updated: dict[str, int] = field(default_factory=dict)  # ticker -> linhas gravadas
    skipped_complete: list[str] = field(default_factory=list)
    skipped_no_history: list[str] = field(default_factory=list)
    coverage: dict[str, str] = field(default_factory=dict)  # ticker -> "início..fim (n)"
    gaps: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def update_history(
    router: Router,
    repo: Repository,
    registry: ReferenceRegistry,
    tickers: list[str],
    today: date,
    years: int,
    allow_full: set[str],
) -> HistoryResult:
    res = HistoryResult()
    target_start = date(today.year - years, today.month, min(today.day, 28))
    for ticker in tickers:
        asset = registry.get(ticker)
        if asset.asset_class == "tbill":
            continue
        first, last, count = repo.history_range(ticker)
        complete_start = first is not None and first <= target_start + timedelta(days=SLACK_DAYS)
        if first is None or not complete_start:
            if ticker not in allow_full:
                res.skipped_no_history.append(ticker)
                continue
            start = target_start
        else:
            if last and last >= today - timedelta(days=1):
                res.skipped_complete.append(ticker)
                continue
            start = (last or target_start) - timedelta(days=OVERLAP_DAYS)
        try:
            series, prov = router.call("reference_history_daily", "daily_history", asset, start, cache=False)
        except NoProviderAvailable as e:
            res.errors.append(f"{ticker}: {e}")
            continue
        res.updated[ticker] = repo.upsert_daily_bars(ticker, series.bars, prov)
        first, last, count = repo.history_range(ticker)
        if first and last:
            res.coverage[ticker] = f"{first}..{last} ({count})"
            expected = (last - first).days * 252 / 365
            if asset.asset_class in ("stock", "etf") and count < expected * 0.95:
                res.gaps.append(f"{ticker}: {count} pregões, esperado ~{int(expected)}")
    return res


@dataclass
class TbillResult:
    years: list[int] = field(default_factory=list)
    rows: int = 0
    last_day: date | None = None
    errors: list[str] = field(default_factory=list)


def update_tbills(router: Router, repo: Repository, today: date, years: int) -> TbillResult:
    """Baixa só os anos que faltam no banco + o ano do último dado + o ano atual.
    (O CSV do Tesouro leva ~18 s por ano, então rebaixar tudo custa ~3 min.)"""
    res = TbillResult()
    present = repo.tbill_years()
    last = repo.tbill_last_day()
    wanted = set(range(today.year - years, today.year + 1)) - present
    wanted |= {today.year} | ({last.year} if last else set())
    for year in sorted(wanted):
        try:
            rates, _ = router.call("tbill_yield", "tbill_rates", year, cache=False)
        except NoProviderAvailable as e:
            res.errors.append(f"{year}: {e}")
            continue
        res.rows += repo.upsert_tbill_rates(rates)
        res.years.append(year)
    res.last_day = repo.tbill_last_day()
    return res
