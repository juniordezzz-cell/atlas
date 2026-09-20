"""Classificação de risco dos candidatos a cesta, pelo ATR%.

O eixo que manda é o RISCO — é ele que decide como o agente opera (stop, alvo,
prazo). O tema é só o filtro para escolher os ativos dentro de cada nível.

A classificação não é opinião: para cada candidato mede-se o **ATR% de 14
pregões** (Average True Range dividido pelo preço, em %, que é "quanto esse
ativo anda por dia"), tira-se a mediana dos últimos `JANELA_DIAS` dias e
rankeia-se todo mundo em **tercis** — 1/3 mais parado é conservador, 1/3 do
meio é mediano, 1/3 mais agitado é agressivo.

Volatilidade muda de regime, então isto é para ser refeito de tempos em tempos
(trimestral): um ativo mediano hoje pode virar agressivo se o setor entrar em
hype. `lab risco` é o comando que refaz a conta.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta

from ..models import DailyBar

PERIODO_ATR = 14
JANELA_DIAS = 180  # dias corridos de janela para medir a volatilidade atual
MIN_PREGOES_ATR = 60  # sem isso a mediana do ATR% não diz nada
CLASSES = ("conservador", "mediano", "agressivo")


def true_range(bar: DailyBar, fechamento_anterior: float) -> float | None:
    alta, baixa = bar.high, bar.low
    if alta is None or baixa is None or alta <= 0 or baixa <= 0 or fechamento_anterior <= 0:
        return None
    return max(alta - baixa, abs(alta - fechamento_anterior), abs(baixa - fechamento_anterior))


def atr_pct_serie(bars: list[DailyBar], periodo: int = PERIODO_ATR) -> list[tuple[date, float]]:
    """ATR de Wilder dividido pelo fechamento, em %, pregão a pregão."""
    trs: list[tuple[date, float, float]] = []
    for anterior, atual in zip(bars, bars[1:]):
        if not anterior.close or anterior.close <= 0 or not atual.close or atual.close <= 0:
            continue
        tr = true_range(atual, anterior.close)
        if tr is not None:
            trs.append((atual.day, tr, atual.close))
    if len(trs) <= periodo:
        return []
    atr = statistics.fmean(tr for _, tr, _ in trs[:periodo])
    out: list[tuple[date, float]] = []
    for dia, tr, fechamento in trs[periodo:]:
        atr = (atr * (periodo - 1) + tr) / periodo  # suavização de Wilder
        out.append((dia, atr / fechamento * 100))
    return out


def atr_pct(bars: list[DailyBar], ate: date | None = None, janela_dias: int = JANELA_DIAS,
            periodo: int = PERIODO_ATR) -> tuple[float | None, int]:
    """Mediana do ATR% na janela. Devolve (atr%, pregões usados)."""
    serie = atr_pct_serie(bars, periodo)
    if not serie:
        return None, 0
    ate = ate or serie[-1][0]
    desde = ate - timedelta(days=janela_dias)
    janela = [v for dia, v in serie if desde <= dia <= ate]
    if len(janela) < MIN_PREGOES_ATR:
        return None, len(janela)
    return round(statistics.median(janela), 2), len(janela)


@dataclass
class Candidato:
    ticker: str
    temas: list[str] = field(default_factory=list)
    atr_pct: float | None = None
    pregoes_janela: int = 0
    pregoes_total: int = 0
    primeiro_dia: date | None = None
    classe: str | None = None
    motivo: str = ""


def tickers_validos(lista, onde: str) -> list[str]:
    """No YAML, `ON` (ON Semiconductor) vira booleano e `NO` também. Sem esta
    checagem o ticker some da lista sem ninguém perceber."""
    out = []
    for t in lista or []:
        if not isinstance(t, str) or not t.strip():
            raise ValueError(f"{onde}: ticker inválido {t!r} — no YAML, tickers como ON e NO precisam de aspas")
        out.append(t.strip().upper())
    return out


def _tercis(valores: list[float]) -> tuple[float, float]:
    s = sorted(valores)
    def q(p: float) -> float:
        k = (len(s) - 1) * p
        lo, hi = int(k), min(int(k) + 1, len(s) - 1)
        return s[lo] + (s[hi] - s[lo]) * (k - lo)
    return q(1 / 3), q(2 / 3)


def classificar(temas: dict[str, list[str]], bars_of, ate: date | None = None) -> tuple[list[Candidato], tuple[float, float]]:
    """Mede o ATR% de cada candidato e corta a lista inteira em tercis."""
    por_ticker: dict[str, Candidato] = {}
    for tema, tickers in temas.items():
        for t in tickers_validos(tickers, f"tema {tema}"):
            por_ticker.setdefault(t, Candidato(t)).temas.append(tema)
    for c in por_ticker.values():
        bars = bars_of(c.ticker)
        c.pregoes_total = len(bars)
        c.primeiro_dia = bars[0].day if bars else None
        if not bars:
            c.motivo = "sem histórico"
            continue
        c.atr_pct, c.pregoes_janela = atr_pct(bars, ate)
        if c.atr_pct is None:
            c.motivo = f"só {c.pregoes_janela} pregões na janela (mínimo {MIN_PREGOES_ATR})"
    medidos = [c for c in por_ticker.values() if c.atr_pct is not None]
    if not medidos:
        return sorted(por_ticker.values(), key=lambda c: c.ticker), (0.0, 0.0)
    baixo, alto = _tercis([c.atr_pct for c in medidos])
    for c in medidos:
        c.classe = "conservador" if c.atr_pct <= baixo else ("mediano" if c.atr_pct <= alto else "agressivo")
    return sorted(por_ticker.values(), key=lambda c: (c.atr_pct is None, -(c.atr_pct or 0))), (round(baixo, 2), round(alto, 2))


# ------------------------------------------------------ regra de estrutura

MAX_CESTAS = 10
MIN_ATIVOS = 5
MAX_ATIVOS = 8


@dataclass
class Proposta:
    classe: str
    tema: str
    tickers: list[str]
    sobra: list[str] = field(default_factory=list)  # não coube no máximo
    nota: str = ""


def propor(candidatos: list[Candidato], min_ativos: int = MIN_ATIVOS, max_ativos: int = MAX_ATIVOS,
           min_pregoes: int = 300, estreia_ate: date | None = None) -> list[Proposta]:
    """Agrupa por (classe, tema) e monta cestas dentro da regra de estrutura.

    `estreia_ate` deixa de fora quem não tem história suficiente para treinar.
    Dentro de cada grupo ficam os ativos mais REPRESENTATIVOS da classe: os de
    ATR% mais perto da mediana do grupo. Assim a cesta não é só "os 8 mais
    agitados", que puxaria todo o sinal para um ativo só — foi exatamente o que
    aconteceu com a cesta 2 (gatilho fixo, 100% das operações em TSLA)."""
    grupos: dict[tuple[str, str], list[Candidato]] = {}
    for c in candidatos:
        if c.classe is None or c.pregoes_total < min_pregoes:
            continue
        # Ativo que estreou depois do corte só aparece na validação: entraria na
        # cesta sem nunca ter sido treinado, e ainda desequilibraria a comparação.
        if estreia_ate and (c.primeiro_dia is None or c.primeiro_dia > estreia_ate):
            continue
        for tema in c.temas:
            grupos.setdefault((c.classe, tema), []).append(c)
    out: list[Proposta] = []
    for (classe, tema), membros in grupos.items():
        if len(membros) < min_ativos:
            continue
        mediana = statistics.median([c.atr_pct for c in membros])
        ordenados = sorted(membros, key=lambda c: (abs(c.atr_pct - mediana), c.ticker))
        escolhidos = sorted(ordenados[:max_ativos], key=lambda c: -c.atr_pct)
        sobra = sorted(ordenados[max_ativos:], key=lambda c: -c.atr_pct)
        nota = f"tema grande demais: {len(membros)} candidatos, precisa virar sub-cestas" if sobra else ""
        out.append(Proposta(classe, tema, [c.ticker for c in escolhidos], [c.ticker for c in sobra], nota))
    ordem = {c: i for i, c in enumerate(CLASSES)}
    return sorted(out, key=lambda p: (ordem.get(p.classe, 9), p.tema))
