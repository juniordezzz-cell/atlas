from datetime import datetime, timezone

import httpx
import respx

from central_rwa.pools.fontes import ClienteFontes
from central_rwa.pools.modelos import TokenInfo
from central_rwa.pools.memes import identificar
from tests.test_pools_regras_20260926 import pool


def test_identifica_por_id_associado_ao_contrato_nao_simbolo():
    p = pool()
    now = datetime.now(timezone.utc)
    i = TokenInfo('Base', '0xuni', 'UNI', False, False, False, None, None,
                  'dogecoin', None, None, now)
    identificar(p, [i, None], {'dogecoin'})
    assert p.sinais['memecoin']['detectada'] is True
    assert p.sinais['memecoin']['ids'] == ['dogecoin']
    identificar(p, [None, None], {'dogecoin'})
    assert p.sinais['memecoin']['detectada'] is False
    assert p.sinais['memecoin']['estado'] == 'sem_identificacao'


@respx.mock
def test_categoria_pagina_e_registra_falha_parcial():
    route = respx.get('https://api.coingecko.com/api/v3/coins/markets').mock(side_effect=[
        httpx.Response(200, json=[{'id': 'dogecoin'}]*250),
        httpx.Response(429), httpx.Response(429), httpx.Response(429),
    ])
    cli = ClienteFontes(sleep=lambda _: None)
    assert 'dogecoin' in cli.meme_coin_ids()
    assert route.call_count == 4          # 1 página + 3 tentativas na recusada
    assert any('memecoin' in s for s in cli.parciais)
    assert cli.meme_cobertura_ate == 'dogecoin'


@respx.mock
def test_categoria_espera_e_tenta_de_novo_no_429():
    esperas = []
    respx.get('https://api.coingecko.com/api/v3/coins/markets').mock(side_effect=[
        httpx.Response(200, json=[{'id': 'aaa'}]*250),
        httpx.Response(429),
        httpx.Response(200, json=[{'id': 'zzz-meme'}]),
    ])
    cli = ClienteFontes(sleep=esperas.append)
    ids = cli.meme_coin_ids()
    assert 'zzz-meme' in ids
    assert cli.parciais == []
    assert cli.meme_cobertura_ate is None
    assert 30 in esperas


def test_lista_incompleta_nao_vira_solida():
    from central_rwa.pools.classificacao import trilho
    now = datetime.now(timezone.utc)
    p = pool()
    depois = TokenInfo('Base', '0xz', 'ZZZ', False, False, False, None, None,
                       'zzz-token', None, None, now)
    identificar(p, [depois, None], {'dogecoin'}, cobertura_ate='mmm')
    assert p.sinais['memecoin']['estado'] == 'nao_verificada'
    assert p.sinais['memecoin']['detectada'] is False
    assert trilho(p, [None, None], [], now)[0] == 'caca'
    antes = TokenInfo('Base', '0xa', 'AAA', False, False, False, None, None,
                      'aaa-token', None, None, now)
    identificar(p, [antes, None], {'dogecoin'}, cobertura_ate='mmm')
    assert p.sinais['memecoin']['estado'] == 'nao_detectada'
    identificar(p, [depois, None], {'dogecoin'})   # lista completa
    assert p.sinais['memecoin']['estado'] == 'nao_detectada'


@respx.mock
def test_categoria_completa_e_endpoint_por_contrato():
    respx.get('https://api.coingecko.com/api/v3/coins/markets').respond(json=[{'id': 'meme-id-novo'}])
    route = respx.get('https://api.geckoterminal.com/api/v2/networks/base/tokens/0xuni/pools').respond(json={'data': [{'id': 'base_0xpool'}]})
    cli = ClienteFontes(sleep=lambda _: None)
    assert 'meme-id-novo' in cli.meme_coin_ids()
    assert cli.token_pools('base', '0xuni') == [{'id': 'base_0xpool'}]
    assert route.calls.last.request.url.params['page'] == '1'
    assert cli.parciais == []
