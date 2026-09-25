"""Conferência em segunda fonte — nenhum número sobe para o ranking sem ser checado.

POR QUE EXISTE (24/09/2026)
---------------------------
A DefiLlama entregou, numa coleta, a pool Uniswap v4 USDC/cbBTC (Base) com
volume de 24 h de US$ 16,15 M e taxa de 0,18%. Na própria Uniswap, na mesma
hora: US$ 364,6 mil e 0,15%. A GeckoTerminal: US$ 366 mil e 0,15%. O Scanner
aceitou a fonte sem conferir, deu nota 86, APR de 793% e pôs a pool em 2º no
ranking. Para uma ferramenta que orienta onde pôr dinheiro, um número errado
com cara de certo é o pior defeito possível.

O QUE FAZ
---------
As pools da DefiLlama que mais podem subir no ranking (maior eficiência =
volume × taxa ÷ TVL) são conferidas na GeckoTerminal. Uma busca por par
("USDC cbBTC" na Base) devolve todas as pools daquele par com taxa, TVL e
volume — uma chamada confere várias.

A pool da DefiLlama casa com a da GeckoTerminal quando é a mesma DEX (mesma
família e, se a DefiLlama disser, a mesma versão v2/v3/v4) e o TVL está a
menos de 15% — o TVL é o número em que as fontes concordam, e o mais estável.

Com o par casado:
  · taxa: vale a da GeckoTerminal (vem do nome da pool on-chain, "0.15%")
    SÓ nas DEXs de taxa fixa por pool (Uniswap, PancakeSwap, Raydium, Orca...).
    Na Aerodrome/Velodrome (Slipstream, taxa dinâmica) o nome da GeckoTerminal
    traz outro número: AERO/cbBTC aparecia com 0,6% onde a taxa efetiva era
    0,075% — conferido pelo APR da própria DefiLlama (165% com US$ 7,49 M de
    volume só fecha com ~0,075%). Ali a taxa da DefiLlama fica;
  · volume: se as fontes divergem mais de 50%, vale o MENOR — na dúvida o
    Scanner nunca exagera o que a pool rende;
  · APR: se taxa ou volume mudaram, é refeito (volume × taxa × 365 ÷ TVL).
Sem par casado a pool fica marcada "não confirmada" e vai para Caça: Sólida é
só o que foi conferido.

Tudo fica registrado em sinais["conferencia"], para a tela poder mostrar.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .modelos import Candidata

TOL_TVL = 0.15          # TVL a menos de 15%: é a mesma pool
DIVERGE_VOL = 1.5       # volume diverge quando um é mais de 1,5× o outro
# Famílias em que a taxa do nome da pool na GeckoTerminal é a taxa on-chain fixa.
TAXA_FIXA_NA_GECKO = {"uniswap", "pancakeswap", "sushiswap", "raydium", "orca", "camelot",
                      "quickswap", "thena", "cetus", "meteora"}
MAX_PARES = 40          # buscas por coleta (~7 min a 6 pedidos/min)


@dataclass
class PoolGecko:
    dex: str            # slug da GeckoTerminal, "uniswap-v4-base"
    fee: float | None   # %, None quando o nome não traz
    tvl: float
    vol_24h: float
    endereco: str


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def parse_busca(payload: dict) -> list[PoolGecko]:
    out: list[PoolGecko] = []
    for item in (payload or {}).get("data") or []:
        a = item.get("attributes") or {}
        dex = ((((item.get("relationships") or {}).get("dex") or {}).get("data")) or {}).get("id") or ""
        m = re.search(r"([\d.]+)\s*%\s*$", str(a.get("name") or ""))
        out.append(PoolGecko(
            dex=str(dex),
            fee=float(m.group(1)) if m else None,
            tvl=_num(a.get("reserve_in_usd")),
            vol_24h=_num((a.get("volume_usd") or {}).get("h24")),
            endereco=str(a.get("address") or ""),
        ))
    return out


def _familia(projeto: str) -> tuple[str, str | None]:
    """"uniswap-v4" → ("uniswap", "v4"); "aerodrome-slipstream" → ("aerodrome", None)."""
    s = (projeto or "").lower().replace("_", "-")
    fam = s.split("-")[0]
    ver = re.search(r"\bv(\d)\b", s.replace("-", " "))
    return fam, ("v" + ver.group(1)) if ver else None


def _mesma_dex(projeto: str, dex_gecko: str) -> bool:
    fam, ver = _familia(projeto)
    slug = (dex_gecko or "").lower().replace("_", "-")
    if not fam or not slug.startswith(fam):
        return False
    if ver:
        return re.search(r"\b" + ver + r"\b", slug.replace("-", " ")) is not None
    return True


def casar(c: Candidata, pools: list[PoolGecko]) -> PoolGecko | None:
    if c.tvl <= 0:
        return None
    melhor, dist = None, None
    for g in pools:
        if not _mesma_dex(c.projeto, g.dex) or g.tvl <= 0:
            continue
        d = abs(g.tvl - c.tvl) / c.tvl
        if d <= TOL_TVL and (dist is None or d < dist):
            melhor, dist = g, d
    return melhor


def aplicar(c: Candidata, g: PoolGecko | None) -> None:
    """Corrige a candidata com o que a segunda fonte confirmou (no lugar)."""
    if g is None:
        c.sinais["conferencia"] = {"estado": "nao_confirmada"}
        return
    ajustes: list[str] = []
    fee_antes, vol_antes = c.fee, c.vol_24h
    taxa_confiavel = _familia(c.projeto)[0] in TAXA_FIXA_NA_GECKO
    if taxa_confiavel and g.fee is not None and abs(g.fee - c.fee) > 1e-9:
        ajustes.append(f"taxa {c.fee:g}% → {g.fee:g}%")
        c.fee = g.fee
    alto, baixo = max(c.vol_24h, g.vol_24h), min(c.vol_24h, g.vol_24h)
    if baixo > 0 and alto / baixo > DIVERGE_VOL:
        ajustes.append(f"volume {c.vol_24h:,.0f} → {baixo:,.0f}")
        c.vol_24h = baixo
    elif baixo <= 0 < alto:
        # uma das fontes diz zero: não dá para afirmar o volume maior
        ajustes.append(f"volume {c.vol_24h:,.0f} → 0 (sem confirmação)")
        c.vol_24h = 0.0
    if (c.fee != fee_antes or c.vol_24h != vol_antes) and c.tvl > 0:
        c.apr = c.vol_24h * c.fee / 100 * 365 / c.tvl * 100
    c.sinais["conferencia"] = {"estado": "conferida", "fonte": "geckoterminal",
                               "endereco": g.endereco, "ajustes": ajustes}


def _eficiencia(c: Candidata) -> float:
    return (c.vol_24h * c.fee / c.tvl) if c.tvl > 0 else 0.0


def conferir(cli, cands: list[Candidata], gecko_net: dict[str, str], max_pares: int = MAX_PARES) -> dict:
    """Confere as candidatas da DefiLlama, das mais eficientes para as menos,
    até `max_pares` buscas. Devolve um resumo para o log da coleta."""
    alvo = [c for c in cands if c.fonte == "defillama" and c.rede in gecko_net]
    alvo.sort(key=_eficiencia, reverse=True)
    pares: dict[tuple[str, str], list[Candidata]] = {}
    for c in alvo:
        k = (c.rede, c.par)
        if k not in pares and len(pares) >= max_pares:
            continue
        pares.setdefault(k, []).append(c)
    resumo = {"pares_buscados": 0, "conferidas": 0, "ajustadas": 0, "nao_confirmadas": 0}
    for (rede, par), lista in pares.items():
        payload = cli.gecko_busca(gecko_net[rede], par.replace("/", " "))
        if payload is None:
            continue                                    # sem resposta: fica como estava, "não conferida"
        resumo["pares_buscados"] += 1
        pools = parse_busca(payload)
        for c in lista:
            aplicar(c, casar(c, pools))
            est = c.sinais["conferencia"]
            if est["estado"] == "conferida":
                resumo["conferidas"] += 1
                if est["ajustes"]:
                    resumo["ajustadas"] += 1
            else:
                resumo["nao_confirmadas"] += 1
    return resumo
