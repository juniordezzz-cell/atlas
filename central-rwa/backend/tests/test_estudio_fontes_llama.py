"""Estúdio: histórico de preço pela DeFiLlama, com a GeckoTerminal de reserva
e a trava de 7 minutos. Resposta real da DeFiLlama salva em 13/11/2026."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from central_rwa.estudio.fontes import chave_llama, parse_par_ds, parse_precos_llama, velas_de_precos
from central_rwa.estudio.repositorio import MemoriaEstudio
import pytest

from central_rwa.estudio import varredura
from central_rwa.estudio.varredura import PRAZO_VELAS_S, pedidos_llama, varrer
from tests.conftest import fixture_json
from tests.test_estudio_varredura import ALVOS, DS_SOL, ClienteFalso

LLAMA = fixture_json("llama_chart_20261113.json")
JUP = "solana:JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
SOL = "solana:So11111111111111111111111111111111111111112"
AERO = "base:0x940181a94a35a4569e4529a3cdfb74e38fd98631"
ULTIMA_H = max(p["timestamp"] for p in LLAMA["coins"][SOL]["prices"]) // 3600 * 3600
AGORA = datetime.fromtimestamp(ULTIMA_H + 3600 + 600, timezone.utc)   # hora seguinte à última da fixture
AERO_DS = "0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee"   # o AERO como a DexScreener devolve no par da fixture


def test_precos_por_hora_reais():
    p = parse_precos_llama(LLAMA)
    assert set(p) == {JUP, SOL, AERO}          # chave da Base em minúsculas
    assert all(h % 3600 == 0 for h in p[SOL])
    assert 60 <= len(p[SOL]) <= 73
    assert 50 < p[SOL][ULTIMA_H] < 150 and 0.1 < p[JUP][max(p[JUP])] < 1


def test_vela_e_o_ativo_na_moeda_da_cotacao():
    p = parse_precos_llama(LLAMA)
    jup_sol = velas_de_precos(p[JUP], p[SOL])
    h = max(set(p[JUP]) & set(p[SOL]))
    ult = [v for v in jup_sol if v[0].timestamp() == h][0]
    assert ult[4] == p[JUP][h] / p[SOL][h] and ult[1] == ult[2] == ult[3] == ult[4] and ult[5] == 0
    assert len(jup_sol) == len(set(p[JUP]) & set(p[SOL]))     # hora sem os dois preços fica de fora
    jup_usd = velas_de_precos(p[JUP], None)                    # cotação stable: preço em dólar
    assert jup_usd[-1][4] == p[JUP][max(p[JUP])]


def test_chaves_e_endereco_da_cotacao():
    assert chave_llama("Base", "0xABC") == "base:0xabc"
    assert chave_llama("Solana", "JUPy") == "solana:JUPy"
    assert chave_llama("Arbitrum", "0x1") is None and chave_llama("Base", None) is None
    s = parse_par_ds(DS_SOL[0], "x")
    assert s.cotacao == "USDC" and s.cotacao_end.startswith("EPjFWd")


def _item(pid, chaves, ultima=None):
    return {"pool_id": pid, "_chaves": chaves, "ultima_vela": ultima}


def test_pedidos_juntam_as_pools_em_dia_e_cortam_em_500_pontos():
    agora = datetime(2026, 11, 13, 10, 40, tzinfo=timezone.utc)
    em_dia = [_item(f"p{i}", (f"solana:T{i}", None), agora - timedelta(hours=1)) for i in range(120)]
    ped = pedidos_llama(em_dia, agora)
    assert len(ped) == 1 and ped[0][2] == 2 and len(ped[0][0]) == 120    # 120 tokens × 2 horas
    muitos = [_item(f"p{i}", (f"solana:T{i}", None), agora - timedelta(hours=1)) for i in range(300)]
    assert [len(p[0]) for p in pedidos_llama(muitos, agora)] == [250, 50]
    nova = pedidos_llama([_item("n", ("solana:N", None))], agora)
    assert [p[2] for p in nova] == [500, 244]                                # 31 dias, 1 token
    par = pedidos_llama([_item("n", ("solana:N", "solana:SOL"))], agora)
    assert [p[2] for p in par] == [250, 250, 244] and all(p[0] == ["solana:N", "solana:SOL"] for p in par)
    for p in nova + par + ped:
        assert len(p[0]) * p[2] <= 500


class LlamaFalso(ClienteFalso):
    """DeFiLlama responde com a fixture para os tokens que ela conhece."""

    FIXTURE = {JUP: JUP, SOL: SOL, "base:" + AERO_DS.lower(): "base:0x940181a94A35A4569E4529A3CDfB74e38FD98631"}

    def __init__(self, conhecidos=None, falha=False):
        super().__init__()
        self.conhecidos = conhecidos
        self.falha = falha
        self.pedidos_llama = []

    def precos_llama(self, chaves, inicio, span):
        self.pedidos_llama.append((tuple(chaves), inicio, span))
        if self.falha:
            raise RuntimeError("fora do ar")
        return {"coins": {k: LLAMA["coins"][self.FIXTURE[k]] for k in chaves
                          if k in self.FIXTURE and (self.conhecidos is None or k in self.conhecidos)}}


@pytest.fixture(autouse=True)
def preco_da_fixture_e_de_outro_dia(monkeypatch):
    """A DexScreener da fixture é de 11/11 e a DeFiLlama de 13/11: o AERO caiu
    ~14% entre as duas. Nestes testes a conferência de preço fica folgada; ela
    tem teste próprio abaixo."""
    monkeypatch.setattr(varredura, "DIF_MAX_PRECO", 1.0)


ALVO_JUP = {"pool_id": "gecko:solana:JupSol", "rede": "Solana", "dex": "Orca", "par": "JUP/SOL",
            "endereco": "JupSolPool", "taxa_pct": 0.3, "tvl": 1e6, "vol_24h": 2e6}


def _store_com_estado(alvos, ultima):
    """Pools que já têm velas (estado gravado) e o snapshot da DexScreener que não veio."""
    store = MemoriaEstudio(alvos)
    for a in alvos:
        store.estados[a["pool_id"]] = {"ativo": a["_ativo"], "ativo_simbolo": a["_sim"], "cotacao": a["_cot"],
                                       "cotacao_end": a.get("_cot_end"), "buscado_em": ultima, "ultima_vela": ultima,
                                       "primeira_vela": ultima - timedelta(days=30), "falhas": 0}
    return store


def test_varredura_usa_a_defillama_e_nao_a_gecko():
    ultima = AGORA - timedelta(hours=3)
    jup = {**ALVO_JUP, "_ativo": JUP.split(":")[1], "_sim": "JUP", "_cot": "SOL", "_cot_end": SOL.split(":")[1]}
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([jup, aero], ultima)
    # snapshots desta hora para dar volume à vela
    cli = LlamaFalso()
    r = varrer(cli, store, AGORA)
    assert r["estado"] == "ok", r
    assert r["candles_pools_llama"] == 2 and r["candles_pools_gt"] == 0 and r["chamadas_gt"] == 0
    assert r["chamadas_llama"] == 1                     # as duas pools em dia num pedido só
    assert len(cli.pedidos_llama[0][0]) == 3            # JUP, SOL (cotação) e AERO
    assert store.estados[jup["pool_id"]]["fonte"] == "defillama"
    p = parse_precos_llama(LLAMA)
    hj = [k for k in store.velas if k[0] == jup["pool_id"]]
    assert hj and all(k[1].timestamp() >= ultima.timestamp() // 3600 * 3600 for k in hj)
    v = store.velas[max(hj)]
    assert v[3] == p[JUP][int(max(hj)[1].timestamp())] / p[SOL][int(max(hj)[1].timestamp())]


def test_volume_da_hora_vem_dos_snapshots():
    ultima = AGORA - timedelta(hours=3)
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([aero], ultima)
    h = datetime.fromtimestamp(ULTIMA_H, timezone.utc)
    store.snaps[(aero["pool_id"], h + timedelta(minutes=10))] = {"vol_24h": 2400.0}
    store.snaps[(aero["pool_id"], h + timedelta(minutes=25))] = {"vol_24h": 4800.0}
    varrer(LlamaFalso(), store, AGORA)
    assert store.velas[(aero["pool_id"], h)][4] == 150.0      # média 3.600 ÷ 24


def test_token_que_a_defillama_nao_conhece_vai_para_a_gecko():
    ultima = AGORA - timedelta(hours=3)
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([aero], ultima)
    cli = LlamaFalso(conhecidos=set())
    r = varrer(cli, store, AGORA)
    assert r["candles_pools_gt"] == 1 and r["chamadas_gt"] == 1 and store.estados[aero["pool_id"]]["fonte"] == "geckoterminal"


def test_defillama_fora_do_ar_marca_parcial_sem_correr_para_a_gecko():
    ultima = AGORA - timedelta(hours=3)
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([aero], ultima)
    r = varrer(LlamaFalso(falha=True), store, AGORA)
    assert r["estado"] == "parcial" and r["chamadas_gt"] == 0 and any("defillama" in f for f in r["falhas"])


def test_trava_de_7_minutos():
    # relógio que passa do prazo logo depois do início das velas: nada de GT, fica para a próxima
    store = MemoriaEstudio(ALVOS)
    tempos = iter([0.0] + [PRAZO_VELAS_S + 1] * 1000)
    cli = ClienteFalso()
    r = varrer(cli, store, AGORA, relogio=lambda: next(tempos))
    assert r["velas_adiadas"] and r["chamadas_gt"] == 0 and r["estado"] == "ok"
    assert r["snapshots"] == 4                                # o snapshot não depende das velas


def test_preco_da_defillama_longe_do_da_pool_usa_a_gecko(monkeypatch):
    monkeypatch.setattr(varredura, "DIF_MAX_PRECO", 0.05)
    ultima = AGORA - timedelta(hours=3)
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([aero], ultima)
    r = varrer(LlamaFalso(), store, AGORA)        # snapshot 0,5525 × DeFiLlama ~0,47
    assert r["llama_preco_diferente"] == 1 and r["candles_pools_gt"] == 1
    assert store.estados[aero["pool_id"]]["fonte"] == "geckoterminal"
    # e na próxima hora vai direto para a GT, sem pedir à DeFiLlama
    cli = LlamaFalso()
    varrer(cli, store, AGORA + timedelta(hours=1))
    assert cli.pedidos_llama == [] and cli.pedidos_velas


def test_preco_parado_na_defillama_usa_a_gecko():
    ultima = AGORA - timedelta(hours=3)
    aero = {**ALVOS[2], "_ativo": AERO_DS, "_sim": "AERO", "_cot": "USDC"}
    store = _store_com_estado([aero], ultima)
    r = varrer(LlamaFalso(), store, AGORA + timedelta(hours=5))   # a fixture termina ~6 h antes
    assert r["llama_preco_diferente"] == 1 and r["candles_pools_gt"] == 1
