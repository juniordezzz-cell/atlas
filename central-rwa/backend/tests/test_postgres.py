"""Integração com Postgres de verdade (pgserver embutido): aplica a migration e
exercita o PostgresRepository. Pulado se o pgserver não estiver instalado."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")

from central_rwa.db import PostgresRepository, SnapshotRow, apply_migrations  # noqa: E402
from central_rwa.models import DailyBar, ReferenceQuote, TbillRate, TokenListing  # noqa: E402
from central_rwa.reference import ReferenceRegistry  # noqa: E402
from central_rwa.router.state import ProviderState  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
TS = datetime(2026, 9, 19, 12, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def dsn(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pg"), cleanup_mode="stop")
    uri = server.get_uri()
    import psycopg

    with psycopg.connect(uri, autocommit=True) as c:  # papéis que o Supabase já tem
        c.execute("do $$ begin create role anon; exception when duplicate_object then null; end $$")
        c.execute("do $$ begin create role authenticated; exception when duplicate_object then null; end $$")
    apply_migrations(uri, MIGRATIONS)
    apply_migrations(uri, MIGRATIONS)  # idempotente: rodar de novo não quebra
    yield uri
    server.cleanup()


@pytest.fixture
def repo(dsn):
    r = PostgresRepository(dsn)
    yield r
    r.close()


def test_rls_ligado_em_todas_as_tabelas(repo):
    rows = repo._query(
        "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='central_rwa' and c.relkind='r'"
    )
    assert rows and all(rls for _, rls in rows)


def test_catalogo_tokens_e_upsert_idempotente(repo):
    reg = ReferenceRegistry({"assets": {"GOLD": {"asset_class": "commodity", "symbols": {"yahoo": "GC=F"}}}})
    repo.ensure_reference_assets([reg.get("NVDA"), reg.get("GOLD")])
    l = TokenListing(issuer="xstocks", network="solana", address="Xsc9", symbol="NVDAx", reference_ticker="NVDA",
                     mapping_confidence=1.0, mapping_origin="api_emissor", source="xstocks")
    repo.upsert_tokens([l])
    repo.upsert_tokens([l.model_copy(update={"symbol": "NVDAx2"})])
    toks = repo.tokens({"NVDA"}, 0.8)
    assert len(toks) == 1 and toks[0].symbol == "NVDAx2"


def test_historico_idempotente_e_range(repo):
    repo.ensure_reference_assets([ReferenceRegistry({}).get("AAPL")])
    bars = [DailyBar(day=date(2026, 9, 1) + timedelta(days=i), close=100 + i) for i in range(5)]
    repo.upsert_daily_bars("AAPL", bars, "yahoo")
    repo.upsert_daily_bars("AAPL", bars, "yahoo")
    first, last, n = repo.history_range("AAPL")
    assert (first, last, n) == (date(2026, 9, 1), date(2026, 9, 5), 5)


def test_snapshots_liquidez_e_camadas(repo):
    reg = ReferenceRegistry({})
    repo.ensure_reference_assets([reg.get("TSLA")])
    repo.upsert_tokens([TokenListing(issuer="ondo", network="ethereum", address="0xt", symbol="TSLAON", reference_ticker="TSLA",
                                     mapping_confidence=0.8, mapping_origin="sufixo", source="coingecko")])
    [t] = repo.tokens({"TSLA"})
    row = SnapshotRow(t.id, TS, 360.0, 50_000, 250_000, "dexscreener", 2, 0.3, "B")
    assert repo.insert_snapshots([row]) == 1
    repo.insert_snapshots([row])  # mesma (token, ts): ignorado
    assert repo.latest_liquidity_by_ticker()["TSLA"] == 250_000
    repo.set_tiers({"NVDA"}, {"TSLA", "NVDA"})
    tiers = dict(repo._query("select ticker, tier from watch_tiers"))
    assert tiers == {"NVDA": "A", "TSLA": "B"}


def test_cotacoes_tbills_e_job(repo):
    repo.ensure_reference_assets([ReferenceRegistry({}).get("SPY")])
    assert repo.insert_quotes([ReferenceQuote(ticker="SPY", price=761.7, previous_close=760, source="yahoo", observed_at=TS)]) == 1
    repo.upsert_tbill_rates([TbillRate(day=date(2026, 9, 18), tenor="13w", rate=4.08, source="treasury")] * 2)
    assert repo.tbill_last_day() == date(2026, 9, 18)
    assert repo.tbill_years() == {2026}
    repo.record_job("teste", TS, TS, "ok", {"a": 1, "quando": TS})
    assert repo._query("select count(*) from job_runs where job='teste'")[0][0] == 1
    assert any(t == "token_snapshots" for t, _, _ in repo.size_report())


def test_historico_de_ativo_sem_token_no_catalogo(repo, clock):
    """Regressão (backfill #3 no Actions): WTI está na camada A, mas nenhum token aponta
    para ele; o histórico falhava na chave estrangeira de reference_assets."""
    from central_rwa.collectors.history import update_history
    from central_rwa.models import DailySeries

    from .conftest import make_router

    class P:
        name = "h"

        def bind_gate(self, g):
            pass

        def daily_history(self, asset, start, end=None):
            return DailySeries(ticker=asset.ticker, bars=[DailyBar(day=date(2026, 9, 18), close=100.3)], source="h")

    reg = ReferenceRegistry({"assets": {"WTI": {"asset_class": "commodity", "symbols": {"yahoo": "CL=F"}}}})
    router = make_router({"h": P()}, {"h": {}}, {"reference_history_daily": ["h"]}, clock)
    res = update_history(router, repo, reg, ["WTI"], date(2026, 9, 19), 10, allow_full={"WTI"})
    assert res.updated == {"WTI": 1} and not res.errors
    assert repo._query("select asset_class from reference_assets where ticker='WTI'") == [("commodity",)]


def test_visoes_do_site_e_permissoes(repo, dsn):
    """As visões públicas trazem o dado; o papel anon lê as visões mas NÃO as tabelas."""
    import psycopg

    reg = ReferenceRegistry({})
    repo.ensure_reference_assets([reg.get("MSFT")])
    repo.upsert_tokens([TokenListing(issuer="xstocks", network="solana", address="Msft1", symbol="MSFTx", reference_ticker="MSFT",
                                     mapping_confidence=1.0, mapping_origin="api_emissor", source="xstocks")])
    [t] = repo.tokens({"MSFT"})
    repo.insert_snapshots([SnapshotRow(t.id, TS, 494.0, 1e6, 2e6, "dexscreener", 2, 0.1, "A")])
    repo.upsert_daily_bars("MSFT", [DailyBar(day=date.today() - timedelta(days=2), close=490), DailyBar(day=date.today() - timedelta(days=1), close=493.8)], "yahoo")
    repo.insert_quotes([ReferenceQuote(ticker="MSFT", price=493.8, previous_close=490, source="yahoo", observed_at=TS)])
    repo.set_tiers({"MSFT"}, set())

    with psycopg.connect(dsn, autocommit=True) as c:
        c.execute("set role anon")
        ativo = c.execute("select ticker, camada, ref_preco, ult_fechamento, fechamento_anterior, tokens, pregoes from crwa_ativos where ticker='MSFT'").fetchone()
        assert ativo == ("MSFT", "A", 493.8, 493.8, 490, 1, 2)
        tok = c.execute("select simbolo, rede, preco, fontes_confirmadas from crwa_tokens where ticker='MSFT'").fetchone()
        assert tok == ("MSFTx", "solana", 494.0, 2)
        assert c.execute("select count(*) from crwa_historico where ticker='MSFT'").fetchone()[0] == 2
        c.execute("select * from crwa_execucoes").fetchall()
        c.execute("select * from crwa_tbills").fetchall()
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("select * from central_rwa.tokens")


def test_ensure_tier_a_nao_apaga_camada_b(repo):
    reg = ReferenceRegistry({})
    repo.ensure_reference_assets([reg.get("AAA"), reg.get("BBB")])
    repo.set_tiers(set(), {"BBB"})
    repo.ensure_tier_a({"AAA"})
    repo.ensure_tier_a({"AAA"})  # idempotente
    tiers = dict(repo._query("select ticker, tier from watch_tiers where ticker in ('AAA','BBB')"))
    assert tiers == {"AAA": "A", "BBB": "B"}


def test_eventos_posicoes_e_placar(repo, dsn):
    import psycopg

    from central_rwa.db.repository import EventRow, PositionRow

    reg = ReferenceRegistry({})
    repo.ensure_reference_assets([reg.get("AMD")])
    ev = EventRow("AMD", "queda_brusca", date.today() - timedelta(days=3), -6.2, 1.8, "ATENCAO", {"n": 14, "mediana": {"7": 1.9}})
    eid = repo.upsert_event(ev)
    assert repo.upsert_event(ev) == eid  # mesmo evento: atualiza, não duplica

    base = dict(agent="swing_v1", ticker="AMD", setup="queda_brusca", entry_price=100.0, target_pct=2.0, stop_pct=-5.0, horizon_days=7)
    bt = [PositionRow(mode="backtest", event_day=date(2020, 1, d), entry_day=date(2020, 1, d + 1), status="fechada",
                      exit_day=date(2020, 1, d + 3), exit_price=102, exit_reason="alvo", ret_pct=2.0, ret_net_pct=r,
                      baseline_pct=1.0, stats={"n": 12}, **base) for d, r in ((2, 1.7), (10, -5.3), (20, 1.7))]
    assert repo.replace_backtest("swing_v1", bt) == 3
    assert repo.replace_backtest("swing_v1", bt) == 3  # substitui

    live = PositionRow(mode="live", event_day=ev.day, entry_day=date.today(), event_id=eid, **base)
    assert repo.insert_position(live) is True
    assert repo.insert_position(PositionRow(mode="live", event_day=ev.day, entry_day=date.today(), **base)) is False
    [aberta] = repo.open_positions("swing_v1", "live")
    aberta.status, aberta.exit_day, aberta.exit_price, aberta.exit_reason, aberta.ret_pct, aberta.ret_net_pct = (
        "fechada", date.today(), 102.0, "alvo", 2.0, 1.7)
    repo.close_position(aberta)
    assert repo.open_positions("swing_v1", "live") == []

    with psycopg.connect(dsn, autocommit=True) as c:
        c.execute("set role anon")
        placar = dict((m, (f, a, float(t))) for _, m, f, a, t in c.execute(
            "select agente, modo, fechadas, abertas, taxa_acerto_pct from crwa_placar where agente='swing_v1'").fetchall())
        assert placar["backtest"] == (3, 0, 66.7) and placar["live"] == (1, 0, 100.0)
        assert c.execute("select count(*) from crwa_eventos where ticker='AMD'").fetchone()[0] == 1
        assert c.execute("select count(*) from crwa_posicoes where ticker='AMD'").fetchone()[0] == 4
        assert c.execute("select count(*) from crwa_placar_setup where ticker='AMD'").fetchone()[0] == 2


def test_estado_do_roteador_ida_e_volta(repo):
    st = ProviderState()
    st.increment(TS)
    st.increment(TS)
    st.health.consecutive_failures = 2
    st.health.cooldown_until = TS + timedelta(minutes=5)
    st.health.last_error = "HTTP 429"
    repo.save({"dexscreener": st})
    loaded = repo.load()["dexscreener"]
    assert loaded.count("day", TS) == 2 and loaded.count("minute", TS) == 2
    assert loaded.health.consecutive_failures == 2 and loaded.health.cooldown_until == TS + timedelta(minutes=5)
