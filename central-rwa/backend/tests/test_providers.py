"""Normalização de cada adaptador, com respostas REAIS capturadas nas sondas de 2026-09-19."""

from __future__ import annotations

import httpx
import pytest
import respx

from central_rwa.config import ProviderConfig
from central_rwa.providers.coingecko import CoinGecko
from central_rwa.providers.defillama import DefiLlama
from central_rwa.providers.dexscreener import DexScreener
from central_rwa.providers.geckoterminal import GeckoTerminal
from central_rwa.providers.treasury import Treasury, parse_csv
from central_rwa.providers.xstocks import XStocks
from central_rwa.router import NotSupported, ProviderError, RateLimited

from .conftest import fixture_json, fixture_text

NVDAX_SOL = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"


def prov(cls, **cfg):
    return cls(ProviderConfig(name=cls.name, **cfg), httpx.Client())


@respx.mock
def test_dexscreener_agrega_pares():
    respx.get(f"https://api.dexscreener.com/tokens/v1/solana/{NVDAX_SOL}").respond(json=fixture_json("dexscreener_nvdax_solana.json"))
    [q] = prov(DexScreener).token_quotes("solana", [NVDAX_SOL])
    assert q.address == NVDAX_SOL and q.source == "dexscreener"
    assert 200 < q.price_usd < 250
    assert q.liquidity_usd > 1_000_000 and q.volume_24h_usd > 0


def test_dexscreener_rede_nao_suportada():
    with pytest.raises(NotSupported):
        prov(DexScreener).token_quotes("tron", ["x"])


@respx.mock
def test_dexscreener_429_vira_ratelimited():
    respx.get(f"https://api.dexscreener.com/tokens/v1/solana/{NVDAX_SOL}").respond(429, headers={"retry-after": "30"})
    with pytest.raises(RateLimited) as e:
        prov(DexScreener).token_quotes("solana", [NVDAX_SOL])
    assert e.value.retry_after == 30


@respx.mock
def test_dexscreener_500_vira_providererror():
    respx.get(f"https://api.dexscreener.com/tokens/v1/solana/{NVDAX_SOL}").respond(500)
    with pytest.raises(ProviderError):
        prov(DexScreener).token_quotes("solana", [NVDAX_SOL])


@respx.mock
def test_geckoterminal_normaliza():
    respx.get(f"https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/{NVDAX_SOL}").respond(
        json=fixture_json("geckoterminal_nvdax_solana.json")
    )
    [q] = prov(GeckoTerminal).token_quotes("solana", [NVDAX_SOL])
    assert 200 < q.price_usd < 250 and q.liquidity_usd > 0 and q.source == "geckoterminal"


@respx.mock
def test_defillama_normaliza():
    respx.get(f"https://coins.llama.fi/prices/current/solana:{NVDAX_SOL}").respond(json=fixture_json("defillama_nvdax_solana.json"))
    [q] = prov(DefiLlama).token_quotes("solana", [NVDAX_SOL])
    assert q.address == NVDAX_SOL and 200 < q.price_usd < 250 and q.volume_24h_usd is None


@respx.mock
def test_xstocks_catalogo_mapeia_underlying_com_confianca_maxima():
    respx.get("https://api.xstocks.fi/api/v2/public/assets").respond(json=fixture_json("xstocks_assets_page.json"))
    listings = prov(XStocks).catalog()
    assert listings
    assert {l.network for l in listings} <= {"solana", "ethereum", "bnb_chain"}
    assert all(l.reference_ticker and l.mapping_confidence == 1.0 and l.issuer == "xstocks" for l in listings)
    evm = [l for l in listings if l.network == "ethereum"]
    assert all(l.address == l.address.lower() for l in evm)


@respx.mock
def test_coingecko_categoria_por_sufixo():
    respx.get("https://api.coingecko.com/api/v3/coins/markets").respond(json=fixture_json("coingecko_markets_ondo.json"))
    respx.get("https://api.coingecko.com/api/v3/coins/list").respond(
        json=[
            {"id": "alphabet-class-a-ondo-tokenized-stock", "platforms": {"ethereum": "0xABC", "tron": "T123"}},
            {"id": "meta-platforms-ondo-tokenized-stock", "platforms": {"solana": "MetaSo1"}},
        ]
    )
    rule = {"id": "ondo-tokenized-assets", "issuer": "ondo", "rule": "suffix", "suffix": "on"}
    out = prov(CoinGecko, key_env="CG", key_required=False).catalog_category(rule, known_tickers={"GOOGL"})
    by_sym = {l.symbol: l for l in out}
    assert by_sym["GOOGLON"].reference_ticker == "GOOGL" and by_sym["GOOGLON"].mapping_confidence == 0.8
    assert by_sym["GOOGLON"].address == "0xabc"  # EVM normalizado
    assert by_sym["METAON"].reference_ticker == "META" and by_sym["METAON"].mapping_confidence == 0.5
    assert all(l.network != "tron" for l in out)


def test_treasury_csv():
    rates = parse_csv(fixture_text("treasury_bills_2026.csv"), "treasury")
    tenors = {r.tenor for r in rates}
    assert {"4w", "13w", "26w", "52w"} <= tenors
    assert all(0 < r.rate < 20 for r in rates)
    assert max(r.day for r in rates).isoformat() == "2026-09-18"


@respx.mock
def test_treasury_provider_baixa_o_ano():
    respx.get(url__regex=r"https://home\.treasury\.gov/.*daily-treasury-rates\.csv/2026/all.*").respond(
        text=fixture_text("treasury_bills_2026.csv")
    )
    rates = prov(Treasury).tbill_rates(2026)
    assert len(rates) > 10
