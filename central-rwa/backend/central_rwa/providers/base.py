from __future__ import annotations

from typing import Any, Callable

import httpx

from .. import USER_AGENT
from ..config import ProviderConfig
from ..router.errors import ProviderError, RateLimited


class Provider:
    """Base dos adaptadores. Toda requisição passa pelo `gate` do roteador,
    que controla a cota antes da chamada."""

    name: str = ""

    def __init__(self, config: ProviderConfig, client: httpx.Client | None = None):
        self.config = config
        self.client = client or httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
        self._gate: Callable[[str], None] = lambda _p: None

    def bind_gate(self, gate: Callable[[str], None]) -> None:
        self._gate = gate

    @property
    def api_key(self) -> str | None:
        return self.config.api_key()

    def get(self, url: str, params: dict | None = None, headers: dict | None = None) -> httpx.Response:
        self._gate(self.name)
        try:
            resp = self.client.get(url, params=params, headers=headers)
        except httpx.TimeoutException as e:
            raise ProviderError(self.name, f"timeout: {e}") from e
        except httpx.HTTPError as e:
            raise ProviderError(self.name, f"falha de rede: {e}") from e
        if resp.status_code == 429:
            raise RateLimited(self.name, _retry_after(resp))
        if resp.status_code >= 400:
            raise ProviderError(self.name, f"HTTP {resp.status_code}: {resp.text[:200]}")
        return resp

    def get_json(self, url: str, params: dict | None = None, headers: dict | None = None) -> Any:
        resp = self.get(url, params, headers)
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(self.name, f"resposta não é JSON: {resp.text[:200]}") from e
        return data


def _retry_after(resp: httpx.Response) -> float | None:
    val = resp.headers.get("retry-after")
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def fnum(value) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None
