"""Agente de swing trade v1 (seção 9 da especificação).

Camada 1 (analista): lê a estatística de eventos semelhantes.
Camada 2 (operador simulado): decide, abre a posição simulada e a acompanha
até alvo, stop ou prazo. NENHUMA ordem real é executada.

Regras v1 (seção 9.4) — ponto de partida, a aprimorar com o placar.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from ..models import DailyBar
from .events import EventStats

AGENT = "swing_v1"


@dataclass(frozen=True)
class Rules:
    """Regras de um agente. Os padrões são a v1 (seção 9.4)."""

    gatilho_pct: float = 5.0  # variação no pregão que faz o agente olhar o evento
    setups: tuple[str, ...] = ("queda_brusca", "alta_brusca")
    alvo_modo: str = "mediana_fwd"  # mediana_fwd | mediana_max | nenhum (sai só no stop ou no prazo)
    alvo_fator: float = 1.0  # multiplica o alvo calculado
    stop_modo: str = "p20"  # p20 | p50 | fixo
    stop_fixo_pct: float = -5.0
    mediana_minima_pct: float = 0.0  # a mediana de 7 pregões precisa passar disso
    amostra_minima: int = 10
    prazo_pregoes: int = 7
    prazo_maximo_pregoes: int = 10
    pct_positivo_minimo: float = 55.0  # % dos eventos semelhantes que subiram em 7 pregões
    stop_maximo_pct: float = -8.0
    stop_minimo_pct: float = -1.5  # stop mais apertado que isso vira ruído
    alvo_minimo_pct: float = 1.0
    custo_ida_volta_pct: float = 0.3


RULES_V1 = Rules()


@dataclass
class Decision:
    abrir: bool
    motivo: str
    alvo_pct: float | None = None
    stop_pct: float | None = None


SEM_ALVO_PCT = 1000.0  # alvo "infinito": a posição sai no stop ou no prazo


def decide(stats: EventStats, rules: Rules = RULES_V1, setup: str | None = None) -> Decision:
    h = rules.prazo_pregoes
    if setup and setup not in rules.setups:
        return Decision(False, f"setup {setup} fora da estratégia deste agente")
    if stats.n < rules.amostra_minima:
        return Decision(False, f"amostra pequena ({stats.n} < {rules.amostra_minima})")
    med = stats.mediana.get(h)
    pos = stats.pct_positivo.get(h)
    if med is None or pos is None:
        return Decision(False, "sem estatística no prazo")
    if med <= rules.mediana_minima_pct or pos < rules.pct_positivo_minimo:
        # Tokens à vista não permitem venda a descoberto: o agente fica de fora.
        return Decision(False, f"histórico desfavorável (mediana {h}d {med:+.1f}%, {pos:.0f}% positivos)")

    if rules.alvo_modo == "nenhum":
        alvo = SEM_ALVO_PCT
    else:
        base = stats.mediana_max_7d if rules.alvo_modo == "mediana_max" and stats.mediana_max_7d is not None else med
        alvo = max(base * rules.alvo_fator, rules.alvo_minimo_pct)

    if rules.stop_modo == "fixo":
        stop = rules.stop_fixo_pct
    else:
        ref = stats.p50_min_7d if rules.stop_modo == "p50" else stats.p20_min_7d
        stop = ref if ref is not None else rules.stop_maximo_pct
    stop = max(stop, rules.stop_maximo_pct)  # nunca mais fundo que o máximo
    stop = min(stop, rules.stop_minimo_pct)  # nem mais raso que o mínimo
    return Decision(True, f"mediana {h}d {med:+.1f}%, {pos:.0f}% positivos em {stats.n} eventos", round(alvo, 2), round(stop, 2))


@dataclass
class Exit:
    day: date
    price: float
    motivo: str  # alvo | stop | prazo
    ret_pct: float  # bruto
    ret_liquido_pct: float
    pregoes: int


def simulate(entry_price: float, path: list[DailyBar], alvo_pct: float, stop_pct: float, rules: Rules = RULES_V1) -> Exit | None:
    """Acompanha a posição pelos pregões de `path` (os seguintes à entrada).
    Se alvo e stop cabem no mesmo pregão, assume o STOP (conservador)."""
    if not path or not entry_price:
        return None
    alvo = entry_price * (1 + alvo_pct / 100)
    stop = entry_price * (1 + stop_pct / 100)
    for i, b in enumerate(path[: rules.prazo_maximo_pregoes], start=1):
        low, high = (b.low or b.close), (b.high or b.close)
        if low <= stop:
            return _exit(b.day, stop, "stop", entry_price, i, rules)
        if high >= alvo:
            return _exit(b.day, alvo, "alvo", entry_price, i, rules)
        if i >= rules.prazo_pregoes:
            return _exit(b.day, b.close, "prazo", entry_price, i, rules)
    return None  # ainda em aberto (faltam pregões)


def check_live(entry_price: float, current_price: float, alvo_pct: float, stop_pct: float) -> str | None:
    """Ao vivo só há o preço atual (snapshots a cada 6h), sem máxima/mínima."""
    r = (current_price - entry_price) / entry_price * 100
    if r <= stop_pct:
        return "stop"
    if r >= alvo_pct:
        return "alvo"
    return None


def _exit(day: date, price: float, motivo: str, entry: float, n: int, rules: Rules) -> Exit:
    ret = (price - entry) / entry * 100
    return Exit(day, price, motivo, round(ret, 3), round(ret - rules.custo_ida_volta_pct, 3), n)
