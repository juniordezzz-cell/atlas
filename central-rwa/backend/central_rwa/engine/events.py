"""Detecção de eventos e estatística de eventos historicamente semelhantes
(seções 12 e 13 da especificação).

Regra de ouro: a estatística de um evento usa SÓ o histórico ANTERIOR a ele.
Assim o mesmo código serve para o ao vivo e para o treino histórico
(walk-forward), sem olhar o futuro.
"""

from __future__ import annotations

import statistics
from dataclasses import asdict, dataclass, field
from datetime import date

from ..models import DailyBar

HORIZONS = (1, 3, 5, 7, 10)  # pregões depois do evento
GATILHO_PCT = 5.0
EXTREMO_PCT = 10.0
VOLUME_WINDOW = 20
DECLUSTER_DAYS = 3  # dois eventos a menos de 3 pregões contam como um só


@dataclass
class DayMove:
    idx: int
    day: date
    ret_pct: float  # fechamento vs. fechamento anterior
    volume_ratio: float | None  # volume / média dos 20 pregões anteriores


def daily_moves(bars: list[DailyBar]) -> list[DayMove]:
    out: list[DayMove] = []
    for i in range(1, len(bars)):
        prev, cur = bars[i - 1], bars[i]
        # Preço <= 0 quebra a conta de retorno (ex.: petróleo WTI fechou em -US$ 37 em abr/2020).
        if not _valid(prev) or not _valid(cur):
            continue
        vols = [b.volume for b in bars[max(0, i - VOLUME_WINDOW) : i] if b.volume]
        vr = cur.volume / statistics.fmean(vols) if cur.volume and len(vols) >= 10 and statistics.fmean(vols) > 0 else None
        out.append(DayMove(i, cur.day, (cur.close - prev.close) / prev.close * 100, vr))
    return out


def _valid(b: DailyBar) -> bool:
    """Pregão utilizável: fechamento e mínima positivos."""
    return bool(b.close and b.close > 0 and (b.low is None or b.low > 0))


def kind_of(ret_pct: float) -> str:
    return "queda_brusca" if ret_pct < 0 else "alta_brusca"


def is_trigger(ret_pct: float, threshold: float = GATILHO_PCT) -> bool:
    return abs(ret_pct) > threshold


@dataclass
class ForwardPath:
    event_idx: int
    day: date
    ret_pct: float
    fwd: dict[int, float]  # horizonte -> retorno % do fechamento do evento até o fechamento H pregões depois
    max_up_pct: float  # melhor máxima nos 10 pregões seguintes, vs. fechamento do evento
    max_down_pct: float  # pior mínima nos 10 pregões seguintes
    min_7d_pct: float  # pior mínima nos 7 pregões seguintes (base do stop)
    max_7d_pct: float  # melhor máxima nos 7 pregões seguintes


def forward_path(bars: list[DailyBar], idx: int) -> ForwardPath | None:
    """Retornos depois do evento em `idx`. None se não houver 10 pregões à frente."""
    base = bars[idx].close
    last = max(HORIZONS)
    if idx + last >= len(bars) or not _valid(bars[idx]) or not _valid(bars[idx - 1]):
        return None
    if not all(_valid(b) for b in bars[idx + 1 : idx + last + 1]):
        return None
    fwd = {h: (bars[idx + h].close - base) / base * 100 for h in HORIZONS}
    window = bars[idx + 1 : idx + last + 1]
    highs = [(b.high or b.close) for b in window]
    lows = [(b.low or b.close) for b in window]
    return ForwardPath(
        event_idx=idx,
        day=bars[idx].day,
        ret_pct=(bars[idx].close - bars[idx - 1].close) / bars[idx - 1].close * 100,
        fwd=fwd,
        max_up_pct=(max(highs) - base) / base * 100,
        max_down_pct=(min(lows) - base) / base * 100,
        min_7d_pct=(min(lows[:7]) - base) / base * 100,
        max_7d_pct=(max(highs[:7]) - base) / base * 100,
    )


def similar_events(bars: list[DailyBar], moves: list[DayMove], event: DayMove, threshold: float = GATILHO_PCT) -> list[ForwardPath]:
    """Eventos anteriores no mesmo sentido e acima do gatilho, cujo futuro de 10
    pregões já era conhecido na data do evento (sem olhar o futuro)."""
    same_sign = [
        m
        for m in moves
        if m.idx + max(HORIZONS) < event.idx  # o futuro de 10 pregões já tinha acontecido
        and is_trigger(m.ret_pct, threshold)
        and (m.ret_pct < 0) == (event.ret_pct < 0)
    ]
    paths: list[ForwardPath] = []
    last_idx = -10**9
    for m in same_sign:
        if m.idx - last_idx < DECLUSTER_DAYS:
            continue
        p = forward_path(bars, m.idx)
        if p:
            paths.append(p)
            last_idx = m.idx
    return paths


def _pct(xs: list[bool]) -> float | None:
    return round(sum(xs) / len(xs) * 100, 1) if xs else None


def _quantile(xs: list[float], q: float) -> float | None:
    if not xs:
        return None
    s = sorted(xs)
    k = (len(s) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


@dataclass
class EventStats:
    n: int
    mediana: dict[int, float] = field(default_factory=dict)
    media: dict[int, float] = field(default_factory=dict)
    pct_positivo: dict[int, float] = field(default_factory=dict)
    pct_sobe_3_em_5d: float | None = None
    pct_cai_mais_3_em_5d: float | None = None
    p20_min_7d: float | None = None  # pior mínima típica em 7 pregões (percentil 20)
    mediana_max_7d: float | None = None  # alta máxima típica dentro de 7 pregões (mediana das máximas)
    p50_min_7d: float | None = None  # queda máxima típica dentro de 7 pregões (mediana das mínimas)
    melhor_10d: float | None = None
    pior_10d: float | None = None
    desde: date | None = None

    def as_dict(self) -> dict:
        d = asdict(self)
        d["desde"] = self.desde.isoformat() if self.desde else None
        for k in ("mediana", "media", "pct_positivo"):
            d[k] = {str(h): round(v, 2) for h, v in d[k].items()}
        for k in ("p20_min_7d", "p50_min_7d", "mediana_max_7d", "melhor_10d", "pior_10d"):
            d[k] = round(d[k], 2) if d[k] is not None else None
        return d


def compute_stats(paths: list[ForwardPath]) -> EventStats:
    st = EventStats(n=len(paths))
    if not paths:
        return st
    for h in HORIZONS:
        vals = [p.fwd[h] for p in paths]
        st.mediana[h] = statistics.median(vals)
        st.media[h] = statistics.fmean(vals)
        st.pct_positivo[h] = _pct([v > 0 for v in vals])
    st.pct_sobe_3_em_5d = _pct([p.fwd[5] >= 3 for p in paths])
    st.pct_cai_mais_3_em_5d = _pct([p.fwd[5] <= -3 for p in paths])
    st.p20_min_7d = _quantile([p.min_7d_pct for p in paths], 0.2)
    st.p50_min_7d = _quantile([p.min_7d_pct for p in paths], 0.5)
    st.mediana_max_7d = _quantile([p.max_7d_pct for p in paths], 0.5)
    st.melhor_10d = max(p.max_up_pct for p in paths)
    st.pior_10d = min(p.max_down_pct for p in paths)
    st.desde = paths[0].day
    return st


def level_of(ret_pct: float, moves: list[DayMove], upto_idx: int) -> str:
    """EXTREMO: acima de 10% ou entre os 1% maiores movimentos do próprio ativo até ali."""
    a = abs(ret_pct)
    past = sorted(abs(m.ret_pct) for m in moves if m.idx < upto_idx)
    p99 = _quantile(past, 0.99) if len(past) >= 250 else None
    if a >= EXTREMO_PCT or (p99 is not None and a >= p99):
        return "EXTREMO"
    return "ATENCAO"


def baseline_mean(bars: list[DailyBar], upto_idx: int, horizon: int = 7) -> float | None:
    """Retorno médio de `horizon` pregões num dia QUALQUER até a data (o 'não fazer nada')."""
    vals = [
        (bars[i + horizon].close - bars[i].close) / bars[i].close * 100
        for i in range(0, upto_idx - horizon)
        if _valid(bars[i]) and _valid(bars[i + horizon])
    ]
    return statistics.fmean(vals) if vals else None
