"""Nota 0–100 pelo funil do dono (Guia, tópico "O funil de decisão"):

  rendimento   40%  a Eficiência %/dia — a taxa que compensa
  giro         30%  a Razão volume do dia ÷ TVL — o volume tem que passar o TVL
  consistência 15%  a razão estável nos últimos 7 dias — não é pico
  profundidade 10%  TVL real
  tendência     5%  TVL subindo ou caindo na semana

A régua é absoluta (não percentil): a mesma pool tem a mesma nota não
importa quantas outras entrem na coleta. Cada componente vai de 0 a 1 e
fica gravado, para o Guia e a dica da tela explicarem a nota."""

from __future__ import annotations

import math
from statistics import mean, pstdev

from .modelos import Candidata, Leitura

VE33 = {"Aerodrome", "Velodrome", "THENA", "Pharaoh", "Ramses"}
PESOS = {"rendimento": 0.40, "giro": 0.30, "consistencia": 0.15, "profundidade": 0.10, "tendencia": 0.05}


def razao(c: Candidata) -> float:
    """Volume do dia (últimas 24h) ÷ TVL."""
    return c.vol_24h / c.tvl if c.tvl > 0 else 0.0


def eficiencia(c: Candidata) -> float:
    """Quanto a pool rende por dia, em % do capital."""
    taxa = c.fee * razao(c)
    if c.dex in VE33:  # nas ve(3,3) o LP recebe as emissões, não a taxa
        lp = max(c.apr or 0, c.apr_reward or 0) / 365
        return max(taxa, lp)
    if c.fee <= 0 and c.apr:  # taxa dinâmica (Uniswap v4) chega como 0: vale o APR da fonte
        return c.apr / 365
    return taxa


def _rendimento(efic: float) -> float:
    if efic <= 0:
        return 0.0
    return max(0.0, min(1.0, (math.log10(efic) + 2) / 2))    # 0,01%/dia -> 0 · 1%/dia -> 1


def _giro(r: float) -> float:
    if r <= 0:
        return 0.0
    if r < 1:
        return 0.3 * r                                        # volume abaixo do TVL: capital parado
    if r < 3:
        return 0.3 + 0.2 * (r - 1)                            # 1× -> 0,3 · 3× -> 0,7
    return min(1.0, 0.7 + 0.3 * (r - 3) / 7)                  # 3× -> 0,7 · 10× -> 1


def _consistencia(ls: list[Leitura]) -> float:
    ult = sorted(ls, key=lambda x: x.dia)[-7:]
    razoes = [l.vol_24h / l.tvl for l in ult if l.tvl > 0]
    if len(razoes) < 3 or mean(razoes) == 0:
        return 0.5   # sem histórico suficiente: neutro
    cv = pstdev(razoes) / mean(razoes)
    return max(0.0, min(1.0, 1 - cv))


def _profundidade(tvl: float) -> float:
    if tvl <= 0:
        return 0.0
    return max(0.0, min(1.0, (math.log10(tvl) - 5) / 3))      # US$ 100 mil -> 0 · US$ 100 mi -> 1


def _tendencia(ls: list[Leitura]) -> float:
    ult = sorted(ls, key=lambda x: x.dia)
    if len(ult) < 2:
        return 0.5
    ini = next((l for l in ult if (ult[-1].dia - l.dia).days <= 7), ult[0])
    if ini.tvl <= 0:
        return 0.5
    var = ult[-1].tvl / ini.tvl - 1
    return max(0.0, min(1.0, (var + 0.30) / 0.60))           # -30% -> 0 · +30% -> 1


def calcular_notas(cands: list[Candidata], leituras_por_pool: dict[str, list[Leitura]]) -> dict[str, tuple[float, dict]]:
    out: dict[str, tuple[float, dict]] = {}
    for c in cands:
        ls = leituras_por_pool.get(c.id, [])
        comp = {
            "rendimento": round(_rendimento(eficiencia(c)), 4),
            "giro": round(_giro(razao(c)), 4),
            "consistencia": round(_consistencia(ls), 4),
            "profundidade": round(_profundidade(c.tvl), 4),
            "tendencia": round(_tendencia(ls), 4),
        }
        out[c.id] = (round(100 * sum(PESOS[k] * v for k, v in comp.items()), 1), comp)
    return out
