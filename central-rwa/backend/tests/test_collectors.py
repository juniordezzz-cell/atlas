from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from central_rwa.collectors.catalog import apply_overrides, corroborate, merge
from central_rwa.collectors.history import update_history, update_tbills
from central_rwa.collectors.token_prices import snapshot_tokens
from central_rwa.db import MemoryRepository
from central_rwa.mapping import map_by_suffix, strip_suffix
from central_rwa.models import DailyBar, DailySeries, TbillRate, TokenListing, TokenQuote
from central_rwa.reference import ReferenceRegistry
from central_rwa.router import RateLimited

from .conftest import make_router

TS = datetime(2026, 9, 19, 12, tzinfo=timezone.utc)


def listing(addr, ticker, conf, issuer="x", origin="sufixo", net="ethereum"):
    return TokenListing(issuer=issuer, network=net, address=addr, symbol=addr.upper(), reference_ticker=ticker,
                        mapping_confidence=conf, mapping_origin=origin, source="t")


# ---------------- mapeamento / catálogo ----------------

def test_strip_suffix():
    assert strip_suffix("NVDAON", "on") == "NVDA"
    assert strip_suffix("spyb", "b") == "SPY"
    assert strip_suffix("nvda", "") == "NVDA"
    assert strip_suffix("on", "on") is None
    assert strip_suffix("xyz$", "") is None


def test_map_by_suffix_confianca():
    assert map_by_suffix("TSLAx", "x", {"TSLA"})[:2] == ("TSLA", 0.8)
    assert map_by_suffix("ABCDx", "x", set())[:2] == ("ABCD", 0.5)


def test_merge_fica_com_maior_confianca():
    m = merge([listing("0xa", "NVDA", 0.5), listing("0xa", "NVDA", 1.0, origin="api_emissor")])
    assert m[("ethereum", "0xa")].mapping_confidence == 1.0


def test_corroboracao_por_outro_emissor_sobe_confianca():
    m = merge([listing("0xa", "PDD", 0.5, issuer="ondo"), listing("0xb", "PDD", 0.8, issuer="robinhood")])
    corroborate(m)
    assert m[("ethereum", "0xa")].mapping_confidence == 0.8
    assert m[("ethereum", "0xa")].mapping_origin == "sufixo+outro_emissor"


def test_override_vence_e_ignore_remove():
    m = merge([listing("0xa", "ERRADO", 0.8), listing("0xb", "NVDA", 1.0)])
    apply_overrides(m, {"ethereum:0xa": {"reference_ticker": "GOLD", "asset_class": "commodity"}, "ethereum:0xb": {"ignore": True}})
    assert m[("ethereum", "0xa")].reference_ticker == "GOLD" and m[("ethereum", "0xa")].mapping_confidence == 1.0
    assert ("ethereum", "0xb") not in m


# ---------------- snapshots + validação cruzada ----------------

class PriceProv:
    def __init__(self, name, prices: dict, fail=False):
        self.name, self.prices, self.fail = name, prices, fail
        self._gate = lambda _p: None

    def bind_gate(self, g):
        self._gate = g

    def token_quotes(self, network, addresses):
        self._gate(self.name)
        if self.fail:
            raise RateLimited(self.name)
        return [TokenQuote(network=network, address=a, price_usd=self.prices[a], liquidity_usd=500_000, volume_24h_usd=1,
                           source=self.name, observed_at=TS) for a in addresses if a in self.prices]


def snap_router(clock, provs):
    return make_router({p.name: p for p in provs}, {p.name: {} for p in provs}, {"token_price": [p.name for p in provs]}, clock)


def seed_tokens(repo, addrs):
    repo.upsert_tokens([listing(a, "NVDA", 1.0) for a in addrs])
    return repo.tokens()


def test_snapshot_confirma_com_segunda_fonte(clock):
    repo = MemoryRepository()
    toks = seed_tokens(repo, ["0xa", "0xb"])
    router = snap_router(clock, [PriceProv("p1", {"0xa": 100, "0xb": 50}), PriceProv("p2", {"0xa": 100.5, "0xb": 60})])
    res = snapshot_tokens(router, repo, toks, "A", TS, tolerance_pct=1.0)
    assert res.saved == 2 and res.confirmed == 1
    assert len(res.divergent) == 1 and "0XB" in res.divergent[0]
    rows = {r.token_id: r for r in repo.snapshots}
    assert rows[toks[0].id].sources_confirmed == 2 and rows[toks[1].id].sources_confirmed == 1


def test_snapshot_busca_faltantes_na_proxima_fonte(clock):
    repo = MemoryRepository()
    toks = seed_tokens(repo, ["0xa", "0xb"])
    router = snap_router(clock, [PriceProv("p1", {"0xa": 100}), PriceProv("p2", {"0xb": 50}), PriceProv("p3", {"0xa": 100, "0xb": 50})])
    res = snapshot_tokens(router, repo, toks, "A", TS, tolerance_pct=1.0)
    assert res.saved == 2 and not res.missing
    assert {r.source for r in repo.snapshots} == {"p1", "p2"}
    assert res.confirmed == 2  # p3 confirmou os dois


def test_snapshot_fallback_quando_primeira_fonte_bloqueia(clock):
    repo = MemoryRepository()
    toks = seed_tokens(repo, ["0xa"])
    router = snap_router(clock, [PriceProv("p1", {}, fail=True), PriceProv("p2", {"0xa": 10})])
    res = snapshot_tokens(router, repo, toks, "A", TS, tolerance_pct=1.0)
    assert res.saved == 1 and repo.snapshots[0].source == "p2"


def test_snapshot_camada_b_so_confirma_acima_do_piso(clock):
    repo = MemoryRepository()
    toks = seed_tokens(repo, ["0xa"])
    confirm = PriceProv("p2", {"0xa": 10})
    router = snap_router(clock, [PriceProv("p1", {"0xa": 10}), confirm])
    snapshot_tokens(router, repo, toks, "B", TS, 1.0, max_providers=2, confirm_min_usd=10_000_000)
    assert router.stats.calls["p2"] == 0


# ---------------- histórico (idempotência e retomada) ----------------

class HistProv:
    name = "h"

    def __init__(self, fail_on: set[str] = frozenset()):
        self.fail_on = set(fail_on)
        self.requests: list[tuple[str, date]] = []
        self._gate = lambda _p: None

    def bind_gate(self, g):
        self._gate = g

    def daily_history(self, asset, start, end=None):
        self._gate(self.name)
        self.requests.append((asset.ticker, start))
        if asset.ticker in self.fail_on:
            raise RateLimited(self.name)
        days, d = [], start
        while d <= date(2026, 9, 18):
            if d.weekday() < 5:
                days.append(DailyBar(day=d, close=100.0))
            d += timedelta(days=1)
        return DailySeries(ticker=asset.ticker, bars=days, source=self.name)

    def tbill_rates(self, year):
        self._gate(self.name)
        return [TbillRate(day=date(year, 1, 2), tenor="13w", rate=4.0, source=self.name)]


def hist_router(clock, prov):
    return make_router({"h": prov}, {"h": {}}, {"reference_history_daily": ["h"], "tbill_yield": ["h"]}, clock, cooldown_base_seconds=0)


def test_backfill_e_idempotente(clock):
    repo, prov = MemoryRepository(), HistProv()
    reg = ReferenceRegistry({})
    today = date(2026, 9, 19)
    update_history(hist_router(clock, prov), repo, reg, ["NVDA"], today, 10, allow_full={"NVDA"})
    _, _, n1 = repo.history_range("NVDA")
    assert n1 > 2500
    # segunda execução: série completa até ontem → pulado, nada duplicado
    res = update_history(hist_router(clock, prov), repo, reg, ["NVDA"], today, 10, allow_full={"NVDA"})
    assert res.skipped_complete == ["NVDA"]
    assert repo.history_range("NVDA")[2] == n1


def test_backfill_retoma_de_onde_parou(clock):
    repo = MemoryRepository()
    reg = ReferenceRegistry({})
    today = date(2026, 9, 19)
    # 1ª execução: NVDA ok, TSLA falha (limite)
    p1 = HistProv(fail_on={"TSLA"})
    r1 = update_history(hist_router(clock, p1), repo, reg, ["NVDA", "TSLA"], today, 10, allow_full={"NVDA", "TSLA"})
    assert "NVDA" in r1.updated and r1.errors
    # 2ª execução: NVDA pulado, TSLA baixado
    p2 = HistProv()
    r2 = update_history(hist_router(clock, p2), repo, reg, ["NVDA", "TSLA"], today, 10, allow_full={"NVDA", "TSLA"})
    assert r2.skipped_complete == ["NVDA"] and "TSLA" in r2.updated
    assert [t for t, _ in p2.requests] == ["TSLA"]


def test_atualizacao_diaria_busca_so_o_fim_e_nao_faz_backfill_da_camada_b(clock):
    repo, prov = MemoryRepository(), HistProv()
    reg = ReferenceRegistry({})
    today = date(2026, 9, 19)
    repo.upsert_daily_bars("NVDA", [DailyBar(day=date(2016, 9, 1), close=1), DailyBar(day=date(2026, 9, 10), close=1)], "h")
    res = update_history(hist_router(clock, prov), repo, reg, ["NVDA", "XYZ"], today, 10, allow_full=set())
    assert res.skipped_no_history == ["XYZ"]
    assert prov.requests == [("NVDA", date(2026, 9, 5))]  # último dia - 5 de sobreposição


def test_tbills_incremental_e_retomavel(clock):
    repo, prov = MemoryRepository(), HistProv()
    res = update_tbills(hist_router(clock, prov), repo, date(2026, 9, 19), years=10)
    assert res.years == list(range(2016, 2027))
    res2 = update_tbills(hist_router(clock, prov), repo, date(2026, 9, 19), years=10)
    assert res2.years == [2026]
    # um ano que falhou antes (sumiu do banco) é buscado de novo
    repo.tbills = {k: v for k, v in repo.tbills.items() if k[1].year != 2019}
    res3 = update_tbills(hist_router(clock, prov), repo, date(2026, 9, 19), years=10)
    assert res3.years == [2019, 2026]
