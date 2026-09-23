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


def rodar(argv: list[str]) -> None:
    p = argparse.ArgumentParser(prog="central_rwa pools")
    p.add_argument("--dry-run", action="store_true", help="coleta de verdade, mas não grava no banco")
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
