"""Conexão com o Supabase e diagnóstico de falhas (sem nunca expor a senha)."""

from __future__ import annotations

from urllib.parse import urlsplit


def connect(dsn: str, **kwargs):
    import psycopg

    # prepare_threshold=None: sem prepared statements, o que faz funcionar também
    # no pooler do Supabase em modo transação (porta 6543).
    return psycopg.connect(dsn, prepare_threshold=None, **kwargs)


def safe_host(dsn: str) -> str:
    try:
        u = urlsplit(dsn)
        return f"{u.hostname}:{u.port or 5432} (usuário {u.username})"
    except ValueError:
        return "(string de conexão ilegível)"


def diagnose(dsn: str, err: Exception) -> str:
    msg = str(err)
    host = safe_host(dsn)
    if "[YOUR-PASSWORD]" in dsn or "YOUR-PASSWORD" in dsn:
        return f"A string de conexão ainda tem o texto [YOUR-PASSWORD]: troque pela senha do banco. Host: {host}"
    if "Network is unreachable" in msg or "Cannot assign requested address" in msg or (
        "db." in host and ".supabase.co" in host
    ):
        return (
            f"Não conectou em {host}. A conexão DIRETA do Supabase (db.xxxx.supabase.co) só funciona por IPv6, "
            "que o GitHub Actions não tem. Use a string do POOLER: Supabase → Connect → "
            "'Session pooler' (host ...pooler.supabase.com, porta 5432) e atualize o segredo SUPABASE_DB_URL."
        )
    if "password authentication failed" in msg:
        return f"Senha recusada em {host}. Confira a senha do banco (caracteres como @ # / ? precisam ser codificados na URL)."
    if "Tenant or user not found" in msg:
        return f"Usuário do pooler inválido em {host}: no pooler o usuário é 'postgres.<id-do-projeto>'."
    if "could not translate host name" in msg or "nodename nor servname" in msg:
        return f"Host não encontrado: {host}. Confira se copiou a string inteira."
    if "timeout" in msg.lower():
        return f"Tempo esgotado ao conectar em {host}. O projeto pode estar pausado: reative no painel do Supabase."
    first = msg.strip().splitlines()[0] if msg.strip() else type(err).__name__
    return f"Falha no banco ({host}): {first[:300]}"
