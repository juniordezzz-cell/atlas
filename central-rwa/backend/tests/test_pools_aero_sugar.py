"""Aero direto da rede pelo LpSugar (22/10/2026). A fixture é a resposta real de
all(2, 0, 48 h, 0) do Sugar da Base (0xb2A7bD…) às 13:30 UTC de 22/10: as pools
AERO/USDC 0,3% e WETH/VVV 0,3%. No app, a AERO/USDC mostrava 91,1% de AERO APR
e 6,7% de Fees APR."""

from datetime import datetime, timezone
from pathlib import Path

from central_rwa.pools import aero, config
from central_rwa.pools import coleta as col
from central_rwa.pools.conferencia import conferir
from central_rwa.pools.modelos import Candidata, TokenRef
from central_rwa.pools.nota import VE33, parte_emissao

HEXA = (Path(__file__).parent / "fixtures" / "aero_sugar_all_base_20261022.hex").read_text().strip()
AERO_NOVO = "0x3f5bf3edac59d650d8fdf9657a71f2f904a3a4ee"
USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
WETH = "0x4200000000000000000000000000000000000006"
PRECOS = {AERO_NOVO: {"simbolo": "AERO", "decimais": 18, "preco": 0.803},
          USDC: {"simbolo": "USDC", "decimais": 6, "preco": 1.0},
          WETH: {"simbolo": "WETH", "decimais": 18, "preco": 2402.0}}
AGORA = datetime(2026, 10, 22, 13, 30, tzinfo=timezone.utc)


def lps():
    return aero.decodificar_lps(HEXA)


def test_decodifica_a_resposta_real_do_sugar():
    a, b = lps()
    assert a["lp"] == "0xf634058dc94e6bf8e828e27621320c423bc8b18e"
    assert a["symbol"] == "vAMMV2-AERO/USDC" and a["poolType"] == -1 and a["poolFee"] == 30
    assert a["token0"] == AERO_NOVO and a["token1"] == USDC
    assert a["emissions"] == 414 * 10 ** 15 and a["gaugeAlive"] is True
    assert b["symbol"] == "vAMMV2-WETH/VVV"


def test_aero_usdc_bate_com_o_app():
    c = aero.parse_aero(lps(), "Base", PRECOS)[0]
    assert c.id == "gecko:base:0xf634058dc94e6bf8e828e27621320c423bc8b18e"
    assert (c.dex, c.fonte, c.projeto, c.par) == ("Aero", "aero", "aero-volatile", "AERO/USDC")
    assert 11.5e6 < c.tvl < 12.5e6
    assert abs(c.fee - 0.3) < 0.01            # cobrada na janela = a do contrato
    assert 6.0 < c.apr < 7.5                  # app: 6,7%
    assert 85 < c.apr_reward < 95             # app: 91,1%
    assert c.sinais["endereco_pool"] == c.id.split(":")[-1] and c.sinais["fonte_direta"] == "Aero"
    assert "Aero" in VE33 and parte_emissao(c) > 0.9


def test_pool_com_token_sem_preco_fica_de_fora():
    pares = [c.par for c in aero.parse_aero(lps(), "Base", PRECOS)]
    assert pares == ["AERO/USDC"]             # VVV sem preço: WETH/VVV não entra


def test_gauge_parado_e_emissao_zero_nao_sem_dado():
    lp = dict(lps()[0], gaugeAlive=False)
    c = aero.parse_aero([lp], "Base", PRECOS)[0]
    assert c.apr_reward == 0.0 and parte_emissao(c) == 0.0


def test_taxa_do_contrato_por_tipo_de_pool():
    assert aero.taxa_pct({"poolType": 1, "poolFee": 85}) == 0.0085     # CL1 WETH/cbBTC
    assert aero.taxa_pct({"poolType": -1, "poolFee": 30}) == 0.3       # básica volátil
    assert aero.projeto({"poolType": 100}) == "aero-slipstream"
    assert aero.projeto({"poolType": 0}) == "aero-stable"


def test_taxa_dinamica_vale_a_cobrada_na_janela():
    lp = dict(lps()[0], poolFee=100)          # o contrato diz 1% agora...
    c = aero.parse_aero([lp], "Base", PRECOS)[0]
    assert abs(c.fee - 0.3) < 0.01            # ...mas a janela cobrou 0,3%
    assert c.sinais["taxa_atual"] == 1.0


def test_simbolo_de_erc20():
    abi = "0x" + f"{32:064x}" + f"{4:064x}" + b"WETH".hex().ljust(64, "0")
    assert aero.decodificar_texto(abi) == "WETH"
    assert aero.decodificar_texto("0x" + b"MKR".hex().ljust(64, "0")) == "MKR"   # bytes32
    assert aero.decodificar_texto("0x") is None


def test_chamada_all_e_tokens_a_precificar():
    assert aero.chamada_all(300, 600) == aero.SEL_ALL + f"{300:064x}{600:064x}{172800:064x}{0:064x}"
    assert set(aero.tokens_das_pools(lps())) >= {AERO_NOVO, USDC, WETH}


def test_rpc_com_chave_vem_da_config(monkeypatch):
    monkeypatch.delenv("ATLAS_RPC_BASE", raising=False)
    assert config.rpc_url("Base") == "https://mainnet.base.org"
    monkeypatch.setenv("ATLAS_RPC_BASE", "https://base-mainnet.g.alchemy.com/v2/x")
    assert config.rpc_url("Base") == "https://base-mainnet.g.alchemy.com/v2/x"
    monkeypatch.setenv("ATLAS_RPC_BASE", " ")
    assert config.rpc_url("Base") == "https://mainnet.base.org"


class CliAero:
    """Sugar responde na Base; nas outras redes a RPC cai."""

    def __init__(self):
        self.parciais: list[str] = []
        self.gecko: list[tuple[str, str]] = []

    def llama_pools(self):
        return []

    def gecko_pools(self, net, dex, paginas):
        self.gecko.append((net, dex))
        return []

    def aero_pools(self, rede):
        if rede != "Base":
            raise ConnectionError("RPC fora")
        return lps()

    def aero_tokens(self, rede, enderecos, prioridade=()):
        assert AERO_NOVO in prioridade            # o token da emissão é precificado primeiro
        return PRECOS


def test_sugar_ok_dispensa_a_gecko_da_aero_so_naquela_rede():
    cli, status = CliAero(), []
    cands = col._candidatas(cli, status, AGORA)
    assert any(c.fonte == "aero" for c in cands)
    assert ("base", "aero-slipstream-base") not in cli.gecko
    assert ("optimism", "aero-slipstream-optimism") in cli.gecko      # reserva quando o Sugar falha
    aero_status = {s["rede"]: s["estado"] for s in status if s["fonte"] == "aero"}
    assert aero_status["Base"] == "ok" and aero_status["Optimism"].startswith("falhou")


def _llama_aero():
    return Candidata(id="llama:x", fonte="defillama", rede="Base", dex="Aero", par="AERO/USDC",
                     token_a=TokenRef(AERO_NOVO, "AERO"), token_b=TokenRef(USDC, "USDC"),
                     fee=0.3, tvl=12e6, vol_24h=1e6, vol_7d=None, apr=5.0, apr_reward=300.0,
                     projeto="aero-v1")


def test_defillama_da_aero_recebe_a_emissao_on_chain():
    direta = aero.parse_aero(lps(), "Base", PRECOS)[0]
    [junta] = col.reconciliar_diretas([_llama_aero(), direta])
    assert junta.id == "llama:x"                          # o ID histórico fica
    assert junta.apr_reward == direta.apr_reward          # a emissão vem do contrato
    assert junta.sinais["fonte_direta"] == "Aero"


def test_pool_lida_na_rede_nao_vai_para_a_conferencia():
    c = _llama_aero()
    c.sinais["fonte_direta"] = "Aero"

    class Cli:
        buscas = 0

        def gecko_busca(self, net, consulta):
            Cli.buscas += 1
            return {"data": []}

    conferir(Cli(), [c], config.GECKO_NET)
    assert Cli.buscas == 0
