"""Laboratório: o que garante que o experimento é honesto.

O ponto mais importante aqui é `escolher`: a variante tem de sair do TREINO.
Se algum dia alguém trocar por "a melhor da validação", o teste quebra.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from central_rwa.engine import lab
from central_rwa.engine.agents import AgentDef, parse_agents
from central_rwa.engine.swing import Rules
from central_rwa.models import DailyBar

from .test_engine import com_quedas, serie

BASE = AgentDef("b", "Base", "", ("X",), Rules(), date(2021, 1, 1))


def _res(nome, treino, validacao):
    """(operações, médio, base) de cada período."""
    def p(t):
        return lab.Periodo(operacoes=t[0], medio_pct=t[1], base_media_pct=t[2])
    return lab.Resultado(nome, BASE, p(treino), p(validacao))


def test_escolher_olha_so_o_treino():
    bom_no_treino = _res("A", (50, 2.0, 1.0), (10, -3.0, 1.0))
    bom_na_validacao = _res("B", (50, 1.1, 1.0), (10, 9.0, 1.0))
    assert lab.escolher([bom_no_treino, bom_na_validacao]).nome == "A"


def test_escolher_exige_amostra_de_treino():
    poucas = _res("poucas", (5, 9.0, 1.0), (10, 9.0, 1.0))
    muitas = _res("muitas", (50, 1.5, 1.0), (10, 0.0, 1.0))
    assert lab.escolher([poucas, muitas], minimo_treino=30).nome == "muitas"
    assert lab.escolher([poucas], minimo_treino=30) is None


def test_vantagem_e_veredito():
    r = _res("x", (50, 2.0, 1.0), (30, 0.5, 1.2))
    assert r.treino.vantagem_pct == 1.0
    assert "não se sustentou" in r.veredito
    assert "promissor" in _res("y", (50, 2.0, 1.0), (8, 2.0, 1.0)).veredito
    assert "se sustentou" in _res("z", (50, 2.0, 1.0), (40, 2.0, 1.0)).veredito
    assert "sem operações" in _res("w", (50, 2.0, 1.0), (0, None, None)).veredito


def test_variantes_combina_cestas_e_regras():
    vs = lab.variantes(BASE, {"c1": ["X"], "c2": ["X", "Y"]}, {"gatilho_pct": [3, 5]})
    assert len(vs) == 4
    nomes = [n for n, _ in vs]
    assert "c2 · gatilho_pct=3" in nomes
    assert {a.rules.gatilho_pct for _, a in vs} == {3, 5}
    assert {len(a.cesta) for _, a in vs} == {1, 2}


def test_variantes_aceita_regras_que_andam_juntas():
    vs = lab.variantes(BASE, {"c": ["X"]}, {"prazo": [{"prazo_pregoes": 10, "prazo_maximo_pregoes": 15}]})
    (nome, agente), = vs
    assert agente.rules.prazo_pregoes == 10 and agente.rules.prazo_maximo_pregoes == 15
    assert "prazo=10/15" in nome


def test_variantes_recusa_prazo_maior_que_o_maximo():
    """Prazo acima do máximo faz a posição nunca fechar: o agente fica mudo."""
    with pytest.raises(ValueError, match="prazo_maximo_pregoes"):
        lab.variantes(BASE, {"c": ["X"]}, {"prazo_pregoes": [20]})


def test_avaliar_separa_treino_da_validacao_e_conta_recusas():
    bars = com_quedas(20, recupera=True)
    corte = bars[int(len(bars) * 0.75)].day  # depois das 10 primeiras quedas, senão o treino é só "amostra pequena"
    agente = AgentDef("a", "A", "", ("X",), Rules(setups=("queda_brusca",), gatilho_pct=5), corte)
    r = lab.avaliar("teste", agente, lambda t: bars if t == "X" else [], ["X"])
    assert r.treino.operacoes and r.validacao.operacoes
    assert r.gatilhos["treino"] and r.gatilhos["validacao"]
    assert r.recusas["treino"].get("abriu") == r.treino.operacoes
    assert r.treino.base_media_pct is not None  # o "não fazer nada" tem de existir


def test_avaliar_reporta_ativo_sem_historico():
    agente = AgentDef("a", "A", "", ("X", "VAZIO"), Rules(), date(2021, 1, 1))
    bars = com_quedas(20)
    r = lab.avaliar("t", agente, lambda t: bars if t == "X" else [], ["X"])
    assert r.sem_historico == ["VAZIO"]


def test_resumo_conta_quem_ganha_em_cada_periodo():
    txt = lab.resumo([_res("a", (50, 2.0, 1.0), (10, 2.0, 1.0)), _res("b", (50, 0.5, 1.0), (10, 0.5, 1.0))])
    assert "1/2" in txt and "na validação" in txt


def test_cache_de_barras_sem_rede(tmp_path, monkeypatch):
    monkeypatch.setattr(lab, "CACHE_DIR", tmp_path)
    bars = serie([100.0] * 400, start=date(2016, 1, 1))
    monkeypatch.setattr(lab, "download", lambda t, reg, anos=lab.ANOS_PADRAO: (_ for _ in ()).throw(AssertionError("baixou")))
    (tmp_path / "X.json").write_text(
        '{"ticker": "X", "bars": [' + ",".join(b.model_dump_json() for b in bars) + "]}", encoding="utf-8"
    )
    bars_of, disponiveis, faltando = lab.bars_source(["X"], baixar=False, inicio=date(2016, 1, 1))
    assert disponiveis == ["X"] and not faltando and len(bars_of("X")) == 400


def test_bars_source_corta_pela_janela(tmp_path, monkeypatch):
    monkeypatch.setattr(lab, "CACHE_DIR", tmp_path)
    bars = serie([100.0] * 400, start=date(2016, 1, 1))
    (tmp_path / "X.json").write_text(
        '{"ticker": "X", "bars": [' + ",".join(b.model_dump_json() for b in bars) + "]}", encoding="utf-8"
    )
    corte = date(2016, 1, 1) + timedelta(days=200)
    _, disponiveis, faltando = lab.bars_source(["X"], baixar=False, inicio=corte)
    assert disponiveis == [] and faltando and "mínimo" in faltando[0]


def test_inicio_producao_e_a_mesma_janela_do_backfill():
    """collectors/history.py: date(hoje.ano - anos, hoje.mês, min(dia, 28))."""
    assert lab.inicio_producao(date(2026, 9, 20)) == date(2016, 9, 20)
    assert lab.inicio_producao(date(2026, 1, 31)) == date(2016, 1, 28)


def test_experimentos_yaml_do_projeto_e_valido():
    """O arquivo que guarda o que já foi testado tem de continuar rodável."""
    raw, agents = lab.carregar_experimentos()
    por_id = {a.id: a for a in agents}
    cestas = raw.get("cestas") or {}
    assert raw.get("experimentos")
    for exp in raw["experimentos"]:
        base = por_id[exp["agente"]]  # KeyError se o agente sumir de agents.yaml
        for nome in exp.get("cestas") or []:
            assert cestas.get(nome), f"cesta '{nome}' não existe"
        combos = lab.variantes(base, {n: cestas[n] for n in (exp.get("cestas") or [])}, exp.get("grade") or {})
        assert combos and all(a.cesta for _, a in combos)


def test_parse_agents_recusa_prazo_maior_que_o_maximo():
    with pytest.raises(ValueError, match="prazo_maximo_pregoes"):
        parse_agents({"agents": [{"id": "a", "cesta": list("ABCDE"), "regras": {"prazo_pregoes": 12}}]})


def test_periodo_repete_as_contas_da_view():
    class P:
        def __init__(self, r, b):
            self.ret_net_pct, self.baseline_pct = r, b

    p = lab._periodo([P(2.0, 1.0), P(-1.0, 0.0), P(3.0, 2.0)])
    assert p.operacoes == 3 and p.medio_pct == 1.33 and p.mediano_pct == 2.0
    assert p.acerto_pct == 66.7 and p.base_media_pct == 1.0 and p.soma_pct == 4.0


def test_contar_gatilhos_separa_lado_e_periodo():
    bars = serie([100, 94, 100, 100, 100, 107, 100])
    c = lab.contar_gatilhos(lambda t: bars, ["X"], 5.0, date(2020, 1, 4))
    assert c == {}  # série curta demais (MIN_BARS)
    longa = serie([100.0] * 300 + [94.0, 96.0, 96.0, 102.7], start=date(2019, 1, 1))
    c = lab.contar_gatilhos(lambda t: longa, ["X"], 5.0, longa[301].day)
    assert c["X"]["queda_treino"] == 1 and c["X"]["alta_validacao"] == 1


def test_detalhe_mostra_regras_e_motivos():
    bars = com_quedas(20, recupera=True)
    agente = AgentDef("a", "A", "", ("X",), Rules(setups=("queda_brusca",)), bars[int(len(bars) * 0.75)].day)
    txt = lab.detalhe(lab.avaliar("t", agente, lambda _t: bars, ["X"]))
    assert "cesta (1): X" in txt and "gatilho_pct" in txt and "veredito" in txt


def test_daily_bar_do_cache_aceita_campos_vazios(tmp_path, monkeypatch):
    monkeypatch.setattr(lab, "CACHE_DIR", tmp_path)
    (tmp_path / "X.json").write_text('{"ticker": "X", "bars": [{"day": "2020-01-02", "close": 10.0}]}', encoding="utf-8")
    assert lab.load_cached("X") == [DailyBar(day=date(2020, 1, 2), close=10.0)]


def test_concentracao_denuncia_cesta_de_um_ativo_so():
    """A cesta 2 parecia ter 7 ativos e operava só TSLA: o veredito precisa dizer."""
    r = _res("x", (50, 2.0, 1.0), (30, 2.0, 1.0))
    r.agente = AgentDef("a", "A", "", ("TSLA", "NVDA"), Rules(), date(2023, 1, 1))
    r.por_ativo = {"validacao": {"TSLA": 27, "NVDA": 3}}
    assert r.concentracao == ("TSLA", 90.0)
    assert "90% das operações são de TSLA" in r.veredito
    r.por_ativo = {"validacao": {"TSLA": 15, "NVDA": 15}}
    assert "operações são de" not in r.veredito


def test_concentracao_cai_para_o_treino_quando_nao_houve_validacao():
    r = _res("x", (50, 2.0, 1.0), (0, None, None))
    r.por_ativo = {"treino": {"HUT": 40, "MARA": 10}, "validacao": {}}
    assert r.concentracao == ("HUT", 80.0)
    assert "HUT 80%" in lab.tabela([r])
