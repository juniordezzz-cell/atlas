"""python -m central_rwa estudio [--dry-run] [--orcamento-gecko N]

Grava com ESTUDIO_DB_URL (papel estudio_agente: só o schema estudio). Sem
ela, avisa e sai sem erro, para o agendamento não ficar vermelho antes de o
dono cadastrar o segredo."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from ..db.connect import diagnose
from ..gha import annotate
from .fontes import ClienteEstudio
from .repositorio import MemoriaEstudio, PostgresEstudio
from .varredura import ORCAMENTO_GT, varrer


def rodar(argv: list[str]) -> None:
    p = argparse.ArgumentParser(prog="central_rwa estudio")
    p.add_argument("--dry-run", action="store_true", help="busca de verdade, não grava (alvos pela visão pública)")
    p.add_argument("--orcamento-gecko", type=int, default=ORCAMENTO_GT, metavar="N",
                   help=f"máximo de chamadas à GeckoTerminal nesta execução (padrão {ORCAMENTO_GT})")
    args = p.parse_args(argv)
    if args.dry_run:
        store = MemoriaEstudio()
    else:
        dsn = os.environ.get("ESTUDIO_DB_URL")
        if not dsn:
            annotate("warning", "Estúdio", "ESTUDIO_DB_URL não configurada — varredura pulada (veja docs/estudio-agentes.md).")
            print("ESTUDIO_DB_URL não definida. Use --dry-run para rodar sem banco.")
            return
        try:
            store = PostgresEstudio(dsn)
        except Exception as e:
            hint = diagnose(dsn, e)
            annotate("error", "Estúdio · banco", hint)
            sys.exit(hint)
    inicio = datetime.now(timezone.utc)
    try:
        resumo = varrer(ClienteEstudio(), store, inicio, args.orcamento_gecko)
    finally:
        store.close()
    resumo["dry_run"] = args.dry_run
    resumo["duracao_s"] = round((datetime.now(timezone.utc) - inicio).total_seconds(), 1)
    nivel = {"ok": "notice", "parcial": "warning"}.get(resumo["estado"], "error")
    annotate(nivel, "Estúdio",
             f"{resumo['snapshots']}/{resumo['pools_alvo']} snapshots · velas de {resumo['candles_pools']} pools "
             f"({resumo['candles_novas']} novas) · {resumo['chamadas_gt']} chamadas GT")
    print(json.dumps(resumo, ensure_ascii=False, default=str))
    if resumo["estado"] == "erro":
        sys.exit(1)
