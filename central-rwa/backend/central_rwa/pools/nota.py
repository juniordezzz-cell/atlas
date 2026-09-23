"""Nota 0–100: rendimento 40% · consistência 30% · profundidade 20% · tendência 10%.
Cada componente vai de 0 a 1 e fica gravado, para o Guia poder explicar a nota."""

from __future__ import annotations

import math
from statistics import mean, pstdev

from .modelos import Candidata, Leitura

VE33 = {"Aerodrome", "Velodrome", "THENA", "Pharaoh", "Ramses"}
PESOS = {"rendimento": 0.40, "consistencia": 0.30, "profundidade": 0.20, "tendencia": 0.10}


def eficiencia(c: Candidata) -> float:
    """Quanto a pool rende por dia, em % do capital."""
    vol_dia = c.vol_7d / 7 if c.vol_7d else c.vol_24h
    taxa = c.fee * vol_dia / c.tvl if c.tvl > 0 else 0.0
    if c.dex in VE33:  # nas ve(3,3) o LP recebe as emissões, não a taxa
        lp = max(c.apr or 0, c.apr_reward or 0) / 365
        return max(taxa, lp)
    return taxa


def _percentis(valores: dict[str, float]) -> dict[str, float]:
    ordem = sorted(valores, key=lambda k: valores[k])
    n = len(ordem)
    return {k: (i / (n - 1) if n > 1 else 1.0) for i, k in enumerate(ordem)}


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
    rend = _percentis({c.id: eficiencia(c) for c in cands})
    out: dict[str, tuple[float, dict]] = {}
    for c in cands:
        ls = leituras_por_pool.get(c.id, [])
        comp = {
            "rendimento": round(rend[c.id], 4),
            "consistencia": round(_consistencia(ls), 4),
            "profundidade": round(_profundidade(c.tvl), 4),
            "tendencia": round(_tendencia(ls), 4),
        }
        out[c.id] = (round(100 * sum(PESOS[k] * v for k, v in comp.items()), 1), comp)
    return out
