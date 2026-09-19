"""Estado persistente do roteador: uso de cota e saúde de cada provedor.

Cada job do GitHub Actions é efêmero, então cotas diárias e mensais só
funcionam se o estado for salvo entre execuções. O estado é carregado uma vez
no início do job e gravado uma vez no fim (ver db.repository)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

WINDOWS = ("second", "minute", "day", "month")


def window_start(window: str, now: datetime) -> datetime:
    now = now.astimezone(timezone.utc)
    if window == "second":
        return now.replace(microsecond=0)
    if window == "minute":
        return now.replace(second=0, microsecond=0)
    if window == "day":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if window == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    raise ValueError(window)


def window_seconds(window: str) -> float:
    return {"second": 1, "minute": 60, "day": 86400, "month": 86400 * 31}[window]


@dataclass
class Usage:
    window: str
    start: datetime
    count: int = 0


@dataclass
class Health:
    consecutive_failures: int = 0
    cooldown_until: datetime | None = None
    circuit_open_until: datetime | None = None
    last_error: str | None = None
    last_success: datetime | None = None
    latency_ms_avg: float | None = None
    calls: int = 0


@dataclass
class ProviderState:
    usage: dict[str, Usage] = field(default_factory=dict)
    health: Health = field(default_factory=Health)

    def count(self, window: str, now: datetime) -> int:
        u = self.usage.get(window)
        start = window_start(window, now)
        if u is None or u.start != start:
            return 0
        return u.count

    def increment(self, now: datetime) -> None:
        for w in WINDOWS:
            start = window_start(w, now)
            u = self.usage.get(w)
            if u is None or u.start != start:
                self.usage[w] = Usage(w, start, 1)
            else:
                u.count += 1


class StateStore:
    """Interface de persistência. MemoryStateStore serve para testes e --dry-run."""

    def load(self) -> dict[str, ProviderState]:
        raise NotImplementedError

    def save(self, states: dict[str, ProviderState]) -> None:
        raise NotImplementedError


class MemoryStateStore(StateStore):
    def __init__(self) -> None:
        self.states: dict[str, ProviderState] = {}

    def load(self) -> dict[str, ProviderState]:
        return self.states

    def save(self, states: dict[str, ProviderState]) -> None:
        self.states = states
