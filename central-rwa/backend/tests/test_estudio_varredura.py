"""Estúdio de Agentes, Fase 2: varredura (snapshot + velas) sem banco.
Respostas reais da DexScreener e da GeckoTerminal salvas em 11/11/2026."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from central_rwa.estudio.fontes import escolher_ativo, parse_par_ds, parse_velas_gt
from central_rwa.estudio.repositorio import MemoriaEstudio, alvo_de_linha_publica
from central_rwa.estudio.varredura import fila_velas, limite_velas, varrer
from tests.conftest import fixture_json

AGORA = datetime(2026, 11, 11, 23, 0, tzinfo=timezone.utc)
DS_SOL = fixture_json("ds_pairs_solana_20261111.json")["pairs"]
DS_BASE = fixture_json("ds_pairs_base_20261111.json")["pairs"]
GT_AERO = fixture_json("gt_ohlcv_base_aero_usdc_20261111.json")

ALVOS = [
    {"pool_id": "llama:cbbtc", "rede": "Solana", "dex": "Orca", "par": "CBBTC/USDC",
     "endereco": "HxA6SKW5qA4o12fjVgTpXdq2YnZ5Zv1s7SB4FFomsyLM", "taxa_pct": 0.04, "tvl": 5e6, "vol_24h": 9e6},
    {"pool_id": "llama:aaplx", "rede": "Solana", "dex": "Raydium", "par": "AAPLX/USDC",
     "endereco": "ApniVWuZbZoruTAJdyJcLBA4AVw4DKGdV5fHxo6qrAZT", "taxa_pct": 0.1, "tvl": 3e5, "vol_24h": 2e5},
    {"pool_id": "gecko:base:0x422df9aa896e883c9cdcbad309c0785b7364a1cf", "rede": "Base", "dex": "Aero", "par": "AERO/USDC",
     "endereco": "0x422df9aa896e883c9cdcbad309c0785b7364a1cf", "taxa_pct": 0.0327, "tvl": 8e5, "vol_24h": 9e6},
    {"pool_id": "gecko:base:0x83f3aca29bc79b048b99c56013475570acc97ccf", "rede": "Base", "dex": "PancakeSwap", "par": "ELSA/USDC",
     "endereco": "0x83f3aca29bc79b048b99c56013475570acc97ccf", "taxa_pct": 0.01, "tvl": 4e5, "vol_24h": 1e6},
]
AERO = "0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee"


class GeckoFalso:
    def __init__(self):
        self.gecko_metricas = {"requisicoes": 0, "limites_429": 0, "espera_s": 0.0}


class ClienteFalso:
    def __init__(self, velas=GT_AERO, falha_ds=False):
        self.gecko = GeckoFalso()
        self.pedidos_velas: list[tuple] = []
        self.velas, self.falha_ds = velas, falha_ds

    def pares_ds(self, rede, enderecos):
        if self.falha_ds:
            raise RuntimeError("fora do ar")
        pares = DS_SOL if rede == "Solana" else DS_BASE
        return [p for p in pares if p["pairAddress"] in enderecos or p["pairAddress"].lower() in enderecos]

    def precos_llama(self, chaves, inicio, span):
        self.pedidos_llama = getattr(self, "pedidos_llama", []) + [(tuple(chaves), inicio, span)]
        return {"coins": {}}   # a DeFiLlama "não conhece" nada: tudo vai para a reserva (GT)

    def velas_gt(self, rede, endereco, ativo, limite):
        self.gecko.gecko_metricas["requisicoes"] += 1
        self.pedidos_velas.append((rede, endereco, ativo, limite))
        return self.velas


def test_ativo_e_o_token_que_nao_e_dinheiro():
    usdc, sol, jup, weth = ({"symbol": s, "address": s} for s in ("USDC", "SOL", "JUP", "WETH"))
    assert escolher_ativo(usdc, sol)[0] is sol          # stable é cotação mesmo como base
    assert escolher_ativo(sol, usdc)[0] is sol
    assert escolher_ativo(sol, jup)[0] is jup           # SOL cota o JUP
    assert escolher_ativo(weth, sol)[0] is sol          # WETH cota antes de SOL
    assert escolher_ativo(jup, {"symbol": "RAY"})[0] is jup   # empate: fica o base


def test_snapshot_da_dexscreener_real():
    s = parse_par_ds(DS_SOL[0], "x")
    assert (s.ativo_simbolo, s.cotacao) == ("cbBTC", "USDC")
    assert s.preco == 74451.9851 and s.preco_usd == 74451.98
    assert s.tvl == 5105283.99 and s.vol_24h == 9228060.31
    aero = [p for p in DS_BASE if p["dexId"] == "aero"][0]
    s = parse_par_ds(aero, "y")
    assert s.ativo.lower() == AERO.lower() and s.preco == 0.5525


def test_ativo_no_quote_inverte_o_preco():
    par = {"baseToken": {"symbol": "USDC", "address": "u"}, "quoteToken": {"symbol": "SOL", "address": "s"},
           "priceNative": "0.0125", "priceUsd": "1.0", "liquidity": {"usd": 1e6}, "volume": {"h24": 2e6}}
    s = parse_par_ds(par, "z")
    assert s.ativo == "s" and s.preco == 80.0 and s.preco_usd == 80.0


def test_par_sem_liquidez_e_ignorado():
    assert parse_par_ds({"baseToken": {}, "quoteToken": {}, "liquidity": {"usd": 0}, "volume": {"h24": 1}}, "z") is None


def test_velas_reais_em_ordem_crescente():
    v = parse_velas_gt(GT_AERO)
    assert len(v) == 48
    assert all(a[0] < b[0] for a, b in zip(v, v[1:]))
    assert v[-1][0] == datetime.fromtimestamp(1794434400, timezone.utc)
    assert 0.4 < v[-1][4] < 0.7     # AERO em USDC


def test_limite_de_velas():
    assert limite_velas(None, AGORA) == 1000
    assert limite_velas(AGORA - timedelta(hours=1), AGORA) == 3
    assert limite_velas(AGORA - timedelta(days=90), AGORA) == 1000


def test_fila_prioriza_quem_nunca_buscou_e_respeita_uma_hora():
    snaps = {}
    estados = {
        ALVOS[0]["pool_id"]: {"ativo": "a0", "buscado_em": AGORA - timedelta(minutes=20)},   # recente: fora
        ALVOS[1]["pool_id"]: {"ativo": "a1", "buscado_em": AGORA - timedelta(hours=3)},
        ALVOS[2]["pool_id"]: {"ativo": "a2", "buscado_em": AGORA - timedelta(hours=1)},
    }
    fila = fila_velas(ALVOS, estados, snaps, AGORA)
    assert [f["pool_id"] for f in fila] == [ALVOS[1]["pool_id"], ALVOS[2]["pool_id"]]   # ALVOS[3] sem ativo
    assert fila_velas(ALVOS[3:], {}, {}, AGORA) == []


def test_varredura_completa_em_memoria():
    store, cli = MemoriaEstudio(ALVOS), ClienteFalso()
    r = varrer(cli, store, AGORA)
    assert r["estado"] == "ok" and r["pools_alvo"] == 4 and r["snapshots"] == 4
    assert r["candles_pools"] == 4 and r["candles_novas"] == 4 * 48
    aero = [p for p in cli.pedidos_velas if p[0] == "Base" and p[1].startswith("0x422d")][0]
    assert aero[2].lower() == AERO.lower() and aero[3] == 1000     # ativo certo, histórico inteiro
    snap = store.snaps[(ALVOS[2]["pool_id"], AGORA)]
    assert snap["taxa_pct"] == 0.0327 and abs(snap["giro"] - 9818815.51 / 828047.71) < 1e-9

    # 15 min depois: snapshot de novo, velas não (ainda não passou uma hora)
    r2 = varrer(cli, store, AGORA + timedelta(minutes=15))
    assert r2["snapshots"] == 4 and r2["candles_pools"] == 0
    # 1 h depois: velas incrementais, só as horas que faltam
    cli.pedidos_velas.clear()
    r3 = varrer(cli, store, AGORA + timedelta(hours=1))
    assert r3["candles_pools"] == 4 and r3["candles_novas"] == 0
    assert all(p[3] < 1000 for p in cli.pedidos_velas)


def test_orcamento_da_gecko_divide_as_pools():
    store, cli = MemoriaEstudio(ALVOS), ClienteFalso()
    r = varrer(cli, store, AGORA, orcamento_gt=2)
    assert r["candles_pools"] == 2 and r["chamadas_gt"] == 2
    r = varrer(cli, store, AGORA + timedelta(minutes=15), orcamento_gt=2)
    assert r["candles_pools"] == 2       # as outras duas
    assert len(store.estados) == 4


def test_dexscreener_fora_do_ar_e_erro_registrado():
    store = MemoriaEstudio(ALVOS)
    r = varrer(ClienteFalso(falha_ds=True), store, AGORA)
    assert r["estado"] == "erro" and r["snapshots"] == 0
    assert any("dexscreener" in f for f in r["falhas"])


def test_velas_que_falham_entram_na_fila_depois_e_marcam_parcial():
    store, cli = MemoriaEstudio(ALVOS), ClienteFalso(velas=None)
    r = varrer(cli, store, AGORA)
    assert r["estado"] == "parcial" and r["candles_pools"] == 0
    assert all(e["falhas"] == 1 for e in store.estados.values())


def test_alvo_publico_segue_o_filtro_da_visao():
    base = {"id": "gecko:base:0xabc", "rede": "Base", "dex": "Aero", "par": "A/B", "fee": 0.05, "tvl": 300_000, "vol_24h": 200_000, "sinais": {}}
    assert alvo_de_linha_publica(base)["endereco"] == "0xabc"
    assert alvo_de_linha_publica({**base, "tvl": 249_999}) is None
    assert alvo_de_linha_publica({**base, "vol_24h": 150_000}) is None          # giro 0,5 não passa
    assert alvo_de_linha_publica({**base, "rede": "Arbitrum"}) is None
    llama = {**base, "id": "llama:1", "sinais": {"endereco_pool": "Hx"}}
    assert alvo_de_linha_publica(llama)["endereco"] == "Hx"
    assert alvo_de_linha_publica({**base, "id": "llama:2"}) is None              # sem endereço
