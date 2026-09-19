"""Liga o motor de eventos e o agente de swing ao banco.

- `train`: treino histórico (walk-forward) do agente em 10 anos de pregões,
  e registro dos eventos dos últimos 180 dias (aba Eventos já nasce com conteúdo).
- `live`: eventos do último pregão + decisões do agente + acompanhamento das
  posições simuladas abertas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from ..db import Repository
from ..db.repository import EventRow, PositionRow
from ..reference import ReferenceRegistry
from .events import (
    GATILHO_PCT,
    baseline_mean,
    compute_stats,
    daily_moves,
    is_trigger,
    kind_of,
    level_of,
    similar_events,
)
from .swing import AGENT, RULES_V1, Rules, check_live, decide, simulate

EVENTS_WINDOW_DAYS = 180
LIVE_LOOKBACK_DAYS = 5  # pega eventos de pregões que um job perdido deixou para trás


@dataclass
class TrainResult:
    ativos: int = 0
    eventos_historicos: int = 0
    eventos_registrados: int = 0
    posicoes: int = 0
    acertos: int = 0
    retorno_medio_pct: float | None = None
    por_motivo: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _tickers(repo: Repository, registry: ReferenceRegistry, only: set[str] | None) -> list[str]:
    ts = [t for t in repo.watched_tickers() if registry.get(t).asset_class != "tbill"]
    return [t for t in ts if not only or t in only]


def train(repo: Repository, registry: ReferenceRegistry, today: date, only: set[str] | None = None, rules: Rules = RULES_V1) -> TrainResult:
    res = TrainResult()
    positions: list[PositionRow] = []
    for ticker in _tickers(repo, registry, only):
        bars = repo.daily_bars(ticker)
        if len(bars) < 300:
            continue
        res.ativos += 1
        moves = daily_moves(bars)
        busy_until = -1  # o agente não abre duas posições ao mesmo tempo no mesmo ativo
        for m in moves:
            if not is_trigger(m.ret_pct):
                continue
            res.eventos_historicos += 1
            stats = compute_stats(similar_events(bars, moves, m))
            if m.day >= today - timedelta(days=EVENTS_WINDOW_DAYS):
                repo.upsert_event(EventRow(ticker, kind_of(m.ret_pct), m.day, round(m.ret_pct, 3), m.volume_ratio,
                                           level_of(m.ret_pct, moves, m.idx), stats.as_dict(), "historico"))
                res.eventos_registrados += 1
            if m.idx <= busy_until or m.idx + 1 >= len(bars):
                continue
            d = decide(stats, rules)
            if not d.abrir:
                continue
            entry_bar = bars[m.idx + 1]
            entry = entry_bar.open or entry_bar.close
            ex = simulate(entry, bars[m.idx + 1 :], d.alvo_pct, d.stop_pct, rules)
            if ex is None:
                continue  # ainda em andamento no fim do histórico
            busy_until = m.idx + ex.pregoes
            positions.append(PositionRow(
                agent=AGENT, mode="backtest", ticker=ticker, setup=kind_of(m.ret_pct), event_day=m.day,
                entry_day=entry_bar.day, entry_price=round(entry, 4), target_pct=d.alvo_pct, stop_pct=d.stop_pct,
                horizon_days=rules.prazo_pregoes, status="fechada", exit_day=ex.day, exit_price=round(ex.price, 4),
                exit_reason=ex.motivo, ret_pct=ex.ret_pct, ret_net_pct=ex.ret_liquido_pct,
                baseline_pct=_r(baseline_mean(bars, m.idx, rules.prazo_pregoes)), rationale=d.motivo,
                stats={"n": stats.n, "mediana_7d": stats.mediana.get(7), "pct_positivo_7d": stats.pct_positivo.get(7)},
            ))
    repo.replace_backtest(AGENT, positions)
    res.posicoes = len(positions)
    res.acertos = sum(1 for p in positions if (p.ret_net_pct or 0) > 0)
    if positions:
        res.retorno_medio_pct = round(sum(p.ret_net_pct for p in positions) / len(positions), 2)
    for p in positions:
        res.por_motivo[p.exit_reason] = res.por_motivo.get(p.exit_reason, 0) + 1
    return res


@dataclass
class LiveResult:
    eventos: list[str] = field(default_factory=list)
    abertas: list[str] = field(default_factory=list)
    fechadas: list[str] = field(default_factory=list)
    ignoradas: list[str] = field(default_factory=list)
    em_aberto: int = 0
    errors: list[str] = field(default_factory=list)


def live(repo: Repository, registry: ReferenceRegistry, today: date, only: set[str] | None = None, rules: Rules = RULES_V1) -> LiveResult:
    """Chamado pelo job diário (depois do histórico do dia)."""
    res = LiveResult()
    for ticker in _tickers(repo, registry, only):
        bars = repo.daily_bars(ticker)
        if len(bars) < 300:
            continue
        moves = daily_moves(bars)
        for m in moves[-LIVE_LOOKBACK_DAYS:]:
            if not is_trigger(m.ret_pct) or m.day < today - timedelta(days=LIVE_LOOKBACK_DAYS + 3):
                continue
            stats = compute_stats(similar_events(bars, moves, m))
            eid = repo.upsert_event(EventRow(ticker, kind_of(m.ret_pct), m.day, round(m.ret_pct, 3), m.volume_ratio,
                                             level_of(m.ret_pct, moves, m.idx), stats.as_dict(), "daily"))
            res.eventos.append(f"{ticker} {m.ret_pct:+.1f}% em {m.day} ({stats.n} semelhantes)")
            d = decide(stats, rules)
            if not d.abrir:
                res.ignoradas.append(f"{ticker} {m.day}: {d.motivo}")
                continue
            best = repo.best_token_price(ticker)
            token_id, price = (best[0], best[1]) if best else (None, bars[-1].close)
            row = PositionRow(
                agent=AGENT, mode="live", ticker=ticker, setup=kind_of(m.ret_pct), event_day=m.day, event_id=eid,
                token_id=token_id, entry_day=today, entry_price=round(price, 4), target_pct=d.alvo_pct, stop_pct=d.stop_pct,
                horizon_days=rules.prazo_pregoes, baseline_pct=_r(baseline_mean(bars, m.idx, rules.prazo_pregoes)),
                rationale=d.motivo + ("" if token_id else " · sem token com preço: entrada pelo ativo de referência"),
                stats={"n": stats.n, "mediana_7d": stats.mediana.get(7), "pct_positivo_7d": stats.pct_positivo.get(7)},
            )
            if repo.insert_position(row):
                res.abertas.append(f"{ticker} a {price:.4g} (alvo {d.alvo_pct:+.1f}%, stop {d.stop_pct:+.1f}%)")
    monitor(repo, today, res, rules)
    return res


def monitor(repo: Repository, today: date, res: LiveResult | None = None, rules: Rules = RULES_V1) -> LiveResult:
    """Acompanha as posições abertas (camada A a cada 6h e job diário)."""
    res = res or LiveResult()
    for p in repo.open_positions(AGENT, "live"):
        cur = repo.token_price(p.token_id) if p.token_id else None
        bars = repo.daily_bars(p.ticker)
        price = cur[0] if cur else (bars[-1].close if bars else None)
        if not price:
            continue
        motivo = check_live(p.entry_price, price, p.target_pct, p.stop_pct)
        pregoes = sum(1 for b in bars if b.day > p.entry_day)
        if not motivo and pregoes >= p.horizon_days:
            motivo = "prazo"
        if not motivo and (today - p.entry_day).days > 21:  # trava de segurança se faltarem pregões
            motivo = "prazo"
        if not motivo:
            continue
        ret = (price - p.entry_price) / p.entry_price * 100
        p.status, p.exit_day, p.exit_price, p.exit_reason = "fechada", today, round(price, 4), motivo
        p.ret_pct, p.ret_net_pct = round(ret, 3), round(ret - rules.custo_ida_volta_pct, 3)
        repo.close_position(p)
        res.fechadas.append(f"{p.ticker} {motivo} {p.ret_net_pct:+.2f}%")
    res.em_aberto = len(repo.open_positions(AGENT, "live"))
    return res


def _r(v: float | None) -> float | None:
    return round(v, 3) if v is not None else None


__all__ = ["train", "live", "monitor", "GATILHO_PCT"]
