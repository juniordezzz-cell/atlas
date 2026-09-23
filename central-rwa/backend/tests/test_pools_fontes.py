from central_rwa.pools import config


def test_nomes_de_projeto_e_taxa():
    assert config.pretty_project("pancakeswap-amm-v3") == "PancakeSwap"
    assert config.pretty_project("aerodrome-slipstream") == "Aerodrome"
    assert config.parse_llama_fee("0.3%", "uniswap-v3") == 0.3
    assert config.parse_llama_fee("25%", "cetus-clmm") == 0.25      # Cetus escreve em pontos-base
    assert config.parse_llama_fee(None, "uniswap-v2") == 0.3        # taxa fixa de v2
    assert config.parse_llama_fee(None, "curve-dex") == 0            # desconhecida = 0
    assert config.LLAMA_CHAINS["BSC"] == "BNB Chain"
    assert config.GECKO_NET["BNB Chain"] == "bsc"


# ---- Task 2: leitura das fontes (parse puro) ----
from datetime import datetime, timezone

from central_rwa.pools import fontes
from tests.conftest import fixture_json

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


def test_parse_llama_mantem_so_minhas_redes_e_dexes():
    rows = fixture_json("llama_pools_sample.json")["data"]
    cands = fontes.parse_llama(rows)
    assert cands, "a amostra tem pools de Uniswap/Aerodrome em Base"
    c = next(x for x in cands if x.par == "WETH/USDC" and x.rede == "Base")
    assert c.id.startswith("llama:")
    assert c.dex == "Uniswap" and c.fee == 0.3
    assert c.token_a.endereco == "0x4200000000000000000000000000000000000006"
    assert c.tvl > 1e8 and c.vol_24h > 0
    assert all(x.dex in fontes.config.LLAMA_PROJECTS for x in cands)


def test_parse_gecko_tira_taxa_do_nome_e_guarda_sinais():
    cands = fontes.parse_gecko_pools(fixture_json("gt_pools_pancake_v3_bsc.json"), "PancakeSwap", "BNB Chain")
    c = cands[0]
    assert c.par == "USDT/WBNB" and c.fee == 0.01
    assert c.id == "gecko:bsc:" + c.id.split(":")[2] and c.id.split(":")[2].startswith("0x")
    assert c.token_a.endereco == "0x55d398326f99059ff775485246999027b3197955"
    assert c.token_b.endereco == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
    assert c.tvl > 1e6 and c.vol_24h > 1e6 and c.vol_7d is None
    assert c.criada_em.year == 2025
    assert c.sinais["compradores_24h"] > 0 and "variacao_24h" in c.sinais


def test_parse_token_info():
    t = fontes.parse_token_info(fixture_json("gt_token_info_wbnb.json"), "BNB Chain", AGORA)
    assert t.simbolo == "WBNB" and t.coingecko_id == "wbnb"
    assert t.honeypot is False and not t.mint_ativo and not t.freeze_ativo
    assert t.holders > 1_000_000


def test_parse_tokens_multi_da_market_cap():
    mc = fontes.parse_tokens_multi(fixture_json("gt_tokens_multi_bsc.json"))
    assert mc["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"] > 1e9


def test_normalizar_par():
    assert fontes.normalizar_par("WETH - USDC") == "ETH/USDC"
    assert fontes.normalizar_par("usdt/wbnb") == "USDT/BNB"


# ---- Task 3: cliente HTTP com o limite da GeckoTerminal ----
import httpx
import respx


@respx.mock
def test_gecko_espaca_chamadas_e_repete_em_429():
    dormiu: list[float] = []
    rota = respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/dexes/x/pools").mock(side_effect=[
        httpx.Response(429),
        httpx.Response(200, json={"data": [{"attributes": {"name": "A / B"}}] * 20}),
        httpx.Response(200, json={"data": [{"attributes": {"name": "C / D"}}]}),
    ])
    cli = fontes.ClienteFontes(sleep=dormiu.append, relogio=lambda: 0.0)
    itens = cli.gecko_pools("bsc", "x", paginas=5)
    assert len(itens) == 21            # página 1 (repetida) + página 2 curta = fim
    assert rota.call_count == 3
    assert 15 in dormiu                # esperou por causa do 429
    assert cli.parciais == []


@respx.mock
def test_gecko_falha_vira_parcial_sem_derrubar():
    respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/dexes/x/pools").mock(return_value=httpx.Response(500))
    cli = fontes.ClienteFontes(sleep=lambda s: None, relogio=lambda: 0.0)
    assert cli.gecko_pools("bsc", "x", paginas=3) == []
    assert cli.parciais and "bsc/x" in cli.parciais[0]


@respx.mock
def test_token_info_404_devolve_none():
    respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/tokens/0xabc/info").mock(return_value=httpx.Response(404))
    cli = fontes.ClienteFontes(sleep=lambda s: None, relogio=lambda: 0.0)
    assert cli.token_info("bsc", "0xabc") is None
