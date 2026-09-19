"""Snapshots de preço/volume/liquidez dos tokens, com validação cruzada.

Para cada rede: a 1ª fonte disponível responde; os tokens que ela não trouxe
são pedidos às próximas; depois uma fonte DIFERENTE confirma o preço.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from ..db import Repository, SnapshotRow, TokenRow
from ..models import TokenQuote
from ..networks import normalize_address
from ..router import NoProviderAvailable, Router


@dataclass
class SnapshotResult:
    requested: int = 0
    saved: int = 0
    confirmed: int = 0  # >= 2 fontes concordando
    divergent: list[str] = field(default_factory=list)
    missing_total: int = 0  # tokens sem preço em nenhuma fonte (sem pool/listagem)
    missing: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _collect(
    router: Router, network: str, addresses: list[str], exclude: tuple[str, ...] = (), max_providers: int | None = None
) -> tuple[dict[str, TokenQuote], tuple[str, ...]]:
    """Busca até cobrir todos os endereços, acabarem os provedores ou atingir max_providers."""
    got: dict[str, TokenQuote] = {}
    used = exclude
    pending = list(addresses)
    while pending and (max_providers is None or len(used) - len(exclude) < max_providers):
        try:
            quotes, prov = router.call("token_price", "token_quotes", network, pending, exclude=used, cache=False)
        except NoProviderAvailable:
            break
        used += (prov,)
        for q in quotes:
            got.setdefault(normalize_address(network, q.address), q)
        pending = [a for a in pending if normalize_address(network, a) not in got]
    return got, used[len(exclude):]


def snapshot_tokens(
    router: Router,
    repo: Repository,
    tokens: list[TokenRow],
    tier: str,
    ts: datetime,
    tolerance_pct: float,
    max_providers: int | None = None,
    confirm_min_usd: float = 0.0,
) -> SnapshotResult:
    """max_providers limita quantas fontes tentam os tokens que faltam; confirm_min_usd
    restringe a validação cruzada aos tokens com liquidez/volume relevante
    (a camada B tem milhares de tokens e as fontes de reserva têm limite baixo)."""
    res = SnapshotResult(requested=len(tokens))
    by_net: dict[str, list[TokenRow]] = defaultdict(list)
    for t in tokens:
        by_net[t.network].append(t)

    rows: list[SnapshotRow] = []
    for network, toks in by_net.items():
        addrs = [t.address for t in toks]
        primary, used = _collect(router, network, addrs, max_providers=max_providers)
        found = [
            a
            for a in addrs
            if (q := primary.get(normalize_address(network, a)))
            and max(q.liquidity_usd or 0, q.volume_24h_usd or 0) >= confirm_min_usd
        ]
        # confirmação por uma fonte diferente das que já responderam
        confirm: dict[str, TokenQuote] = {}
        if found:
            confirm, _ = _collect(router, network, found, exclude=used, max_providers=1)
        for t in toks:
            key = normalize_address(network, t.address)
            q = primary.get(key)
            if not q:
                res.missing.append(f"{network}:{t.symbol}")
                continue
            c = confirm.get(key)
            div = abs(c.price_usd - q.price_usd) / q.price_usd * 100 if c else None
            ok = div is not None and div <= tolerance_pct
            if div is not None and not ok:
                res.divergent.append(f"{network}:{t.symbol} {q.source}={q.price_usd:.4g} vs {c.source}={c.price_usd:.4g} ({div:.1f}%)")
            res.confirmed += int(ok)
            rows.append(
                SnapshotRow(
                    token_id=t.id,
                    ts=ts,
                    price_usd=q.price_usd,
                    volume_24h_usd=q.volume_24h_usd,
                    liquidity_usd=q.liquidity_usd,
                    source=q.source,
                    sources_confirmed=2 if ok else 1,
                    divergence_pct=round(div, 3) if div is not None else None,
                    tier=tier,
                )
            )
    res.saved = repo.insert_snapshots(rows)
    res.rows = rows  # fora dos campos do dataclass: não vai para o resumo
    res.missing_total = len(res.missing)
    res.missing = _cap(res.missing, 30)
    res.divergent = _cap(res.divergent, 40)
    return res


def _cap(items: list[str], n: int) -> list[str]:
    return items[:n] + ([f"... e mais {len(items) - n}"] if len(items) > n else [])
