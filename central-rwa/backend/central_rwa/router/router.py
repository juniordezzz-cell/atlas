"""Roteador de APIs (seção 18 da especificação).

Os coletores pedem uma CAPACIDADE ("token_price", "reference_history_daily"...)
e o roteador escolhe o provedor: pula quem está sem chave, em cooldown, com o
circuito aberto ou sem cota, e cai para o próximo quando um falha.
"""

from __future__ import annotations

import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from ..config import ProvidersFile
from .errors import NoProviderAvailable, NotSupported, ProviderError, QuotaExhausted, RateLimited
from .state import WINDOWS, ProviderState, StateStore, window_seconds, window_start


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RunStats:
    calls: Counter = field(default_factory=Counter)  # requisições HTTP por provedor
    served: Counter = field(default_factory=Counter)  # pedidos atendidos por provedor
    fallbacks: Counter = field(default_factory=Counter)  # capacidade -> quantas vezes caiu para o próximo
    skipped: dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))  # provedor -> motivo
    errors: list[str] = field(default_factory=list)
    cache_hits: int = 0

    def as_dict(self) -> dict:
        return {
            "calls": dict(self.calls),
            "served": dict(self.served),
            "fallbacks": dict(self.fallbacks),
            "skipped": {p: dict(c) for p, c in self.skipped.items()},
            "errors": self.errors[-50:],
            "cache_hits": self.cache_hits,
        }


class Router:
    def __init__(
        self,
        config: ProvidersFile,
        providers: dict[str, Any],
        store: StateStore,
        clock: Callable[[], datetime] = utcnow,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.config = config
        self.providers = providers
        self.store = store
        self.clock = clock
        self.sleep = sleep
        self.states: dict[str, ProviderState] = store.load()
        self.stats = RunStats()
        self._cache: dict[tuple, tuple[datetime, Any, str]] = {}
        for name, prov in providers.items():
            if hasattr(prov, "bind_gate"):
                prov.bind_gate(self.gate)

    # ---------- cota ----------

    def state(self, provider: str) -> ProviderState:
        return self.states.setdefault(provider, ProviderState())

    def gate(self, provider: str) -> None:
        """Chamado pelo provedor ANTES de cada requisição HTTP.
        Espera se a janela curta vira logo; senão levanta QuotaExhausted."""
        cfg = self.config.providers[provider]
        st = self.state(provider)
        safety = self.config.router.quota_safety
        limits = cfg.effective_limits()
        for w in WINDOWS:
            limit = limits.get(w)
            if not limit:
                continue
            allowed = max(1, int(limit * safety)) if w in ("day", "month") else limit
            now = self.clock()
            if st.count(w, now) < allowed:
                continue
            wait = (window_start(w, now) + timedelta(seconds=window_seconds(w)) - now).total_seconds()
            if w in ("second", "minute") and wait <= cfg.max_wait_seconds:
                self.sleep(max(wait, 0) + 0.05)
                continue
            raise QuotaExhausted(provider, w)
        st.increment(self.clock())
        self.stats.calls[provider] += 1

    # ---------- saúde ----------

    def blocked_reason(self, provider: str) -> str | None:
        cfg = self.config.providers.get(provider)
        if cfg is None or provider not in self.providers:
            return "não implementado"
        if not cfg.enabled:
            return "desativado"
        if not cfg.has_key():
            return "sem chave"
        h = self.state(provider).health
        now = self.clock()
        if h.circuit_open_until and h.circuit_open_until > now:
            return "circuito aberto"
        if h.cooldown_until and h.cooldown_until > now:
            return "cooldown"
        return None

    def _on_success(self, provider: str, started: float) -> None:
        h = self.state(provider).health
        ms = (time.perf_counter() - started) * 1000
        h.latency_ms_avg = ms if h.latency_ms_avg is None else h.latency_ms_avg * 0.8 + ms * 0.2
        h.consecutive_failures = 0
        h.circuit_open_until = None
        h.last_success = self.clock()
        h.calls += 1

    def _on_failure(self, provider: str, err: Exception) -> None:
        rc = self.config.router
        h = self.state(provider).health
        h.consecutive_failures += 1
        h.last_error = str(err)[:500]
        now = self.clock()
        if isinstance(err, RateLimited):
            backoff = min(rc.cooldown_base_seconds * 2 ** (h.consecutive_failures - 1), rc.cooldown_max_seconds)
            if err.retry_after:
                backoff = max(backoff, err.retry_after)
            h.cooldown_until = now + timedelta(seconds=backoff)
        if h.consecutive_failures >= rc.circuit_threshold:
            h.circuit_open_until = now + timedelta(seconds=rc.circuit_seconds)
        self.stats.errors.append(f"{now:%H:%M:%S} {err}")

    # ---------- chamada ----------

    def order(self, capability: str) -> list[str]:
        if capability not in self.config.capabilities:
            raise KeyError(f"capacidade desconhecida: {capability}")
        return self.config.capabilities[capability]

    def call(self, capability: str, method: str, *args, exclude: tuple[str, ...] = (), cache: bool = True, **kwargs):
        """Devolve (resultado, provedor). Tenta os provedores em ordem."""
        key = (capability, method, repr(args), repr(sorted(kwargs.items())), exclude)
        now = self.clock()
        if cache and key in self._cache:
            at, value, prov = self._cache[key]
            if (now - at).total_seconds() < self.config.router.cache_ttl_seconds:
                self.stats.cache_hits += 1
                return value, prov

        attempts: list[tuple[str, str]] = []
        for name in self.order(capability):
            if name in exclude:
                continue
            reason = self.blocked_reason(name)
            if reason:
                self.stats.skipped[name][reason] += 1
                attempts.append((name, reason))
                continue
            fn = getattr(self.providers[name], method, None)
            if fn is None:
                attempts.append((name, f"sem método {method}"))
                continue
            started = time.perf_counter()
            try:
                value = fn(*args, **kwargs)
            except NotSupported as e:
                attempts.append((name, f"não atende: {e}"))
                continue
            except QuotaExhausted as e:
                self.stats.skipped[name][f"cota {e.window}"] += 1
                attempts.append((name, f"cota {e.window}"))
                self.stats.fallbacks[capability] += 1
                continue
            except ProviderError as e:
                self._on_failure(name, e)
                attempts.append((name, "limite (429)" if isinstance(e, RateLimited) else "erro"))
                self.stats.fallbacks[capability] += 1
                continue
            except Exception as e:  # erro inesperado de parsing etc.: trata como falha do provedor
                self._on_failure(name, ProviderError(name, f"{type(e).__name__}: {e}"))
                attempts.append((name, "erro inesperado"))
                self.stats.fallbacks[capability] += 1
                continue
            self._on_success(name, started)
            self.stats.served[name] += 1
            if cache:
                self._cache[key] = (self.clock(), value, name)
            return value, name
        raise NoProviderAvailable(capability, attempts)

    def call_distinct(self, capability: str, method: str, *args, n: int = 2, **kwargs) -> list[tuple[Any, str]]:
        """Pede o mesmo dado a até N provedores diferentes (validação cruzada)."""
        results: list[tuple[Any, str]] = []
        used: tuple[str, ...] = ()
        while len(results) < n:
            try:
                value, prov = self.call(capability, method, *args, exclude=used, **kwargs)
            except NoProviderAvailable:
                break
            results.append((value, prov))
            used += (prov,)
        return results

    def persist(self) -> None:
        self.store.save(self.states)

    def health_report(self) -> dict[str, dict]:
        out = {}
        now = self.clock()
        for name in self.config.providers:
            st = self.state(name)
            h = st.health
            out[name] = {
                "bloqueio": self.blocked_reason(name),
                "falhas_seguidas": h.consecutive_failures,
                "uso_dia": st.count("day", now),
                "uso_mes": st.count("month", now),
                "latencia_ms": round(h.latency_ms_avg) if h.latency_ms_avg else None,
                "ultimo_erro": h.last_error,
            }
        return out
