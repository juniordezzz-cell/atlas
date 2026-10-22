"""Aero direto da rede (22/10/2026), pelo LpSugar: o mesmo contrato que o app
app.aero.xyz usa para listar as pools. Não há API HTTP da Aero nem chave;
basta uma RPC pública (ou a da config, ATLAS_RPC_<REDE>).

Por que on-chain: a GeckoTerminal põe no nome da pool uma taxa que não é a do
contrato (WETH/cbBTC CL1 aparecia "0,02%"; o contrato e o app dizem 0,0085%),
e não informa a emissão. O Sugar dá taxa, reservas, parte em stake, emissão por
segundo e volume/taxas das últimas 48 h. As contas espelham o app (assets/pool-*.js):
  AERO APR  = emissão/s × preço × 1 ano ÷ valor em stake
  Fees APR  = taxas da janela, anualizadas, menos a parte de quem não faz stake ÷ TVL
Conferido em 22/10 na AERO/USDC 0,3%: 89% e 6,6% aqui, 91,1% e 6,7% no app.

decodificar_lps e parse_aero são puras; as chamadas ficam em fontes.ClienteFontes."""

from __future__ import annotations

from datetime import datetime, timezone

from . import config
from .modelos import Candidata, TokenRef

SEL_COUNT = "0x06661abd"     # count()
SEL_ALL = "0x814b0f0c"       # all(uint256 _limit, uint256 _offset, uint48 _window, uint8 _filter)
SEL_SYMBOL = "0x95d89b41"    # symbol()
SEL_DECIMALS = "0x313ce567"  # decimals()
JANELA_S = 48 * 3600         # a mesma do app (2880 min)
LOTE = 300                   # pools por chamada (o app usa até 300)
ANO_S = 365 * 86400
TVL_MIN = 1_000.0            # poeira não vira candidata (o pré-corte é bem acima)

# struct Lp do LpSugar novo (ABI tirada do app em 22/10/2026), na ordem.
CAMPOS = ("lp symbol decimals liquidity poolType tick sqrtRatio token0 reserve0 staked0 "
          "token1 reserve1 staked1 gauge gaugeLiquidity gaugeAlive rewardsManager factory "
          "emissions emissionsToken emissionsCap poolFee unstakedFee token0Fees token1Fees "
          "createdAt nfpm windowStart windowEnd windowOpenTick windowCloseTick windowSwapCount "
          "windowVolume0 windowVolume1 windowFee0 windowFee1 windowMevVolume0 windowMevVolume1 "
          "windowMevFee0 windowMevFee1").split()
_ENDERECOS = {"lp", "token0", "token1", "gauge", "rewardsManager", "factory", "emissionsToken", "nfpm"}
_COM_SINAL = {"poolType", "tick", "windowOpenTick", "windowCloseTick"}   # int24


def chamada_all(limite: int, offset: int) -> str:
    return SEL_ALL + "".join(f"{v:064x}" for v in (limite, offset, JANELA_S, 0))


def _palavra(b: bytes, i: int) -> int:
    return int.from_bytes(b[i:i + 32], "big")


def _texto(b: bytes, i: int) -> str:
    n = _palavra(b, i)
    return b[i + 32:i + 32 + n].decode("utf-8", "replace")


def decodificar_lps(hexa: str) -> list[dict]:
    """Resposta de all() (Lp[]) em dicts. Só `symbol` é dinâmico."""
    b = bytes.fromhex(hexa.removeprefix("0x"))
    if len(b) < 64:
        return []
    base = _palavra(b, 0)
    n = _palavra(b, base)
    corpo = base + 32
    out = []
    for k in range(n):
        ini = corpo + _palavra(b, corpo + 32 * k)
        lp: dict = {}
        for j, nome in enumerate(CAMPOS):
            v = _palavra(b, ini + 32 * j)
            if nome == "symbol":
                lp[nome] = _texto(b, ini + v)
            elif nome in _ENDERECOS:
                lp[nome] = "0x" + f"{v:064x}"[-40:]
            elif nome == "gaugeAlive":
                lp[nome] = bool(v)
            elif nome in _COM_SINAL:
                lp[nome] = v - (1 << 256) if v >= 1 << 255 else v
            else:
                lp[nome] = v
        out.append(lp)
    return out


def decodificar_texto(hexa: str | None) -> str | None:
    """symbol() de ERC-20: string ABI (ou bytes32 nos tokens antigos)."""
    if not hexa or len(hexa) < 66:
        return None
    b = bytes.fromhex(hexa.removeprefix("0x"))
    try:
        if len(b) >= 96 and _palavra(b, 0) == 32:
            return _texto(b, 32) or None
        return b[:32].rstrip(b"\0").decode("utf-8") or None
    except UnicodeDecodeError:
        return None


def _usd(qtd: int, tok: dict) -> float:
    return qtd / 10 ** tok["decimais"] * tok["preco"]


def taxa_pct(lp: dict) -> float:
    """CL: poolFee em milionésimos (85 = 0,0085%); básica: em bps (30 = 0,3%)."""
    return lp["poolFee"] / 10_000 if lp["poolType"] > 0 else lp["poolFee"] / 100


def projeto(lp: dict) -> str:
    return "aero-slipstream" if lp["poolType"] > 0 else ("aero-stable" if lp["poolType"] == 0 else "aero-volatile")


def parse_aero(lps: list[dict], rede: str, tokens: dict[str, dict]) -> list[Candidata]:
    """`tokens`: endereço minúsculo -> {simbolo, decimais, preco}. Pool com token
    sem preço fica de fora: sem os dois lados não há TVL que se afirme."""
    net = config.GECKO_NET[rede]
    out: list[Candidata] = []
    for lp in lps:
        t0, t1 = tokens.get(lp["token0"].lower()), tokens.get(lp["token1"].lower())
        if not t0 or not t1 or not t0.get("preco") or not t1.get("preco"):
            continue
        tvl = _usd(lp["reserve0"], t0) + _usd(lp["reserve1"], t1)
        if tvl < TVL_MIN:
            continue
        janela = lp["windowEnd"] - lp["windowStart"]
        por_dia = 86400 / janela if janela > 0 else 0.0
        # cada swap entra nos dois tokens: metade de cada lado, como no app
        vol = (_usd(lp["windowVolume0"], t0) + _usd(lp["windowVolume1"], t1)) / 2 * por_dia
        taxas = (_usd(lp["windowFee0"], t0) + _usd(lp["windowFee1"], t1)) * por_dia
        apr = taxas * 365 * (1 - lp["unstakedFee"] / 1_000_000) / tvl * 100
        # A taxa da Aero é dinâmica (WETH/cbBTC CL10: 0,05% de manhã, 0,15% à
        # tarde, 22/10): vale a que a pool cobrou na janela, taxas ÷ volume.
        # Sem volume, a do momento.
        fee = taxas / vol * 100 if vol > 0 and taxas > 0 else taxa_pct(lp)
        reward = 0.0      # o Sugar informa: 0 é "sem emissão", não "sem dado"
        emis = tokens.get(lp["emissionsToken"].lower())
        em_stake = _usd(lp["staked0"], t0) + _usd(lp["staked1"], t1)
        if lp["gaugeAlive"] and lp["emissions"] > 0 and emis and emis.get("preco") and em_stake > 0:
            reward = lp["emissions"] / 10 ** emis["decimais"] * emis["preco"] * ANO_S / em_stake * 100
        endereco = lp["lp"].lower()
        out.append(Candidata(
            id=f"gecko:{net}:{endereco}", fonte="aero", rede=rede, dex="Aero",
            par=f"{t0['simbolo']}/{t1['simbolo']}",
            token_a=TokenRef(lp["token0"], t0["simbolo"]), token_b=TokenRef(lp["token1"], t1["simbolo"]),
            fee=round(fee, 6), tvl=tvl, vol_24h=vol, vol_7d=None, apr=apr, apr_reward=reward,
            criada_em=datetime.fromtimestamp(lp["createdAt"], timezone.utc) if lp["createdAt"] else None,
            projeto=projeto(lp),
            sinais={"endereco_pool": endereco, "fonte_direta": "Aero", "taxa_atual": taxa_pct(lp),
                    "emissao_no_teto": bool(lp["emissions"]) and lp["emissions"] >= lp["emissionsCap"],
                    "parte_em_stake": round(em_stake / tvl, 4)},
        ))
    return out


def tokens_das_pools(lps: list[dict]) -> list[str]:
    """Endereços a precificar: os dois lados das pools com reserva e o token da emissão."""
    vistos: dict[str, None] = {}
    for lp in lps:
        if lp["reserve0"] or lp["reserve1"]:
            vistos[lp["token0"].lower()] = None
            vistos[lp["token1"].lower()] = None
        if lp["emissions"]:
            vistos[lp["emissionsToken"].lower()] = None
    return list(vistos)
