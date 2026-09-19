# Prompt — Central RWA · Fase 1 (Roteador + Data Engine)

> Cole o bloco abaixo numa sessão nova do Claude Code aberta na pasta do repositório `atlas`.
> Antes de colar, leia a seção **"Passos manuais (seus)"** no fim deste arquivo. Alguns passos (criar contas e chaves) só você pode fazer.

---

```text
Vamos implementar a FASE 1 da Central RWA do ATLAS.

LEIA PRIMEIRO, POR INTEIRO:
- docs/central-rwa/ESPECIFICACAO.md — a especificação completa (fonte da verdade).
  Atenção especial às seções 3 (escopo e lista inicial), 4 (emissores e redes),
  5 (gatilhos e camadas de atualização), 7 (histórico), 14 (memória), 16 (backend),
  17 (fontes) e 18 (roteador de APIs).
- docs/central-rwa/INFRA_ALTERNATIVAS.md — por que usamos o Plano A e os cuidados dele.

CONTEXTO
- A Central RWA é uma central de inteligência sobre ATIVOS TRADICIONAIS TOKENIZADOS:
  ações, ETFs, commodities (ouro, prata, petróleo) e títulos do Tesouro dos EUA (T-bills).
  Bitcoin, Solana como ativo e cripto em geral estão FORA. As redes (Solana, Ethereum,
  Robinhood Chain, BNB Chain) são só infraestrutura: é onde os tokens estão registrados.
- Infraestrutura decidida (Plano A): jobs em Python rodando no GitHub Actions (cron) e
  gravando no Supabase (Postgres, 500 MB grátis). Não existe servidor 24/7.
- Orçamento de APIs: ZERO. Por isso, várias fontes gratuitas passam por um ROTEADOR
  com fallback automático.
- O front atual do Atlas (HTML/JS puro) NÃO é tocado nesta fase. A pasta RWA/ antiga
  também não é tocada; ela será substituída na Fase 5.

OBJETIVO DA FASE 1
Ter, rodando sozinho no GitHub Actions e gravando no Supabase:
1. o roteador de APIs (cache, cota, cooldown, circuit breaker, fallback, validação cruzada);
2. o catálogo de ativos tokenizados (ativo de referência ↔ tokens, por emissor e rede);
3. o histórico diário de 10 anos dos ativos de referência;
4. snapshots de preço/volume/liquidez dos tokens, em camadas (A a cada 6h, B a cada 24h);
5. o rendimento dos T-bills (histórico + atualização diária).

FORA DO ESCOPO (fases seguintes, não implementar agora)
- Fluxo on-chain, movimentações de US$ 100k e rastreador de carteiras (Fase 2).
- Detecção de eventos e eventos semelhantes (Fase 3).
- Agentes, paper trading e placar (Fase 4).
- Qualquer interface (Fase 5).
- Pools, notícias, supervisor, IA (Fases 6–7).
Mas o esquema do banco e o roteador devem ser pensados para suportar essas fases
sem precisar de refação.

ESTRUTURA (sugestão, ajuste se tiver motivo)
central-rwa/
  backend/
    pyproject.toml            (Python 3.12; httpx, pydantic, PyYAML, psycopg[binary], yfinance, tenacity; pytest, respx)
    central_rwa/
      config/                 (carregamento de providers.yaml, watchlist.yaml, mapping_overrides.yaml)
      router/                 (roteador, cota, cooldown, circuit breaker, cache, normalização)
      providers/              (um adaptador por fonte; cada um declara capacidades, limites e se exige chave)
      collectors/             (catálogo, histórico de referência, snapshots de token, rendimento T-bill)
      db/                     (conexão e repositórios)
      jobs/                   (pontos de entrada: tier_a, tier_b, daily, backfill, catalog)
      cli.py                  (python -m central_rwa <job> [--dry-run] [--only ATIVO])
    config/
      providers.yaml
      watchlist.yaml
      mapping_overrides.yaml
    tests/
    .env.example
    README.md
  supabase/
    migrations/               (SQL versionado)
.github/workflows/
  central-rwa-tier-a.yml      (cron a cada 6h: 0 */6 * * *)
  central-rwa-daily.yml       (cron diário: camada B + histórico + catálogo + rendimento T-bill)
  central-rwa-backfill.yml    (só manual — workflow_dispatch — para baixar os 10 anos)
  central-rwa-tests.yml       (pytest a cada push em central-rwa/**)

BANCO (Supabase / Postgres) — migrations SQL versionadas
Tabelas mínimas (ajuste nomes e tipos se tiver motivo, e documente):
- asset_classes         (stock, etf, commodity, tbill, br_stock)
- reference_assets      (ticker, nome, classe, bolsa/mercado, símbolos por fonte — ex.: Yahoo "GC=F", Stooq, FRED)
- issuers               (xStocks, Ondo, Robinhood, Dinari, bStocks, Colb, Paimon, Tether, Paxos, BlackRock, Franklin, Superstate...)
- networks              (solana, ethereum, robinhood_chain [4663], bnb_chain; outras podem existir desativadas)
- tokens                (reference_asset, issuer, network, contrato/mint, decimais, símbolo, ativo?, confiança do mapeamento, origem do mapeamento)
- watch_tiers           (asset, camada A/B, motivo: manual|evento|padrão, desde, até)
- reference_prices_daily(asset, data, open, high, low, close, adj_close, volume, fonte) — PK (asset, data)
- token_snapshots       (token, ts, preço_usd, volume_24h_usd, liquidez_usd, fonte, fontes_confirmadas, divergência_%)
- tbill_yields_daily    (prazo, data, rendimento, fonte)
- provider_usage        (provedor, janela [segundo/minuto/dia/mês], início_da_janela, chamadas) — persistida porque cada job é efêmero
- provider_health       (provedor, falhas_seguidas, cooldown_até, circuito aberto?, último_erro, último_sucesso, latência_média)
- job_runs              (job, início, fim, status, resumo JSON: chamadas por provedor, linhas gravadas, erros)
Regras:
- Toda linha de dado de mercado guarda a FONTE (provedor) que a entregou.
- NÃO guardar respostas brutas das APIs, só o dado normalizado (limite de 500 MB).
- Upserts idempotentes: rodar o mesmo job duas vezes não duplica nada.
- Ativar RLS em todas as tabelas, SEM políticas públicas por enquanto (o front entra na Fase 5).
- Deixar uma consulta/visão simples que mostre o tamanho do banco por tabela.

ROTEADOR (seção 18 da especificação — seguir à risca)
- Os coletores pedem CAPACIDADES (ex.: token_price, reference_history_daily,
  reference_quote, catalog_tokens, tbill_yield), nunca uma API específica.
- providers.yaml define, por capacidade, a lista ordenada de provedores e os limites
  de cada um (por segundo/minuto/dia/mês), se exige chave e o nome da variável de ambiente.
- Provedor que exige chave e está sem chave configurada é PULADO sem erro. A Fase 1 tem
  que funcionar só com as fontes sem chave e ficar melhor à medida que as chaves são adicionadas.
- A cota é controlada ANTES da chamada (parar antes de estourar) e persistida em provider_usage.
- 429 ou bloqueio → cooldown com backoff exponencial; N falhas seguidas → circuito aberto,
  com nova tentativa depois de um tempo; tudo gravado em provider_health.
- Cache: dentro da execução (memória) + checagem de "frescor" no banco (não buscar de novo
  um dado que ainda vale — ex.: histórico diário já gravado).
- Resposta normalizada com pydantic; trocar a fonte não muda nada para o coletor.
- Validação cruzada: o preço de token só recebe fontes_confirmadas >= 2 se duas fontes
  concordarem dentro de uma tolerância configurável (ex.: 1%). Gravar a divergência.
- Consultas em lote onde a API permitir (ex.: DexScreener aceita vários tokens por chamada).
- User-Agent identificado em todas as chamadas (a SEC EDGAR, por exemplo, exige).
- Respeitar os termos de uso de cada fonte. NUNCA criar contas falsas nem burlar limites.

PROVEDORES DA FASE 1 (implementar os adaptadores nesta ordem de prioridade)
Antes de escrever cada adaptador, CONSULTE A DOCUMENTAÇÃO ATUAL da fonte e faça UMA
chamada real de sonda para confirmar o formato da resposta e os limites. Os limites da
seção 17 da especificação foram pesquisados em 2026-09-19 e podem ter mudado — se
mudaram, atualize providers.yaml e anote em docs/central-rwa/FONTES_VERIFICADAS.md
(fonte, data da verificação, limite real, observações).

  catalog_tokens:        xStocks API pública (sem chave) → Ondo GM API (se o acesso for livre)
                         → CoinGecko (categorias de tokenized stocks / gold / treasury, chave Demo)
                         → DefiLlama (RWA) → mapping_overrides.yaml (manual, sempre vence)
  token_price:           DexScreener → GeckoTerminal → DefiLlama coins → CoinPaprika
                         → CoinGecko (Demo) → Jupiter (Solana, se chave)
  reference_history_daily: yfinance (baixar com cache e pausas) → Stooq (se chave)
                         → Tiingo / Twelve Data / Alpha Vantage (se chave)
  commodity_history_daily: yfinance (GC=F, SI=F, CL=F, BZ=F) → Stooq → FRED (petróleo, se chave)
  reference_quote:       Finnhub (se chave) → Twelve Data (se chave) → yfinance
  tbill_yield:           Treasury Fiscal Data API (sem chave) → FRED (se chave)

MAPEAMENTO TOKEN ↔ ATIVO DE REFERÊNCIA
- Cada token precisa apontar para o ativo de referência certo (NVDAx → NVDA, XAUT → ouro spot/GC,
  BUIDL → T-bill). Heurística por símbolo e metadados do emissor, com um campo de CONFIANÇA.
- Mapeamentos de baixa confiança não entram na camada A e são listados no resumo do job
  para revisão humana.
- mapping_overrides.yaml sempre vence a heurística.
- T-bills: o preço fica perto de US$ 1; registrar preço e NAV quando houver. O gatilho de 5%
  NÃO se aplica a eles (ver seção 3.1 da especificação).

CAMADAS DE ATUALIZAÇÃO (seção 5.3)
- watchlist.yaml, camada A inicial: NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL, SPY, QQQ,
  ouro (XAUT/PAXG → referência ouro), petróleo (WTI).
- Camada B: todo ativo do catálogo cujo token tenha liquidez/volume > US$ 100.000.
- Redes ativas: solana, ethereum, robinhood_chain, bnb_chain.
- Job tier_a (6h): snapshots dos tokens da camada A + cotação de referência.
- Job daily (00h UTC): snapshots da camada B + 1 dia novo de histórico para todos
  + atualização do catálogo + rendimento dos T-bills.
- Job backfill (manual): 10 anos de histórico diário dos ativos de referência. Tem que ser
  RETOMÁVEL: se parar no meio, continua de onde parou.
- Deixar pronta (mas sem lógica de evento ainda) a promoção automática B → A prevista
  na seção 5.3: só a estrutura em watch_tiers.

GITHUB ACTIONS
- Segredos lidos de GitHub Secrets: SUPABASE_DB_URL e as chaves opcionais das APIs.
  Nenhum segredo no código, em logs ou em commits. Criar .env.example com todas as variáveis.
- concurrency por workflow (duas execuções do mesmo job nunca rodam ao mesmo tempo).
- timeout-minutes em todos os jobs.
- Cache do pip.
- Cada execução imprime no final um RESUMO legível: chamadas por provedor, fallbacks
  acionados, provedores em cooldown, linhas gravadas, mapeamentos de baixa confiança, erros.
  O mesmo resumo vai para job_runs.
- Estimar e documentar os minutos de Actions por mês (a meta é ficar abaixo de ~1.300 dos
  2.000 gratuitos). Se a estimativa real passar disso, avisar.

TESTES
- pytest com HTTP simulado (respx) para: fallback quando o 1º provedor dá 429, pulo de provedor
  sem chave, cota que impede a chamada, circuit breaker, validação cruzada de preço, normalização
  de cada adaptador (com respostas reais capturadas nas sondas e salvas como fixtures),
  idempotência dos upserts e retomada do backfill.
- Modo --dry-run: roda tudo, mas não grava no banco (imprime o que gravaria).

CRITÉRIOS DE PRONTO DA FASE 1
1. `pytest` passando localmente e no workflow de testes.
2. `python -m central_rwa daily --dry-run` rodando localmente só com as fontes SEM chave.
3. Migrations aplicadas no Supabase (ou instruções exatas para eu aplicar, se você não tiver acesso).
4. Backfill de 10 anos concluído para os ativos da camada A, com contagem de linhas por ativo
   (~2.500 pregões por ativo) e lacunas relatadas.
5. Catálogo com os tokens da camada A mapeados nas 4 redes onde existirem, com fonte e confiança.
6. Pelo menos uma execução real de tier_a e uma de daily no GitHub Actions, com o resumo.
7. Tamanho do banco medido e anotado (tem que estar bem abaixo de 500 MB).
8. docs/central-rwa/FONTES_VERIFICADAS.md preenchido com o que foi realmente testado.
9. central-rwa/backend/README.md explicando como rodar local, como adicionar um provedor novo,
   como adicionar um ativo à camada A e como ler o resumo dos jobs.

FORMA DE TRABALHAR
- Siga a ordem: estrutura → banco → roteador (com testes) → adaptadores (sondando cada fonte)
  → coletores → jobs → workflows → backfill → verificação final.
- Commits pequenos, em português, um por etapa.
- Relate TODO erro ou comportamento estranho de fonte que encontrar, mesmo fora do escopo.
- Se uma fonte da lista não servir (limite muito menor, exige pagamento, termos proíbem),
  tire da ordem, registre o porquê em FONTES_VERIFICADAS.md e siga com as outras.
- Pare e me pergunte SÓ se precisar de algo que só eu posso fazer (criar conta, chave,
  segredo no GitHub) ou se uma decisão mudar o que está na especificação.
```

---

## Passos manuais (seus)

O Claude Code não cria contas nem cadastra chaves por você. Isso é você quem faz, de preferência antes de colar o prompt (a Fase 1 começa com as fontes sem chave, então dá para ir fazendo em paralelo).

### Obrigatórios

1. **Supabase:** criar a conta e um projeto (plano Free).
   - Anote a **connection string do Postgres** (Project Settings → Database → Connection string, modo *pooler*).
   - Ela vira o segredo `SUPABASE_DB_URL`.
2. **GitHub Secrets:** no repositório `juniordezzz-cell/atlas` → Settings → Secrets and variables → Actions → *New repository secret*.
   - Cadastre `SUPABASE_DB_URL` e, depois, cada chave de API que você criar.
3. **Visibilidade do repositório:** confirme se ele é **privado** (2.000 min/mês de Actions) ou **público** (ilimitado, mas o agendamento é desativado após 60 dias sem atividade e o código fica visível). Os dois funcionam.

### Chaves gratuitas (opcionais, mas cada uma deixa o roteador mais forte)

| Variável | Onde criar | Para quê |
|---|---|---|
| `COINGECKO_DEMO_KEY` | coingecko.com → Developer Dashboard | Catálogo e preço dos tokens |
| `FINNHUB_KEY` | finnhub.io | Cotação das ações |
| `TWELVEDATA_KEY` | twelvedata.com | Cotação e histórico |
| `TIINGO_KEY` | tiingo.com | Histórico diário |
| `ALPHAVANTAGE_KEY` | alphavantage.co | Histórico (reserva) |
| `FRED_KEY` | fred.stlouisfed.org | Petróleo e T-bills |
| `STOOQ_KEY` | stooq.com (captcha) | Histórico em CSV |
| `JUPITER_KEY` | developers.jup.ag | Preço de tokens na Solana |

As chaves de dados on-chain (Blockscout, Etherscan, Alchemy, Helius, Moralis) só são necessárias na **Fase 2**.
