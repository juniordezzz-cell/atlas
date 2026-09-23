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
