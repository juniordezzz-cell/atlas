from central_rwa.db.connect import diagnose, safe_host
from central_rwa.gha import annotate

DIRECT = "postgresql://postgres:s3nh4@db.abcd.supabase.co:5432/postgres"
POOLER = "postgresql://postgres.abcd:s3nh4@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"


def test_nunca_mostra_a_senha():
    for dsn in (DIRECT, POOLER):
        assert "s3nh4" not in safe_host(dsn)
        assert "s3nh4" not in diagnose(dsn, Exception("qualquer coisa"))


def test_conexao_direta_sugere_pooler():
    assert "POOLER" in diagnose(DIRECT, Exception("connection failed: Network is unreachable"))


def test_placeholder_de_senha():
    assert "[YOUR-PASSWORD]" in diagnose("postgresql://postgres.x:[YOUR-PASSWORD]@h.pooler.supabase.com:5432/postgres", Exception("x"))


def test_string_de_exemplo_e_host_inexistente():
    exemplo = "postgresql://postgres.xxxx:abc@aws-0-REGIAO.pooler.supabase.com:5432/postgres"
    assert "EXEMPLO" in diagnose(exemplo, Exception("failed to resolve host"))
    real = "postgresql://postgres.abc:x@aws-0-zz.pooler.supabase.com:5432/postgres"
    assert "Host não encontrado" in diagnose(real, Exception("failed to resolve host 'aws-0-zz': Name or service not known"))


def test_senha_errada_e_usuario_do_pooler():
    assert "Senha recusada" in diagnose(POOLER, Exception('FATAL: password authentication failed for user "postgres"'))
    assert "postgres.<id" in diagnose(POOLER, Exception("FATAL: Tenant or user not found"))


def test_anotacao_so_no_actions(monkeypatch, capsys):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    annotate("error", "t", "m")
    assert capsys.readouterr().out == ""
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    annotate("error", "Banco, teste", "linha1\nlinha2 100%")
    assert capsys.readouterr().out.strip() == "::error title=Banco; teste::linha1%0Alinha2 100%25"
