from central_rwa.pools.fontes_diretas import parse_orca, parse_raydium
from central_rwa.pools.fontes import ClienteFontes
import httpx
import respx


def test_orca_converte_taxa_em_basis_points_e_volume_24h():
    row = {
        "address": "orca-pool", "tvlUsdc": "400000", "feeRate": 400,
        "tokenA": {"address": "mint-a", "symbol": "SOL"},
        "tokenB": {"address": "mint-b", "symbol": "USDC"},
        "stats": {"24h": {"volume": "900000"}, "7d": {"volume": "3500000"}},
    }
    pool = parse_orca([row])[0]
    assert pool.id == "gecko:solana:orca-pool"
    assert pool.dex == "Orca" and pool.fee == 0.04
    assert pool.vol_24h == 900000 and pool.vol_7d == 3500000
    assert pool.token_a.endereco == "mint-a"


def test_raydium_converte_taxa_fracionaria_e_descarta_pool_sem_id():
    row = {
        "id": "ray-pool", "tvl": 300000, "feeRate": 0.0025,
        "mintA": {"address": "mint-a", "symbol": "SOL"},
        "mintB": {"address": "mint-b", "symbol": "USDC"},
        "day": {"volume": 600000, "feeApr": 24},
        "week": {"volume": 2200000},
    }
    pools = parse_raydium([row, {**row, "id": ""}])
    assert len(pools) == 1
    assert pools[0].id == "gecko:solana:ray-pool"
    assert pools[0].fee == 0.25 and pools[0].apr == 24


def test_fonte_direta_sem_volume_nao_inventa_o_dado():
    row = {
        "address": "orca-empty", "tvlUsdc": 400000, "feeRate": 100,
        "tokenA": {"address": "a", "symbol": "A"},
        "tokenB": {"address": "b", "symbol": "B"},
    }
    assert parse_orca([row])[0].vol_24h == 0


@respx.mock
def test_orca_segue_cursor_e_para_na_ultima_pagina():
    route = respx.get('https://api.orca.so/v2/solana/pools').mock(side_effect=[
        httpx.Response(200, json={'data': [{'address': 'a'}], 'meta': {'cursor': {'next': 'cursor-2'}}}),
        httpx.Response(200, json={'data': [{'address': 'b'}], 'meta': {'cursor': {'next': None}}}),
    ])
    cli = ClienteFontes()
    assert [r['address'] for r in cli.orca_pools()] == ['a', 'b']
    assert route.calls[1].request.url.params['next'] == 'cursor-2'
    assert cli.parciais == []


@respx.mock
def test_raydium_para_ao_cruzar_piso_de_tvl():
    route = respx.get('https://api-v3.raydium.io/pools/info/list').mock(return_value=httpx.Response(200, json={
        'success': True, 'data': {'data': [{'tvl': 200000}, {'tvl': 90000}], 'hasNextPage': True},
    }))
    cli = ClienteFontes()
    assert len(cli.raydium_pools()) == 2
    assert route.call_count == 1
    assert cli.parciais == []
