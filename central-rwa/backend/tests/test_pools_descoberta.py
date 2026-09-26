from central_rwa.pools.descoberta import complementar
from tests.test_pools_regras_20260926 import pool, NOW


def item(address, fee, tvl, vol):
    return {'attributes': {'address': address, 'name': f'UNI / WETH {fee}%',
                           'reserve_in_usd': tvl, 'volume_usd': {'h24': vol}},
            'relationships': {'base_token': {'data': {'id': 'base_0xuni'}},
                              'quote_token': {'data': {'id': 'base_0xeth'}},
                              'dex': {'data': {'id': 'uniswap-v3-base'}}}}


def test_descobre_taxas_diferentes_sem_duplicar_pool_mesma_taxa():
    p = pool(.2)
    p.id = 'llama:uni'
    p.fonte = 'defillama'
    p.projeto = 'uniswap-v3'
    p.fee = 1
    p.tvl = 300000
    class Cli:
        def token_pools(self, net, endereco, paginas):
            assert net == 'base'
            return [item('0xexisting', 1, 300000, 60000), item('0xnew', .05, 750, 1155)]
    rows, status = complementar(Cli(), [p], NOW)
    assert len(rows) == 2
    assert rows[0].id == 'llama:uni'
    assert rows[0].sinais['endereco_pool'] == '0xexisting'
    assert rows[1].fee == .05 and rows[1].tvl == 750
    assert status['adicionadas'] == 1


def test_simbolos_iguais_contratos_diferentes_nao_fundem():
    p = pool()
    p.fonte = 'defillama'
    p.projeto = 'uniswap-v3'
    p.token_a.endereco = '0xoutro_uni'
    class Cli:
        def token_pools(self, net, endereco, paginas):
            return [item('0xexisting', .05, 750, 1155)]
    rows, _ = complementar(Cli(), [p], NOW)
    assert len(rows) == 2
    assert 'endereco_pool' not in p.sinais


def test_descoberta_falha_aparece_no_status_sem_pendentes():
    from central_rwa.pools.coleta import coletar
    from central_rwa.pools.repositorio import MemoryPoolStore
    from tests.test_pools_coleta import FakeCliente
    class Cli(FakeCliente):
        def llama_pools(self):
            return []
        def gecko_pools(self, net, dex, paginas):
            return []
        def token_pools(self, net, endereco, paginas):
            self.parciais.append('descoberta: sem dados')
            return []
    store = MemoryPoolStore()
    coletar(Cli(), store, NOW)
    assert next(s for s in store.status if s['fonte'] == 'descoberta')['estado'] == 'parcial'
