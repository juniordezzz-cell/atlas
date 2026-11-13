"""python -m central_rwa agentes [--forcar]

Rodada dos agentes do Laboratório de Agentes (Fase 3, sem IA), uma vez por hora, depois da
varredura. O Python lê o banco (papel estudio_agente), entrega as pools e as
velas para estudio/agentes/rodar.mjs (o motor é JavaScript, igual ao
simulador) e grava achados, status e o relatório do supervisor.

Sem ESTUDIO_DB_URL, avisa e sai sem erro, como a varredura."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from collections import Counter
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from ..db.connect import connect, diagnose
from ..gha import annotate

RAIZ = Path(__file__).resolve().parents[4]
RODAR = RAIZ / "estudio" / "agentes" / "rodar.mjs"
AGENTES = ("base", "concentrador", "curva", "pontas", "grade", "acumulador", "acumulador_token")
INTERVALO = timedelta(minutes=55)
DIAS_VELAS = 31

COLUNAS_ACHADO = (
    "agente", "pool_id", "rede", "dex", "par", "ativo_simbolo", "cotacao", "modelo", "faixas", "preco",
    "faixa_min", "faixa_max", "posicoes", "capital_usd", "dias", "media_usd", "p10_usd", "p90_usd", "taxas_usd",
    "il_usd", "custo_usd", "em_faixa_pct", "ret_risco", "prob_perda_pct", "apr_taxas_pct", "ref_media_usd",
    "ganho_vs_ref_usd", "mercado", "metricas", "conc_estimada",
)
JSONB = {"posicoes", "mercado", "metricas"}


def iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat()


class PostgresAgentes:
    def __init__(self, dsn: str):
        self.conn = connect(dsn, autocommit=True)

    def ultima_rodada(self) -> datetime | None:
        return self.conn.execute("select max(rodada) from estudio.agentes_status where agente = any(%s) and estado in ('ok', 'sem_pools')",
                                 (list(AGENTES),)).fetchone()[0]

    def pools(self) -> list[dict]:
        cur = self.conn.execute(
            "select p.pool_id, p.rede, p.dex, p.par, coalesce(p.taxa_pct, s.taxa_pct) as taxa_pct, p.tvl, p.vol_24h, "
            "p.ativo_simbolo, p.cotacao, s.preco, s.preco_usd, s.tvl as tvl_snap, s.vol_24h as vol_24h_snap "
            "from estudio.pools_prontas p left join lateral ("
            "  select preco, preco_usd, tvl, vol_24h, taxa_pct from estudio.snapshots x "
            "  where x.pool_id = p.pool_id order by observado_em desc limit 1) s on true "
            "order by p.pool_id")
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def velas(self, ids: list[str], desde: datetime) -> dict[str, list]:
        out: dict[str, list] = {i: [] for i in ids}
        if not ids:
            return out
        cur = self.conn.execute(
            "select pool_id, extract(epoch from hora)::bigint, abertura, maxima, minima, fechamento, volume_usd "
            "from estudio.candles where pool_id = any(%s) and hora >= %s order by pool_id, hora", (ids, desde))
        for r in cur:
            out[r[0]].append([r[1], r[2], r[3], r[4], r[5], r[6]])
        return out

    def achados_desde(self, desde: datetime) -> list[dict]:
        cur = self.conn.execute(
            "select agente, pool_id, rede, dex, par, modelo, faixas, media_usd, p10_usd, ganho_vs_ref_usd, rodada "
            "from estudio.achados where rodada >= %s", (desde,))
        cols = [d.name for d in cur.description]
        return [{**dict(zip(cols, r)), "rodada": iso(r[-1])} for r in cur.fetchall()]

    def marcar(self, estado: str, rodada: datetime, mensagem: str | None = None):
        with self.conn.cursor() as cur:
            cur.executemany(
                "insert into estudio.agentes_status (agente, estado, mensagem, rodada, atualizado_em) values (%s,%s,%s,%s,now()) "
                "on conflict (agente) do update set estado = excluded.estado, mensagem = excluded.mensagem, "
                "rodada = excluded.rodada, atualizado_em = now()",
                [(a, estado, mensagem, rodada) for a in AGENTES])

    def gravar(self, rodada: datetime, saida: dict):
        with self.conn.transaction(), self.conn.cursor() as cur:
            cols = ", ".join(("rodada",) + COLUNAS_ACHADO)
            marcas = ", ".join(["%s"] * (len(COLUNAS_ACHADO) + 1))
            cur.executemany(
                f"insert into estudio.achados ({cols}) values ({marcas}) on conflict (rodada, agente, pool_id) do nothing",
                [(rodada, *[json.dumps(a.get(c)) if c in JSONB else a.get(c) for c in COLUNAS_ACHADO]) for a in saida["achados"]])
            cur.executemany(
                "insert into estudio.agentes_status (agente, estado, pool_em_analise, par_em_analise, pools_vistas, "
                "pools_trabalhadas, achados, melhor_media_usd, mensagem, rodada, atualizado_em) "
                "values (%(agente)s, %(estado)s, %(pool_em_analise)s, %(par_em_analise)s, %(pools_vistas)s, "
                "%(pools_trabalhadas)s, %(achados)s, %(melhor_media_usd)s, %(mensagem)s, %(rodada)s, now()) "
                "on conflict (agente) do update set estado = excluded.estado, pool_em_analise = excluded.pool_em_analise, "
                "par_em_analise = excluded.par_em_analise, pools_vistas = excluded.pools_vistas, "
                "pools_trabalhadas = excluded.pools_trabalhadas, achados = excluded.achados, "
                "melhor_media_usd = excluded.melhor_media_usd, mensagem = excluded.mensagem, rodada = excluded.rodada, "
                "atualizado_em = now()",
                [{**s, "rodada": rodada} for s in saida["status"]])
            rel = saida["relatorio"]
            n_ach = len(saida["achados"])
            cur.execute(
                "insert into estudio.agentes_status (agente, estado, pools_vistas, achados, mensagem, rodada, atualizado_em) "
                "values ('supervisor', 'ok', %s, %s, %s, %s, now()) on conflict (agente) do update set estado = 'ok', "
                "pools_vistas = excluded.pools_vistas, achados = excluded.achados, mensagem = excluded.mensagem, "
                "rodada = excluded.rodada, atualizado_em = now()",
                (saida["pools"], n_ach, f"{len(rel['disputas'])} disputas · {len(rel['conflitos'])} conflitos", rodada))
            cur.execute(
                "insert into estudio.relatorios_diarios (data, ranking, disputas, conflitos, rodadas, atualizado_em) "
                "values (%s, %s, %s, %s, 1, now()) on conflict (data) do update set ranking = excluded.ranking, "
                "disputas = excluded.disputas, conflitos = excluded.conflitos, "
                "rodadas = estudio.relatorios_diarios.rodadas + 1, atualizado_em = now()",
                (rodada.astimezone(timezone.utc).date(), json.dumps(rel["ranking"]), json.dumps(rel["disputas"]),
                 json.dumps(rel["conflitos"])))
        self.conn.execute("select estudio.manutencao_agentes()")

    def close(self):
        self.conn.close()


def _json(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return iso(v)
    return str(v)


def chamar_node(entrada: dict, node: str = "node") -> dict:
    p = subprocess.run([node, str(RODAR)], input=json.dumps(entrada, default=_json), capture_output=True,
                       text=True, encoding="utf-8", timeout=600)
    if p.returncode != 0:
        raise RuntimeError(f"rodar.mjs saiu com {p.returncode}: {p.stderr.strip()[-500:]}")
    return json.loads(p.stdout)


def conflitos_por_regra(conflitos: list[dict]) -> dict[str, int]:
    """Quantos conflitos cada regra de descarte causou ("Grade · giro baixo": 70), do maior para o menor."""
    return dict(Counter(f"{c['nome_contra']} · {c['motivo']}" for c in conflitos).most_common())


def rodada(store, agora: datetime, forcar: bool = False) -> dict:
    """Uma rodada completa. Pula se a última foi há menos de 55 min (a não ser forçada)."""
    ultima = store.ultima_rodada()
    if not forcar and ultima and agora - ultima < INTERVALO:
        return {"estado": "pulada", "ultima": iso(ultima)}
    rodada_em = agora.replace(second=0, microsecond=0)
    store.marcar("cacando", rodada_em, "rodada em andamento")
    try:
        pools = store.pools()
        velas = store.velas([p["pool_id"] for p in pools], agora - timedelta(days=DIAS_VELAS))
        inicio_dia = rodada_em.astimezone(timezone.utc).replace(hour=0, minute=0)
        entrada = {
            "rodada": iso(rodada_em),
            "pools": [{**p, "candles": velas[p["pool_id"]]} for p in pools],
            "achados_hoje": store.achados_desde(inicio_dia),
        }
        saida = chamar_node(entrada)
        store.gravar(rodada_em, saida)
    except Exception as e:
        store.marcar("erro", rodada_em, f"{type(e).__name__}: {str(e)[:200]}")
        raise
    conf = saida["relatorio"]["conflitos"]
    return {"estado": "ok", "rodada": iso(rodada_em), "pools": saida["pools"], "achados": len(saida["achados"]),
            "por_agente": {s["agente"]: s["achados"] for s in saida["status"]},
            "disputas": len(saida["relatorio"]["disputas"]), "conflitos": len(conf),
            "conflitos_por_regra": conflitos_por_regra(conf),
            "conflitos_por_par": dict(Counter(f"{c['nome']} × {c['nome_contra']}" for c in conf).most_common(10)),
            "erros": saida["erros"][:20], "duracao_motor_s": saida["duracao_s"]}


def rodar(argv: list[str]) -> None:
    p = argparse.ArgumentParser(prog="central_rwa agentes")
    p.add_argument("--forcar", action="store_true", help="roda mesmo que a última rodada tenha sido há menos de 55 min")
    args = p.parse_args(argv)
    dsn = os.environ.get("ESTUDIO_DB_URL")
    if not dsn:
        annotate("warning", "Laboratório · agentes", "ESTUDIO_DB_URL não configurada — rodada pulada (veja docs/estudio-agentes.md).")
        print("ESTUDIO_DB_URL não definida.")
        return
    try:
        store = PostgresAgentes(dsn)
    except Exception as e:
        hint = diagnose(dsn, e)
        annotate("error", "Laboratório · agentes · banco", hint)
        sys.exit(hint)
    try:
        r = rodada(store, datetime.now(timezone.utc), args.forcar)
    except Exception as e:
        annotate("error", "Laboratório · agentes", f"{type(e).__name__}: {str(e)[:300]}")
        raise
    finally:
        store.close()
    if r["estado"] == "pulada":
        print(f"Agentes: última rodada em {r['ultima']}, menos de 55 min atrás. Pulada.")
        return
    annotate("notice", "Laboratório · agentes",
             f"{r['pools']} pools · {r['achados']} achados · " +
             " · ".join(f"{k} {v}" for k, v in r["por_agente"].items()) +
             f" · {r['disputas']} disputas · {r['conflitos']} conflitos" +
             (" (" + ", ".join(f"{k}: {v}" for k, v in r["conflitos_por_regra"].items()) + ")" if r["conflitos"] else ""))
    print(json.dumps(r, ensure_ascii=False, default=str))
