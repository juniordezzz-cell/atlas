from __future__ import annotations

from datetime import date, timedelta

from central_rwa.db import MemoryRepository
from central_rwa.engine import runner
from central_rwa.engine.events import (
    compute_stats,
    daily_moves,
    forward_path,
    is_trigger,
    kind_of,
    level_of,
    similar_events,
)
from central_rwa.engine.swing import Rules, check_live, decide, simulate
from central_rwa.models import DailyBar
from central_rwa.reference import ReferenceRegistry


def serie(closes, start=date(2020, 1, 1)):
    """Série diária a partir de fechamentos (máxima/mínima = fechamento ± 0,5%)."""
    out, d = [], start
    for c in closes:
        out.append(DailyBar(day=d, open=c, high=c * 1.005, low=c * 0.995, close=c, volume=1000))
        d += timedelta(days=1)
    return out


def com_quedas(n_quedas=12, recupera=True, base=100.0, espaco=30):
    """Série com n quedas de -6% seguidas de recuperação (ou continuação)."""
    closes = [base] * 40
    for _ in range(n_quedas):
        p = closes[-1]
        closes.append(p * 0.94)  # queda de 6%
        for _ in range(12):
            closes.append(closes[-1] * (1.006 if recupera else 0.996))
        closes += [closes[-1]] * espaco
    return serie(closes)


def test_daily_moves_e_gatilho():
    bars = serie([100, 106, 100.7])
    m = daily_moves(bars)
    assert round(m[0].ret_pct, 2) == 6.0 and is_trigger(m[0].ret_pct) and kind_of(m[0].ret_pct) == "alta_brusca"
    assert not is_trigger(m[1].ret_pct) and kind_of(m[1].ret_pct) == "queda_brusca"


def test_forward_path_precisa_de_10_pregoes():
    bars = serie([100] * 5)
    assert forward_path(bars, 1) is None
    bars = serie([100] + [110] * 12)
    p = forward_path(bars, 1)
    assert p.fwd[1] == 0 and round(p.max_up_pct, 2) == 0.5


def test_semelhantes_nao_olham_o_futuro():
    bars = com_quedas(12)
    moves = daily_moves(bars)
    eventos = [m for m in moves if is_trigger(m.ret_pct)]
    ultimo = eventos[-1]
    sem = similar_events(bars, moves, ultimo)
    assert len(sem) == len(eventos) - 1  # todos os anteriores, nenhum posterior
    assert all(p.event_idx + 10 < ultimo.idx for p in sem)
    primeiro = eventos[0]
    assert similar_events(bars, moves, primeiro) == []


def test_estatistica_de_recuperacao():
    bars = com_quedas(12, recupera=True)
    moves = daily_moves(bars)
    ultimo = [m for m in moves if is_trigger(m.ret_pct)][-1]
    st = compute_stats(similar_events(bars, moves, ultimo))
    assert st.n == 11
    assert st.mediana[7] > 0 and st.pct_positivo[7] == 100.0
    assert st.as_dict()["mediana"]["7"] == round(st.mediana[7], 2)


def test_nivel_extremo():
    moves = daily_moves(serie([100, 89]))
    assert level_of(-11, moves, 5) == "EXTREMO"
    assert level_of(-6, moves, 5) == "ATENCAO"


def test_decide_regras_v1():
    bars = com_quedas(12, recupera=True)
    moves = daily_moves(bars)
    ultimo = [m for m in moves if is_trigger(m.ret_pct)][-1]
    st = compute_stats(similar_events(bars, moves, ultimo))
    d = decide(st)
    assert d.abrir and d.alvo_pct >= 1.0 and -8.0 <= d.stop_pct <= -1.5
    # amostra pequena
    st.n = 5
    assert not decide(st).abrir
    # histórico de continuação: fica de fora (sem venda a descoberto)
    bars2 = com_quedas(12, recupera=False)
    moves2 = daily_moves(bars2)
    u2 = [m for m in moves2 if is_trigger(m.ret_pct)][-1]
    assert not decide(compute_stats(similar_events(bars2, moves2, u2))).abrir


def test_simulate_alvo_stop_prazo_e_conservador():
    r = Rules(custo_ida_volta_pct=0.3)
    sobe = serie([101, 103, 105])
    ex = simulate(100, sobe, alvo_pct=2, stop_pct=-5, rules=r)
    assert ex.motivo == "alvo" and ex.price == 102 and ex.ret_liquido_pct == 1.7
    cai = serie([98, 94])
    assert simulate(100, cai, 2, -5, r).motivo == "stop"
    parado = serie([100] * 10)
    ex = simulate(100, parado, 2, -5, r)
    assert ex.motivo == "prazo" and ex.pregoes == 7
    # alvo e stop no mesmo pregão: assume o stop
    ambos = [DailyBar(day=date(2020, 1, 1), high=110, low=90, close=100)]
    assert simulate(100, ambos, 2, -5, r).motivo == "stop"
    assert simulate(100, serie([100] * 3), 2, -5, r) is None  # ainda aberta


def test_check_live():
    assert check_live(100, 103, 2, -5) == "alvo"
    assert check_live(100, 94, 2, -5) == "stop"
    assert check_live(100, 101, 2, -5) is None


def test_train_e_live_ponta_a_ponta():
    repo = MemoryRepository()
    reg = ReferenceRegistry({})
    bars = com_quedas(20, recupera=True)
    repo.upsert_daily_bars("XYZ", bars, "t")
    repo.set_tiers({"XYZ"}, set())
    last = bars[-1].day
    res = runner.train(repo, reg, last)
    assert res.posicoes > 0 and res.acertos == res.posicoes
    assert all(p.mode == "backtest" and p.status == "fechada" for p in repo.positions)
    n = res.posicoes
    runner.train(repo, reg, last)  # substitui, não duplica
    assert len([p for p in repo.positions if p.mode == "backtest"]) == n

    # ao vivo: nova queda de 6% no último pregão → agente abre posição
    novo = bars + serie([bars[-1].close * 0.94], start=last + timedelta(days=1))
    repo.upsert_daily_bars("XYZ", novo[-1:], "t")
    hoje = novo[-1].day
    lv = runner.live(repo, reg, hoje)
    assert lv.abertas and lv.em_aberto == 1
    assert runner.live(repo, reg, hoje).abertas == []  # idempotente
    # preço sobe acima do alvo → fecha no acompanhamento
    pos = repo.open_positions("swing_v1")[0]
    repo.upsert_daily_bars("XYZ", serie([pos.entry_price * 1.2], start=hoje + timedelta(days=1)), "t")
    mon = runner.monitor(repo, hoje + timedelta(days=1))
    assert mon.fechadas and mon.em_aberto == 0
    assert repo.positions[-1].exit_reason == "alvo"


def test_preco_negativo_fica_fora_da_estatistica():
    """Petróleo WTI fechou em -US$ 37 em abr/2020: gerava 'pior em 10d -260%'."""
    closes = [20.0] * 30 + [18.0, 10.0, -37.0, 10.0, 12.0] + [15.0] * 30
    bars = serie(closes)
    bars[32] = DailyBar(day=bars[32].day, open=-30, high=-10, low=-40, close=-37, volume=1000)
    moves = daily_moves(bars)
    assert all(m.day != bars[32].day and m.day != bars[33].day for m in moves)
    for m in moves:
        p = forward_path(bars, m.idx)
        if p:
            assert p.max_down_pct > -100 and p.min_7d_pct > -100
