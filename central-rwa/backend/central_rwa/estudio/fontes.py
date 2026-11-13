"""Fontes da varredura: DexScreener (snapshot), DeFiLlama (preço por hora) e
GeckoTerminal (velas de 1h, só de reserva).

Testadas em 11/11/2026, sem chave:
- DexScreener /latest/dex/pairs/{rede}/{a,b,...}: até 30 pools por chamada,
  limite oficial de 300 pedidos/min. Não informa a taxa da pool.
- GeckoTerminal /ohlcv/hour com token=<ativo>&currency=token: preço do ativo
  em unidades do outro token do par; 1.000 velas (41 dias) por chamada. O
  ritmo (~6 pedidos/min medidos) é o do ClienteFontes do Scanner.

Testada em 13/11/2026, sem chave:
- DeFiLlama coins.llama.fi/chart/{rede:token,...}?start&span&period=1h: preço
  do token em dólar, um ponto por hora (às vezes falta alguma), no máximo 500
  pontos por chamada somando todos os tokens. 12 pedidos seguidos sem recusa.
  Vira a fonte principal do histórico (13/11): 1 chamada por hora atualiza
  todas as pools; a GeckoTerminal fica para quem a DeFiLlama não conhece.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from .. import USER_AGENT
from ..pools.config import STABLES
from ..pools.fontes import GECKO, ClienteFontes

DEXSCREENER = "https://api.dexscreener.com/latest/dex/pairs"
LLAMA_CHART = "https://coins.llama.fi/chart"
REDE_LLAMA = {"Solana": "solana", "Base": "base"}
LLAMA_MAX_PONTOS = 500
REDE_DS = {"Solana": "solana", "Base": "base"}
REDE_GT = {"Solana": "solana", "Base": "base"}
POR_CHAMADA_DS = 30

# Quem faz papel de "dinheiro" no par: o ativo é o OUTRO token. Menor = mais
# cotação. Empate (dois tokens quaisquer) fica com o token base da DexScreener.
_COTACAO = {**{s: 0 for s in STABLES}, "WETH": 1, "ETH": 1, "SOL": 2, "WSOL": 2, "CBBTC": 3, "WBTC": 3, "BTC": 3}


@dataclass
class Snapshot:
    pool_id: str
    preco: float | None       # ativo em unidades do outro token
    preco_usd: float | None   # ativo em dólar
    tvl: float
    vol_24h: float
    ativo: str                # endereço
    ativo_simbolo: str
    cotacao: str              # símbolo do outro token
    cotacao_end: str = ""     # endereço do outro token


def escolher_ativo(base: dict, quote: dict) -> tuple[dict, dict]:
    """(ativo, cotação) entre os dois tokens de um par da DexScreener."""
    pb = _COTACAO.get(str(base.get("symbol", "")).upper(), 99)
    pq = _COTACAO.get(str(quote.get("symbol", "")).upper(), 99)
    return (quote, base) if pb < pq else (base, quote)


def _num(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x and x not in (float("inf"), float("-inf")) else None


def parse_par_ds(par: dict, pool_id: str) -> Snapshot | None:
    """Um par da DexScreener → Snapshot. None sem liquidez ou volume."""
    base, quote = par.get("baseToken") or {}, par.get("quoteToken") or {}
    tvl = _num((par.get("liquidity") or {}).get("usd"))
    vol = _num((par.get("volume") or {}).get("h24"))
    if not tvl or tvl <= 0 or vol is None:
        return None
    ativo, cot = escolher_ativo(base, quote)
    nativo, usd = _num(par.get("priceNative")), _num(par.get("priceUsd"))
    if ativo is base:
        preco, preco_usd = nativo, usd
    else:  # o ativo é o quote: inverte
        preco = 1 / nativo if nativo else None
        preco_usd = usd / nativo if (usd and nativo) else None
    return Snapshot(pool_id, preco, preco_usd, tvl, vol, str(ativo.get("address", "")),
                    str(ativo.get("symbol", "")), str(cot.get("symbol", "")), str(cot.get("address", "")))


def cotacao_estavel(simbolo: str | None) -> bool:
    return str(simbolo or "").upper() in STABLES


def chave_llama(rede: str, endereco: str | None) -> str | None:
    """Token no formato da DeFiLlama (solana:<mint>, base:<0x...>)."""
    if not endereco or rede not in REDE_LLAMA:
        return None
    return f"{REDE_LLAMA[rede]}:{endereco if rede == 'Solana' else endereco.lower()}"


def parse_precos_llama(j: dict) -> dict[str, dict[int, float]]:
    """Resposta do /chart → {chave: {hora_unix (início da hora): preço}}.
    Pontos da mesma hora: fica o mais recente. Chave em minúsculas na Base."""
    out: dict[str, dict[int, float]] = {}
    for chave, v in ((j or {}).get("coins") or {}).items():
        rede, _, end = chave.partition(":")
        k = f"{rede}:{end.lower()}" if rede != "solana" else chave
        horas: dict[int, tuple[int, float]] = {}
        for ponto in (v or {}).get("prices") or []:
            t, preco = _num(ponto.get("timestamp")), _num(ponto.get("price"))
            if t is None or not preco or preco <= 0:
                continue
            h = int(t) // 3600 * 3600
            if h not in horas or t >= horas[h][0]:
                horas[h] = (int(t), preco)
        out[k] = {h: p for h, (_, p) in horas.items()}
    return out


def velas_de_precos(ativo: dict[int, float], cotacao: dict[int, float] | None
                    ) -> list[tuple[datetime, float, float, float, float, float]]:
    """Preço do ativo na moeda da cotação, uma "vela" por hora (abertura =
    máxima = mínima = fechamento). Sem a cotação (stable), o preço em dólar.
    Hora sem os dois preços fica de fora. Volume entra depois (snapshots)."""
    out = []
    for h in sorted(ativo):
        if cotacao is None:
            p = ativo[h]
        elif cotacao.get(h):
            p = ativo[h] / cotacao[h]
        else:
            continue
        out.append((datetime.fromtimestamp(h, timezone.utc), p, p, p, p, 0.0))
    return out


def parse_velas_gt(j: dict) -> list[tuple[datetime, float, float, float, float, float]]:
    """OHLCV da GeckoTerminal → [(hora, abertura, máxima, mínima, fechamento, volume)], crescente."""
    lista = (((j or {}).get("data") or {}).get("attributes") or {}).get("ohlcv_list") or []
    out = {}
    for v in lista:
        if not isinstance(v, (list, tuple)) or len(v) < 5:
            continue
        t, o, h, l, c = (_num(x) for x in v[:5])
        vol = _num(v[5]) if len(v) > 5 else 0.0
        if t is None or not all(x and x > 0 for x in (o, h, l, c)):
            continue
        out[int(t)] = (datetime.fromtimestamp(int(t), timezone.utc), o, h, l, c, vol or 0.0)
    return [out[k] for k in sorted(out)]


class ClienteEstudio:
    """DexScreener direto; GeckoTerminal pelo mesmo controle de ritmo do Scanner."""

    def __init__(self, client: httpx.Client | None = None, gecko: ClienteFontes | None = None):
        self.client = client or httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        self.gecko = gecko or ClienteFontes(self.client)

    def pares_ds(self, rede: str, enderecos: list[str]) -> list[dict]:
        r = self.client.get(f"{DEXSCREENER}/{REDE_DS[rede]}/{','.join(enderecos)}")
        r.raise_for_status()
        return (r.json() or {}).get("pairs") or []

    def precos_llama(self, chaves: list[str], inicio: int, span: int) -> dict:
        """Preços por hora de vários tokens. span × tokens ≤ 500. Uma nova tentativa em erro."""
        url = f"{LLAMA_CHART}/{','.join(chaves)}"
        params = {"start": str(int(inicio)), "span": str(int(span)), "period": "1h"}
        for tentativa in (1, 2):
            try:
                r = self.client.get(url, params=params)
                if r.status_code == 200:
                    return r.json()
            except httpx.HTTPError:
                pass
        raise RuntimeError("DeFiLlama não respondeu")

    def velas_gt(self, rede: str, endereco: str, ativo: str, limite: int) -> dict | None:
        url = (f"{GECKO}/networks/{REDE_GT[rede]}/pools/{endereco}/ohlcv/hour"
               f"?aggregate=1&limit={max(1, min(1000, limite))}&currency=token&token={ativo}")
        r = self.gecko._gecko(url, tentativas=2)   # reserva: não fica minutos esperando a GT
        if r is None or r.status_code != 200:
            return None
        return r.json()
