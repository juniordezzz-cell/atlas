"""Fusão Aero (21/10/2026 20:00 em Nova York = 22/10 00:00 UTC). A pool de
referência é a WETH/cbBTC CL1 0,0085% da Base (0x7c74…efa9): na DefiLlama
tinha 4.515,8% de apyReward às 23:07 UTC de 21/10 e 0 às 12:07 de 22/10."""

from datetime import datetime, timezone

from central_rwa.pools import conferencia as cf
from central_rwa.pools.coleta import encerrar_emissao_legado
from central_rwa.pools.descoberta import _dex
from central_rwa.pools.fontes import parse_gecko_pools, parse_llama
from central_rwa.pools.nota import PARTE_EMISSAO_PRESUMIDA, VE33, eficiencia, parte_emissao

ANTES = datetime(2026, 10, 21, 23, 7, tzinfo=timezone.utc)
DEPOIS = datetime(2026, 10, 22, 12, 7, tzinfo=timezone.utc)

# A linha da DefiLlama de 21/10 23:07 UTC (só o que é lido).
REFERENCIA = {"chain": "Base", "project": "aerodrome-slipstream", "symbol": "WETH-CBBTC",
              "poolMeta": "CL1 - 0.0085%", "tvlUsd": 3207747, "apyBase": 67.43653,
              "apyReward": 4515.81998, "volumeUsd1d": 19719256.27,
              "underlyingTokens": ["0x4200000000000000000000000000000000000006",
                                   "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"],
              "pool": "541b4974-e23b-4a7a-968f-6cfc027825de"}


def referencia():
    return parse_llama([REFERENCIA])[0]


def test_antes_da_fusao_a_emissao_continua_contando():
    c = referencia()
    assert encerrar_emissao_legado([c], ANTES) == 0
    assert c.apr_reward == REFERENCIA["apyReward"]
    assert eficiencia(c) == c.apr_reward / 365


def test_depois_da_fusao_a_pool_antiga_rende_so_a_taxa():
    c = referencia()
    assert encerrar_emissao_legado([c], DEPOIS) == 1
    assert c.apr_reward == 0.0
    assert c.sinais["emissao_encerrada"]
    taxa = c.fee * c.vol_24h / c.tvl
    assert eficiencia(c) == max(taxa, (c.apr or 0) / 365)
    assert eficiencia(c) < 1          # era 12,4%/dia com a emissão velha
    assert parte_emissao(c) == 0.0


def test_velodrome_da_gecko_sem_dado_nao_presume_emissao_depois_da_fusao():
    item = {"attributes": {"name": "WETH / USDC 0.04%", "address": "0xv", "reserve_in_usd": "191044",
                           "volume_usd": {"h24": "500000"}}, "relationships": {}}
    c = parse_gecko_pools({"data": [item]}, "Velodrome", "Optimism", "velodrome-finance-slipstream")[0]
    assert parte_emissao(c) == PARTE_EMISSAO_PRESUMIDA   # sem dado: presume
    encerrar_emissao_legado([c], DEPOIS)
    assert parte_emissao(c) == 0.0


def test_aero_nova_nao_tem_emissao_zerada_e_e_ve33():
    item = {"attributes": {"name": "cbBTC / WETH 0.05%", "address": "0xbb55", "reserve_in_usd": "2958295",
                           "volume_usd": {"h24": "1000000"}}, "relationships": {}}
    c = parse_gecko_pools({"data": [item]}, "Aero", "Base", "aero-slipstream-base")[0]
    encerrar_emissao_legado([c], DEPOIS)
    assert c.apr_reward is None and "emissao_encerrada" not in c.sinais
    assert "Aero" in VE33


def test_aero_da_defillama_entra_quando_for_listada():
    linha = dict(REFERENCIA, project="aero-slipstream", apyReward=0)
    c = parse_llama([linha])[0]
    assert c.dex == "Aero"


def test_descoberta_reconhece_aero_sem_confundir_com_aerodrome():
    assert _dex("aero-slipstream-base") == "Aero"
    assert _dex("aero-volatile-base") == "Aero"
    assert _dex("aerodrome-slipstream-3") == "Aerodrome"


def test_conferencia_casa_familia_inteira():
    assert cf._mesma_dex("aero-slipstream", "aero-slipstream-base")
    assert not cf._mesma_dex("aero-slipstream", "aerodrome-slipstream-3")
    assert not cf._mesma_dex("aero-slipstream", "aerodrome-base")
    # a v1 é "aerodrome-base" na GeckoTerminal e agora é conferida
    assert cf._mesma_dex("aerodrome-v1", "aerodrome-base")
    assert not cf._mesma_dex("aerodrome-v1", "aerodrome-slipstream")
    assert cf._mesma_dex("aerodrome-slipstream", "aerodrome-slipstream-3")
    assert not cf._mesma_dex("aerodrome-slipstream", "aerodrome-base")
    # o resto segue como antes
    assert cf._mesma_dex("uniswap-v3", "uniswap_v3_optimism")
    assert cf._mesma_dex("meteora-dlmm", "meteora")
    assert not cf._mesma_dex("uniswap-v4", "uniswap-v3-base")
