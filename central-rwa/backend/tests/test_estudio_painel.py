"""Laboratório de Agentes, Fase 4.1: public.laboratorio_painel() só entrega os
dados ao dono, identificado pelo token do Firebase (claims da requisição)."""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")
import psycopg  # noqa: E402

from central_rwa.db import apply_migrations  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
MIGRATIONS = RAIZ / "central-rwa" / "supabase" / "migrations"
UID = "uidDoDonoDeTeste"


def claims(**kw):
    base = {"iss": "https://securetoken.google.com/cryptotrack-br", "aud": "cryptotrack-br", "sub": UID,
            "exp": int(time.time()) + 3600}
    base.update(kw)
    return json.dumps({k: v for k, v in base.items() if v is not None})


@pytest.fixture(scope="module")
def uri(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pgpainel"), cleanup_mode="stop")
    u = server.get_uri()
    with psycopg.connect(u, autocommit=True) as c:
        for r in ("anon", "authenticated", "service_role"):
            c.execute(f"do $$ begin create role {r}; exception when duplicate_object then null; end $$")
    apply_migrations(u, MIGRATIONS)
    apply_migrations(u, MIGRATIONS)   # idempotente
    with psycopg.connect(u, autocommit=True) as c:
        c.execute("insert into estudio.laboratorio_donos (uid, nome) values (%s, 'dono')", (UID,))
        c.execute("insert into estudio.agentes_status (agente, estado, achados) values ('curva', 'ok', 3)")
        c.execute(
            "insert into estudio.achados (rodada, agente, pool_id, rede, dex, par, modelo, faixas, preco, faixa_min, faixa_max, "
            "posicoes, capital_usd, dias, media_usd, p10_usd, p90_usd, taxas_usd, il_usd, em_faixa_pct, ref_media_usd, "
            "ganho_vs_ref_usd, mercado, metricas) values (now(), 'curva', 'p1', 'Solana', 'Orca', 'JUP/SOL', 'curve', 4, 1, 0.9, 1.1, "
            "'[]', 1000, 30, 60, -10, 120, 80, -15, 90, 35, 25, '{}', '{}')")
    yield u
    server.cleanup()


def painel(uri, cl):
    """Chama a função como o site: papel anon e os claims que o PostgREST põe na requisição."""
    with psycopg.connect(uri) as c:
        c.execute("set role anon")
        if cl is not None:
            c.execute("select set_config('request.jwt.claims', %s, true)", (cl,))
        return c.execute("select public.laboratorio_painel()").fetchone()[0]


def test_dono_recebe_os_dados(uri):
    d = painel(uri, claims())
    assert d is not None
    assert [a["agente"] for a in d["agentes"]] == ["curva"]
    assert d["achados"][0]["par"] == "JUP/SOL" and d["achados"][0]["dex"] == "Orca"
    assert d["registro"][0]["achados"] == 1 and d["registro"][0]["por_agente"] == {"curva": 1}
    assert isinstance(d["salas"], list)


@pytest.mark.parametrize("cl", [
    None,                                                       # só a chave publicável, sem login
    claims(sub="outraPessoa"),                                  # login de outra pessoa
    claims(iss="https://securetoken.google.com/outro-projeto"),  # token de outro projeto Firebase
    claims(aud="outro-projeto"),
    claims(exp=int(time.time()) - 10),                          # token vencido
])
def test_quem_nao_e_dono_recebe_nada(uri, cl):
    assert painel(uri, cl) is None


def test_anon_nao_le_as_tabelas(uri):
    with psycopg.connect(uri) as c:
        for t in ("estudio.laboratorio_donos", "estudio.achados", "estudio.agentes_status", "estudio.boletim"):
            assert not c.execute("select has_table_privilege('anon', %s, 'select')", (t,)).fetchone()[0], t
        assert c.execute("select has_function_privilege('anon', 'public.laboratorio_painel()', 'execute')").fetchone()[0]
        assert not c.execute("select has_function_privilege('anon', 'estudio.dono_do_laboratorio()', 'execute')").fetchone()[0]
