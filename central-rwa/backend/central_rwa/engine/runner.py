"""Liga o motor de eventos e os agentes ao banco.

- `train`: registra os eventos (>5%) dos últimos 180 dias e treina CADA agente
  (walk-forward) na própria cesta, em 10 anos de pregões.
- `live`: eventos do último pregão + decisões de cada agente + acompanhamento
  das posições simuladas abertas.
- `monitor`: acompanhamento das posições abertas (camada A, a cada 6h).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from ..db import Repository
from ..db.repository import EventRow, PositionRow
from ..reference import ReferenceRegistry
from .agents import AgentDef, load_agents
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
from .swing import check_live, decide, simulate

EVENTS_WINDOW_DAYS = 180
LIVE_LOOKBACK_DAYS = 5  # pega eventos de pregões que um job perdido deixou para trás
MIN_BARS = 300


@dataclass
class AgentTrain:
    posicoes: int = 0
    acertos: int = 0
    retorno_medio_pct: float | None = None
    treino_medio_pct: float | None = None
    validacao_medio_pct: float | None = None
    validacao_n: int = 0
    sem_historico: list[str] = field(default_factory=list)


@dataclass
class TrainResult:
    ativos: int = 0
    eventos_registrados: int = 0
    agentes: dict[str, dict] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _bars_cache(repo: Repository):
    cache: dict[str, list] = {}

    def get(ticker: str):
        if ticker not in cache:
            cache[ticker] = repo.daily_bars(ticker)
        return cache[ticker]

    return get


def _eligible(repo: Repository, registry: ReferenceRegistry, only: set[str] | None) -> list[str]:
    ts = [t for t in repo.watched_tickers() if registry.get(t).asset_class != "tbill"]
    return [t for t in ts if not only or t in only]


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 2) if xs else None


def record_events(repo: Repository, bars_of, tickers: list[str], since: date, source: str) -> list[str]:
    """Eventos da aba Eventos: gatilho global de 5% (seção 5.2)."""
    out = []
    for ticker in tickers:
        bars = bars_of(ticker)
        if len(bars) < MIN_BARS:
            continue
        moves = daily_moves(bars)
        for m in moves:
            if m.day < since or not is_trigger(m.ret_pct, GATILHO_PCT):
                continue
            stats = compute_stats(similar_events(bars, moves, m, GATILHO_PCT))
            repo.upsert_event(EventRow(ticker, kind_of(m.ret_pct), m.day, round(m.ret_pct, 3), m.volume_ratio,
                                       level_of(m.ret_pct, moves, m.idx), stats.as_dict(), source))
            out.append(f"{ticker} {m.ret_pct:+.1f}% em {m.day} ({stats.n} semelhantes)")
    return out


def train_agent(agent: AgentDef, bars_of, tickers: list[str]) -> tuple[list[PositionRow], AgentTrain]:
    r = agent.rules
    positions: list[PositionRow] = []
    info = AgentTrain()
    for ticker in agent.cesta:
        bars = bars_of(ticker) if ticker in tickers else []
        if len(bars) < MIN_BARS:
            info.sem_historico.append(ticker)
            continue
        moves = daily_moves(bars)
        busy_until = -1  # uma posição por vez em cada ativo
        for m in moves:
            if not is_trigger(m.ret_pct, r.gatilho_pct) or m.idx <= busy_until or m.idx + 1 >= len(bars):
                continue
            stats = compute_stats(similar_events(bars, moves, m, r.gatilho_pct))
            d = decide(stats, r, kind_of(m.ret_pct))
            if not d.abrir:
                continue
            entry_bar = bars[m.idx + 1]
            entry = entry_bar.open or entry_bar.close
            ex = simulate(entry, bars[m.idx + 1 :], d.alvo_pct, d.stop_pct, r)
            if ex is None:
                continue  # ainda em andamento no fim do histórico
            busy_until = m.idx + ex.pregoes
            positions.append(PositionRow(
                agent=agent.id, mode="backtest", ticker=ticker, setup=kind_of(m.ret_pct), event_day=m.day,
                entry_day=entry_bar.day, entry_price=round(entry, 4), target_pct=d.alvo_pct, stop_pct=d.stop_pct,
                horizon_days=r.prazo_pregoes, status="fechada", exit_day=ex.day, exit_price=round(ex.price, 4),
                exit_reason=ex.motivo, ret_pct=ex.ret_pct, ret_net_pct=ex.ret_liquido_pct,
                baseline_pct=_round(baseline_mean(bars, m.idx, r.prazo_pregoes)), rationale=d.motivo,
                stats={"n": stats.n, f"mediana_{r.prazo_pregoes}d": stats.mediana.get(r.prazo_pregoes),
                       "pct_positivo": stats.pct_positivo.get(r.prazo_pregoes)},
            ))
    info.posicoes = len(positions)
    info.acertos = sum(1 for p in positions if (p.ret_net_pct or 0) > 0)
    info.retorno_medio_pct = _mean([p.ret_net_pct for p in positions])
    info.treino_medio_pct = _mean([p.ret_net_pct for p in positions if p.entry_day < agent.corte_validacao])
    val = [p for p in positions if p.entry_day >= agent.corte_validacao]
    info.validacao_medio_pct, info.validacao_n = _mean([p.ret_net_pct for p in val]), len(val)
    return positions, info


def train(repo: Repository, registry: ReferenceRegistry, today: date, only: set[str] | None = None,
          agents: list[AgentDef] | None = None) -> TrainResult:
    agents = agents if agents is not None else load_agents()
    res = TrainResult()
    bars_of = _bars_cache(repo)
    tickers = _eligible(repo, registry, only)
    res.ativos = len(tickers)
    res.eventos_registrados = len(record_events(repo, bars_of, tickers, today - timedelta(days=EVENTS_WINDOW_DAYS), "historico"))
    repo.sync_agents(agents)
    for agent in agents:
        positions, info = train_agent(agent, bars_of, tickers)
        repo.replace_backtest(agent.id, positions)
        res.agentes[agent.id] = info.__dict__
    return res


@dataclass
class LiveResult:
    eventos: list[str] = field(default_factory=list)
    abertas: list[str] = field(default_factory=list)
    fechadas: list[str] = field(default_factory=list)
    ignoradas: list[str] = field(default_factory=list)
    em_aberto: int = 0
    errors: list[str] = field(default_factory=list)


def live(repo: Repository, registry: ReferenceRegistry, today: date, only: set[str] | None = None,
         agents: list[AgentDef] | None = None) -> LiveResult:
    """Chamado pelo job diário (depois do histórico do dia)."""
    agents = agents if agents is not None else load_agents()
    res = LiveResult()
    bars_of = _bars_cache(repo)
    tickers = _eligible(repo, registry, only)
    since = today - timedelta(days=LIVE_LOOKBACK_DAYS + 3)
    res.eventos = record_events(repo, bars_of, tickers, since, "daily")
    for agent in agents:
        r = agent.rules
        for ticker in agent.cesta:
            bars = bars_of(ticker) if ticker in tickers else []
            if len(bars) < MIN_BARS:
                continue
            moves = daily_moves(bars)
            for m in moves[-LIVE_LOOKBACK_DAYS:]:
                if m.day < since or not is_trigger(m.ret_pct, r.gatilho_pct):
                    continue
                stats = compute_stats(similar_events(bars, moves, m, r.gatilho_pct))
                d = decide(stats, r, kind_of(m.ret_pct))
                if not d.abrir:
                    res.ignoradas.append(f"{agent.id}/{ticker} {m.day}: {d.motivo}")
                    continue
                best = repo.best_token_price(ticker)
                token_id, price = (best[0], best[1]) if best else (None, bars[-1].close)
                row = PositionRow(
                    agent=agent.id, mode="live", ticker=ticker, setup=kind_of(m.ret_pct), event_day=m.day,
                    token_id=token_id, entry_day=today, entry_price=round(price, 4), target_pct=d.alvo_pct,
                    stop_pct=d.stop_pct, horizon_days=r.prazo_pregoes,
                    baseline_pct=_round(baseline_mean(bars, m.idx, r.prazo_pregoes)),
                    rationale=d.motivo + ("" if token_id else " · sem token com preço: entrada pelo ativo de referência"),
                    stats={"n": stats.n, f"mediana_{r.prazo_pregoes}d": stats.mediana.get(r.prazo_pregoes)},
                )
                if repo.insert_position(row):
                    res.abertas.append(f"{agent.id}: {ticker} a {price:.4g} (stop {d.stop_pct:+.1f}%)")
    monitor(repo, today, res, agents)
    return res


def monitor(repo: Repository, today: date, res: LiveResult | None = None, agents: list[AgentDef] | None = None) -> LiveResult:
    """Acompanha as posições abertas de todos os agentes (camada A a cada 6h e job diário)."""
    agents = agents if agents is not None else load_agents()
    res = res or LiveResult()
    total_abertas = 0
    for agent in agents:
        r = agent.rules
        for p in repo.open_positions(agent.id, "live"):
            cur = repo.token_price(p.token_id) if p.token_id else None
            bars = repo.daily_bars(p.ticker)
            price = cur[0] if cur else (bars[-1].close if bars else None)
            if not price:
                total_abertas += 1
                continue
            motivo = check_live(p.entry_price, price, p.target_pct, p.stop_pct)
            pregoes = sum(1 for b in bars if b.day > p.entry_day)
            if not motivo and pregoes >= p.horizon_days:
                motivo = "prazo"
            if not motivo and (today - p.entry_day).days > 21:  # trava se faltarem pregões
                motivo = "prazo"
            if not motivo:
                total_abertas += 1
                continue
            ret = (price - p.entry_price) / p.entry_price * 100
            p.status, p.exit_day, p.exit_price, p.exit_reason = "fechada", today, round(price, 4), motivo
            p.ret_pct, p.ret_net_pct = round(ret, 3), round(ret - r.custo_ida_volta_pct, 3)
            repo.close_position(p)
            res.fechadas.append(f"{agent.id}: {p.ticker} {motivo} {p.ret_net_pct:+.2f}%")
    res.em_aberto = total_abertas
    return res


def _round(v: float | None) -> float | None:
    return round(v, 3) if v is not None else None
