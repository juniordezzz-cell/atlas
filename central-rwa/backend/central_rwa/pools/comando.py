"""python -m central_rwa pools [--dry-run]"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from ..db.connect import diagnose
from ..gha import annotate
from .coleta import coletar
from .fontes import ClienteFontes
from .repositorio import MemoryPoolStore, PostgresPoolStore


def pular_por_recente(store, agora: datetime, minutos: int | None) -> bool:
    """A reserva agendada no GitHub roda de hora em hora e só coleta se o
    disparo do Supabase falhou. Esperando na fila (concurrency) atrás de uma
    coleta em andamento, ela confere DEPOIS que a outra gravou."""
    if not minutos:
        return False
    ultima = store.ultima_coleta()
    if ultima is None or (agora - ultima).total_seconds() >= minutos * 60:
        return False
    idade = round((agora - ultima).total_seconds() / 60)
    annotate("notice", "Scanner Pools", f"coleta recente (há {idade} min) — esta execução de reserva foi pulada")
    return True


def rodar(argv: list[str]) -> None:
    p = argparse.ArgumentParser(prog="central_rwa pools")
    p.add_argument("--dry-run", action="store_true", help="coleta de verdade, mas não grava no banco")
    p.add_argument("--pular-se-recente", type=int, metavar="MIN", default=None,
                   help="não coleta se a última coleta começou há menos de MIN minutos "
                        "(reserva do GitHub: o disparo de 4 em 4 h vem do Supabase)")
    args = p.parse_args(argv)
    if args.dry_run:
        store = MemoryPoolStore()
    else:
        dsn = os.environ.get("SUPABASE_DB_URL")
        if not dsn:
            sys.exit("SUPABASE_DB_URL não definida. Use --dry-run para rodar sem banco.")
        try:
            store = PostgresPoolStore(dsn)
        except Exception as e:
            hint = diagnose(dsn, e)
            annotate("error", "Banco", hint)
            sys.exit(hint)
    inicio = datetime.now(timezone.utc)
    if pular_por_recente(store, inicio, args.pular_se_recente):
        store.close()
        return
    try:
        resumo = coletar(ClienteFontes(), store, inicio)
    finally:
        store.close()
    resumo["dry_run"] = args.dry_run
    resumo["duracao_s"] = round((datetime.now(timezone.utc) - inicio).total_seconds(), 1)
    if resumo["parciais"]:
        annotate("warning", "Scanner Pools", f"coleta parcial: {len(resumo['parciais'])} fonte(s) com falha")
    annotate("notice", "Scanner Pools",
             f"{resumo['pre_corte']} pools · {resumo['solidas']} Sólidas · {resumo['caca']} Caça · {resumo['barradas']} barradas")
    print(json.dumps(resumo, ensure_ascii=False, default=str))
    if resumo["lidas"] == 0:
        sys.exit(1)
