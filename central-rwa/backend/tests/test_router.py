from __future__ import annotations

import pytest

from central_rwa.router import MemoryStateStore, NoProviderAvailable, NotSupported, ProviderError, RateLimited

from .conftest import make_router


class Fake:
    """Provedor falso: cada chamada passa pelo gate (como uma requisição HTTP)."""

    def __init__(self, name, behavior="ok", value=None):
        self.name = name
        self.behavior = behavior
        self.value = value if value is not None else f"dado-{name}"
        self.calls = 0
        self._gate = lambda _p: None

    def bind_gate(self, gate):
        self._gate = gate

    def fetch(self, *args):
        self._gate(self.name)
        self.calls += 1
        if self.behavior == "429":
            raise RateLimited(self.name, retry_after=120)
        if self.behavior == "erro":
            raise ProviderError(self.name, "HTTP 500")
        if self.behavior == "nao_atende":
            raise NotSupported("rede")
        if self.behavior == "quebra":
            raise KeyError("campo_sumiu")
        return self.value


def build(clock, behaviors: dict[str, str], cfgs: dict | None = None, **router_cfg):
    provs = {n: Fake(n, b) for n, b in behaviors.items()}
    cfgs = cfgs or {n: {} for n in behaviors}
    router = make_router(provs, cfgs, {"cap": list(behaviors)}, clock, **router_cfg)
    return router, provs


def test_primeiro_provedor_atende(clock):
    router, provs = build(clock, {"a": "ok", "b": "ok"})
    assert router.call("cap", "fetch") == ("dado-a", "a")
    assert provs["b"].calls == 0


def test_fallback_quando_primeiro_da_429(clock):
    router, provs = build(clock, {"a": "429", "b": "ok"})
    assert router.call("cap", "fetch", cache=False) == ("dado-b", "b")
    assert router.stats.fallbacks["cap"] == 1
    # "a" entrou em cooldown e é pulado na próxima, sem nova chamada
    assert router.blocked_reason("a") == "cooldown"
    router.call("cap", "fetch", cache=False)
    assert provs["a"].calls == 1


def test_cooldown_respeita_retry_after_e_expira(clock):
    router, _ = build(clock, {"a": "429", "b": "ok"}, cooldown_base_seconds=10)
    router.call("cap", "fetch", cache=False)
    clock.advance(119)
    assert router.blocked_reason("a") == "cooldown"
    clock.advance(2)
    assert router.blocked_reason("a") is None


def test_provedor_sem_chave_e_pulado(clock, monkeypatch):
    monkeypatch.delenv("CHAVE_X", raising=False)
    router, provs = build(clock, {"a": "ok", "b": "ok"}, cfgs={"a": {"key_env": "CHAVE_X"}, "b": {}})
    assert router.call("cap", "fetch") == ("dado-b", "b")
    assert provs["a"].calls == 0
    assert router.stats.skipped["a"]["sem chave"] == 1


def test_chave_opcional_nao_bloqueia_e_troca_o_limite(clock, monkeypatch):
    cfg = {"a": {"key_env": "CHAVE_Y", "key_required": False, "limits": {"minute": 1}, "limits_with_key": {"minute": 50}}}
    monkeypatch.delenv("CHAVE_Y", raising=False)
    router, _ = build(clock, {"a": "ok"}, cfgs=cfg)
    assert router.blocked_reason("a") is None
    assert router.config.providers["a"].effective_limits() == {"minute": 1}
    monkeypatch.setenv("CHAVE_Y", "abc")
    assert router.config.providers["a"].effective_limits() == {"minute": 50}


def test_cota_diaria_impede_a_chamada_antes_de_estourar(clock):
    cfg = {"a": {"limits": {"day": 10}}, "b": {}}
    router, provs = build(clock, {"a": "ok", "b": "ok"}, cfgs=cfg, quota_safety=0.9)
    served = [router.call("cap", "fetch", cache=False)[1] for _ in range(12)]
    # 10 * 0.9 = 9 chamadas no "a"; depois o roteador passa para o "b" sem chamar o "a"
    assert provs["a"].calls == 9
    assert served.count("b") == 3
    assert router.stats.skipped["a"]["cota day"] == 3


def test_janela_curta_espera_em_vez_de_pular(clock):
    cfg = {"a": {"limits": {"minute": 2}, "max_wait_seconds": 60}}
    router, provs = build(clock, {"a": "ok"}, cfgs=cfg)
    for _ in range(3):
        router.call("cap", "fetch", cache=False)
    assert provs["a"].calls == 3
    assert clock.slept and clock.slept[0] > 0


def test_janela_curta_longa_demais_pula(clock):
    cfg = {"a": {"limits": {"minute": 1}, "max_wait_seconds": 1}, "b": {}}
    router, provs = build(clock, {"a": "ok", "b": "ok"}, cfgs=cfg)
    router.call("cap", "fetch", cache=False)
    assert router.call("cap", "fetch", cache=False)[1] == "b"
    assert not clock.slept


def test_circuit_breaker_abre_apos_falhas_seguidas(clock):
    router, provs = build(clock, {"a": "erro", "b": "ok"}, circuit_threshold=3, circuit_seconds=600)
    for _ in range(5):
        router.call("cap", "fetch", cache=False)
    assert provs["a"].calls == 3
    assert router.blocked_reason("a") == "circuito aberto"
    clock.advance(601)
    assert router.blocked_reason("a") is None


def test_sucesso_zera_falhas(clock):
    router, provs = build(clock, {"a": "erro", "b": "ok"})
    router.call("cap", "fetch", cache=False)
    provs["a"].behavior = "ok"
    router.call("cap", "fetch", cache=False)
    assert router.state("a").health.consecutive_failures == 0


def test_nao_atende_nao_penaliza(clock):
    router, _ = build(clock, {"a": "nao_atende", "b": "ok"})
    assert router.call("cap", "fetch")[1] == "b"
    assert router.state("a").health.consecutive_failures == 0


def test_erro_inesperado_de_parsing_vira_falha_e_cai_para_o_proximo(clock):
    router, _ = build(clock, {"a": "quebra", "b": "ok"})
    assert router.call("cap", "fetch")[1] == "b"
    assert router.state("a").health.consecutive_failures == 1


def test_todos_falham_levanta_com_motivos(clock):
    router, _ = build(clock, {"a": "429", "b": "erro"})
    with pytest.raises(NoProviderAvailable) as e:
        router.call("cap", "fetch")
    assert "a" in str(e.value) and "b" in str(e.value)


def test_cache_evita_segunda_chamada(clock):
    router, provs = build(clock, {"a": "ok"})
    router.call("cap", "fetch", 1)
    router.call("cap", "fetch", 1)
    assert provs["a"].calls == 1 and router.stats.cache_hits == 1


def test_call_distinct_usa_provedores_diferentes(clock):
    router, _ = build(clock, {"a": "ok", "b": "ok", "c": "ok"})
    got = router.call_distinct("cap", "fetch", n=2)
    assert [p for _, p in got] == ["a", "b"]


def test_estado_persiste_entre_execucoes(clock):
    store = MemoryStateStore()
    cfg = {"a": {"limits": {"day": 3}}, "b": {}}
    provs = {"a": Fake("a"), "b": Fake("b")}
    r1 = make_router(provs, cfg, {"cap": ["a", "b"]}, clock, store=store, quota_safety=1.0)
    r1.call("cap", "fetch", 1, cache=False)
    r1.call("cap", "fetch", 2, cache=False)
    r1.persist()
    # novo job (novo roteador) no mesmo dia: só resta 1 chamada no "a"
    provs2 = {"a": Fake("a"), "b": Fake("b")}
    r2 = make_router(provs2, cfg, {"cap": ["a", "b"]}, clock, store=store, quota_safety=1.0)
    assert [r2.call("cap", "fetch", i, cache=False)[1] for i in range(3)] == ["a", "b", "b"]
