"""Classificação de risco por ATR% e a regra de estrutura das cestas."""

from __future__ import annotations

from datetime import date, timedelta

from central_rwa.engine import risco
from central_rwa.models import DailyBar


def serie_atr(n: int, preco: float = 100.0, amplitude_pct: float = 2.0, start=date(2026, 1, 1)) -> list[DailyBar]:
    """Série com amplitude diária constante: o ATR% tem de bater com ela."""
    out, d = [], start
    for _ in range(n):
        alta, baixa = preco * (1 + amplitude_pct / 200), preco * (1 - amplitude_pct / 200)
        out.append(DailyBar(day=d, open=preco, high=alta, low=baixa, close=preco, volume=1000))
        d += timedelta(days=1)
    return out


def test_true_range_considera_o_gap():
    b = DailyBar(day=date(2026, 1, 2), high=110, low=105, close=108)
    assert risco.true_range(b, 100) == 10  # |alta - fechamento anterior| manda
    assert risco.true_range(b, 107) == 5  # sem gap, é alta - baixa
    assert risco.true_range(DailyBar(day=date(2026, 1, 2), close=10), 10) is None  # sem máxima/mínima


def test_atr_pct_de_uma_serie_de_amplitude_conhecida():
    atr, pregoes = risco.atr_pct(serie_atr(200, amplitude_pct=2.0))
    assert abs(atr - 2.0) < 0.05 and pregoes >= risco.MIN_PREGOES_ATR


def test_atr_pct_exige_janela_minima():
    atr, pregoes = risco.atr_pct(serie_atr(40))
    assert atr is None and pregoes < risco.MIN_PREGOES_ATR


def test_atr_pct_usa_so_a_janela_recente():
    """Volatilidade muda de regime: o que conta é o pedaço recente."""
    calmo = serie_atr(300, amplitude_pct=1.0)
    agitado = serie_atr(200, amplitude_pct=6.0, start=calmo[-1].day + timedelta(days=1))
    atr, _ = risco.atr_pct(calmo + agitado, janela_dias=120)
    assert atr > 5


def test_classificar_corta_em_tercis():
    series = {
        "CALMO1": serie_atr(200, amplitude_pct=0.5), "CALMO2": serie_atr(200, amplitude_pct=0.7),
        "MEIO1": serie_atr(200, amplitude_pct=2.0), "MEIO2": serie_atr(200, amplitude_pct=2.2),
        "DOIDO1": serie_atr(200, amplitude_pct=6.0), "DOIDO2": serie_atr(200, amplitude_pct=7.0),
    }
    cands, (baixo, alto) = risco.classificar({"t": list(series)}, lambda t: series.get(t, []))
    classe = {c.ticker: c.classe for c in cands}
    assert classe["CALMO1"] == classe["CALMO2"] == "conservador"
    assert classe["MEIO1"] == classe["MEIO2"] == "mediano"
    assert classe["DOIDO1"] == classe["DOIDO2"] == "agressivo"
    assert baixo < alto
    assert [c.ticker for c in cands][:2] == ["DOIDO2", "DOIDO1"]  # ordenado do mais agitado


def test_classificar_registra_quem_ficou_sem_medida():
    cands, _ = risco.classificar({"t": ["X", "CURTO"]}, lambda t: serie_atr(200) if t == "X" else (serie_atr(30) if t == "CURTO" else []))
    por = {c.ticker: c for c in cands}
    assert por["X"].classe and por["CURTO"].classe is None and "pregões na janela" in por["CURTO"].motivo


def test_classificar_mantem_o_ativo_que_esta_em_dois_temas():
    series = {t: serie_atr(200, amplitude_pct=2.0) for t in ("A", "B")}
    cands, _ = risco.classificar({"ia": ["A"], "energia": ["A", "B"]}, lambda t: series.get(t, []))
    por = {c.ticker: c for c in cands}
    assert por["A"].temas == ["ia", "energia"]


def _cand(ticker, atr, classe, pregoes=500, temas=("tema",)):
    return risco.Candidato(ticker, list(temas), atr, 120, pregoes, date(2016, 1, 1), classe)


def test_propor_respeita_o_minimo_e_o_maximo():
    poucos = [_cand(f"P{i}", 2.0 + i / 10, "mediano", temas=("pouco",)) for i in range(4)]
    bastantes = [_cand(f"B{i}", 2.0 + i / 10, "mediano", temas=("muito",)) for i in range(10)]
    props = {p.tema: p for p in risco.propor(poucos + bastantes)}
    assert "pouco" not in props  # 4 candidatos: não vira cesta
    p = props["muito"]
    assert len(p.tickers) == 8 and len(p.sobra) == 2 and "sub-cestas" in p.nota


def test_propor_escolhe_os_representativos_e_nao_os_mais_agitados():
    """Pegar 'os mais agitados' faria um ativo só dominar as operações."""
    membros = [_cand("X0", 1.0, "agressivo"), *[_cand(f"X{i}", 5.0 + i / 10, "agressivo") for i in range(1, 9)]]
    (p,) = risco.propor(membros, max_ativos=5)
    assert "X0" not in p.tickers and "X0" in p.sobra


def test_propor_deixa_de_fora_quem_nao_tem_historico_para_treinar():
    membros = [_cand(f"X{i}", 2.0, "mediano") for i in range(5)] + [_cand("NOVO", 2.0, "mediano", pregoes=100)]
    (p,) = risco.propor(membros, min_pregoes=300)
    assert "NOVO" not in p.tickers and len(p.tickers) == 5


def test_propor_separa_por_classe_e_ordena_do_conservador_ao_agressivo():
    membros = ([_cand(f"A{i}", 7.0, "agressivo") for i in range(5)]
               + [_cand(f"C{i}", 0.5, "conservador") for i in range(5)])
    props = risco.propor(membros)
    assert [p.classe for p in props] == ["conservador", "agressivo"]


def test_candidatos_yaml_do_projeto_e_valido():
    from central_rwa.config import load_yaml

    raw = load_yaml("candidatos.yaml")
    temas = raw.get("temas") or {}
    assert temas
    for chave, tema in temas.items():
        assert tema.get("nome"), f"tema {chave} sem nome"
        assert len(tema.get("tickers") or []) >= risco.MIN_ATIVOS, f"tema {chave} com candidatos de menos"
