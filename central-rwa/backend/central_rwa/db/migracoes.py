"""Aplica as migrações SQL da pasta supabase/migrations, em ordem de nome.

Saiu de repository.py na retirada da Central RWA (11/11/2026), sem mudança:
todas as migrações são idempotentes e rodam de novo a cada coleta."""

from __future__ import annotations

from pathlib import Path

from .connect import connect


def apply_migrations(dsn: str, folder: Path) -> list[str]:
    applied = []
    with connect(dsn, autocommit=True) as conn:
        for path in sorted(folder.glob("*.sql")):
            with conn.cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
            applied.append(path.name)
    return applied
