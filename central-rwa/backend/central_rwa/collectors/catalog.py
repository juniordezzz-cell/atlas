"""Catálogo de ativos tokenizados: une a API do emissor (xStocks) com as
categorias da CoinGecko, aplica os overrides manuais e grava tokens + ativos
de referência."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..config import load_yaml
from ..db import Repository
from ..mapping import CONF_OVERRIDE, CONF_SUFFIX_KNOWN, MIN_CONFIDENCE_TIER_A
from ..models import TokenListing
from ..reference import ReferenceRegistry
from ..router import NoProviderAvailable, Router


@dataclass
class CatalogResult:
    tokens: int = 0
    by_source: dict[str, int] = field(default_factory=dict)
    by_network: dict[str, int] = field(default_factory=dict)
    low_confidence: list[str] = field(default_factory=list)
    low_confidence_total: int = 0
    unmapped: int = 0
    errors: list[str] = field(default_factory=list)


def merge(listings: list[TokenListing]) -> dict[tuple[str, str], TokenListing]:
    """Um token por (rede, endereço): fica o mapeamento de maior confiança."""
    best: dict[tuple[str, str], TokenListing] = {}
    for l in listings:
        key = (l.network, l.address)
        if key not in best or l.mapping_confidence > best[key].mapping_confidence:
            best[key] = l
    return best


def corroborate(merged: dict[tuple[str, str], TokenListing]) -> None:
    """Sufixo mapeado para um ticker que OUTRO emissor também aponta → confiança sobe
    (ex.: Ondo "TSLAON"→TSLA e Robinhood "TSLA"→TSLA)."""
    issuers_by_ticker: dict[str, set[str]] = {}
    for l in merged.values():
        if l.reference_ticker:
            issuers_by_ticker.setdefault(l.reference_ticker, set()).add(l.issuer)
    for key, l in merged.items():
        if l.mapping_origin == "sufixo" and l.mapping_confidence < CONF_SUFFIX_KNOWN and len(issuers_by_ticker.get(l.reference_ticker, ())) >= 2:
            merged[key] = l.model_copy(update={"mapping_confidence": CONF_SUFFIX_KNOWN, "mapping_origin": "sufixo+outro_emissor"})


def apply_overrides(merged: dict[tuple[str, str], TokenListing], overrides: dict) -> None:
    for key, ov in (overrides or {}).items():
        net, _, addr = key.partition(":")
        k = (net, addr)
        if ov.get("ignore"):
            merged.pop(k, None)
            continue
        base = merged.get(k)
        merged[k] = TokenListing(
            issuer=ov.get("issuer") or (base.issuer if base else "varios"),
            network=net,
            address=addr,
            symbol=ov.get("symbol") or (base.symbol if base else "?"),
            name=ov.get("name") or (base.name if base else None),
            reference_ticker=ov["reference_ticker"],
            asset_class=ov.get("asset_class") or (base.asset_class if base else None),
            mapping_confidence=CONF_OVERRIDE,
            mapping_origin="override",
            source=base.source if base else "override",
        )


def run_catalog(router: Router, repo: Repository, registry: ReferenceRegistry) -> CatalogResult:
    result = CatalogResult()
    listings: list[TokenListing] = []

    try:
        xs, _ = router.call("catalog_issuer", "catalog", cache=False)
        listings += xs
    except NoProviderAvailable as e:
        result.errors.append(str(e))

    known = registry.known_tickers() | {l.reference_ticker for l in listings if l.reference_ticker}
    for rule in load_yaml("catalog.yaml").get("categories") or []:
        try:
            found, _ = router.call("catalog_category", "catalog_category", rule, known, cache=False)
            listings += found
        except NoProviderAvailable as e:
            result.errors.append(f"{rule['id']}: {e}")

    merged = merge(listings)
    corroborate(merged)
    apply_overrides(merged, load_yaml("mapping_overrides.yaml").get("overrides"))

    final: list[TokenListing] = []
    low: list[str] = []
    for l in merged.values():
        if l.reference_ticker:
            asset = registry.get(l.reference_ticker, l.asset_class)
            l = l.model_copy(update={"asset_class": asset.asset_class})
        else:
            result.unmapped += 1
        if l.reference_ticker and l.mapping_confidence < MIN_CONFIDENCE_TIER_A:
            low.append(f"{l.issuer}:{l.symbol}→{l.reference_ticker} ({l.mapping_confidence:.1f}, {l.mapping_origin})")
        final.append(l)
        src = l.source.split(":")[0]
        result.by_source[src] = result.by_source.get(src, 0) + 1
        result.by_network[l.network] = result.by_network.get(l.network, 0) + 1

    # Um item por símbolo (o mesmo token em várias redes aparece uma vez só).
    low = sorted(set(low))
    result.low_confidence = low[:40] + ([f"... e mais {len(low) - 40}"] if len(low) > 40 else [])
    result.low_confidence_total = len(low)

    tickers = {l.reference_ticker for l in final if l.reference_ticker}
    repo.ensure_reference_assets([registry.get(t) for t in sorted(tickers)])
    result.tokens = repo.upsert_tokens(final)
    return result
