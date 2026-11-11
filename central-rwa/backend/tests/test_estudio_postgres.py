"""Estúdio, Fase 2, com Postgres embutido: migração idempotente, visão das
pools-alvo, privilégios do papel estudio_agente e a varredura gravando."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")
import psycopg  # noqa: E402
from psycopg.conninfo import make_conninfo  # noqa: E402

from central_rwa.db import apply_migrations  # noqa: E402
from central_rwa.estudio.repositorio import PostgresEstudio  # noqa: E402
from central_rwa.estudio.varredura import varrer  # noqa: E402
from tests.test_estudio_varredura import ALVOS, ClienteFalso  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
AGORA = datetime(2026, 11, 11, 23, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def dsns(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pgestudio"), cleanup_mode="stop")
    uri = server.get_uri()
    with psycopg.connect(uri, autocommit=True) as c:
        for r in ("anon", "authenticated", "service_role"):
            c.execute(f"do $$ begin create role {r}; exception when duplicate_object then null; end $$")
    apply_migrations(uri, MIGRATIONS)
    apply_migrations(uri, MIGRATIONS)   # idempotente
    with psycopg.connect(uri, autocommit=True) as c:
        c.execute("alter role estudio_agente with login password 'teste'")
        for a in ALVOS:   # as pools-alvo nascem no Scanner
            gecko = a["pool_id"].startswith("gecko:")
            c.execute(
                "insert into scanner.pools (id, fonte, rede, dex, par, fee, tvl, vol_24h, sinais, trilho, visto_em) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, 'solida', now())",
                (a["pool_id"], "geckoterminal" if gecko else "defillama", a["rede"], a["dex"], a["par"],
                 a["taxa_pct"], a["tvl"], a["vol_24h"], "{}" if gecko else f'{{"endereco_pool": "{a["endereco"]}"}}'))
        # fora do alvo: rede, TVL, giro, barrada, sem endereço
        for pid, rede, tvl, vol, trilho, sinais in [
            ("gecko:arbitrum:0x1", "Arbitrum", 1e6, 1e6, "solida", "{}"),
            ("gecko:base:0x2", "Base", 249_999, 1e6, "solida", "{}"),
            ("gecko:base:0x3", "Base", 1e6, 5e5, "solida", "{}"),
            ("gecko:base:0x4", "Base", 1e6, 1e6, "barrada", "{}"),
            ("llama:sem", "Solana", 1e6, 1e6, "solida", "{}"),
        ]:
            c.execute("insert into scanner.pools (id, fonte, rede, dex, par, fee, tvl, vol_24h, sinais, trilho, visto_em) "
                      "values (%s, 'x', %s, 'X', 'A/B', 0.3, %s, %s, %s::jsonb, %s, now())", (pid, rede, tvl, vol, sinais, trilho))
    yield uri, make_conninfo(uri, user="estudio_agente", password="teste")
    server.cleanup()


def test_visao_de_alvos_aplica_o_filtro_e_acha_o_endereco(dsns):
    _, agente = dsns
    with psycopg.connect(agente) as c:
        rows = dict(c.execute("select pool_id, endereco from estudio.pools_alvo").fetchall())
    assert set(rows) == {a["pool_id"] for a in ALVOS}
    assert rows["llama:cbbtc"] == ALVOS[0]["endereco"]
    assert rows[ALVOS[2]["pool_id"]] == ALVOS[2]["endereco"]


def test_agente_nao_le_o_scanner_direto_e_anon_nao_le_o_estudio(dsns):
    uri, agente = dsns
    with psycopg.connect(agente) as c, pytest.raises(psycopg.errors.InsufficientPrivilege):
        c.execute("select count(*) from scanner.pools")
    with psycopg.connect(agente) as c, pytest.raises(psycopg.errors.InsufficientPrivilege):
        c.execute("insert into scanner.pools (id) values ('x')")
    with psycopg.connect(uri) as c:
        for papel in ("anon", "authenticated"):
            for obj in ("estudio.snapshots", "estudio.candles", "estudio.pools_alvo"):
                assert not c.execute("select has_table_privilege(%s, %s, 'select')", (papel, obj)).fetchone()[0], (papel, obj)
        assert not c.execute("select has_function_privilege('estudio_agente', 'estudio.disparar_varredura()', 'execute')").fetchone()[0]


def test_varredura_grava_com_o_papel_do_agente(dsns):
    uri, agente = dsns
    store, cli = PostgresEstudio(agente), ClienteFalso()
    try:
        r = varrer(cli, store, AGORA)
        assert r["estado"] == "ok" and r["snapshots"] == 4 and r["candles_novas"] == 4 * 48
        r2 = varrer(cli, store, AGORA + timedelta(hours=1))      # mesmas velas: nada novo
        assert r2["candles_novas"] == 0 and r2["candles_pools"] == 4
    finally:
        store.close()
    with psycopg.connect(uri) as c:
        assert c.execute("select count(*) from estudio.snapshots").fetchone()[0] == 8
        assert c.execute("select count(*) from estudio.candles").fetchone()[0] == 4 * 48
        est = c.execute("select ativo_simbolo, cotacao, primeira_vela < ultima_vela from estudio.candles_estado "
                        "where pool_id = %s", (ALVOS[2]["pool_id"],)).fetchone()
        assert est == ("AERO", "USDC", True)
        assert [x[0] for x in c.execute("select estado from estudio.varredura_status order by id")] == ["ok", "ok"]
        # 48 velas (2 dias) não bastam para os agentes: pools_prontas exige 7 dias
        assert c.execute("select count(*) from estudio.pools_prontas").fetchone()[0] == 0


def test_manutencao_resume_por_hora_e_apaga_o_vencido(dsns):
    uri, _ = dsns
    with psycopg.connect(uri, autocommit=True) as c:
        c.execute("insert into estudio.snapshots (pool_id, observado_em, tvl, vol_24h) values "
                  "('velho', now() - interval '8 days', 1, 1), ('novo', now(), 2, 2), ('novo', now() - interval '15 minutes', 4, 2)")
        c.execute("select estudio.manutencao()")
        assert c.execute("select count(*) from estudio.snapshots where pool_id = 'velho'").fetchone()[0] == 0
        assert c.execute("select sum(amostras) from estudio.snapshots_hora where pool_id = 'novo'").fetchone()[0] == 2
