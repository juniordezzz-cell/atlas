"""Carregamento dos arquivos de configuração (pasta backend/config)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


@dataclass
class ProviderConfig:
    name: str
    key_env: str | None = None
    key_required: bool = True  # False = funciona sem chave, a chave só melhora o limite
    limits: dict[str, int] = field(default_factory=dict)  # janela -> chamadas
    limits_with_key: dict[str, int] | None = None  # se a chave (opcional) estiver presente
    max_wait_seconds: float = 15.0  # espera aceitável numa janela curta antes de pular
    enabled: bool = True
    notes: str = ""

    def effective_limits(self) -> dict[str, int]:
        if self.limits_with_key and self.api_key():
            return self.limits_with_key
        return self.limits

    def api_key(self) -> str | None:
        return os.environ.get(self.key_env) if self.key_env else None

    def has_key(self) -> bool:
        return self.key_env is None or not self.key_required or bool(self.api_key())


@dataclass
class RouterConfig:
    quota_safety: float = 0.9
    cooldown_base_seconds: float = 60
    cooldown_max_seconds: float = 3600
    circuit_threshold: int = 5
    circuit_seconds: float = 1800
    cache_ttl_seconds: float = 300
    price_tolerance_pct: float = 1.0


@dataclass
class ProvidersFile:
    router: RouterConfig
    providers: dict[str, ProviderConfig]
    capabilities: dict[str, list[str]]


def load_yaml(name: str, base: Path = CONFIG_DIR) -> dict:
    with open(base / name, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_providers(base: Path = CONFIG_DIR) -> ProvidersFile:
    raw = load_yaml("providers.yaml", base)
    router = RouterConfig(**(raw.get("router") or {}))
    providers = {
        name: ProviderConfig(name=name, **(cfg or {}))
        for name, cfg in (raw.get("providers") or {}).items()
    }
    caps = {cap: list(order) for cap, order in (raw.get("capabilities") or {}).items()}
    for cap, order in caps.items():
        for p in order:
            if p not in providers:
                raise ValueError(f"capacidade '{cap}' cita provedor desconhecido '{p}'")
    return ProvidersFile(router, providers, caps)


def load_env_file(path: Path) -> None:
    """Carrega um .env simples (CHAVE=valor) sem sobrescrever o ambiente."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
