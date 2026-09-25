"""Conferência em segunda fonte. O primeiro caso é o incidente de 24/09/2026:
a DefiLlama deu US$ 16,15 M de volume e 0,18% de taxa para uma pool que, na
Uniswap e na GeckoTerminal, fazia US$ 366 mil e cobrava 0,15%."""

from datetime import datetime, timezone

from central_rwa.pools import conferencia as cf
from central_rwa.pools.classificacao import trilho
from central_rwa.pools.coleta import coletar
from central_rwa.pools.modelos import Candidata, TokenRef
from central_rwa.pools.repositorio import MemoryPoolStore
from tests.test_pools_coleta import FakeCliente

AGORA = datetime(2026, 9, 24, 23, tzinfo=timezone.utc)


def gecko_item(nome, dex, tvl, vol, endereco="0xabc"):
    """Uma pool no formato de /search/pools da GeckoTerminal (só o que é lido)."""
    return {"attributes": {"name": nome, "address": endereco, "reserve_in_usd": str(tvl),
                           "volume_usd": {"h24": str(vol)}},
            "relationships": {"dex": {"data": {"id": dex}}}}


# As pools USDC/cbBTC da Base como a GeckoTerminal devolveu em 24/09/2026.
BUSCA_USDC_CBBTC = {"data": [
    gecko_item("cbBTC / USDC 0.05%", "uniswap-v3-base", 8275179, 11891524, "0xfbb6"),
    gecko_item("cbBTC / USDC 0.05%", "uniswap-v4-base", 4699313, 5294945, "0x12d7"),
    gecko_item("cbBTC / USDC 0.3%", "uniswap-v3-base", 1916888, 590892, "0xec55"),
    gecko_item("USDC / cbBTC 0.15%", "uniswap-v4-base", 1308402, 366182, "0xf97d"),
    gecko_item("cbBTC / USDC 0.05%", "aerodrome-slipstream-3", 5105571, 32541463, "0x160d"),
]}


def llama(projeto, fee, tvl, vol, apr=None, par="USDC/CBBTC", dex="Uniswap"):
    return Candidata(id=f"llama:{projeto}:{fee}", fonte="defillama", rede="Base", dex=dex, par=par,
                     token_a=TokenRef(None, par.split("/")[0]), token_b=TokenRef(None, par.split("/")[1]),
                     fee=fee, tvl=tvl, vol_24h=vol, vol_7d=None, apr=apr, apr_reward=None, projeto=projeto)


def test_incidente_volume_inflado_e_taxa_errada_sao_corrigidos():
    c = llama("uniswap-v4", 0.18, 1308244, 16147164.55, apr=793.79)
    cf.aplicar(c, cf.casar(c, cf.parse_busca(BUSCA_USDC_CBBTC)))
    assert c.sinais["conferencia"]["estado"] == "conferida"
    assert c.sinais["conferencia"]["endereco"] == "0xf97d"
    assert c.fee == 0.15                                   # a taxa on-chain
    assert c.vol_24h == 366182                             # o menor dos dois
    assert abs(c.apr - 366182 * 0.15 / 100 * 365 / 1308244 * 100) < 1e-9   # ~15%, não 793%
    assert len(c.sinais["conferencia"]["ajustes"]) == 2


def test_aerodrome_taxa_dinamica_nao_e_trocada_pela_do_nome():
    # 24/09/2026: GeckoTerminal "AERO / cbBTC 0.6%"; a taxa efetiva era 0,075%
    c = llama("aerodrome-slipstream", 0.075, 1646725, 7490166, par="AERO/CBBTC", dex="Aerodrome")
    g = cf.PoolGecko(dex="aerodrome-slipstream", fee=0.6, tvl=1649672, vol_24h=7558738, endereco="0xdfe5")
    cf.aplicar(c, g)
    assert c.fee == 0.075 and c.sinais["conferencia"]["estado"] == "conferida"


def test_versao_da_dex_tem_de_bater():
    # v3 0,05% de 8,3 M casa com a v3, não com a v4 de 4,7 M nem com a Aerodrome
    c = llama("uniswap-v3", 0.05, 8301761, 11936254)
    g = cf.casar(c, cf.parse_busca(BUSCA_USDC_CBBTC))
    assert g is not None and g.endereco == "0xfbb6"


def test_volumes_parecidos_ficam_como_estao():
    c = llama("uniswap-v3", 0.05, 8301761, 11936254, apr=10.2)
    cf.aplicar(c, cf.casar(c, cf.parse_busca(BUSCA_USDC_CBBTC)))
    assert c.vol_24h == 11936254 and c.fee == 0.05 and c.apr == 10.2
    assert c.sinais["conferencia"]["ajustes"] == []


def test_sem_par_na_segunda_fonte_vira_caca():
    c = llama("uniswap-v4", 0.30, 3_000_000, 900_000)   # TVL que nenhuma pool da busca tem
    cf.aplicar(c, cf.casar(c, cf.parse_busca(BUSCA_USDC_CBBTC)))
    assert c.sinais["conferencia"]["estado"] == "nao_confirmada"
    t, motivos = trilho(c, [None, None], [], AGORA)      # USDC e CBBTC são majors
    assert t == "caca" and "números não confirmados em segunda fonte" in motivos


def test_fonte_diz_zero_nao_afirma_o_volume_maior():
    c = llama("uniswap-v4", 0.15, 1308244, 500_000)
    g = cf.PoolGecko(dex="uniswap-v4-base", fee=0.15, tvl=1308402, vol_24h=0, endereco="0x1")
    cf.aplicar(c, g)
    assert c.vol_24h == 0


class CliBusca:
    def __init__(self, payload=BUSCA_USDC_CBBTC):
        self.payload, self.buscas = payload, []

    def gecko_busca(self, net, consulta):
        self.buscas.append((net, consulta))
        return self.payload


def test_uma_busca_confere_todas_as_pools_do_par_e_respeita_o_teto():
    cands = [llama("uniswap-v4", 0.18, 1308244, 16147164.55),
             llama("uniswap-v3", 0.05, 8301761, 11936254),
             llama("uniswap-v3", 0.3, 1921523, 568447, par="WETH/CBBTC")]
    cli = CliBusca()
    r = cf.conferir(cli, cands, {"Base": "base"}, max_pares=1)
    # a mais eficiente (a inflada) é a primeira: o teto de 1 par cobre USDC/CBBTC
    assert cli.buscas == [("base", "USDC CBBTC")]
    assert r["pares_buscados"] == 1 and r["conferidas"] == 2 and r["ajustadas"] == 1
    assert "conferencia" not in cands[2].sinais          # além do teto: não conferida nesta coleta


def test_busca_sem_resposta_nao_marca_nada():
    class Muda(CliBusca):
        def gecko_busca(self, net, consulta):
            return None
    c = llama("uniswap-v4", 0.18, 1308244, 16147164.55)
    cf.conferir(Muda(), [c], {"Base": "base"})
    assert "conferencia" not in c.sinais and c.vol_24h == 16147164.55


def test_pools_da_geckoterminal_nao_sao_conferidas_contra_elas_mesmas():
    c = llama("pancakeswap-v3-base", 0.01, 1_700_000, 10_000_000)
    c.fonte = "geckoterminal"
    cli = CliBusca()
    cf.conferir(cli, [c], {"Base": "base"})
    assert cli.buscas == []


def test_coleta_de_ponta_a_ponta_grava_o_numero_conferido():
    class Cli(FakeCliente):
        def gecko_busca(self, net, consulta):
            return {"data": []}                              # nada casa: tudo "não confirmada"
    store = MemoryPoolStore()
    r = coletar(Cli(), store, AGORA)
    assert r["conferencia"]["pares_buscados"] > 0
    llamas = [p for p in store.pools.values() if p["id"].startswith("llama:")]
    assert llamas and all(p["trilho"] != "solida" for p in llamas)
    assert all(p["sinais"]["conferencia"]["estado"] == "nao_confirmada"
               for p in llamas if "conferencia" in p["sinais"])
