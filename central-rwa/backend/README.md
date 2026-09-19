# Central RWA · backend (Fase 1)

Coleta e roteamento de dados de **ativos tradicionais tokenizados** (ações, ETFs, commodities, T-bills).
Roda em jobs agendados no GitHub Actions e grava no Supabase (Postgres). Custo zero.

- Especificação: [`docs/central-rwa/ESPECIFICACAO.md`](../../docs/central-rwa/ESPECIFICACAO.md)
- Infraestrutura e alternativas: [`docs/central-rwa/INFRA_ALTERNATIVAS.md`](../../docs/central-rwa/INFRA_ALTERNATIVAS.md)
- Fontes testadas de verdade: [`docs/central-rwa/FONTES_VERIFICADAS.md`](../../docs/central-rwa/FONTES_VERIFICADAS.md)

## Rodar localmente

```bash
cd central-rwa/backend
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"      # no Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m central_rwa tier_a --dry-run          # nada é gravado
.venv/Scripts/python -m central_rwa daily --dry-run --only NVDA,GOLD
```

Para gravar no banco, copie `.env.example` para `.env` e preencha `SUPABASE_DB_URL`.

| Comando | O que faz | Onde roda |
|---|---|---|
| `migrate` | Aplica `central-rwa/supabase/migrations/*.sql` | manual / backfill |
| `tier_a` | Snapshots dos tokens da camada A + cotação dos ativos de referência | Actions, 00h/06h/12h/18h de Brasília |
| `daily` | Catálogo, snapshots da camada B, recálculo das camadas, 1 dia de histórico, T-bills | Actions, 00h30 de Brasília |
| `backfill` | 10 anos de histórico da camada A (+ B conhecida). **Retomável** | Actions, manual |
| `catalog` | Só o catálogo | manual |
| `report` | Tamanho do banco por tabela | depois do daily/backfill |
| `probe` | Uma chamada real por provedor, para checar chaves e formatos | manual |

Opções: `--dry-run` (usa um banco em memória) e `--only NVDA,GOLD` (limita os ativos).

## Primeira vez em produção

1. Crie o projeto no Supabase e cadastre `SUPABASE_DB_URL` nos Secrets do repositório.
2. No GitHub → Actions → **Central RWA · backfill** → *Run workflow*, marcando **migrate**.
3. A partir daí, os agendamentos de 6h e diário rodam sozinhos. Sem o segredo, eles só avisam e pulam.

## Como funciona o roteador

Os coletores nunca chamam uma API direto. Eles pedem uma **capacidade** (`token_price`, `reference_history_daily`...) e o roteador ([`central_rwa/router/router.py`](central_rwa/router/router.py)) escolhe a fonte seguindo a ordem de `config/providers.yaml`. No caminho, ele:

- **pula** um provedor que esteja sem chave, em cooldown, com o circuito aberto ou sem cota;
- **conta a cota antes** de cada requisição HTTP. Em janelas curtas espera; em janelas longas passa para o próximo;
- **põe em cooldown** quem respondeu 429 (backoff exponencial) e **abre o circuito** depois de N falhas seguidas;
- **guarda o estado** das cotas e da saúde nas tabelas `provider_usage` e `provider_health`, porque cada job é efêmero;
- **confirma o preço** de cada token em uma segunda fonte diferente e grava a divergência.

## Adicionar um provedor novo

1. Crie `central_rwa/providers/<nome>.py` com uma classe `Provider` (`name = "<nome>"`) implementando o método da capacidade:
   - `token_quotes(network, addresses)`
   - `daily_history(asset, start)`
   - `quote(asset)`
   - `tbill_rates(year)`
   - `catalog()` / `catalog_category(rule, known)`

   Use `self.get_json(...)`: é ele que passa pela cota do roteador e converte 429 em `RateLimited`.
2. Registre a classe em `central_rwa/providers/__init__.py`.
3. Em `config/providers.yaml`, declare os limites e a chave (`key_env`) e coloque o provedor na ordem da capacidade.
4. Faça **uma chamada real**, salve a resposta em `tests/fixtures/` e escreva um teste de normalização.
5. Registre o resultado em `docs/central-rwa/FONTES_VERIFICADAS.md`.

## Adicionar um ativo à camada A

Acrescente o ticker **do ativo de referência** em `config/watchlist.yaml` (ex.: `AMD`). Todos os tokens mapeados para ele, nas 4 redes, passam a ser atualizados a cada 6h.

- **Commodity ou símbolo fora do padrão:** declare também em `config/reference_assets.yaml` (ex.: `GOLD` → Yahoo `GC=F`).
- **Token mapeado errado ou com baixa confiança:** corrija em `config/mapping_overrides.yaml`.

## Ler o resumo dos jobs

Cada execução imprime um **RESUMO** no fim do log do Actions e grava o mesmo conteúdo em `central_rwa.job_runs.summary`:

- **Chamadas / atendidos por provedor:** quanto cada fonte foi usada.
- **Fallbacks acionados / provedores pulados:** quando e por que uma fonte foi trocada (cota, cooldown, sem chave).
- **`catalogo`:** tokens por fonte e por rede, `low_confidence` (mapeamentos a revisar) e `unmapped`.
- **`tokens_camada_a` / `tokens_camada_b`:** quantos tokens tiveram preço, quantos foram **confirmados por 2 fontes**, as divergências e os tokens sem preço (`missing_total`).
- **`token_vs_ativo_acima_de_2pct`:** tokens descolados do ativo de referência (seção 7.2).
- **`historico`:** linhas gravadas, cobertura de cada série e lacunas.
- **`status`:**
  - `ok`: tudo certo;
  - `parcial`: alguma fonte falhou, mas o job terminou;
  - `erro`: o job falhou e o workflow fica vermelho.

## Consumo estimado do GitHub Actions

Medido localmente em 2026-09-19:

- `daily` ≈ 5 min, sendo a maior parte a espera da CoinGecko sem chave e ~18 s por ano no CSV do Tesouro.
- `tier_a` ≈ 49 s, no teste de ponta a ponta contra Postgres.

A tabela abaixo soma ~40 s de instalação por execução:

| Job | Execuções/mês | Min/execução | Min/mês |
|---|---|---|---|
| tier_a | 120 | ~2 | ~240 |
| daily | 30 | ~6 | ~180 |
| testes (push) | ~20 | ~1 | ~20 |
| **Total** | | | **~440 de 2.000** |
