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
from .connect import connect

SEARCH_PATH = "set local search_path to central_rwa, public"


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


@dataclass
class EventRow:
    ticker: str
    kind: str
    day: date
    magnitude_pct: float
    volume_ratio: float | None
    level: str
    stats: dict
    source: str = "daily"


@dataclass
class PositionRow:
    agent: str
    mode: str
    ticker: str
    setup: str
    event_day: date
    entry_day: date
    entry_price: float
    target_pct: float
    stop_pct: float
    horizon_days: int
    status: str = "aberta"
    token_id: int | None = None
    event_id: int | None = None
    exit_day: date | None = None
    exit_price: float | None = None
    exit_reason: str | None = None
    ret_pct: float | None = None
    ret_net_pct: float | None = None
    baseline_pct: float | None = None
    rationale: str | None = None
    stats: dict | None = None
    id: int | None = None


POSITION_COLS = (
    "agent", "mode", "ticker", "token_id", "setup", "event_day", "event_id", "entry_day", "entry_price", "target_pct",
    "stop_pct", "horizon_days", "status", "exit_day", "exit_price", "exit_reason", "ret_pct", "ret_net_pct",
    "baseline_pct", "rationale", "stats",
)


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
    def ensure_tier_a(self, tier_a: set[str]) -> None: ...
    def tbill_last_day(self) -> date | None: ...
    def tbill_years(self) -> set[int]: ...
    def upsert_tbill_rates(self, rates: list[TbillRate]) -> int: ...
    def record_job(self, job: str, started: datetime, finished: datetime, status: str, summary: dict) -> None: ...
    def size_report(self) -> list[tuple[str, str, int]]: ...
    def close(self) -> None: ...
    # --- Fases 3/4 ---
    def daily_bars(self, ticker: str) -> list[DailyBar]: ...
    def watched_tickers(self) -> list[str]: ...
    def upsert_event(self, e: EventRow) -> int: ...
    def replace_backtest(self, agent: str, rows: list[PositionRow]) -> int: ...
    def open_positions(self, agent: str, mode: str = "live") -> list[PositionRow]: ...
    def insert_position(self, row: PositionRow) -> bool: ...
    def close_position(self, row: PositionRow) -> None: ...
    def best_token_price(self, ticker: str) -> tuple[int, float, datetime] | None: ...
    def token_price(self, token_id: int) -> tuple[float, datetime] | None: ...
    def sync_agents(self, agents) -> None: ...


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
        self.events: dict[tuple, tuple[int, EventRow]] = {}
        self.positions: list[PositionRow] = []

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

    def ensure_tier_a(self, tier_a):
        self.tiers.update({t: "A" for t in tier_a})

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

    # --- Fases 3/4 ---
    def daily_bars(self, ticker):
        return [b for (t, _), (b, _) in sorted(self.bars.items(), key=lambda kv: kv[0][1]) if t == ticker]

    def watched_tickers(self):
        return sorted(self.tiers)

    def upsert_event(self, e):
        key = (e.ticker, e.kind, e.day)
        eid = self.events[key][0] if key in self.events else len(self.events) + 1
        self.events[key] = (eid, e)
        return eid

    def replace_backtest(self, agent, rows):
        self.positions = [p for p in self.positions if not (p.agent == agent and p.mode == "backtest")]
        self.positions.extend(rows)
        return len(rows)

    def open_positions(self, agent, mode="live"):
        return [p for p in self.positions if p.agent == agent and p.mode == mode and p.status == "aberta"]

    def insert_position(self, row):
        if any(p.agent == row.agent and p.mode == row.mode and p.ticker == row.ticker and p.event_day == row.event_day for p in self.positions):
            return False
        row.id = len(self.positions) + 1
        self.positions.append(row)
        return True

    def close_position(self, row):
        pass  # o objeto já foi alterado no lugar

    def best_token_price(self, ticker):
        by_id = {t.id: t for t in self.token_rows.values()}
        latest: dict[int, SnapshotRow] = {}
        for sn in self.snapshots:
            if sn.token_id not in latest or sn.ts > latest[sn.token_id].ts:
                latest[sn.token_id] = sn
        best = None
        for tid, sn in latest.items():
            t = by_id.get(tid)
            if t and t.reference_ticker == ticker and t.mapping_confidence >= 0.8:
                if best is None or (sn.liquidity_usd or 0) > (best[3] or 0):
                    best = (tid, sn.price_usd, sn.ts, sn.liquidity_usd)
        return best[:3] if best else None

    def sync_agents(self, agents):
        ids = {a.id for a in agents}
        self.agents = {a.id: a for a in agents}
        self.positions = [p for p in self.positions if p.agent in ids or p.mode == "live"]

    def token_price(self, token_id):
        snaps = [sn for sn in self.snapshots if sn.token_id == token_id]
        if not snaps:
            return None
        sn = max(snaps, key=lambda x: x.ts)
        return sn.price_usd, sn.ts


# ======================================================================
# Postgres (Supabase)
# ======================================================================


class PostgresRepository(Repository):
    def __init__(self, dsn: str):
        self.conn = connect(dsn, autocommit=False)

    def _cursor(self):
        """Cursor com o schema definido NA TRANSAÇÃO (set local): funciona no pooler
        do Supabase em modo sessão e em modo transação."""
        cur = self.conn.cursor()
        cur.execute(SEARCH_PATH)
        return cur

    def close(self):
        self.conn.close()

    def _query(self, sql: str, params=None):
        with self._cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else None
        self.conn.commit()
        return rows

    def _many(self, sql: str, rows: list[tuple]) -> int:
        if not rows:
            return 0
        with self._cursor() as cur:
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
        with self._cursor() as cur:
            # Promoções por evento (Fase 3) são preservadas; o resto é recalculado.
            cur.execute("delete from watch_tiers where reason <> 'evento'")
            cur.executemany(
                "insert into watch_tiers (ticker, tier, reason) values (%s,%s,%s) on conflict (ticker) do nothing",
                rows,
            )
        self.conn.commit()

    def ensure_tier_a(self, tier_a):
        """Garante a lista de observação como camada A sem mexer na camada B
        (usado pela camada A e pelo backfill; o recálculo completo é do diário)."""
        self._many(
            """insert into watch_tiers (ticker, tier, reason) values (%s, 'A', 'manual')
               on conflict (ticker) do update set tier='A', reason=case when watch_tiers.reason='evento' then 'evento' else 'manual' end""",
            [(t,) for t in sorted(tier_a)],
        )

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


    # --- Fases 3/4 ---
    def daily_bars(self, ticker):
        rows = self._query(
            "select day, open, high, low, close, adj_close, volume from reference_prices_daily where ticker=%s order by day", (ticker,)
        ) or []
        return [DailyBar(day=r[0], open=r[1], high=r[2], low=r[3], close=r[4], adj_close=r[5], volume=r[6]) for r in rows]

    def watched_tickers(self):
        return [r[0] for r in self._query("select ticker from watch_tiers order by ticker") or []]

    def upsert_event(self, e):
        return self._query(
            """insert into events (ticker, kind, day, magnitude_pct, volume_ratio, level, stats, source)
               values (%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (ticker, kind, day) do update set magnitude_pct=excluded.magnitude_pct,
                 volume_ratio=excluded.volume_ratio, level=excluded.level, stats=excluded.stats
               returning id""",
            (e.ticker, e.kind, e.day, e.magnitude_pct, e.volume_ratio, e.level, json.dumps(e.stats, default=str), e.source),
        )[0][0]

    def _pos_values(self, p):
        v = [getattr(p, c) for c in POSITION_COLS]
        v[-1] = json.dumps(p.stats or {}, default=str)
        return tuple(v)

    def replace_backtest(self, agent, rows):
        cols = ", ".join(POSITION_COLS)
        marks = ", ".join(["%s"] * len(POSITION_COLS))
        with self._cursor() as cur:
            cur.execute("delete from paper_positions where agent=%s and mode='backtest'", (agent,))
            if rows:
                cur.executemany(f"insert into paper_positions ({cols}) values ({marks})", [self._pos_values(p) for p in rows])
        self.conn.commit()
        return len(rows)

    def open_positions(self, agent, mode="live"):
        cols = ", ".join(POSITION_COLS)
        rows = self._query(
            f"select id, {cols} from paper_positions where agent=%s and mode=%s and status='aberta' order by entry_day",
            (agent, mode),
        ) or []
        return [PositionRow(**dict(zip(("id",) + POSITION_COLS, r))) for r in rows]

    def insert_position(self, row):
        cols = ", ".join(POSITION_COLS)
        marks = ", ".join(["%s"] * len(POSITION_COLS))
        got = self._query(
            f"insert into paper_positions ({cols}) values ({marks}) on conflict (agent, mode, ticker, event_day) do nothing returning id",
            self._pos_values(row),
        )
        if got:
            row.id = got[0][0]
        return bool(got)

    def close_position(self, row):
        self._query(
            """update paper_positions set status=%s, exit_day=%s, exit_price=%s, exit_reason=%s, ret_pct=%s, ret_net_pct=%s
               where id=%s""",
            (row.status, row.exit_day, row.exit_price, row.exit_reason, row.ret_pct, row.ret_net_pct, row.id),
        )

    def best_token_price(self, ticker):
        rows = self._query(
            """select t.id, s.price_usd, s.ts from tokens t
               join lateral (select price_usd, ts, liquidity_usd from token_snapshots where token_id=t.id order by ts desc limit 1) s on true
               where t.reference_ticker=%s and t.active and t.mapping_confidence >= 0.8
               order by coalesce(s.liquidity_usd, 0) desc limit 1""",
            (ticker,),
        )
        return tuple(rows[0]) if rows else None

    def token_price(self, token_id):
        rows = self._query("select price_usd, ts from token_snapshots where token_id=%s order by ts desc limit 1", (token_id,))
        return tuple(rows[0]) if rows else None

    def sync_agents(self, agents):
        """Espelha config/agents.yaml: grava/atualiza os agentes, desativa os que
        saíram do arquivo e apaga o treino deles (as posições ao vivo ficam)."""
        ids = [a.id for a in agents]
        with self._cursor() as cur:
            cur.executemany(
                """insert into agents (id, nome, descricao, cesta, regras, corte_validacao, ativo, updated_at)
                   values (%s,%s,%s,%s,%s,%s,true,now())
                   on conflict (id) do update set nome=excluded.nome, descricao=excluded.descricao, cesta=excluded.cesta,
                     regras=excluded.regras, corte_validacao=excluded.corte_validacao, ativo=true, updated_at=now()""",
                [(a.id, a.nome, a.descricao, json.dumps(list(a.cesta)), json.dumps(a.regras_dict()), a.corte_validacao) for a in agents],
            )
            cur.execute("update agents set ativo=false where not (id = any(%s))", (ids,))
            cur.execute("delete from paper_positions where mode='backtest' and not (agent = any(%s))", (ids,))
        self.conn.commit()


def apply_migrations(dsn: str, folder: Path) -> list[str]:
    applied = []
    with connect(dsn, autocommit=True) as conn:
        for path in sorted(folder.glob("*.sql")):
            with conn.cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
            applied.append(path.name)
    return applied


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
