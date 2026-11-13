"""Estúdio, Fase 3, com Postgres embutido e o Node de verdade: a rodada dos
agentes lê as pools prontas e as velas com o papel estudio_agente, chama
estudio/agentes/rodar.mjs e grava achados, status e o relatório do dia."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")
if not shutil.which("node"):
    pytest.skip("sem node", allow_module_level=True)
import psycopg  # noqa: E402
from psycopg.conninfo import make_conninfo  # noqa: E402

from central_rwa.db import apply_migrations  # noqa: E402
from central_rwa.estudio.agentes import AGENTES, PostgresAgentes, rodada  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
MIGRATIONS = RAIZ / "central-rwa" / "supabase" / "migrations"
VELAS = json.loads((RAIZ / "estudio/motor/fixtures/gt_ohlcv_sol_usdc_orca_20261111.json").read_text("utf-8"))["data"]["attributes"]["ohlcv_list"]
AGORA = datetime.now(timezone.utc).replace(minute=5, second=0, microsecond=0)


@pytest.fixture(scope="module")
def dsns(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pgagentes"), cleanup_mode="stop")
    uri = server.get_uri()
    with psycopg.connect(uri, autocommit=True) as c:
        for r in ("anon", "authenticated", "service_role"):
            c.execute(f"do $$ begin create role {r}; exception when duplicate_object then null; end $$")
    apply_migrations(uri, MIGRATIONS)
    apply_migrations(uri, MIGRATIONS)   # idempotente
    with psycopg.connect(uri, autocommit=True) as c:
        c.execute("alter role estudio_agente with login password 'teste'")
        # Uma pool SOL/USDC com giro alto (as taxas pagam) e uma sem velas.
        for pid, vol in (("gecko:solana:SoLuSdC", 60e6), ("gecko:solana:SemVelas", 2e6)):
            c.execute("insert into scanner.pools (id, fonte, rede, dex, par, fee, tvl, vol_24h, sinais, trilho, visto_em) "
                      "values (%s, 'geckoterminal', 'Solana', 'Orca', 'SOL/USDC', 0.3, 10e6, %s, '{}'::jsonb, 'solida', now())",
                      (pid, vol))
        # Velas reais, deslocadas para terminar uma hora atrás.
        ultima = max(v[0] for v in VELAS)
        desloc = int((AGORA - timedelta(hours=1)).timestamp()) - ultima
        with c.cursor() as cur:
            cur.executemany(
                "insert into estudio.candles (pool_id, hora, abertura, maxima, minima, fechamento, volume_usd) "
                "values ('gecko:solana:SoLuSdC', to_timestamp(%s), %s, %s, %s, %s, %s)",
                [(v[0] + desloc, *v[1:6]) for v in VELAS])
        c.execute("insert into estudio.candles_estado (pool_id, ativo, ativo_simbolo, cotacao, buscado_em, primeira_vela, ultima_vela) "
                  "select pool_id, 'So11', 'SOL', 'USDC', now(), min(hora), max(hora) from estudio.candles group by pool_id")
        c.execute("insert into estudio.snapshots (pool_id, observado_em, preco, preco_usd, tvl, vol_24h, giro, taxa_pct) "
                  "values ('gecko:solana:SoLuSdC', now(), 84.7, 84.7, 10e6, 60e6, 6, 0.3)")
    yield uri, make_conninfo(uri, user="estudio_agente", password="teste")
    server.cleanup()


def test_rodada_grava_achados_status_e_relatorio(dsns):
    uri, agente = dsns
    store = PostgresAgentes(agente)
    try:
        r = rodada(store, AGORA)
        assert r["estado"] == "ok" and r["pools"] == 1          # só a pool com 7+ dias de velas está pronta
        assert r["achados"] > 0
        assert sum(r["conflitos_por_regra"].values()) == r["conflitos"]
        # menos de 55 min depois: pulada; forçada: roda de novo
        assert rodada(store, AGORA + timedelta(minutes=20))["estado"] == "pulada"
        r2 = rodada(store, AGORA + timedelta(minutes=30), forcar=True)
        assert r2["estado"] == "ok"
    finally:
        store.close()
    with psycopg.connect(uri) as c:
        st = dict(c.execute("select agente, estado from estudio.agentes_status").fetchall())
        assert set(st) == set(AGENTES) | {"supervisor"}
        assert all(v in ("ok", "sem_pools") for v in st.values())
        n, rodadas = c.execute("select count(*), count(distinct rodada) from estudio.achados").fetchone()
        assert n == 2 * r["achados"] and rodadas == 2
        a = c.execute("select capital_usd, media_usd, ref_media_usd, ganho_vs_ref_usd, agente, posicoes, mercado->>'cotacao_usd' "
                      "from estudio.achados where agente <> 'base' order by media_usd desc limit 1").fetchone()
        if a:
            assert a[0] == 1000 and a[1] > 0 and a[1] > a[2] and a[3] > 0
            assert abs(sum(p["cap"] for p in a[5]) - 1000) < 1e-6
            assert float(a[6]) == pytest.approx(1.0)
        ranking, rod = c.execute("select ranking, rodadas from estudio.relatorios_diarios").fetchone()
        assert rod == 2 and len(ranking) == r["achados"]          # mesma pool: o mais recente de cada agente
        assert ranking == sorted(ranking, key=lambda x: -x["media_usd"])


def test_agente_so_le_e_grava_o_estudio(dsns):
    uri, agente = dsns
    with psycopg.connect(uri) as c:
        for papel in ("anon", "authenticated"):
            for obj in ("estudio.achados", "estudio.agentes_status", "estudio.relatorios_diarios"):
                assert not c.execute("select has_table_privilege(%s, %s, 'select')", (papel, obj)).fetchone()[0], (papel, obj)
        for obj in ("estudio.achados", "estudio.agentes_status", "estudio.relatorios_diarios"):
            assert c.execute("select has_table_privilege('estudio_agente', %s, 'insert')", (obj,)).fetchone()[0]


def test_falha_no_motor_marca_erro_e_nao_bloqueia_a_proxima(dsns, monkeypatch):
    uri, agente = dsns
    import central_rwa.estudio.agentes as mod

    def quebra(_):
        raise RuntimeError("motor fora")
    monkeypatch.setattr(mod, "chamar_node", quebra)
    store = PostgresAgentes(agente)
    try:
        with pytest.raises(RuntimeError):
            rodada(store, AGORA + timedelta(hours=3), forcar=True)
        with psycopg.connect(uri) as c:
            assert {e for (e,) in c.execute("select estado from estudio.agentes_status where agente <> 'supervisor'")} == {"erro"}
        # erro não conta como rodada feita: a próxima, 15 min depois, roda
        assert store.ultima_rodada() is None
    finally:
        store.close()


def test_conflitos_por_regra():
    from central_rwa.estudio.agentes import conflitos_por_regra
    c = [{"nome": "Curva", "nome_contra": "Grade", "motivo": "giro baixo"},
         {"nome": "Acumulador", "nome_contra": "Grade", "motivo": "giro baixo"},
         {"nome": "Curva", "nome_contra": "Base", "motivo": "volume caindo há 3 dias"}]
    assert conflitos_por_regra(c) == {"Grade · giro baixo": 2, "Base · volume caindo há 3 dias": 1}
    assert list(conflitos_por_regra(c))[0] == "Grade · giro baixo"
