from datetime import datetime, timezone

from central_rwa.pools.classificacao import passa_pre_corte, trilho
from central_rwa.pools.modelos import Candidata, TokenRef

NOW = datetime(2026, 9, 26, tzinfo=timezone.utc)


def pool(r=1, meme=False):
    return Candidata('gecko:base:0xpool', 'geckoterminal', 'Base', 'Uniswap', 'UNI/WETH',
                     TokenRef('0xuni', 'UNI'), TokenRef('0xeth', 'WETH'),
                     0.05, 100_000, 100_000*r, None, None, None,
                     sinais={'memecoin': {'detectada': meme, 'fonte': 'coingecko:meme-token'}})


def test_corte_razao_inclusivo_com_tvl_minimo():
    assert not passa_pre_corte(pool(0.50))
    assert passa_pre_corte(pool(0.500001))
    assert passa_pre_corte(pool(1.54))  # razão elegível com TVL mínimo


def test_dados_incompletos_nao_significam_meme():
    assert trilho(pool(), [None, None], [], NOW)[0] == 'solida'


def test_meme_so_pendente_acima_de_dois():
    assert trilho(pool(2, True), [None, None], [], NOW)[0] == 'barrada'
    assert trilho(pool(2.000001, True), [None, None], [], NOW)[0] == 'caca'


def test_segunda_fonte_incompleta_nao_muda_trilho():
    p = pool()
    p.sinais['conferencia'] = {'estado': 'nao_confirmada'}
    assert trilho(p, [None, None], [], NOW)[0] == 'solida'


def test_tvl_minimo_obrigatorio_inclusive():
    p = pool(100)
    for tvl in (0, 0.22, 1, 22, 41, 800, 1000, 99999.99):
        p.tvl, p.vol_24h = tvl, 10_000_000
        assert not passa_pre_corte(p)
    p.tvl, p.vol_24h = 100_000, 100_000
    assert passa_pre_corte(p)
