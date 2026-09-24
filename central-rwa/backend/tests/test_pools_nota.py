from datetime import date

from central_rwa.pools.modelos import Candidata, Leitura, TokenRef
from central_rwa.pools.nota import calcular_notas, eficiencia


def c(id, fee=0.25, tvl=1e6, vol=1e6, vol7=None, apr=None, reward=None, dex="PancakeSwap"):
    return Candidata(id=id, fonte="x", rede="BNB Chain", dex=dex, par="A/B", token_a=TokenRef(None, "A"),
                     token_b=TokenRef(None, "B"), fee=fee, tvl=tvl, vol_24h=vol, vol_7d=vol7, apr=apr, apr_reward=reward)


def lei(pid, dia, tvl, vol):
    return Leitura(pid, date(2026, 9, dia), tvl, vol, None, None, 0.25)


def test_eficiencia():
    assert eficiencia(c("a", fee=0.25, tvl=1e6, vol=1e6)) == 0.25
    assert eficiencia(c("a", fee=0.25, tvl=1e6, vol=2e6, vol7=7e6)) == 0.5         # vale o volume do dia, não a média 7d
    assert round(eficiencia(c("a", fee=0, apr=36.5)), 4) == 0.1                   # taxa dinâmica: APR da fonte
    assert round(eficiencia(c("a", fee=0.01, apr=10, reward=73, dex="Aerodrome")), 3) == 0.2


def test_nota_ordena_e_fica_entre_0_e_100():
    boa = c("boa", fee=0.3, tvl=20e6, vol=20e6)
    rasa = c("rasa", fee=0.3, tvl=150_000, vol=60_000)
    notas = calcular_notas([boa, rasa], {})
    assert 0 <= notas["rasa"][0] < notas["boa"][0] <= 100
    assert set(notas["boa"][1]) == {"taxa", "giro", "rendimento", "consistencia", "profundidade", "tendencia"}


def test_consistencia_premia_razao_estavel_e_sem_historico_vale_meio():
    estavel = [lei("e", d, 1e6, 1e6) for d in range(17, 24)]
    instavel = [lei("i", d, 1e6, v) for d, v in zip(range(17, 24), [1e5, 5e6, 2e5, 4e6, 1e5, 6e6, 3e5])]
    n = calcular_notas([c("e"), c("i"), c("s")], {"e": estavel, "i": instavel})
    assert n["e"][1]["consistencia"] > n["i"][1]["consistencia"]
    assert n["s"][1]["consistencia"] == 0.5


def test_tendencia_de_tvl():
    sobe = [lei("s", 16, 1e6, 1e6), lei("s", 23, 1.3e6, 1e6)]
    cai = [lei("c", 16, 1e6, 1e6), lei("c", 23, 0.7e6, 1e6)]
    n = calcular_notas([c("s"), c("c")], {"s": sobe, "c": cai})
    assert n["s"][1]["tendencia"] == 1.0 and n["c"][1]["tendencia"] == 0.0


def test_giro_volume_abaixo_do_tvl_pesa_pouco():
    n = calcular_notas([c("parada", tvl=1e6, vol=5e5), c("gira", tvl=1e6, vol=3e6), c("voa", tvl=1e6, vol=2e7)], {})
    assert n["parada"][1]["giro"] == 0.15 and n["gira"][1]["giro"] == 0.7 and n["voa"][1]["giro"] == 1.0


def test_razao_alta_com_taxa_infima_nao_passa_pool_que_rende():
    # Guia, caso SNDK: USDC/USDT gira 4,5× com taxa 0,0008% (fora); SNDK gira 5,6× com 0,1% (escolhida)
    stable = c("stable", fee=0.0008, tvl=2e6, vol=9.04e6)
    sndk = c("sndk", fee=0.1, tvl=321_000, vol=1.8e6)
    n = calcular_notas([stable, sndk], {})
    assert n["sndk"][0] > n["stable"][0] + 20


def test_nota_nao_depende_das_outras_pools():
    a = c("a", fee=0.05, tvl=5e6, vol=1e7)
    so = calcular_notas([a], {})["a"][0]
    junto = calcular_notas([a, c("b", fee=1, tvl=1e6, vol=1e7)], {})["a"][0]
    assert so == junto


def test_taxa_ponto_bom_entre_025_e_08_e_degen_perde():
    n = calcular_notas([c(k, fee=f) for k, f in
                        [("t0001", 0.001), ("t001", 0.01), ("t005", 0.05), ("t03", 0.3), ("t08", 0.8), ("t1", 1), ("t0", 0)]], {})
    t = {k: v[1]["taxa"] for k, v in n.items()}
    assert t["t0001"] == 0 < t["t001"] < t["t005"] == 0.5 < t["t03"] == t["t08"] == 1.0
    assert t["t1"] == 0.4 and t["t0"] == 0.3


def test_taxa_boa_ganha_de_razao_maior_com_taxa_infima():
    # o exemplo do dono: 0,001% com razão 18× perde para 0,25% com razão 10×
    infima = c("infima", fee=0.001, tvl=1e6, vol=18e6)
    boa = c("boa", fee=0.25, tvl=1e6, vol=10e6)
    n = calcular_notas([infima, boa], {})
    assert n["boa"][0] > n["infima"][0] + 30
