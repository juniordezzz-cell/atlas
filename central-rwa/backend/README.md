# Backend do Scanner Pools

Coletor de pools de liquidez do Scanner Pools (`central_rwa/pools/`). Busca na
DefiLlama, GeckoTerminal, Orca, Raydium e Aero (on-chain), aplica os cortes e a
segurança, dá nota e grava no Supabase (schema `scanner`). Roda no GitHub Actions
(`.github/workflows/scanner-pools.yml`), disparado pelo `pg_cron` do Supabase.

Regras vigentes e histórico: [`docs/superpowers/specs/2026-09-26-scanner-regras-design.md`](../../docs/superpowers/specs/2026-09-26-scanner-regras-design.md)
e [`docs/scanner-pools-2026-09-26.md`](../../docs/scanner-pools-2026-09-26.md).

A pasta e o pacote ainda se chamam `central-rwa`/`central_rwa`: eram da Central RWA,
retirada em 11/11/2026 (o último estado dela está na tag `central-rwa-final`). O
nome ficou para não mexer no agendamento que já funciona.

## Rodar localmente

```bash
cd central-rwa/backend
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"      # no Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m central_rwa pools --dry-run     # coleta sem gravar
```

Para gravar no banco, copie `.env.example` para `.env` e preencha `SUPABASE_DB_URL`.

| Comando | O que faz |
|---|---|
| `pools [--dry-run] [--pular-se-recente MIN]` | Uma coleta do Scanner |
| `migrate` | Aplica `central-rwa/supabase/migrations/*.sql` (todas idempotentes, a cada coleta) |

Toda migração nova precisa ser idempotente: o workflow do Scanner roda todas antes de cada coleta.
