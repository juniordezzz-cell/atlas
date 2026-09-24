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
    assert eficiencia(c("a", fee=0.25, tvl=1e6, vol=9e9, vol7=7e6)) == 0.25        # 7d manda
    assert round(eficiencia(c("a", fee=0.01, apr=10, reward=73, dex="Aerodrome")), 3) == 0.2


def test_nota_ordena_e_fica_entre_0_e_100():
    boa = c("boa", fee=0.3, tvl=20e6, vol=20e6)
    rasa = c("rasa", fee=0.3, tvl=150_000, vol=60_000)
    notas = calcular_notas([boa, rasa], {})
    assert 0 <= notas["rasa"][0] < notas["boa"][0] <= 100
    assert set(notas["boa"][1]) == {"rendimento", "consistencia", "profundidade", "tendencia"}


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
