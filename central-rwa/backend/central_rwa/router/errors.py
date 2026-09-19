from __future__ import annotations


class ProviderError(Exception):
    """Falha de um provedor. O roteador conta como falha e tenta o próximo."""

    def __init__(self, provider: str, message: str):
        super().__init__(f"[{provider}] {message}")
        self.provider = provider


class RateLimited(ProviderError):
    """O provedor respondeu 429 / bloqueio. Entra em cooldown."""

    def __init__(self, provider: str, retry_after: float | None = None, message: str = "limite atingido"):
        super().__init__(provider, message)
        self.retry_after = retry_after


class NotSupported(Exception):
    """O provedor não atende este pedido (ex.: rede que ele não cobre).
    Não é falha: o roteador só passa para o próximo, sem penalizar."""


class QuotaExhausted(Exception):
    """A cota local do provedor acabou nesta janela. O roteador para ANTES de
    estourar o limite real e passa para o próximo."""

    def __init__(self, provider: str, window: str):
        super().__init__(f"[{provider}] cota esgotada na janela '{window}'")
        self.provider = provider
        self.window = window


class NoProviderAvailable(Exception):
    def __init__(self, capability: str, attempts: list[tuple[str, str]]):
        detail = "; ".join(f"{p}: {r}" for p, r in attempts) or "nenhum provedor configurado"
        super().__init__(f"Nenhum provedor disponível para '{capability}' ({detail})")
        self.capability = capability
        self.attempts = attempts
