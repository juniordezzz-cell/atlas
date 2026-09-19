"""Os jobs da Fase 1 (seção 5.3 da especificação)."""

from __future__ import annotations

from datetime import date, datetime, timezone

from ..collectors import run_catalog, snapshot_tokens, update_history, update_tbills
from ..engine import runner as agents
from ..mapping import MIN_CONFIDENCE_TIER_A
from ..router import NoProviderAvailable
from .runner import Context

MIN_CONFIDENCE_TIER_B = 0.5
MAX_FULL_PER_DAILY = 40  # downloads de 10 anos por job diário (~2 s cada no Yahoo)


def _ts() -> datetime:
    return datetime.now(timezone.utc).replace(second=0, microsecond=0)


def _ensure_catalog(ctx: Context) -> None:
    if not ctx.repo.tokens():
        ctx.section("catalogo", run_catalog(ctx.router, ctx.repo, ctx.registry))


TOKEN_VS_ASSET_ALERT_PCT = 2.0


def _token_vs_asset(tokens, snap, quotes: dict) -> list[str]:
    """Seção 7.2: o token deveria estar colado no ativo. Lista o que passou de 2%.
    Obs.: tokens com multiplicador de dividendos (xStocks) podem ficar um pouco acima."""
    by_id = {t.id: t for t in tokens}
    out = []
    for row in getattr(snap, "rows", []):
        t = by_id.get(row.token_id)
        q = quotes.get(t.reference_ticker) if t else None
        if not q or not q.price:
            continue
        diff = (row.price_usd - q.price) / q.price * 100
        if abs(diff) > TOKEN_VS_ASSET_ALERT_PCT:
            out.append(f"{t.network}:{t.symbol} {row.price_usd:.4g} vs {t.reference_ticker} {q.price:.4g} ({diff:+.1f}%, fonte {row.source})")
    return out


def _quotes(ctx: Context, tickers: set[str]) -> dict:
    out, errors = {}, []
    quotes = []
    ctx.repo.ensure_reference_assets([ctx.registry.get(t) for t in sorted(tickers)])
    for t in sorted(tickers):
        asset = ctx.registry.get(t)
        if asset.asset_class == "tbill":
            continue
        try:
            q, _ = ctx.router.call("reference_quote", "quote", asset, cache=False)
        except NoProviderAvailable as e:
            errors.append(f"{t}: {e}")
            continue
        quotes.append(q)
        out[t] = f"{q.price:.4g} ({q.source})"
    ctx.repo.insert_quotes(quotes)
    return {"cotacoes": out, "errors": errors, "_objs": {q.ticker: q for q in quotes}}


def tier_a(ctx: Context) -> None:
    """A cada 6h: snapshots dos tokens da camada A + cotação de referência."""
    _ensure_catalog(ctx)
    tokens = ctx.repo.tokens(ctx.tier_a, MIN_CONFIDENCE_TIER_A)
    snap = snapshot_tokens(ctx.router, ctx.repo, tokens, "A", _ts(), ctx.router.config.router.price_tolerance_pct)
    ctx.section("tokens_camada_a", snap)
    ref = _quotes(ctx, ctx.tier_a)
    ctx.repo.ensure_tier_a(ctx.tier_a)
    objs = ref.pop("_objs")
    ctx.section("referencia_camada_a", ref)
    ctx.section("token_vs_ativo_acima_de_2pct", _token_vs_asset(tokens, snap, objs))
    ctx.section("agente_acompanhamento", agents.monitor(ctx.repo, datetime.now(timezone.utc).date()))


def daily(ctx: Context) -> None:
    """A cada 24h: catálogo, snapshots da camada B, camadas, 1 dia de histórico, T-bills."""
    today = datetime.now(timezone.utc).date()
    ctx.section("catalogo", run_catalog(ctx.router, ctx.repo, ctx.registry))

    tokens = [t for t in ctx.repo.tokens(None, MIN_CONFIDENCE_TIER_B) if t.reference_ticker]
    if ctx.only:
        tokens = [t for t in tokens if t.reference_ticker in ctx.only]
    floor = float(ctx.watchlist.get("tier_b_floor_usd", 100_000))
    ctx.section(
        "tokens_camada_b",
        snapshot_tokens(
            ctx.router, ctx.repo, tokens, "B", _ts(), ctx.router.config.router.price_tolerance_pct, max_providers=2, confirm_min_usd=floor
        ),
    )
    size = ctx.repo.latest_liquidity_by_ticker()
    tier_b = {t for t, v in size.items() if v >= floor}
    if ctx.only:
        tier_b &= ctx.only
    ctx.repo.ensure_reference_assets([ctx.registry.get(t) for t in sorted(ctx.tier_a | tier_b)])
    ctx.repo.set_tiers(ctx.tier_a, tier_b)
    ctx.section("camadas", {"A": sorted(ctx.tier_a), "B_total": len(tier_b - ctx.tier_a), "piso_usd": floor})

    years = int(ctx.watchlist.get("history_years", 10))
    tickers = sorted(ctx.tier_a | tier_b)
    # Ativos que acabaram de entrar na camada B ganham os 10 anos aqui mesmo
    # (camada A primeiro), limitado por execução para não pesar o job diário.
    ordered = sorted(ctx.tier_a) + sorted(set(tickers) - ctx.tier_a)
    ctx.section(
        "historico",
        update_history(ctx.router, ctx.repo, ctx.registry, ordered, today, years, allow_full=set(tickers), max_full=MAX_FULL_PER_DAILY),
    )
    ctx.section("tbills", update_tbills(ctx.router, ctx.repo, today, years))
    _agents(ctx, today)


def _agents(ctx: Context, today) -> None:
    """Fases 3/4: treino histórico (walk-forward) + eventos do dia + posições ao vivo."""
    # A lista de observação precisa estar no banco: os agentes leem watch_tiers.
    ctx.repo.ensure_reference_assets([ctx.registry.get(t) for t in sorted(ctx.tier_a)])
    ctx.repo.ensure_tier_a(ctx.tier_a)
    ctx.section("agente_treino", agents.train(ctx.repo, ctx.registry, today, ctx.only))
    ctx.section("agente_ao_vivo", agents.live(ctx.repo, ctx.registry, today, ctx.only))


def agents_job(ctx: Context) -> None:
    """Manual: roda só os eventos e o agente sobre o histórico já gravado."""
    _agents(ctx, datetime.now(timezone.utc).date())


def backfill(ctx: Context) -> None:
    """Manual: 10 anos de histórico da camada A (+ camada B já conhecida). Retomável."""
    today = datetime.now(timezone.utc).date()
    _ensure_catalog(ctx)
    years = int(ctx.watchlist.get("history_years", 10))
    size = ctx.repo.latest_liquidity_by_ticker()
    floor = float(ctx.watchlist.get("tier_b_floor_usd", 100_000))
    tier_b = {t for t, v in size.items() if v >= floor}
    if ctx.only:
        tier_b &= ctx.only
    tickers = sorted(ctx.tier_a | tier_b)
    ctx.section("historico", update_history(ctx.router, ctx.repo, ctx.registry, tickers, today, years, allow_full=set(tickers)))
    ctx.repo.ensure_tier_a(ctx.tier_a)
    ctx.section("tbills", update_tbills(ctx.router, ctx.repo, today, years))
    _agents(ctx, today)


def catalog(ctx: Context) -> None:
    ctx.section("catalogo", run_catalog(ctx.router, ctx.repo, ctx.registry))


def report(ctx: Context) -> None:
    ctx.section("tamanho_do_banco", [{"tabela": t, "tamanho": s} for t, s, _ in ctx.repo.size_report()])
    total = sum(b for _, _, b in ctx.repo.size_report())
    ctx.section("total_mb", round(total / 1024 / 1024, 2))


def probe(ctx: Context) -> None:
    """Uma chamada real por provedor com chave/configurado — para FONTES_VERIFICADAS.md."""
    from ..networks import normalize_address

    nvda = ctx.registry.get("NVDA")
    nvdax_sol = normalize_address("solana", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh")
    results = {}
    checks = {
        "token_price": lambda p: p.token_quotes("solana", [nvdax_sol]),
        "reference_quote": lambda p: p.quote(nvda),
        "reference_history_daily": lambda p: p.daily_history(nvda, date.today().replace(day=1)),
        "tbill_yield": lambda p: p.tbill_rates(date.today().year),
    }
    for cap, order in ctx.router.config.capabilities.items():
        if cap not in checks:
            continue
        for name in order:
            reason = ctx.router.blocked_reason(name)
            if reason:
                results[f"{cap}/{name}"] = f"pulado: {reason}"
                continue
            try:
                value = checks[cap](ctx.router.providers[name])
                n = len(value) if isinstance(value, list) else len(getattr(value, "bars", [])) or 1
                results[f"{cap}/{name}"] = f"OK ({n} item/ns)"
            except Exception as e:
                results[f"{cap}/{name}"] = f"FALHOU: {type(e).__name__}: {str(e)[:160]}"
    ctx.section("sondas", results)


JOBS = {"tier_a": tier_a, "daily": daily, "backfill": backfill, "agents": agents_job, "catalog": catalog, "report": report, "probe": probe}
