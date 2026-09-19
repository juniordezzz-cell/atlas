"""Monta roteador + repositório, roda o job, imprime o RESUMO e grava em job_runs."""

from __future__ import annotations

import json
import os
import sys
import traceback
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime, timezone
from pathlib import Path

from ..config import load_env_file, load_providers, load_yaml
from ..db import MemoryRepository, PostgresRepository, Repository
from ..db.connect import diagnose
from ..gha import annotate
from ..providers import build_providers
from ..reference import ReferenceRegistry
from ..router import Router

BACKEND_DIR = Path(__file__).resolve().parents[2]


@dataclass
class Context:
    router: Router
    repo: Repository
    registry: ReferenceRegistry
    watchlist: dict
    dry_run: bool
    only: set[str] | None
    started: datetime
    sections: dict = field(default_factory=dict)
    status: str = "ok"

    @property
    def tier_a(self) -> set[str]:
        tickers = set(self.watchlist.get("tier_a") or [])
        return tickers & self.only if self.only else tickers

    def section(self, name: str, value) -> None:
        self.sections[name] = asdict(value) if is_dataclass(value) else value
        errs = self.sections[name].get("errors") if isinstance(self.sections[name], dict) else None
        if errs and self.status == "ok":
            self.status = "parcial"


def make_repo(dry_run: bool) -> Repository:
    if dry_run:
        return MemoryRepository()
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        sys.exit("SUPABASE_DB_URL não definida. Use --dry-run para rodar sem banco.")
    try:
        return PostgresRepository(dsn)
    except Exception as e:
        hint = diagnose(dsn, e)
        annotate("error", "Banco", hint)
        sys.exit(hint)


@contextmanager
def job(name: str, dry_run: bool = False, only: set[str] | None = None):
    load_env_file(BACKEND_DIR / ".env")
    config = load_providers()
    repo = make_repo(dry_run)
    router = Router(config, build_providers(config), repo)
    ctx = Context(router, repo, ReferenceRegistry.load(), load_yaml("watchlist.yaml"), dry_run, only, datetime.now(timezone.utc))
    try:
        yield ctx
    except Exception as e:
        ctx.status = "erro"
        ctx.sections["falha"] = f"{type(e).__name__}: {e}"
        traceback.print_exc()
    finally:
        finished = datetime.now(timezone.utc)
        summary = {
            "dry_run": dry_run,
            "duracao_s": round((finished - ctx.started).total_seconds(), 1),
            **ctx.sections,
            "roteador": router.stats.as_dict(),
            "provedores": router.health_report(),
        }
        try:
            router.persist()
            repo.record_job(name, ctx.started, finished, ctx.status, summary)
        except Exception as e:  # não esconder o resumo se o banco falhar
            summary["falha_ao_gravar_resumo"] = str(e)
            ctx.status = "erro"
        print_summary(name, ctx.status, summary)
        annotate(
            {"ok": "notice", "parcial": "warning"}.get(ctx.status, "error"),
            f"Central RWA {name} ({ctx.status})",
            short_summary(summary),
        )
        repo.close()
        if ctx.status == "erro":
            sys.exit(1)


def short_summary(summary: dict) -> str:
    """Versão curta do resumo para a anotação pública do Actions (sem segredos)."""
    lines = [f"duração {summary.get('duracao_s')}s"]
    r = summary.get("roteador", {})
    lines.append(f"chamadas: {r.get('calls')}")
    if r.get("fallbacks"):
        lines.append(f"fallbacks: {r['fallbacks']}")
    for key, val in summary.items():
        if not isinstance(val, dict) or key in ("roteador", "provedores"):
            if key == "falha":
                lines.append(f"FALHA: {val}")
            continue
        picks = {k: val[k] for k in ("tokens", "requested", "saved", "confirmed", "missing_total", "B_total", "rows", "low_confidence_total") if k in val}
        if "updated" in val:
            picks["atualizados"] = len(val["updated"])
            picks["completos"] = len(val.get("skipped_complete", []))
        if val.get("errors"):
            picks["erros"] = len(val["errors"])
            lines.append(f"{key} erro exemplo: {str(val['errors'][0])[:200]}")
        if picks:
            lines.append(f"{key}: {picks}")
    if "total_mb" in summary:
        lines.append(f"banco: {summary['total_mb']} MB")
    return "\n".join(lines)


def print_summary(name: str, status: str, summary: dict) -> None:
    print("\n" + "=" * 72)
    print(f"RESUMO · {name} · status={status} · {summary.get('duracao_s')}s" + (" · DRY-RUN (nada gravado)" if summary.get("dry_run") else ""))
    print("=" * 72)
    r = summary.get("roteador", {})
    print(f"Chamadas por provedor: {r.get('calls')}")
    print(f"Atendidos por provedor: {r.get('served')}")
    if r.get("fallbacks"):
        print(f"Fallbacks acionados: {r['fallbacks']}")
    if r.get("skipped"):
        print(f"Provedores pulados: {r['skipped']}")
    blocked = {p: v["bloqueio"] for p, v in summary.get("provedores", {}).items() if v["bloqueio"] and v["bloqueio"] != "sem chave"}
    if blocked:
        print(f"Em cooldown / circuito aberto: {blocked}")
    for key, val in summary.items():
        if key in ("roteador", "provedores", "dry_run", "duracao_s"):
            continue
        print(f"\n[{key}]")
        print(json.dumps(val, ensure_ascii=False, indent=1, default=str)[:4000])
    if r.get("errors"):
        print("\nErros de provedor (últimos):")
        for e in r["errors"][-15:]:
            print("  -", e)
    print("=" * 72)
