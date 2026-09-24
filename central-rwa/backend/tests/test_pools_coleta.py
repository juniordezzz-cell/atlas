from datetime import date, datetime, timedelta, timezone

from central_rwa.pools.coleta import coletar
from central_rwa.pools.modelos import Candidata, PoolFinal, TokenRef
from central_rwa.pools.repositorio import MemoryPoolStore
from tests.conftest import fixture_json

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


class FakeCliente:
    """Devolve as fixtures reais: a amostra da DefiLlama e 6 pools da PancakeSwap v3/BSC."""

    def __init__(self):
        self.parciais: list[str] = []
        self.infos_pedidas: list[str] = []

    def llama_pools(self):
        return fixture_json("llama_pools_sample.json")["data"]

    def gecko_pools(self, net, dex, paginas):
        if (net, dex) == ("bsc", "pancakeswap-v3-bsc"):
            return fixture_json("gt_pools_pancake_v3_bsc.json")["data"]
        return []

    def token_info(self, net, endereco):
        self.infos_pedidas.append(endereco)
        if endereco == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c":
            return fixture_json("gt_token_info_wbnb.json")
        return fixture_json("gt_token_info_bsc.json")

    def tokens_multi(self, net, enderecos):
        return fixture_json("gt_tokens_multi_bsc.json")


def test_coleta_real_de_ponta_a_ponta():
    store = MemoryPoolStore()
    r = coletar(FakeCliente(), store, AGORA)
    assert r["pre_corte"] > 0
    assert r["solidas"] + r["caca"] + r["barradas"] == r["pre_corte"]
    usdt_wbnb = next(p for p in store.pools.values() if p["par"] == "USDT/WBNB" and p["dex"] == "PancakeSwap")
    assert usdt_wbnb["trilho"] == "solida" and 0 <= usdt_wbnb["nota"] <= 100
    assert len(store.leituras_por_pool[usdt_wbnb["id"]]) == 1


def test_majors_nao_gastam_consulta_e_cache_evita_repetir():
    store, cli = MemoryPoolStore(), FakeCliente()
    coletar(cli, store, AGORA)
    assert "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" not in cli.infos_pedidas     # WBNB é major
    antes = len(cli.infos_pedidas)
    coletar(cli, store, AGORA + timedelta(hours=4))
    assert len(cli.infos_pedidas) == antes                                           # cache de 7 dias


def fin(pid):
    c = Candidata(id=pid, fonte="x", rede="BNB Chain", dex="PancakeSwap", par="A/B", token_a=TokenRef(None, "A"),
                  token_b=TokenRef(None, "B"), fee=0.25, tvl=1e6, vol_24h=1e6, vol_7d=None, apr=None, apr_reward=None)
    return PoolFinal(c, "solida", [], 50.0, {})


def test_pool_some_so_depois_de_3_coletas_e_leitura_do_dia_e_unica():
    s = MemoryPoolStore()
    s.gravar([fin("a"), fin("b")], date(2026, 9, 20), AGORA)
    s.gravar([fin("a"), fin("b")], date(2026, 9, 20), AGORA)          # mesma data: substitui
    assert len(s.leituras_por_pool["a"]) == 1
    for d in (21, 22):
        s.gravar([fin("a")], date(2026, 9, d), AGORA)
    assert s.pools["b"]["ativa"] is True
    s.gravar([fin("a")], date(2026, 9, 23), AGORA)
    assert s.pools["b"]["ativa"] is False and s.leituras_por_pool["b"]


def test_leitura_com_mais_de_30_dias_e_apagada():
    s = MemoryPoolStore()
    s.gravar([fin("a")], date(2026, 8, 1), AGORA)
    s.gravar([fin("a")], date(2026, 9, 23), AGORA)
    assert [l.dia for l in s.leituras_por_pool["a"]] == [date(2026, 9, 23)]


# ---- Task 8: comando ----
import json

from central_rwa import __main__ as cli_main


def test_comando_pools_dry_run(monkeypatch, capsys):
    monkeypatch.setattr("central_rwa.pools.comando.ClienteFontes", lambda: FakeCliente())
    cli_main.main(["pools", "--dry-run"])
    resumo = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert resumo["pre_corte"] > 0 and resumo["dry_run"] is True


# ---- limite de consultas por coleta (verificação real: 1ª coleta passava de 30 min) ----
def test_consulta_de_token_tem_teto_e_prioriza_pools_maiores(monkeypatch):
    from central_rwa.pools import config as cfg

    monkeypatch.setattr(cfg, "MAX_TOKENS_POR_COLETA", 2)
    store, cli = MemoryPoolStore(), FakeCliente()
    r = coletar(cli, store, AGORA)
    assert len(cli.infos_pedidas) == 2
    assert r["tokens_pendentes"] > 0
    # os dois consultados são de pools com TVL maior que o de qualquer pendente
    pools = list(store.pools.values())
    tvl_de = lambda e: max(p["tvl"] for p in pools if e in ((p["token_a"] or "").lower(), (p["token_b"] or "").lower()))
    from central_rwa.pools.coleta import _dispensa_consulta
    candidatos = {t for p in pools for t, s in ((p["token_a"], p["simbolo_a"]), (p["token_b"], p["simbolo_b"]))
                  if t and not _dispensa_consulta(s)}
    pedidos = {x.lower() for x in cli.infos_pedidas}      # Solana diferencia maiúsculas; aqui só comparamos
    pendentes = {e.lower() for e in candidatos} - pedidos
    assert len(pendentes) == r["tokens_pendentes"]
    assert min(tvl_de(e) for e in pedidos) >= max(tvl_de(e) for e in pendentes)
