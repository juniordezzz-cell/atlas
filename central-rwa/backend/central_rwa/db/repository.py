"""Acesso ao banco. PostgresRepository grava no Supabase; MemoryRepository
serve para testes e para o modo --dry-run (nada é gravado)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

from ..models import DailyBar, ReferenceQuote, TbillRate, TokenListing
from ..reference import ReferenceAsset
from ..router.state import Health, ProviderState, StateStore, Usage


@dataclass
class TokenRow:
    id: int
    network: str
    address: str
    symbol: str
    reference_ticker: str | None
    mapping_confidence: float
    issuer: str | None


@dataclass
class SnapshotRow:
    token_id: int
    ts: datetime
    price_usd: float
    volume_24h_usd: float | None
    liquidity_usd: float | None
    source: str
    sources_confirmed: int
    divergence_pct: float | None
    tier: str


class Repository(StateStore):
    def ensure_reference_assets(self, assets: list[ReferenceAsset]) -> None: ...
    def upsert_tokens(self, listings: list[TokenListing]) -> int: ...
    def tokens(self, tickers: set[str] | None = None, min_confidence: float = 0.0) -> list[TokenRow]: ...
    def history_range(self, ticker: str) -> tuple[date | None, date | None, int]: ...
    def upsert_daily_bars(self, ticker: str, bars: list[DailyBar], source: str) -> int: ...
    def insert_snapshots(self, rows: list[SnapshotRow]) -> int: ...
    def latest_liquidity_by_ticker(self) -> dict[str, float]: ...
    def insert_quotes(self, quotes: list[ReferenceQuote]) -> int: ...
    def set_tiers(self, tier_a: set[str], tier_b: set[str]) -> None: ...
    def tbill_last_day(self) -> date | None: ...
    def tbill_years(self) -> set[int]: ...
    def upsert_tbill_rates(self, rates: list[TbillRate]) -> int: ...
    def record_job(self, job: str, started: datetime, finished: datetime, status: str, summary: dict) -> None: ...
    def size_report(self) -> list[tuple[str, str, int]]: ...
    def close(self) -> None: ...


# ======================================================================
# Memória (testes / dry-run)
# ======================================================================


class MemoryRepository(Repository):
    def __init__(self) -> None:
        self.assets: dict[str, ReferenceAsset] = {}
        self.token_rows: dict[tuple[str, str], TokenRow] = {}
        self.bars: dict[tuple[str, date], tuple[DailyBar, str]] = {}
        self.snapshots: list[SnapshotRow] = []
        self.quotes: list[ReferenceQuote] = []
        self.tbills: dict[tuple[str, date], TbillRate] = {}
        self.tiers: dict[str, str] = {}
        self.jobs: list[dict] = []
        self.router_states: dict[str, ProviderState] = {}

    def load(self) -> dict[str, ProviderState]:
        return self.router_states

    def save(self, states: dict[str, ProviderState]) -> None:
        self.router_states = states

    def ensure_reference_assets(self, assets):
        for a in assets:
            self.assets.setdefault(a.ticker, a)

    def upsert_tokens(self, listings):
        for l in listings:
            key = (l.network, l.address)
            old = self.token_rows.get(key)
            self.token_rows[key] = TokenRow(
                id=old.id if old else len(self.token_rows) + 1,
                network=l.network,
                address=l.address,
                symbol=l.symbol,
                reference_ticker=l.reference_ticker,
                mapping_confidence=l.mapping_confidence,
                issuer=l.issuer,
            )
        return len(listings)

    def tokens(self, tickers=None, min_confidence=0.0):
        return [
            t
            for t in self.token_rows.values()
            if t.mapping_confidence >= min_confidence and (tickers is None or t.reference_ticker in tickers)
        ]

    def history_range(self, ticker):
        days = sorted(d for (t, d) in self.bars if t == ticker)
        return (days[0], days[-1], len(days)) if days else (None, None, 0)

    def upsert_daily_bars(self, ticker, bars, source):
        for b in bars:
            self.bars[(ticker, b.day)] = (b, source)
        return len(bars)

    def insert_snapshots(self, rows):
        self.snapshots.extend(rows)
        return len(rows)

    def latest_liquidity_by_ticker(self):
        by_id = {t.id: t for t in self.token_rows.values()}
        latest: dict[int, SnapshotRow] = {}
        for s in self.snapshots:
            if s.token_id not in latest or s.ts > latest[s.token_id].ts:
                latest[s.token_id] = s
        out: dict[str, float] = {}
        for tid, s in latest.items():
            t = by_id.get(tid)
            if t and t.reference_ticker:
                size = max(s.liquidity_usd or 0, s.volume_24h_usd or 0)
                out[t.reference_ticker] = max(out.get(t.reference_ticker, 0), size)
        return out

    def insert_quotes(self, quotes):
        self.quotes.extend(quotes)
        return len(quotes)

    def set_tiers(self, tier_a, tier_b):
        self.tiers = {t: "A" for t in tier_a} | {t: "B" for t in tier_b - tier_a}

    def tbill_last_day(self):
        return max((d for (_, d) in self.tbills), default=None)

    def tbill_years(self):
        return {d.year for (_, d) in self.tbills}

    def upsert_tbill_rates(self, rates):
        for r in rates:
            self.tbills[(r.tenor, r.day)] = r
        return len(rates)

    def record_job(self, job, started, finished, status, summary):
        self.jobs.append({"job": job, "started": started, "finished": finished, "status": status, "summary": summary})

    def size_report(self):
        return [("(memória — dry-run)", "-", 0)]

    def close(self):
        pass


# ======================================================================
# Postgres (Supabase)
# ======================================================================


class PostgresRepository(Repository):
    def __init__(self, dsn: str):
        import psycopg

        self.conn = psycopg.connect(dsn, autocommit=False, options="-c search_path=central_rwa,public")

    def close(self):
        self.conn.close()

    def _query(self, sql: str, params=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else None
        self.conn.commit()
        return rows

    def _many(self, sql: str, rows: list[tuple]) -> int:
        if not rows:
            return 0
        with self.conn.cursor() as cur:
            cur.executemany(sql, rows)
        self.conn.commit()
        return len(rows)

    # --- estado do roteador ---
    def load(self) -> dict[str, ProviderState]:
        states: dict[str, ProviderState] = {}
        for provider, w, start, calls in self._query("select provider, window_name, window_start, calls from provider_usage") or []:
            states.setdefault(provider, ProviderState()).usage[w] = Usage(w, start, calls)
        for row in self._query(
            "select provider, consecutive_failures, cooldown_until, circuit_open_until, last_error, last_success, latency_ms_avg, calls from provider_health"
        ) or []:
            states.setdefault(row[0], ProviderState()).health = Health(*row[1:])
        return states

    def save(self, states: dict[str, ProviderState]) -> None:
        usage = [(p, u.window, u.start, u.count) for p, st in states.items() for u in st.usage.values()]
        self._many(
            """insert into provider_usage (provider, window_name, window_start, calls) values (%s,%s,%s,%s)
               on conflict (provider, window_name) do update set window_start=excluded.window_start, calls=excluded.calls""",
            usage,
        )
        health = [
            (p, h.consecutive_failures, h.cooldown_until, h.circuit_open_until, h.last_error, h.last_success, h.latency_ms_avg, h.calls)
            for p, st in states.items()
            for h in [st.health]
        ]
        self._many(
            """insert into provider_health (provider, consecutive_failures, cooldown_until, circuit_open_until, last_error, last_success, latency_ms_avg, calls, updated_at)
               values (%s,%s,%s,%s,%s,%s,%s,%s, now())
               on conflict (provider) do update set consecutive_failures=excluded.consecutive_failures, cooldown_until=excluded.cooldown_until,
                 circuit_open_until=excluded.circuit_open_until, last_error=excluded.last_error, last_success=excluded.last_success,
                 latency_ms_avg=excluded.latency_ms_avg, calls=excluded.calls, updated_at=now()""",
            health,
        )

    # --- catálogo ---
    def ensure_reference_assets(self, assets):
        self._many(
            """insert into reference_assets (ticker, name, asset_class, market, symbols) values (%s,%s,%s,%s,%s)
               on conflict (ticker) do update set name=coalesce(excluded.name, reference_assets.name),
                 asset_class=excluded.asset_class, symbols=excluded.symbols""",
            [(a.ticker, a.name, a.asset_class, a.market, json.dumps(a.symbols)) for a in assets],
        )

    def upsert_tokens(self, listings):
        return self._many(
            """insert into tokens (network, address, symbol, name, issuer, reference_ticker, mapping_confidence, mapping_origin, source, last_seen)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
               on conflict (network, address) do update set symbol=excluded.symbol, name=excluded.name, issuer=excluded.issuer,
                 reference_ticker=excluded.reference_ticker, mapping_confidence=excluded.mapping_confidence,
                 mapping_origin=excluded.mapping_origin, source=excluded.source, last_seen=now(), active=true""",
            [
                (l.network, l.address, l.symbol, l.name, l.issuer, l.reference_ticker, l.mapping_confidence, l.mapping_origin, l.source)
                for l in listings
            ],
        )

    def tokens(self, tickers=None, min_confidence=0.0):
        sql = """select id, network, address, symbol, reference_ticker, mapping_confidence, issuer
                 from tokens where active and mapping_confidence >= %s"""
        params: list = [min_confidence]
        if tickers is not None:
            sql += " and reference_ticker = any(%s)"
            params.append(list(tickers))
        return [TokenRow(*r) for r in self._query(sql, params) or []]

    # --- histórico ---
    def history_range(self, ticker):
        row = (self._query("select min(day), max(day), count(*) from reference_prices_daily where ticker=%s", (ticker,)) or [(None, None, 0)])[0]
        return row[0], row[1], int(row[2] or 0)

    def upsert_daily_bars(self, ticker, bars, source):
        return self._many(
            """insert into reference_prices_daily (ticker, day, open, high, low, close, adj_close, volume, source)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (ticker, day) do update set open=excluded.open, high=excluded.high, low=excluded.low,
                 close=excluded.close, adj_close=excluded.adj_close, volume=excluded.volume, source=excluded.source""",
            [(ticker, b.day, b.open, b.high, b.low, b.close, b.adj_close, b.volume, source) for b in bars],
        )

    # --- snapshots ---
    def insert_snapshots(self, rows):
        return self._many(
            """insert into token_snapshots (token_id, ts, price_usd, volume_24h_usd, liquidity_usd, source, sources_confirmed, divergence_pct, tier)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (token_id, ts) do nothing""",
            [
                (r.token_id, r.ts, r.price_usd, r.volume_24h_usd, r.liquidity_usd, r.source, r.sources_confirmed, r.divergence_pct, r.tier)
                for r in rows
            ],
        )

    def latest_liquidity_by_ticker(self):
        rows = self._query(
            """select t.reference_ticker, max(greatest(coalesce(s.liquidity_usd,0), coalesce(s.volume_24h_usd,0)))
               from tokens t
               join lateral (select liquidity_usd, volume_24h_usd from token_snapshots
                             where token_id = t.id order by ts desc limit 1) s on true
               where t.reference_ticker is not null
               group by t.reference_ticker"""
        ) or []
        return {t: float(v or 0) for t, v in rows}

    def insert_quotes(self, quotes):
        return self._many(
            """insert into reference_quotes (ticker, ts, price, previous_close, source) values (%s,%s,%s,%s,%s)
               on conflict (ticker, ts) do nothing""",
            [(q.ticker, q.observed_at.replace(microsecond=0), q.price, q.previous_close, q.source) for q in quotes],
        )

    def set_tiers(self, tier_a, tier_b):
        rows = [(t, "A", "manual") for t in tier_a] + [(t, "B", "padrao") for t in tier_b - tier_a]
        with self.conn.cursor() as cur:
            # Promoções por evento (Fase 3) são preservadas; o resto é recalculado.
            cur.execute("delete from watch_tiers where reason <> 'evento'")
            cur.executemany(
                "insert into watch_tiers (ticker, tier, reason) values (%s,%s,%s) on conflict (ticker) do nothing",
                rows,
            )
        self.conn.commit()

    # --- T-bills ---
    def tbill_last_day(self):
        return (self._query("select max(day) from tbill_yields_daily") or [(None,)])[0][0]

    def tbill_years(self):
        return {int(r[0]) for r in self._query("select distinct extract(year from day) from tbill_yields_daily") or []}

    def upsert_tbill_rates(self, rates):
        return self._many(
            """insert into tbill_yields_daily (tenor, day, rate, source) values (%s,%s,%s,%s)
               on conflict (tenor, day) do update set rate=excluded.rate, source=excluded.source""",
            [(r.tenor, r.day, r.rate, r.source) for r in rates],
        )

    # --- jobs ---
    def record_job(self, job, started, finished, status, summary):
        self._query(
            "insert into job_runs (job, started_at, finished_at, status, summary) values (%s,%s,%s,%s,%s)",
            (job, started, finished, status, json.dumps(summary, default=str)),
        )

    def size_report(self):
        return [(r[0], r[1], int(r[2])) for r in self._query("select tabela, tamanho, bytes from db_size") or []]


def apply_migrations(dsn: str, folder: Path) -> list[str]:
    import psycopg

    applied = []
    with psycopg.connect(dsn, autocommit=True) as conn:
        for path in sorted(folder.glob("*.sql")):
            with conn.cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
            applied.append(path.name)
    return applied


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
