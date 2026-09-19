"""python -m central_rwa <job> [--dry-run] [--only NVDA,GOLD]

Jobs: tier_a | daily | backfill | catalog | report | probe | migrate
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .config import load_env_file


def main(argv: list[str] | None = None) -> None:
    # Console do Windows: garante UTF-8 no resumo.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    from .jobs import JOBS

    parser = argparse.ArgumentParser(prog="central_rwa")
    parser.add_argument("job", choices=[*JOBS, "migrate"])
    parser.add_argument("--dry-run", action="store_true", help="roda tudo sem gravar no banco")
    parser.add_argument("--only", help="limita a estes tickers de referência (ex.: NVDA,GOLD)")
    args = parser.parse_args(argv)

    backend = Path(__file__).resolve().parents[1]
    load_env_file(backend / ".env")

    if args.job == "migrate":
        from .db import apply_migrations

        dsn = os.environ.get("SUPABASE_DB_URL")
        if not dsn:
            sys.exit("SUPABASE_DB_URL não definida.")
        for name in apply_migrations(dsn, backend.parent / "supabase" / "migrations"):
            print("aplicada:", name)
        return

    from .jobs.runner import job

    only = {t.strip().upper() for t in args.only.split(",")} if args.only else None
    with job(args.job, dry_run=args.dry_run, only=only) as ctx:
        JOBS[args.job](ctx)


if __name__ == "__main__":
    main()
