from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from central_rwa.config import ProviderConfig, ProvidersFile, RouterConfig
from central_rwa.router import MemoryStateStore, Router

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_json(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class FakeClock:
    def __init__(self, start: datetime | None = None):
        self.now = start or datetime(2026, 9, 19, 12, 0, 0, tzinfo=timezone.utc)
        self.slept: list[float] = []

    def __call__(self) -> datetime:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += timedelta(seconds=seconds)

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


@pytest.fixture
def clock():
    return FakeClock()


def make_router(providers: dict, provider_cfgs: dict[str, dict], capabilities: dict[str, list[str]], clock: FakeClock, store=None, **router_cfg):
    cfg = ProvidersFile(
        router=RouterConfig(**router_cfg),
        providers={n: ProviderConfig(name=n, **c) for n, c in provider_cfgs.items()},
        capabilities=capabilities,
    )
    return Router(cfg, providers, store or MemoryStateStore(), clock=clock, sleep=clock.sleep)
