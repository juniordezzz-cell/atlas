"""Anotações do GitHub Actions. Elas aparecem no resumo da execução, que é
visível sem login num repositório público (os logs completos não)."""

from __future__ import annotations

import os


def annotate(level: str, title: str, message: str) -> None:
    """level: notice | warning | error. Fora do Actions, não faz nada."""
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    esc = message.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    t = title.replace(",", ";").replace("::", ":")
    print(f"::{level} title={t}::{esc}", flush=True)
