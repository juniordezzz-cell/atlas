"""python -m central_rwa <comando>

Comandos:
  pools [--dry-run] [--pular-se-recente MIN]   coleta do Scanner Pools
  estudio [--dry-run] [--orcamento-gecko N]     varredura do Estúdio de Agentes
  agentes [--forcar]                            rodada dos agentes (1 por hora)
  migrate                                       aplica supabase/migrations

A Central RWA saiu em 11/11/2026; o pacote guarda o nome antigo para não
mexer no agendamento do Scanner (workflow scanner-pools.yml).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from .ambiente import load_env_file


def main(argv: list[str] | None = None) -> None:
    # Console do Windows: garante UTF-8 no resumo.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    argv = list(sys.argv[1:] if argv is None else argv)
    backend = Path(__file__).resolve().parents[1]
    load_env_file(backend / ".env")

    if argv and argv[0] == "pools":
        from .pools.comando import rodar as rodar_pools

        rodar_pools(argv[1:])
        return

    if argv and argv[0] == "estudio":
        from .estudio.comando import rodar as rodar_estudio

        rodar_estudio(argv[1:])
        return

    if argv and argv[0] == "agentes":
        from .estudio.agentes import rodar as rodar_agentes

        rodar_agentes(argv[1:])
        return

    if argv == ["migrate"]:
        from .db import apply_migrations
        from .db.connect import diagnose
        from .gha import annotate

        dsn = os.environ.get("SUPABASE_DB_URL")
        if not dsn:
            sys.exit("SUPABASE_DB_URL não definida.")
        try:
            applied = apply_migrations(dsn, backend.parent / "supabase" / "migrations")
        except Exception as e:
            hint = diagnose(dsn, e)
            annotate("error", "Migrations", hint)
            sys.exit(hint)
        for name in applied:
            print("aplicada:", name)
        annotate("notice", "Migrations", "aplicadas: " + ", ".join(applied))
        return

    sys.exit(__doc__)


if __name__ == "__main__":
    main()
