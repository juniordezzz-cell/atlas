"""Integração com Postgres embutido (pgserver): migration idempotente, RLS,
visões públicas e o ciclo de gravação do PostgresPoolStore."""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")

from central_rwa.db import apply_migrations  # noqa: E402
from central_rwa.pools.modelos import Candidata, PoolFinal, TokenInfo, TokenRef  # noqa: E402
from central_rwa.pools.repositorio import PostgresPoolStore  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def dsn(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pgpools"), cleanup_mode="stop")
    uri = server.get_uri()
    import psycopg

    with psycopg.connect(uri, autocommit=True) as c:
        c.execute("do $$ begin create role anon; exception when duplicate_object then null; end $$")
        c.execute("do $$ begin create role authenticated; exception when duplicate_object then null; end $$")
    apply_migrations(uri, MIGRATIONS)
    apply_migrations(uri, MIGRATIONS)
    yield uri
    server.cleanup()


def fin(pid, trilho="solida"):
    c = Candidata(id=pid, fonte="geckoterminal", rede="BNB Chain", dex="PancakeSwap", par="UNI/WBNB",
                  token_a=TokenRef("0xa", "UNI"), token_b=TokenRef("0xb", "WBNB"), fee=0.25, tvl=2e6,
                  vol_24h=9e5, vol_7d=None, apr=None, apr_reward=None, sinais={"compradores_24h": 10})
    return PoolFinal(c, trilho, [] if trilho != "barrada" else ["honeypot"], 61.5, {"rendimento": 0.7})


def test_ciclo_completo(dsn):
    s = PostgresPoolStore(dsn)
    try:
        s.gravar([fin("gecko:bsc:0x1"), fin("gecko:bsc:0x2", "barrada")], date(2026, 9, 23), AGORA)
        s.gravar_status([{"fonte": "defillama", "rede": None, "dex": None, "estado": "ok", "contagem": 5, "em": AGORA}])
        s.salvar_tokens([TokenInfo("BNB Chain", "0xa", "UNI", False, False, False, None, 400000, "uniswap", 5e9, AGORA, AGORA)])
        assert "0xa" in s.tokens_em_cache("BNB Chain", ["0xa", "0xz"], AGORA)
        assert len(s.leituras(["gecko:bsc:0x1"])["gecko:bsc:0x1"]) == 1
        vis = s._query("select id, trilho, nota from public.scanner_pools order by id")
        assert vis == [("gecko:bsc:0x1", "solida", 61.5)]                # barrada fica fora da visão
        assert s._query("select count(*) from public.scanner_leituras")[0][0] == 1      # a barrada fica fora
        assert s._query("select count(*) from scanner.leituras")[0][0] == 2             # mas é guardada
        assert s._query("select estado from public.scanner_status")[0][0] == "ok"
        rls = s._query("select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                       "where n.nspname='scanner' and c.relkind='r'")[0][0]
        assert rls is True
        # a coleta seguinte sem a 0x1 soma uma falha, mas ela continua na visão
        s.gravar([fin("gecko:bsc:0x3")], date(2026, 9, 24), AGORA)
        assert s._query("select falhas_seguidas, ativa from scanner.pools where id='gecko:bsc:0x1'")[0] == (1, True)
    finally:
        s.close()


def test_visao_traz_variacao_de_tvl_em_7_dias(dsn):
    s = PostgresPoolStore(dsn)
    try:
        f = fin("gecko:bsc:0x7")
        f.cand.tvl = 1_000_000
        s.gravar([f], date(2026, 9, 10), AGORA)
        f.cand.tvl = 1_300_000
        s.gravar([f], date(2026, 9, 17), AGORA)
        var = s._query("select var_tvl_7d, leituras from public.scanner_pools where id='gecko:bsc:0x7'")[0]
        assert round(var[0], 4) == 0.3 and var[1] == 2
    finally:
        s.close()

