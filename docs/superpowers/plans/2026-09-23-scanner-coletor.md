# Scanner Pools · Parte 1 — Coletor no servidor · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um job `python -m central_rwa pools` que, a cada 4 h no GitHub Actions, coleta pools de liquidez na DefiLlama e na GeckoTerminal, barra tokens perigosos, classifica em Sólida/Caça, dá nota 0–100, guarda uma leitura por dia por 30 dias e publica tudo no Supabase por visões públicas `scanner_*`.

**Architecture:** Subpacote novo `central_rwa/pools/`, independente do roteador da Central RWA (que é específico de ativos RWA). Funções puras para parse, classificação e nota (testadas sem rede com fixtures reais); um cliente HTTP com espaçamento para a GeckoTerminal; um repositório com implementação em memória (testes e `--dry-run`) e em Postgres (schema `scanner`). O site só é alterado nas Partes 2 e 3 (planos separados).

**Tech Stack:** Python 3.12, httpx, psycopg 3, pytest, respx, pgserver (integração), Supabase/PostgREST, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-scanner-cacador-design.md`

## Global Constraints

- Sem chave de API e sem IA: só DefiLlama (`https://yields.llama.fi/pools`) e GeckoTerminal (`https://api.geckoterminal.com/api/v2`), regras fixas.
- GeckoTerminal: no máximo ~30 requisições/min → espaçar 2,2 s entre chamadas; em 429, esperar 15 s × tentativa, até 5 tentativas.
- Pré-corte: TVL ≥ US$ 100.000 **e** volume 24 h ≥ US$ 50.000.
- Até 10 páginas (20 pools cada) por DEX na GeckoTerminal.
- Cache de segurança de token: 7 dias.
- Leituras diárias: uma por pool por dia (a última do dia vence), apagar com mais de 30 dias.
- Pool some da lista (`ativa=false`) só após 3 coletas seguidas sem aparecer.
- Token sem informação de segurança → trilho Caça, nunca Sólida.
- Tabelas no schema `scanner`, com RLS ligado e sem política; leitura pública só pelas visões `public.scanner_pools`, `public.scanner_leituras`, `public.scanner_status` (`grant select ... to anon, authenticated`), no padrão das visões `crwa_*`.
- Agendamento: cron a cada 4 h, grupo de concorrência `central-rwa-db`, pular com aviso se `SUPABASE_DB_URL` não existir.
- Textos para o usuário e comentários em português, no estilo do resto do backend.

### Ajustes da spec feitos neste plano (decididos com base nos dados reais)

1. **Idade do token:** a GeckoTerminal não informa quando o token nasceu, só `pool_created_at`. A idade do token passa a ser a data da pool mais antiga daquele token vista pelo coletor (guardada em `scanner.tokens.primeira_pool_em`). Sem data conhecida, o critério de idade não é cumprido.
2. **Fee zero:** a DefiLlama não informa a taxa de Curve, Camelot, LFJ, QuickSwap e Kamino (fica 0, que o Scanner mostra como "taxa ?"). Barrar só pool com **fee = 0 E sem APR** (nem de taxa nem de emissão).

---

## Estrutura de arquivos

```
central-rwa/backend/central_rwa/pools/
  __init__.py        API pública do subpacote
  config.py          redes, DEXes, fontes Gecko, majors, limites
  modelos.py         dataclasses Candidata, TokenInfo, PoolFinal, Leitura
  fontes.py          parse DefiLlama/Gecko (puro) + ClienteFontes (HTTP)
  classificacao.py   pré-corte, camada 1 (barrar), token sólido, trilho
  nota.py            nota 0–100 e componentes
  repositorio.py     PoolStore: MemoryPoolStore e PostgresPoolStore
  coleta.py          orquestra uma execução e devolve o resumo
central-rwa/backend/tests/
  test_pools_fontes.py
  test_pools_classificacao.py
  test_pools_nota.py
  test_pools_coleta.py
  test_pools_postgres.py
  fixtures/ (já capturados em 23/09/2026)
    gt_pools_pancake_v3_bsc.json   6 pools reais da PancakeSwap v3/BSC
    gt_token_info_bsc.json         /tokens/{TAKE}/info
    gt_token_info_wbnb.json        /tokens/{WBNB}/info
    gt_tokens_multi_bsc.json       /tokens/multi/{WBNB,TAKE}
    llama_pools_sample.json        10 pools reais da DefiLlama
central-rwa/supabase/migrations/20260923000001_scanner_pools.sql
central-rwa/backend/central_rwa/__main__.py   (modificar: job "pools")
.github/workflows/scanner-pools.yml
```

---

### Task 1: Configuração e modelos

**Files:**
- Create: `central-rwa/backend/central_rwa/pools/__init__.py`
- Create: `central-rwa/backend/central_rwa/pools/config.py`
- Create: `central-rwa/backend/central_rwa/pools/modelos.py`
- Test: `central-rwa/backend/tests/test_pools_fontes.py` (primeiro teste)

**Interfaces:**
- Produces: `config.LLAMA_CHAINS: dict[str, str]` (chain DefiLlama → rótulo), `config.GECKO_NET: dict[str, str]` (rótulo → slug Gecko), `config.pretty_project(slug) -> str`, `config.LLAMA_PROJECTS: set[str]`, `config.GECKO_SOURCES: dict[str, list[dict]]`, `config.MAJORS: set[str]`, `config.parse_llama_fee(meta, projeto) -> float`, constantes `TVL_MIN`, `VOL_MIN`, `GECKO_PAGINAS`, `CACHE_TOKEN_DIAS`, `LEITURAS_DIAS`, `FALHAS_PARA_SUMIR`.
- Produces: dataclasses em `modelos.py` (campos exatos abaixo).

- [ ] **Step 1: Escrever o teste que falha**

```python
# central-rwa/backend/tests/test_pools_fontes.py
from central_rwa.pools import config


def test_nomes_de_projeto_e_taxa():
    assert config.pretty_project("pancakeswap-amm-v3") == "PancakeSwap"
    assert config.pretty_project("aerodrome-slipstream") == "Aerodrome"
    assert config.parse_llama_fee("0.3%", "uniswap-v3") == 0.3
    assert config.parse_llama_fee("25%", "cetus-clmm") == 0.25      # Cetus escreve em pontos-base
    assert config.parse_llama_fee(None, "uniswap-v2") == 0.3        # taxa fixa de v2
    assert config.parse_llama_fee(None, "curve-dex") == 0            # desconhecida = 0
    assert config.LLAMA_CHAINS["BSC"] == "BNB Chain"
    assert config.GECKO_NET["BNB Chain"] == "bsc"
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `central-rwa/backend`): `python -m pytest tests/test_pools_fontes.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'central_rwa.pools'`

- [ ] **Step 3: Implementar**

```python
# central-rwa/backend/central_rwa/pools/__init__.py
"""Scanner Pools — coletor de pools de liquidez (ver docs/superpowers/specs/2026-09-23-scanner-cacador-design.md)."""
```

```python
# central-rwa/backend/central_rwa/pools/config.py
"""Onde o coletor procura e com que régua. Espelha as listas do Scanner no site
(Ferramentas/scanner-pools/index.html: LLAMA_CHAINS, MY_DEXES, GECKO_SOURCES),
conferidas nas APIs em 22–23/09/2026."""

from __future__ import annotations

import re

TVL_MIN = 100_000.0
VOL_MIN = 50_000.0
GECKO_PAGINAS = 10
GECKO_INTERVALO_S = 2.2
CACHE_TOKEN_DIAS = 7
LEITURAS_DIAS = 30
FALHAS_PARA_SUMIR = 3

# chain na DefiLlama -> rótulo da rede no ATLAS
LLAMA_CHAINS: dict[str, str] = {
    "Solana": "Solana", "Base": "Base", "Arbitrum": "Arbitrum", "BSC": "BNB Chain",
    "Ethereum": "Ethereum", "OP Mainnet": "Optimism", "Polygon": "Polygon",
    "Avalanche": "Avalanche", "Sui": "Sui", "Hyperliquid L1": "HyperEVM",
    "Robinhood Chain": "Robinhood",
}

# rótulo da rede -> slug da rede na GeckoTerminal (conferido em /networks em 23/09/2026)
GECKO_NET: dict[str, str] = {
    "Solana": "solana", "Base": "base", "Arbitrum": "arbitrum", "BNB Chain": "bsc",
    "Ethereum": "eth", "Optimism": "optimism", "Polygon": "polygon_pos",
    "Avalanche": "avax", "Sui": "sui-network", "HyperEVM": "hyperevm", "Robinhood": "robinhood",
}

_PROJETOS: dict[str, str] = {
    "uniswap-v4": "Uniswap", "uniswap-v3": "Uniswap", "uniswap-v2": "Uniswap", "uniswap": "Uniswap",
    "raydium-clmm": "Raydium", "raydium-amm": "Raydium", "raydium": "Raydium",
    "orca-dex": "Orca", "orca": "Orca", "orca-whirlpool": "Orca", "orca-whirlpools": "Orca",
    "pancakeswap-amm-v3": "PancakeSwap", "pancakeswap-amm": "PancakeSwap", "pancakeswap-amm-v2": "PancakeSwap",
    "meteora-dlmm": "Meteora", "meteora-amm": "Meteora", "meteora-dammv2": "Meteora",
    "aerodrome-slipstream": "Aerodrome", "aerodrome-v1": "Aerodrome", "aerodrome": "Aerodrome",
    "velodrome-v2": "Velodrome", "velodrome-v3": "Velodrome", "velodrome-slipstream": "Velodrome",
    "camelot-v2": "Camelot", "camelot-v3": "Camelot",
    "thena-v1": "THENA", "thena-fusion": "THENA", "thena": "THENA",
    "kamino-liquidity": "Kamino", "sushiswap": "SushiSwap", "sushiswap-v3": "SushiSwap",
    "curve-dex": "Curve", "quickswap-dex": "QuickSwap", "quickswap-v3": "QuickSwap",
    "joe-v2.2": "LFJ", "joe-v2.1": "LFJ", "joe-v2": "LFJ", "joe-dex": "LFJ",
    "pharaoh-v3": "Pharaoh", "pharaoh-exchange": "Pharaoh", "cetus-clmm": "Cetus", "cetus-amm": "Cetus",
    "hyperswap-v3": "HyperSwap", "hyperswap-v2": "HyperSwap", "project-x": "Project X",
    "ramses-cl-v2": "Ramses", "ramses-v2": "Ramses",
}

# DEXes que a DefiLlama cobre com volume + APR de taxa
LLAMA_PROJECTS: set[str] = {
    "Uniswap", "Raydium", "Orca", "Aerodrome", "Camelot", "Kamino", "SushiSwap", "Curve",
    "QuickSwap", "LFJ", "Pharaoh", "Cetus", "HyperSwap", "Project X", "Ramses",
}

# DEXes puxadas da GeckoTerminal (a DefiLlama não traz volume delas)
GECKO_SOURCES: dict[str, list[dict]] = {
    "PancakeSwap": [
        {"rede": "BNB Chain", "dexes": ["pancakeswap-v3-bsc", "pancakeswap_v2"]},
        {"rede": "Base", "dexes": ["pancakeswap-v3-base", "pancakeswap-v2-base", "pancakeswap-infinity-clmm-base"]},
        {"rede": "Arbitrum", "dexes": ["pancakeswap-v3-arbitrum", "pancakeswap-v2-arbitrum", "pancakeswap-stableswap-arbitrum"]},
        {"rede": "Robinhood", "dexes": ["pancakeswap-v3-robinhood", "pancakeswap-v2-robinhood"]},
    ],
    "Uniswap": [{"rede": "Robinhood", "dexes": ["uniswap-v3-robinhood", "uniswap-v2-robinhood", "uniswap-v4-robinhood"]}],
    "Meteora": [{"rede": "Solana", "dexes": ["meteora", "meteora-damm-v2"]}],
    "Velodrome": [{"rede": "Optimism", "dexes": ["velodrome-finance-slipstream", "velodrome-slipstream-v2-optimism", "velodrome-finance-v2"]}],
    "THENA": [{"rede": "BNB Chain", "dexes": ["thena-fusion", "thena-v3", "thena"]}],
}

# Tokens que contam como sólidos sem consulta (stables, majors e embrulhados).
MAJORS: set[str] = {
    "USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC",
    "BTC", "WBTC", "CBBTC", "BTCB", "TBTC",
    "ETH", "WETH", "WSTETH", "STETH", "CBETH", "RETH", "WEETH",
    "SOL", "WSOL", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF",
    "BNB", "WBNB", "AVAX", "WAVAX", "POL", "MATIC", "WPOL", "SUI", "HYPE", "WHYPE",
}

_TAXA_FIXA_V2 = {"uniswap-v2": 0.3, "sushiswap": 0.3}
_TAXA_EM_BP = {"cetus-clmm", "cetus-amm"}
_RWA = re.compile(r"^[A-Z]{1,6}X$")          # xStocks: NVDAx, SPYx... (comparado em maiúsculas)
RWA_EXTRA: set[str] = {"XAUT", "PAXG", "BUIDL", "USTB", "USYC", "OUSG"}


def pretty_project(slug: str) -> str:
    s = (slug or "").lower()
    if s in _PROJETOS:
        return _PROJETOS[s]
    return " ".join(w.capitalize() for w in s.split("-") if w) or "—"


def parse_llama_fee(meta, projeto: str) -> float:
    m = re.search(r"([\d.]+)\s*%", "" if meta is None else str(meta))
    p = (projeto or "").lower()
    if m:
        v = float(m.group(1))
        return v / 100 if p in _TAXA_EM_BP else v
    return _TAXA_FIXA_V2.get(p, 0.0)


def eh_rwa(simbolo: str) -> bool:
    s = (simbolo or "").upper()
    return bool(_RWA.match(s)) or s in RWA_EXTRA
```

```python
# central-rwa/backend/central_rwa/pools/modelos.py
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class TokenRef:
    endereco: str | None     # None quando a fonte não informa
    simbolo: str


@dataclass
class Candidata:
    """Uma pool como veio da fonte, já no formato do ATLAS."""
    id: str                  # "llama:<uuid>" ou "gecko:<net>:<endereço>"
    fonte: str               # "defillama" | "geckoterminal"
    rede: str                # rótulo do ATLAS: "BNB Chain"
    dex: str                 # "PancakeSwap"
    par: str                 # "USDT/WBNB"
    token_a: TokenRef
    token_b: TokenRef
    fee: float               # em %, 0 = desconhecida
    tvl: float
    vol_24h: float
    vol_7d: float | None
    apr: float | None        # APR de taxa, %
    apr_reward: float | None # emissões (ve(3,3)), %
    criada_em: datetime | None = None
    sinais: dict = field(default_factory=dict)   # Caça: compradores/vendedores 24h, variação 24h, mcap


@dataclass
class TokenInfo:
    rede: str
    endereco: str
    simbolo: str
    honeypot: bool | None
    mint_ativo: bool
    freeze_ativo: bool
    dev_pct: float | None
    holders: int | None
    coingecko_id: str | None
    mcap: float | None
    primeira_pool_em: datetime | None
    consultado_em: datetime


@dataclass
class Leitura:
    pool_id: str
    dia: date
    tvl: float
    vol_24h: float
    vol_7d: float | None
    apr: float | None
    fee: float


@dataclass
class PoolFinal:
    cand: Candidata
    trilho: str              # "solida" | "caca" | "barrada"
    motivos: list[str]
    nota: float              # 0–100
    componentes: dict        # {"rendimento":..,"consistencia":..,"profundidade":..,"tendencia":..}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_fontes.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools central-rwa/backend/tests/test_pools_fontes.py central-rwa/backend/tests/fixtures/gt_*.json central-rwa/backend/tests/fixtures/llama_pools_sample.json
git commit -m "Scanner coletor: configuracao, modelos e fixtures reais"
```

---

### Task 2: Leitura das fontes (parse puro)

**Files:**
- Create: `central-rwa/backend/central_rwa/pools/fontes.py` (funções puras)
- Test: `central-rwa/backend/tests/test_pools_fontes.py` (acrescentar)

**Interfaces:**
- Consumes: `config.*`, `modelos.Candidata`, `modelos.TokenRef`, `modelos.TokenInfo`.
- Produces:
  - `parse_llama(rows: list[dict]) -> list[Candidata]` — filtra redes de `LLAMA_CHAINS` e projetos em `LLAMA_PROJECTS`.
  - `parse_gecko_pools(payload: dict, dex: str, rede: str) -> list[Candidata]`.
  - `parse_token_info(payload: dict, rede: str, agora: datetime) -> TokenInfo`.
  - `parse_tokens_multi(payload: dict) -> dict[str, float | None]` (endereço minúsculo → market cap, com fallback para FDV).
  - `normalizar_par(par: str) -> str` (tira espaços, `-`→`/`, WETH→ETH, WBNB→BNB, WSOL→SOL só para comparação).

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em central-rwa/backend/tests/test_pools_fontes.py
from datetime import datetime, timezone

from central_rwa.pools import fontes
from tests.conftest import fixture_json

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


def test_parse_llama_mantem_so_minhas_redes_e_dexes():
    rows = fixture_json("llama_pools_sample.json")["data"]
    cands = fontes.parse_llama(rows)
    assert cands, "a amostra tem pools de Uniswap/Aerodrome em Base"
    c = next(x for x in cands if x.par == "WETH/USDC" and x.rede == "Base")
    assert c.id.startswith("llama:")
    assert c.dex == "Uniswap" and c.fee == 0.3
    assert c.token_a.endereco == "0x4200000000000000000000000000000000000006"
    assert c.tvl > 1e8 and c.vol_24h > 0
    assert all(x.dex in fontes.config.LLAMA_PROJECTS for x in cands)


def test_parse_gecko_tira_taxa_do_nome_e_guarda_sinais():
    cands = fontes.parse_gecko_pools(fixture_json("gt_pools_pancake_v3_bsc.json"), "PancakeSwap", "BNB Chain")
    c = cands[0]
    assert c.par == "USDT/WBNB" and c.fee == 0.01
    assert c.id == "gecko:bsc:" + c.id.split(":")[2] and c.id.split(":")[2].startswith("0x")
    assert c.token_a.endereco == "0x55d398326f99059ff775485246999027b3197955"
    assert c.token_b.endereco == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
    assert c.tvl > 1e6 and c.vol_24h > 1e6 and c.vol_7d is None
    assert c.criada_em.year == 2025
    assert c.sinais["compradores_24h"] > 0 and "variacao_24h" in c.sinais


def test_parse_token_info():
    t = fontes.parse_token_info(fixture_json("gt_token_info_wbnb.json"), "BNB Chain", AGORA)
    assert t.simbolo == "WBNB" and t.coingecko_id == "wbnb"
    assert t.honeypot is False and not t.mint_ativo and not t.freeze_ativo
    assert t.holders > 1_000_000


def test_parse_tokens_multi_da_market_cap():
    mc = fontes.parse_tokens_multi(fixture_json("gt_tokens_multi_bsc.json"))
    assert mc["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"] > 1e9


def test_normalizar_par():
    assert fontes.normalizar_par("WETH - USDC") == "ETH/USDC"
    assert fontes.normalizar_par("usdt/wbnb") == "USDT/BNB"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_fontes.py -v`
Expected: FAIL com `ImportError: cannot import name 'fontes'`

- [ ] **Step 3: Implementar**

```python
# central-rwa/backend/central_rwa/pools/fontes.py
"""De onde vêm as pools. As funções parse_* são puras (testadas com
respostas gravadas); ClienteFontes (Task 3) faz as chamadas HTTP."""

from __future__ import annotations

import re
from datetime import datetime

from . import config
from .modelos import Candidata, TokenInfo, TokenRef

_EMBRULHADOS = {"WETH": "ETH", "WBNB": "BNB", "WSOL": "SOL", "WAVAX": "AVAX", "WHYPE": "HYPE", "WPOL": "POL"}


def _num(v) -> float | None:
    try:
        return None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None


def _data(v) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def normalizar_par(par: str) -> str:
    partes = [p.strip().upper() for p in re.split(r"[/\-]", par or "") if p.strip()]
    return "/".join(_EMBRULHADOS.get(p, p) for p in partes)


def parse_llama(rows: list[dict]) -> list[Candidata]:
    out: list[Candidata] = []
    for p in rows:
        rede = config.LLAMA_CHAINS.get(p.get("chain"))
        dex = config.pretty_project(p.get("project", ""))
        if not rede or dex not in config.LLAMA_PROJECTS:
            continue
        simbolos = [s for s in str(p.get("symbol") or "").split("-") if s]
        if len(simbolos) < 2:
            continue
        ends = p.get("underlyingTokens") or []
        apr = p.get("apyBase7d")
        if apr is None:
            apr = p.get("apyBase") if p.get("apyBase") is not None else p.get("apy")
        reward = _num(p.get("apyReward"))
        out.append(Candidata(
            id="llama:" + str(p["pool"]),
            fonte="defillama",
            rede=rede,
            dex=dex,
            par="/".join(simbolos[:2]),
            token_a=TokenRef(ends[0] if len(ends) > 0 else None, simbolos[0]),
            token_b=TokenRef(ends[1] if len(ends) > 1 else None, simbolos[1]),
            fee=config.parse_llama_fee(p.get("poolMeta"), p.get("project", "")),
            tvl=float(p.get("tvlUsd") or 0),
            vol_24h=float(p.get("volumeUsd1d") or 0),
            vol_7d=_num(p.get("volumeUsd7d")),
            apr=_num(apr),
            apr_reward=reward if reward and reward > 0 else None,
        ))
    return out


def _endereco_de(rel: dict) -> str | None:
    tid = (((rel or {}).get("data")) or {}).get("id") or ""
    return tid.split("_", 1)[1] if "_" in tid else None


def parse_gecko_pools(payload: dict, dex: str, rede: str) -> list[Candidata]:
    net = config.GECKO_NET[rede]
    out: list[Candidata] = []
    for item in payload.get("data") or []:
        a = item.get("attributes") or {}
        rel = item.get("relationships") or {}
        nome = str(a.get("name") or "").strip()
        fee = 0.0
        m = re.search(r"([\d.]+)\s*%\s*$", nome)
        if m:
            fee = float(m.group(1))
            nome = nome[: m.start()].strip()
        simbolos = [s.strip() for s in nome.split("/") if s.strip()]
        if len(simbolos) < 2 or not a.get("address"):
            continue
        tx = ((a.get("transactions") or {}).get("h24")) or {}
        out.append(Candidata(
            id=f"gecko:{net}:{a['address']}",
            fonte="geckoterminal",
            rede=rede,
            dex=dex,
            par="/".join(simbolos[:2]),
            token_a=TokenRef(_endereco_de(rel.get("base_token")), simbolos[0]),
            token_b=TokenRef(_endereco_de(rel.get("quote_token")), simbolos[1]),
            fee=fee,
            tvl=_num(a.get("reserve_in_usd")) or 0.0,
            vol_24h=_num((a.get("volume_usd") or {}).get("h24")) or 0.0,
            vol_7d=None,
            apr=None,
            apr_reward=None,
            criada_em=_data(a.get("pool_created_at")),
            sinais={
                "compradores_24h": int(tx.get("buyers") or 0),
                "vendedores_24h": int(tx.get("sellers") or 0),
                "variacao_24h": _num((a.get("price_change_percentage") or {}).get("h24")),
                "mcap": _num(a.get("market_cap_usd")) or _num(a.get("fdv_usd")),
            },
        ))
    return out


def parse_token_info(payload: dict, rede: str, agora: datetime) -> TokenInfo:
    a = (payload.get("data") or {}).get("attributes") or {}
    holders = a.get("holders") or {}
    return TokenInfo(
        rede=rede,
        endereco=str(a.get("address") or ""),
        simbolo=str(a.get("symbol") or ""),
        honeypot=a.get("is_honeypot") if isinstance(a.get("is_honeypot"), bool) else None,
        mint_ativo=bool(a.get("mint_authority")),
        freeze_ativo=bool(a.get("freeze_authority")),
        dev_pct=_num(a.get("developer_holding_percentage")),
        holders=int(holders["count"]) if isinstance(holders, dict) and holders.get("count") is not None else None,
        coingecko_id=a.get("coingecko_coin_id") or None,
        mcap=None,
        primeira_pool_em=None,
        consultado_em=agora,
    )


def parse_tokens_multi(payload: dict) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for item in payload.get("data") or []:
        a = item.get("attributes") or {}
        out[str(a.get("address") or "").lower()] = _num(a.get("market_cap_usd")) or _num(a.get("fdv_usd"))
    return out
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_fontes.py -v`
Expected: PASS (6 passed). Se `test_parse_llama_mantem_so_minhas_redes_e_dexes` não achar `WETH/USDC` em Base, abrir `tests/fixtures/llama_pools_sample.json`, conferir o par real da primeira linha de Base/uniswap-v3 e ajustar só o literal do teste — nunca o parser.

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools/fontes.py central-rwa/backend/tests/test_pools_fontes.py
git commit -m "Scanner coletor: leitura da DefiLlama e da GeckoTerminal"
```

---

### Task 3: Cliente HTTP com respeito ao limite da GeckoTerminal

**Files:**
- Modify: `central-rwa/backend/central_rwa/pools/fontes.py` (acrescentar `ClienteFontes`)
- Test: `central-rwa/backend/tests/test_pools_fontes.py` (acrescentar)

**Interfaces:**
- Produces: `class ClienteFontes(client: httpx.Client | None = None, sleep=time.sleep, relogio=time.monotonic)` com:
  - `llama_pools() -> list[dict]`
  - `gecko_pools(net: str, dex: str, paginas: int) -> list[dict]` (junta os `data` de cada página; para em 404, página vazia ou com menos de 20)
  - `token_info(net: str, endereco: str) -> dict | None` (None em 404)
  - `tokens_multi(net: str, enderecos: list[str]) -> dict` (lotes de 30, junta `data`)
  - atributo `parciais: list[str]` — fontes que falharam ("gecko:bsc/pancakeswap_v2 p3: HTTP 500")

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em central-rwa/backend/tests/test_pools_fontes.py
import httpx
import respx


@respx.mock
def test_gecko_espaca_chamadas_e_repete_em_429():
    dormiu: list[float] = []
    rota = respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/dexes/x/pools").mock(side_effect=[
        httpx.Response(429),
        httpx.Response(200, json={"data": [{"attributes": {"name": "A / B"}}] * 20}),
        httpx.Response(200, json={"data": [{"attributes": {"name": "C / D"}}]}),
    ])
    cli = fontes.ClienteFontes(sleep=dormiu.append, relogio=lambda: 0.0)
    itens = cli.gecko_pools("bsc", "x", paginas=5)
    assert len(itens) == 21            # página 1 (repetida) + página 2 curta = fim
    assert rota.call_count == 3
    assert 15 in dormiu                # esperou por causa do 429
    assert cli.parciais == []


@respx.mock
def test_gecko_falha_vira_parcial_sem_derrubar():
    respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/dexes/x/pools").mock(return_value=httpx.Response(500))
    cli = fontes.ClienteFontes(sleep=lambda s: None, relogio=lambda: 0.0)
    assert cli.gecko_pools("bsc", "x", paginas=3) == []
    assert cli.parciais and "bsc/x" in cli.parciais[0]


@respx.mock
def test_token_info_404_devolve_none():
    respx.get("https://api.geckoterminal.com/api/v2/networks/bsc/tokens/0xabc/info").mock(return_value=httpx.Response(404))
    cli = fontes.ClienteFontes(sleep=lambda s: None, relogio=lambda: 0.0)
    assert cli.token_info("bsc", "0xabc") is None
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_fontes.py -v`
Expected: FAIL com `AttributeError: module 'central_rwa.pools.fontes' has no attribute 'ClienteFontes'`

- [ ] **Step 3: Implementar (acrescentar ao fim de `fontes.py`)**

```python
import time

import httpx

from .. import USER_AGENT

LLAMA_URL = "https://yields.llama.fi/pools"
GECKO = "https://api.geckoterminal.com/api/v2"


class ClienteFontes:
    """Chamadas HTTP. A GeckoTerminal permite ~30 req/min: toda chamada a ela
    espera o intervalo mínimo desde a anterior e, em 429, espera 15 s × tentativa."""

    def __init__(self, client: httpx.Client | None = None, sleep=time.sleep, relogio=time.monotonic):
        self.client = client or httpx.Client(timeout=60, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        self.sleep = sleep
        self.relogio = relogio
        self._ultima = -1e9
        self.parciais: list[str] = []

    def _gecko(self, url: str) -> httpx.Response | None:
        for tentativa in range(1, 6):
            falta = self._ultima + config.GECKO_INTERVALO_S - self.relogio()
            if falta > 0:
                self.sleep(falta)
            self._ultima = self.relogio()
            try:
                r = self.client.get(url)
            except httpx.HTTPError:
                r = None
            if r is not None and r.status_code != 429:
                return r
            self.sleep(15 * tentativa)
        return None

    def llama_pools(self) -> list[dict]:
        r = self.client.get(LLAMA_URL)
        r.raise_for_status()
        j = r.json()
        if j.get("status") != "success" or not isinstance(j.get("data"), list):
            raise RuntimeError("DefiLlama devolveu formato inesperado")
        return j["data"]

    def gecko_pools(self, net: str, dex: str, paginas: int) -> list[dict]:
        itens: list[dict] = []
        for pg in range(1, paginas + 1):
            r = self._gecko(f"{GECKO}/networks/{net}/dexes/{dex}/pools?page={pg}")
            if r is None or (r.status_code >= 400 and r.status_code != 404):
                self.parciais.append(f"gecko:{net}/{dex} p{pg}: " + ("sem resposta" if r is None else f"HTTP {r.status_code}"))
                break
            if r.status_code == 404:
                break
            data = (r.json() or {}).get("data") or []
            itens.extend(data)
            if len(data) < 20:
                break
        return itens

    def token_info(self, net: str, endereco: str) -> dict | None:
        r = self._gecko(f"{GECKO}/networks/{net}/tokens/{endereco}/info")
        if r is None or r.status_code >= 400:
            return None
        return r.json()

    def tokens_multi(self, net: str, enderecos: list[str]) -> dict:
        data: list[dict] = []
        for i in range(0, len(enderecos), 30):
            lote = enderecos[i : i + 30]
            r = self._gecko(f"{GECKO}/networks/{net}/tokens/multi/{','.join(lote)}")
            if r is not None and r.status_code < 400:
                data.extend((r.json() or {}).get("data") or [])
        return {"data": data}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_fontes.py -v`
Expected: PASS (9 passed)

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools/fontes.py central-rwa/backend/tests/test_pools_fontes.py
git commit -m "Scanner coletor: cliente HTTP com limite da GeckoTerminal"
```

---

### Task 4: Classificação (pré-corte, barrar, token sólido, trilho)

**Files:**
- Create: `central-rwa/backend/central_rwa/pools/classificacao.py`
- Test: `central-rwa/backend/tests/test_pools_classificacao.py`

**Interfaces:**
- Consumes: `Candidata`, `TokenInfo`, `Leitura`, `config`.
- Produces:
  - `passa_pre_corte(c: Candidata) -> bool`
  - `motivos_barrada(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura]) -> list[str]` (vazio = não barrada)
  - `token_solido(simbolo: str, info: TokenInfo | None, agora: datetime) -> bool`
  - `trilho(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura], agora: datetime) -> tuple[str, list[str]]` → `("barrada"|"solida"|"caca", motivos)`

- [ ] **Step 1: Escrever os testes que falham**

```python
# central-rwa/backend/tests/test_pools_classificacao.py
from datetime import date, datetime, timedelta, timezone

from central_rwa.pools.classificacao import motivos_barrada, passa_pre_corte, token_solido, trilho
from central_rwa.pools.modelos import Candidata, Leitura, TokenInfo, TokenRef

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


def cand(par="FOO/USDT", fee=0.25, tvl=500_000, vol=200_000, apr=None, reward=None):
    a, b = par.split("/")
    return Candidata(id="gecko:bsc:0x1", fonte="geckoterminal", rede="BNB Chain", dex="PancakeSwap", par=par,
                     token_a=TokenRef("0xa", a), token_b=TokenRef("0xb", b), fee=fee, tvl=tvl, vol_24h=vol,
                     vol_7d=None, apr=apr, apr_reward=reward)


def info(simbolo="FOO", honeypot=False, mint=False, freeze=False, dev=None, holders=5000, cg="foo", mcap=50e6, dias=90):
    return TokenInfo(rede="BNB Chain", endereco="0xa", simbolo=simbolo, honeypot=honeypot, mint_ativo=mint,
                     freeze_ativo=freeze, dev_pct=dev, holders=holders, coingecko_id=cg, mcap=mcap,
                     primeira_pool_em=AGORA - timedelta(days=dias) if dias is not None else None, consultado_em=AGORA)


def test_pre_corte():
    assert passa_pre_corte(cand())
    assert not passa_pre_corte(cand(tvl=99_999))
    assert not passa_pre_corte(cand(vol=49_999))


def test_barrada_por_seguranca():
    assert "honeypot" in motivos_barrada(cand(), [info(honeypot=True), None], [])
    assert "mint ativo" in motivos_barrada(cand(), [info(mint=True), None], [])
    assert "freeze ativo" in motivos_barrada(cand(), [info(freeze=True), None], [])
    assert "dev com mais de 20%" in motivos_barrada(cand(), [info(dev=35.0), None], [])
    assert motivos_barrada(cand(), [info(), None], []) == []


def test_barrada_por_fonte_sem_sentido():
    assert "sem taxa e sem APR" in motivos_barrada(cand(fee=0), [None, None], [])
    assert motivos_barrada(cand(fee=0, apr=12.0), [None, None], []) == []      # Curve: taxa ? mas com APR
    assert "APR impossível" in motivos_barrada(cand(apr=20_000), [None, None], [])


def test_barrada_por_wash_trading_em_3_dias():
    ruins = [Leitura("x", date(2026, 9, d), 100_000, 6_000_000, None, None, 0.25) for d in (21, 22, 23)]
    assert "volume/TVL acima de 50× por 3 dias" in motivos_barrada(cand(), [None, None], ruins)
    assert motivos_barrada(cand(), [None, None], ruins[:2]) == []


def test_token_solido():
    assert token_solido("WBNB", None, AGORA)                     # major dispensa consulta
    assert token_solido("NVDAx", None, AGORA)                    # RWA conhecido
    assert token_solido("FOO", info(), AGORA)
    assert not token_solido("FOO", None, AGORA)                  # sem informação = não sólido
    assert not token_solido("FOO", info(dias=10), AGORA)         # novo
    assert not token_solido("FOO", info(dias=None), AGORA)       # idade desconhecida
    assert not token_solido("FOO", info(mcap=5e6), AGORA)
    assert not token_solido("FOO", info(holders=500), AGORA)
    assert not token_solido("FOO", info(cg=None), AGORA)


def test_trilho():
    assert trilho(cand("WBNB/USDT"), [None, None], [], AGORA) == ("solida", [])
    t, m = trilho(cand("FOO/USDT"), [info(dias=5), None], [], AGORA)
    assert t == "caca" and m == ["FOO: token novo ou sem histórico"]
    assert trilho(cand("FOO/USDT"), [info(honeypot=True), None], [], AGORA)[0] == "barrada"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_classificacao.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'central_rwa.pools.classificacao'`

- [ ] **Step 3: Implementar**

```python
# central-rwa/backend/central_rwa/pools/classificacao.py
"""As três camadas do filtro (a terceira — a lista do usuário — mora no site).

Camada 1 barra sem exceção. Camada 2 separa Sólida de Caça: na dúvida (token
sem informação), Caça — nunca Sólida."""

from __future__ import annotations

from datetime import datetime

from . import config
from .modelos import Candidata, Leitura, TokenInfo

APR_MAX = 10_000.0
WASH_RAZAO = 50.0
DEV_MAX = 20.0
IDADE_MIN_DIAS = 30
MCAP_MIN = 10_000_000.0
HOLDERS_MIN = 1_000


def passa_pre_corte(c: Candidata) -> bool:
    return c.tvl >= config.TVL_MIN and c.vol_24h >= config.VOL_MIN


def motivos_barrada(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura]) -> list[str]:
    m: list[str] = []
    for i in infos:
        if i is None:
            continue
        if i.honeypot:
            m.append("honeypot")
        if i.mint_ativo:
            m.append("mint ativo")
        if i.freeze_ativo:
            m.append("freeze ativo")
        if i.dev_pct is not None and i.dev_pct > DEV_MAX:
            m.append("dev com mais de 20%")
    tem_apr = (c.apr or 0) > 0 or (c.apr_reward or 0) > 0
    if c.fee <= 0 and not tem_apr:
        m.append("sem taxa e sem APR")
    if (c.apr or 0) > APR_MAX or (c.apr_reward or 0) > APR_MAX:
        m.append("APR impossível")
    ultimas = sorted(leituras, key=lambda x: x.dia)[-3:]
    if len(ultimas) == 3 and all(l.tvl > 0 and l.vol_24h / l.tvl > WASH_RAZAO for l in ultimas):
        m.append("volume/TVL acima de 50× por 3 dias")
    return list(dict.fromkeys(m))   # sem repetição, na ordem


def token_solido(simbolo: str, info: TokenInfo | None, agora: datetime) -> bool:
    s = (simbolo or "").upper()
    if s in config.MAJORS or config.eh_rwa(simbolo):
        return True
    if info is None or info.primeira_pool_em is None:
        return False
    idade = (agora - info.primeira_pool_em).days
    return (
        idade >= IDADE_MIN_DIAS
        and (info.mcap or 0) >= MCAP_MIN
        and (info.holders or 0) >= HOLDERS_MIN
        and bool(info.coingecko_id)
    )


def trilho(c: Candidata, infos: list[TokenInfo | None], leituras: list[Leitura], agora: datetime) -> tuple[str, list[str]]:
    barr = motivos_barrada(c, infos, leituras)
    if barr:
        return "barrada", barr
    fracos = [
        f"{t.simbolo}: token novo ou sem histórico"
        for t, i in ((c.token_a, infos[0]), (c.token_b, infos[1]))
        if not token_solido(t.simbolo, i, agora)
    ]
    return ("caca", fracos) if fracos else ("solida", [])
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_classificacao.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools/classificacao.py central-rwa/backend/tests/test_pools_classificacao.py
git commit -m "Scanner coletor: filtro de seguranca e trilhos Solida/Caca"
```

---

### Task 5: Nota 0–100

**Files:**
- Create: `central-rwa/backend/central_rwa/pools/nota.py`
- Test: `central-rwa/backend/tests/test_pools_nota.py`

**Interfaces:**
- Consumes: `Candidata`, `Leitura`.
- Produces:
  - `eficiencia(c: Candidata) -> float` — %/dia: `fee × vol_dia / tvl`, com `vol_dia = vol_7d/7` se houver, senão `vol_24h`; para ve(3,3) (Aerodrome, Velodrome, THENA, Pharaoh, Ramses) usa `max(apr, apr_reward)/365` quando maior.
  - `calcular_notas(cands: list[Candidata], leituras_por_pool: dict[str, list[Leitura]]) -> dict[str, tuple[float, dict]]` — nota e componentes por `id`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# central-rwa/backend/tests/test_pools_nota.py
from datetime import date

from central_rwa.pools.modelos import Candidata, Leitura, TokenRef
from central_rwa.pools.nota import calcular_notas, eficiencia


def c(id, fee=0.25, tvl=1e6, vol=1e6, vol7=None, apr=None, reward=None, dex="PancakeSwap"):
    return Candidata(id=id, fonte="x", rede="BNB Chain", dex=dex, par="A/B", token_a=TokenRef(None, "A"),
                     token_b=TokenRef(None, "B"), fee=fee, tvl=tvl, vol_24h=vol, vol_7d=vol7, apr=apr, apr_reward=reward)


def lei(pid, dia, tvl, vol):
    return Leitura(pid, date(2026, 9, dia), tvl, vol, None, None, 0.25)


def test_eficiencia():
    assert eficiencia(c("a", fee=0.25, tvl=1e6, vol=1e6)) == 0.25
    assert eficiencia(c("a", fee=0.25, tvl=1e6, vol=9e9, vol7=7e6)) == 0.25        # 7d manda
    assert round(eficiencia(c("a", fee=0.01, apr=10, reward=73, dex="Aerodrome")), 3) == 0.2


def test_nota_ordena_e_fica_entre_0_e_100():
    boa = c("boa", fee=0.3, tvl=20e6, vol=20e6)
    rasa = c("rasa", fee=0.3, tvl=150_000, vol=60_000)
    notas = calcular_notas([boa, rasa], {})
    assert 0 <= notas["rasa"][0] < notas["boa"][0] <= 100
    assert set(notas["boa"][1]) == {"rendimento", "consistencia", "profundidade", "tendencia"}


def test_consistencia_premia_razao_estavel_e_sem_historico_vale_meio():
    estavel = [lei("e", d, 1e6, 1e6) for d in range(17, 24)]
    instavel = [lei("i", d, 1e6, v) for d, v in zip(range(17, 24), [1e5, 5e6, 2e5, 4e6, 1e5, 6e6, 3e5])]
    n = calcular_notas([c("e"), c("i"), c("s")], {"e": estavel, "i": instavel})
    assert n["e"][1]["consistencia"] > n["i"][1]["consistencia"]
    assert n["s"][1]["consistencia"] == 0.5


def test_tendencia_de_tvl():
    sobe = [lei("s", 16, 1e6, 1e6), lei("s", 23, 1.3e6, 1e6)]
    cai = [lei("c", 16, 1e6, 1e6), lei("c", 23, 0.7e6, 1e6)]
    n = calcular_notas([c("s"), c("c")], {"s": sobe, "c": cai})
    assert n["s"][1]["tendencia"] == 1.0 and n["c"][1]["tendencia"] == 0.0
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_nota.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'central_rwa.pools.nota'`

- [ ] **Step 3: Implementar**

```python
# central-rwa/backend/central_rwa/pools/nota.py
"""Nota 0–100: rendimento 40% · consistência 30% · profundidade 20% · tendência 10%.
Cada componente vai de 0 a 1 e fica gravado, para o Guia poder explicar a nota."""

from __future__ import annotations

import math
from statistics import mean, pstdev

from .modelos import Candidata, Leitura

VE33 = {"Aerodrome", "Velodrome", "THENA", "Pharaoh", "Ramses"}
PESOS = {"rendimento": 0.40, "consistencia": 0.30, "profundidade": 0.20, "tendencia": 0.10}


def eficiencia(c: Candidata) -> float:
    vol_dia = c.vol_7d / 7 if c.vol_7d else c.vol_24h
    taxa = c.fee * vol_dia / c.tvl if c.tvl > 0 else 0.0
    if c.dex in VE33:
        lp = max(c.apr or 0, c.apr_reward or 0) / 365
        return max(taxa, lp)
    return taxa


def _percentis(valores: dict[str, float]) -> dict[str, float]:
    ordem = sorted(valores, key=lambda k: valores[k])
    n = len(ordem)
    return {k: (i / (n - 1) if n > 1 else 1.0) for i, k in enumerate(ordem)}


def _consistencia(ls: list[Leitura]) -> float:
    ult = sorted(ls, key=lambda x: x.dia)[-7:]
    razoes = [l.vol_24h / l.tvl for l in ult if l.tvl > 0]
    if len(razoes) < 3 or mean(razoes) == 0:
        return 0.5
    cv = pstdev(razoes) / mean(razoes)
    return max(0.0, min(1.0, 1 - cv))


def _profundidade(tvl: float) -> float:
    if tvl <= 0:
        return 0.0
    return max(0.0, min(1.0, (math.log10(tvl) - 5) / 3))      # 1e5 -> 0 · 1e8 -> 1


def _tendencia(ls: list[Leitura]) -> float:
    ult = sorted(ls, key=lambda x: x.dia)
    if len(ult) < 2:
        return 0.5
    ini = next((l for l in ult if (ult[-1].dia - l.dia).days <= 7), ult[0])
    if ini.tvl <= 0:
        return 0.5
    var = ult[-1].tvl / ini.tvl - 1
    return max(0.0, min(1.0, (var + 0.30) / 0.60))           # -30% -> 0 · +30% -> 1


def calcular_notas(cands: list[Candidata], leituras_por_pool: dict[str, list[Leitura]]) -> dict[str, tuple[float, dict]]:
    rend = _percentis({c.id: eficiencia(c) for c in cands})
    out: dict[str, tuple[float, dict]] = {}
    for c in cands:
        ls = leituras_por_pool.get(c.id, [])
        comp = {
            "rendimento": round(rend[c.id], 4),
            "consistencia": round(_consistencia(ls), 4),
            "profundidade": round(_profundidade(c.tvl), 4),
            "tendencia": round(_tendencia(ls), 4),
        }
        out[c.id] = (round(100 * sum(PESOS[k] * v for k, v in comp.items()), 1), comp)
    return out
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_nota.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools/nota.py central-rwa/backend/tests/test_pools_nota.py
git commit -m "Scanner coletor: nota 0-100 com componentes"
```

---

### Task 6: Repositório em memória e orquestração da coleta

**Files:**
- Create: `central-rwa/backend/central_rwa/pools/repositorio.py` (interface + memória)
- Create: `central-rwa/backend/central_rwa/pools/coleta.py`
- Test: `central-rwa/backend/tests/test_pools_coleta.py`

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces:
  - `class PoolStore` (métodos abaixo) e `class MemoryPoolStore(PoolStore)`:
    - `tokens_em_cache(rede: str, enderecos: list[str], validade_desde: datetime) -> dict[str, TokenInfo]` (chave: endereço normalizado)
    - `salvar_tokens(infos: list[TokenInfo]) -> None`
    - `leituras(pool_ids: list[str]) -> dict[str, list[Leitura]]`
    - `gravar(finais: list[PoolFinal], hoje: date, agora: datetime) -> dict` → `{"novas": int, "atualizadas": int, "inativadas": int}`; faz upsert das pools vistas (zera `falhas_seguidas`), grava a leitura do dia (substitui a do mesmo dia), soma 1 em `falhas_seguidas` das ativas não vistas e inativa ao chegar em `FALHAS_PARA_SUMIR`, apaga leituras mais velhas que `LEITURAS_DIAS`.
    - `gravar_status(itens: list[dict]) -> None` (`{"fonte","rede","dex","estado","contagem","em"}`)
  - `coletar(cli: ClienteFontes, store: PoolStore, agora: datetime) -> dict` — resumo `{"lidas","pre_corte","solidas","caca","barradas","tokens_consultados","parciais": [...], "gravacao": {...}}`.
  - `normalizar_endereco(rede: str, endereco: str) -> str` em `coleta.py` (minúsculo fora de Solana e Sui).

- [ ] **Step 1: Escrever os testes que falham**

```python
# central-rwa/backend/tests/test_pools_coleta.py
from datetime import date, datetime, timedelta, timezone

from central_rwa.pools.coleta import coletar
from central_rwa.pools.modelos import Candidata, PoolFinal, TokenRef
from central_rwa.pools.repositorio import MemoryPoolStore
from tests.conftest import fixture_json

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


class FakeCliente:
    """Devolve as fixtures reais: a amostra da DefiLlama e 6 pools da PancakeSwap v3/BSC."""

    def __init__(self):
        self.parciais: list[str] = []
        self.infos_pedidas: list[str] = []

    def llama_pools(self):
        return fixture_json("llama_pools_sample.json")["data"]

    def gecko_pools(self, net, dex, paginas):
        if (net, dex) == ("bsc", "pancakeswap-v3-bsc"):
            return fixture_json("gt_pools_pancake_v3_bsc.json")["data"]
        return []

    def token_info(self, net, endereco):
        self.infos_pedidas.append(endereco)
        if endereco == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c":
            return fixture_json("gt_token_info_wbnb.json")
        return fixture_json("gt_token_info_bsc.json")

    def tokens_multi(self, net, enderecos):
        return fixture_json("gt_tokens_multi_bsc.json")


def test_coleta_real_de_ponta_a_ponta():
    store = MemoryPoolStore()
    r = coletar(FakeCliente(), store, AGORA)
    assert r["pre_corte"] > 0
    assert r["solidas"] + r["caca"] + r["barradas"] == r["pre_corte"]
    usdt_wbnb = next(p for p in store.pools.values() if p["par"] == "USDT/WBNB" and p["dex"] == "PancakeSwap")
    assert usdt_wbnb["trilho"] == "solida" and 0 <= usdt_wbnb["nota"] <= 100
    assert len(store.leituras_por_pool[usdt_wbnb["id"]]) == 1


def test_majors_nao_gastam_consulta_e_cache_evita_repetir():
    store, cli = MemoryPoolStore(), FakeCliente()
    coletar(cli, store, AGORA)
    assert "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" not in cli.infos_pedidas     # WBNB é major
    antes = len(cli.infos_pedidas)
    coletar(cli, store, AGORA + timedelta(hours=4))
    assert len(cli.infos_pedidas) == antes                                           # cache de 7 dias


def fin(pid):
    c = Candidata(id=pid, fonte="x", rede="BNB Chain", dex="PancakeSwap", par="A/B", token_a=TokenRef(None, "A"),
                  token_b=TokenRef(None, "B"), fee=0.25, tvl=1e6, vol_24h=1e6, vol_7d=None, apr=None, apr_reward=None)
    return PoolFinal(c, "solida", [], 50.0, {})


def test_pool_some_so_depois_de_3_coletas_e_leitura_do_dia_e_unica():
    s = MemoryPoolStore()
    s.gravar([fin("a"), fin("b")], date(2026, 9, 20), AGORA)
    s.gravar([fin("a"), fin("b")], date(2026, 9, 20), AGORA)          # mesma data: substitui
    assert len(s.leituras_por_pool["a"]) == 1
    for d in (21, 22):
        s.gravar([fin("a")], date(2026, 9, d), AGORA)
    assert s.pools["b"]["ativa"] is True
    s.gravar([fin("a")], date(2026, 9, 23), AGORA)
    assert s.pools["b"]["ativa"] is False and s.leituras_por_pool["b"]


def test_leitura_com_mais_de_30_dias_e_apagada():
    s = MemoryPoolStore()
    s.gravar([fin("a")], date(2026, 8, 1), AGORA)
    s.gravar([fin("a")], date(2026, 9, 23), AGORA)
    assert [l.dia for l in s.leituras_por_pool["a"]] == [date(2026, 9, 23)]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_coleta.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'central_rwa.pools.coleta'`

- [ ] **Step 3: Implementar**

```python
# central-rwa/backend/central_rwa/pools/repositorio.py
"""Onde as pools ficam. MemoryPoolStore serve aos testes e ao --dry-run;
PostgresPoolStore (Task 7) grava no Supabase, schema scanner."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, timedelta

from . import config
from .modelos import Leitura, PoolFinal, TokenInfo


def linha_pool(f: PoolFinal, agora: datetime) -> dict:
    c = f.cand
    return {
        "id": c.id, "fonte": c.fonte, "rede": c.rede, "dex": c.dex, "par": c.par,
        "token_a": c.token_a.endereco, "simbolo_a": c.token_a.simbolo,
        "token_b": c.token_b.endereco, "simbolo_b": c.token_b.simbolo,
        "fee": c.fee, "tvl": c.tvl, "vol_24h": c.vol_24h, "vol_7d": c.vol_7d,
        "apr": c.apr, "apr_reward": c.apr_reward, "criada_em": c.criada_em, "sinais": c.sinais,
        "trilho": f.trilho, "motivos": f.motivos, "nota": f.nota, "componentes": f.componentes,
        "ativa": True, "visto_em": agora, "falhas_seguidas": 0,
    }


class PoolStore:
    def tokens_em_cache(self, rede: str, enderecos: list[str], validade_desde: datetime) -> dict[str, TokenInfo]: ...
    def salvar_tokens(self, infos: list[TokenInfo]) -> None: ...
    def leituras(self, pool_ids: list[str]) -> dict[str, list[Leitura]]: ...
    def gravar(self, finais: list[PoolFinal], hoje: date, agora: datetime) -> dict: ...
    def gravar_status(self, itens: list[dict]) -> None: ...
    def close(self) -> None: ...


class MemoryPoolStore(PoolStore):
    def __init__(self) -> None:
        self.pools: dict[str, dict] = {}
        self.leituras_por_pool: dict[str, list[Leitura]] = {}
        self.tokens: dict[tuple[str, str], TokenInfo] = {}
        self.status: list[dict] = []

    def tokens_em_cache(self, rede, enderecos, validade_desde):
        return {e: t for e in enderecos if (t := self.tokens.get((rede, e))) and t.consultado_em >= validade_desde}

    def salvar_tokens(self, infos):
        for t in infos:
            self.tokens[(t.rede, t.endereco)] = t

    def leituras(self, pool_ids):
        return {p: list(self.leituras_por_pool.get(p, [])) for p in pool_ids}

    def gravar(self, finais, hoje, agora):
        novas = atualizadas = inativadas = 0
        vistos = set()
        for f in finais:
            pid = f.cand.id
            vistos.add(pid)
            if pid in self.pools:
                atualizadas += 1
            else:
                novas += 1
            self.pools[pid] = linha_pool(f, agora)
            ls = [l for l in self.leituras_por_pool.get(pid, []) if l.dia != hoje]
            c = f.cand
            ls.append(Leitura(pid, hoje, c.tvl, c.vol_24h, c.vol_7d, c.apr, c.fee))
            self.leituras_por_pool[pid] = ls
        for pid, row in self.pools.items():
            if pid in vistos or not row["ativa"]:
                continue
            row["falhas_seguidas"] += 1
            if row["falhas_seguidas"] >= config.FALHAS_PARA_SUMIR:
                row["ativa"] = False
                inativadas += 1
        corte = hoje - timedelta(days=config.LEITURAS_DIAS)
        for pid in self.leituras_por_pool:
            self.leituras_por_pool[pid] = [l for l in self.leituras_por_pool[pid] if l.dia > corte]
        return {"novas": novas, "atualizadas": atualizadas, "inativadas": inativadas}

    def gravar_status(self, itens):
        self.status = list(itens)

    def close(self):
        pass
```

```python
# central-rwa/backend/central_rwa/pools/coleta.py
"""Uma execução do coletor: fontes → pré-corte → segurança → trilho → nota → banco."""

from __future__ import annotations

from datetime import datetime, timedelta

from . import config
from .classificacao import passa_pre_corte, token_solido, trilho
from .fontes import parse_gecko_pools, parse_llama, parse_token_info, parse_tokens_multi
from .modelos import Candidata, PoolFinal, TokenInfo
from .nota import calcular_notas

_CASO_SENSIVEL = {"Solana", "Sui"}


def normalizar_endereco(rede: str, endereco: str) -> str:
    return endereco if rede in _CASO_SENSIVEL else endereco.lower()


def _candidatas(cli, status: list[dict], agora: datetime) -> list[Candidata]:
    todas: list[Candidata] = []
    try:
        llama = parse_llama(cli.llama_pools())
        todas += llama
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": "ok", "contagem": len(llama), "em": agora})
    except Exception as e:  # DefiLlama fora: segue com a GeckoTerminal
        status.append({"fonte": "defillama", "rede": None, "dex": None, "estado": f"falhou: {e}"[:200], "contagem": 0, "em": agora})
    for dex, fontes_dex in config.GECKO_SOURCES.items():
        for src in fontes_dex:
            net = config.GECKO_NET[src["rede"]]
            for slug in src["dexes"]:
                antes = len(cli.parciais)
                itens = cli.gecko_pools(net, slug, config.GECKO_PAGINAS)
                cands = parse_gecko_pools({"data": itens}, dex, src["rede"])
                todas += cands
                estado = "parcial" if len(cli.parciais) > antes else "ok"
                status.append({"fonte": "geckoterminal", "rede": src["rede"], "dex": slug, "estado": estado, "contagem": len(cands), "em": agora})
    vistos: dict[str, Candidata] = {}
    for c in todas:
        vistos.setdefault(c.id, c)
    return list(vistos.values())


def _infos(cli, store, cands: list[Candidata], agora: datetime) -> tuple[dict[tuple[str, str], TokenInfo], int]:
    pedidos: dict[str, set[str]] = {}
    primeira: dict[tuple[str, str], datetime] = {}
    for c in cands:
        for t in (c.token_a, c.token_b):
            if not t.endereco or (t.simbolo or "").upper() in config.MAJORS or config.eh_rwa(t.simbolo):
                continue
            e = normalizar_endereco(c.rede, t.endereco)
            pedidos.setdefault(c.rede, set()).add(e)
            if c.criada_em and ((c.rede, e) not in primeira or c.criada_em < primeira[(c.rede, e)]):
                primeira[(c.rede, e)] = c.criada_em
    infos: dict[tuple[str, str], TokenInfo] = {}
    consultados = 0
    novos: list[TokenInfo] = []
    for rede, ends in pedidos.items():
        net = config.GECKO_NET.get(rede)
        cache = store.tokens_em_cache(rede, sorted(ends), agora - timedelta(days=config.CACHE_TOKEN_DIAS))
        faltam = [e for e in sorted(ends) if e not in cache]
        mcaps = parse_tokens_multi(cli.tokens_multi(net, faltam)) if (net and faltam) else {}
        for e in faltam:
            payload = cli.token_info(net, e) if net else None
            consultados += 1
            if not payload:
                continue
            info = parse_token_info(payload, rede, agora)
            info.endereco = e
            info.mcap = mcaps.get(e.lower())
            novos.append(info)
            cache[e] = info
        for e, info in cache.items():
            p = primeira.get((rede, e))
            if p and (info.primeira_pool_em is None or p < info.primeira_pool_em):
                info.primeira_pool_em = p
                novos.append(info)
            infos[(rede, e)] = info
    store.salvar_tokens(list({(t.rede, t.endereco): t for t in novos}.values()))
    return infos, consultados


def coletar(cli, store, agora: datetime) -> dict:
    status: list[dict] = []
    todas = _candidatas(cli, status, agora)
    cands = [c for c in todas if passa_pre_corte(c)]
    infos, consultados = _infos(cli, store, cands, agora)
    leituras = store.leituras([c.id for c in cands])
    notas = calcular_notas(cands, leituras)
    finais: list[PoolFinal] = []
    for c in cands:
        par_infos = [
            infos.get((c.rede, normalizar_endereco(c.rede, t.endereco))) if t.endereco else None
            for t in (c.token_a, c.token_b)
        ]
        t, motivos = trilho(c, par_infos, leituras.get(c.id, []), agora)
        nota, comp = notas[c.id]
        finais.append(PoolFinal(c, t, motivos, nota, comp))
    gravacao = store.gravar(finais, agora.date(), agora)
    store.gravar_status(status)
    return {
        "lidas": len(todas),
        "pre_corte": len(cands),
        "solidas": sum(f.trilho == "solida" for f in finais),
        "caca": sum(f.trilho == "caca" for f in finais),
        "barradas": sum(f.trilho == "barrada" for f in finais),
        "tokens_consultados": consultados,
        "parciais": list(cli.parciais) + [s["estado"] for s in status if str(s["estado"]).startswith("falhou")],
        "gravacao": gravacao,
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_coleta.py tests/test_pools_classificacao.py tests/test_pools_nota.py tests/test_pools_fontes.py -v`
Expected: PASS (todos). `token_solido` é importado em `coleta.py` só por coerência de API; se o linter acusar import sem uso, removê-lo.

- [ ] **Step 5: Commit**

```bash
git add central-rwa/backend/central_rwa/pools/repositorio.py central-rwa/backend/central_rwa/pools/coleta.py central-rwa/backend/tests/test_pools_coleta.py
git commit -m "Scanner coletor: orquestracao, cache de tokens e leituras diarias"
```

---

### Task 7: Banco (migration + PostgresPoolStore)

**Files:**
- Create: `central-rwa/supabase/migrations/20260923000001_scanner_pools.sql`
- Modify: `central-rwa/backend/central_rwa/pools/repositorio.py` (acrescentar `PostgresPoolStore`)
- Test: `central-rwa/backend/tests/test_pools_postgres.py`

**Interfaces:**
- Consumes: `PoolStore`, `linha_pool`, `central_rwa.db.connect.connect`, `central_rwa.db.apply_migrations`.
- Produces: `class PostgresPoolStore(PoolStore)` com `__init__(dsn: str)`; visões `public.scanner_pools`, `public.scanner_leituras`, `public.scanner_status`.

- [ ] **Step 1: Escrever o teste que falha**

```python
# central-rwa/backend/tests/test_pools_postgres.py
"""Integração com Postgres embutido (pgserver): migration idempotente, RLS,
visões públicas e o ciclo de gravação do PostgresPoolStore."""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

import pytest

pgserver = pytest.importorskip("pgserver")

from central_rwa.db import apply_migrations  # noqa: E402
from central_rwa.pools.modelos import Candidata, PoolFinal, TokenInfo, TokenRef  # noqa: E402
from central_rwa.pools.repositorio import PostgresPoolStore  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def dsn(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pgpools"), cleanup_mode="stop")
    uri = server.get_uri()
    import psycopg

    with psycopg.connect(uri, autocommit=True) as c:
        c.execute("do $$ begin create role anon; exception when duplicate_object then null; end $$")
        c.execute("do $$ begin create role authenticated; exception when duplicate_object then null; end $$")
    apply_migrations(uri, MIGRATIONS)
    apply_migrations(uri, MIGRATIONS)
    yield uri
    server.cleanup()


def fin(pid, trilho="solida"):
    c = Candidata(id=pid, fonte="geckoterminal", rede="BNB Chain", dex="PancakeSwap", par="UNI/WBNB",
                  token_a=TokenRef("0xa", "UNI"), token_b=TokenRef("0xb", "WBNB"), fee=0.25, tvl=2e6,
                  vol_24h=9e5, vol_7d=None, apr=None, apr_reward=None, sinais={"compradores_24h": 10})
    return PoolFinal(c, trilho, [] if trilho != "barrada" else ["honeypot"], 61.5, {"rendimento": 0.7})


def test_ciclo_completo(dsn):
    s = PostgresPoolStore(dsn)
    try:
        s.gravar([fin("gecko:bsc:0x1"), fin("gecko:bsc:0x2", "barrada")], date(2026, 9, 23), AGORA)
        s.gravar_status([{"fonte": "defillama", "rede": None, "dex": None, "estado": "ok", "contagem": 5, "em": AGORA}])
        s.salvar_tokens([TokenInfo("BNB Chain", "0xa", "UNI", False, False, False, None, 400000, "uniswap", 5e9, AGORA, AGORA)])
        assert "0xa" in s.tokens_em_cache("BNB Chain", ["0xa", "0xz"], AGORA)
        assert len(s.leituras(["gecko:bsc:0x1"])["gecko:bsc:0x1"]) == 1
        vis = s._query("select id, trilho, nota from public.scanner_pools order by id")
        assert vis == [("gecko:bsc:0x1", "solida", 61.5)]                # barrada fica fora da visão
        assert s._query("select count(*) from public.scanner_leituras")[0][0] == 1      # a barrada fica fora
        assert s._query("select count(*) from scanner.leituras")[0][0] == 2             # mas é guardada
        assert s._query("select estado from public.scanner_status")[0][0] == "ok"
        rls = s._query("select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                       "where n.nspname='scanner' and c.relkind='r'")[0][0]
        assert rls is True
    finally:
        s.close()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_postgres.py -v`
Expected: FAIL com `ImportError: cannot import name 'PostgresPoolStore'` (ou SKIP se o `pgserver` não estiver instalado: instalar com `pip install -e ".[dev]"` e rodar de novo).

- [ ] **Step 3: Implementar a migration**

```sql
-- central-rwa/supabase/migrations/20260923000001_scanner_pools.sql
-- ATLAS · Scanner Pools — pools de liquidez coletadas pelo servidor.
-- Tabelas fechadas (RLS sem política); o site lê só pelas visões scanner_*.
-- Idempotente: pode rodar de novo.

create schema if not exists scanner;

create table if not exists scanner.pools (
  id              text primary key,
  fonte           text not null,
  rede            text not null,
  dex             text not null,
  par             text not null,
  token_a         text,
  simbolo_a       text,
  token_b         text,
  simbolo_b       text,
  fee             double precision not null default 0,
  tvl             double precision not null default 0,
  vol_24h         double precision not null default 0,
  vol_7d          double precision,
  apr             double precision,
  apr_reward      double precision,
  criada_em       timestamptz,
  sinais          jsonb not null default '{}'::jsonb,
  trilho          text not null check (trilho in ('solida','caca','barrada')),
  motivos         text[] not null default '{}',
  nota            double precision not null default 0,
  componentes     jsonb not null default '{}'::jsonb,
  ativa           boolean not null default true,
  visto_em        timestamptz not null,
  falhas_seguidas integer not null default 0
);

create table if not exists scanner.leituras (
  pool_id  text not null references scanner.pools(id) on delete cascade,
  dia      date not null,
  tvl      double precision not null,
  vol_24h  double precision not null,
  vol_7d   double precision,
  apr      double precision,
  fee      double precision not null,
  primary key (pool_id, dia)
);

create table if not exists scanner.tokens (
  rede              text not null,
  endereco          text not null,
  simbolo           text,
  honeypot          boolean,
  mint_ativo        boolean not null default false,
  freeze_ativo      boolean not null default false,
  dev_pct           double precision,
  holders           integer,
  coingecko_id      text,
  mcap              double precision,
  primeira_pool_em  timestamptz,
  consultado_em     timestamptz not null,
  primary key (rede, endereco)
);

create table if not exists scanner.status_coleta (
  fonte     text not null,
  rede      text,
  dex       text,
  estado    text not null,
  contagem  integer not null default 0,
  em        timestamptz not null
);

alter table scanner.pools enable row level security;
alter table scanner.leituras enable row level security;
alter table scanner.tokens enable row level security;
alter table scanner.status_coleta enable row level security;

drop view if exists public.scanner_pools;
drop view if exists public.scanner_leituras;
drop view if exists public.scanner_status;

create view public.scanner_pools as
select id, rede, dex, par, simbolo_a, simbolo_b, fee, tvl, vol_24h, vol_7d, apr, apr_reward,
       criada_em, sinais, trilho, motivos, nota, componentes, visto_em
from scanner.pools
where ativa and trilho <> 'barrada';

create view public.scanner_leituras as
select l.pool_id, l.dia, l.tvl, l.vol_24h, l.vol_7d, l.apr, l.fee
from scanner.leituras l
join scanner.pools p on p.id = l.pool_id
where p.ativa and p.trilho <> 'barrada';

create view public.scanner_status as
select fonte, rede, dex, estado, contagem, em from scanner.status_coleta;

grant select on public.scanner_pools, public.scanner_leituras, public.scanner_status to anon, authenticated;
```

- [ ] **Step 4: Implementar o `PostgresPoolStore` (acrescentar ao fim de `repositorio.py`)**

```python
import json

from ..db.connect import connect

_COLS = ("id", "fonte", "rede", "dex", "par", "token_a", "simbolo_a", "token_b", "simbolo_b", "fee", "tvl",
         "vol_24h", "vol_7d", "apr", "apr_reward", "criada_em", "sinais", "trilho", "motivos", "nota",
         "componentes", "ativa", "visto_em", "falhas_seguidas")


class PostgresPoolStore(PoolStore):
    def __init__(self, dsn: str) -> None:
        self.conn = connect(dsn)

    def _query(self, sql: str, params=None) -> list[tuple]:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def tokens_em_cache(self, rede, enderecos, validade_desde):
        if not enderecos:
            return {}
        rows = self._query(
            "select rede, endereco, simbolo, honeypot, mint_ativo, freeze_ativo, dev_pct, holders, coingecko_id, "
            "mcap, primeira_pool_em, consultado_em from scanner.tokens "
            "where rede=%s and endereco = any(%s) and consultado_em >= %s",
            (rede, enderecos, validade_desde),
        )
        return {r[1]: TokenInfo(*r) for r in rows}

    def salvar_tokens(self, infos):
        with self.conn.cursor() as cur:
            for t in infos:
                d = asdict(t)
                cur.execute(
                    "insert into scanner.tokens (" + ",".join(d) + ") values (" + ",".join(["%s"] * len(d)) + ") "
                    "on conflict (rede, endereco) do update set " + ",".join(f"{k}=excluded.{k}" for k in d if k not in ("rede", "endereco")),
                    list(d.values()),
                )
        self.conn.commit()

    def leituras(self, pool_ids):
        out: dict[str, list[Leitura]] = {p: [] for p in pool_ids}
        if not pool_ids:
            return out
        for r in self._query(
            "select pool_id, dia, tvl, vol_24h, vol_7d, apr, fee from scanner.leituras where pool_id = any(%s) order by dia",
            (pool_ids,),
        ):
            out[r[0]].append(Leitura(*r))
        return out

    def gravar(self, finais, hoje, agora):
        ids = [f.cand.id for f in finais]
        existentes = {r[0] for r in self._query("select id from scanner.pools where id = any(%s)", (ids,))} if ids else set()
        with self.conn.cursor() as cur:
            for f in finais:
                row = linha_pool(f, agora)
                vals = [json.dumps(row[k]) if k in ("sinais", "componentes") else row[k] for k in _COLS]
                cur.execute(
                    "insert into scanner.pools (" + ",".join(_COLS) + ") values (" + ",".join(["%s"] * len(_COLS)) + ") "
                    "on conflict (id) do update set " + ",".join(f"{k}=excluded.{k}" for k in _COLS if k != "id"),
                    vals,
                )
                c = f.cand
                cur.execute(
                    "insert into scanner.leituras (pool_id, dia, tvl, vol_24h, vol_7d, apr, fee) values (%s,%s,%s,%s,%s,%s,%s) "
                    "on conflict (pool_id, dia) do update set tvl=excluded.tvl, vol_24h=excluded.vol_24h, "
                    "vol_7d=excluded.vol_7d, apr=excluded.apr, fee=excluded.fee",
                    (c.id, hoje, c.tvl, c.vol_24h, c.vol_7d, c.apr, c.fee),
                )
            cur.execute(
                "update scanner.pools set falhas_seguidas = falhas_seguidas + 1 where ativa and not (id = any(%s))", (ids,)
            )
            cur.execute(
                "update scanner.pools set ativa = false where ativa and falhas_seguidas >= %s", (config.FALHAS_PARA_SUMIR,)
            )
            inativadas = cur.rowcount
            cur.execute("delete from scanner.leituras where dia <= %s", (hoje - timedelta(days=config.LEITURAS_DIAS),))
        self.conn.commit()
        return {"novas": len(set(ids) - existentes), "atualizadas": len(existentes), "inativadas": inativadas}

    def gravar_status(self, itens):
        with self.conn.cursor() as cur:
            cur.execute("delete from scanner.status_coleta")
            for s in itens:
                cur.execute(
                    "insert into scanner.status_coleta (fonte, rede, dex, estado, contagem, em) values (%s,%s,%s,%s,%s,%s)",
                    (s["fonte"], s["rede"], s["dex"], s["estado"], s["contagem"], s["em"]),
                )
        self.conn.commit()

    def close(self):
        self.conn.close()
```

- [ ] **Step 5: Rodar e ver passar**

Run: `python -m pytest tests/test_pools_postgres.py tests/test_postgres.py -v`
Expected: PASS (as duas; a migration nova não pode quebrar a da Central RWA).

- [ ] **Step 6: Commit**

```bash
git add central-rwa/supabase/migrations/20260923000001_scanner_pools.sql central-rwa/backend/central_rwa/pools/repositorio.py central-rwa/backend/tests/test_pools_postgres.py
git commit -m "Scanner coletor: tabelas, visoes publicas e gravacao no Postgres"
```

---

### Task 8: Comando `pools` e job agendado

**Files:**
- Modify: `central-rwa/backend/central_rwa/__main__.py` (tratar `pools` antes do parser dos jobs RWA, como `lab`)
- Create: `.github/workflows/scanner-pools.yml`
- Test: `central-rwa/backend/tests/test_pools_coleta.py` (acrescentar teste do comando)

**Interfaces:**
- Consumes: `coletar`, `ClienteFontes`, `MemoryPoolStore`, `PostgresPoolStore`, `central_rwa.gha.annotate`, `central_rwa.db.connect.diagnose`.
- Produces: `python -m central_rwa pools [--dry-run]` — imprime o resumo em JSON; com `--dry-run` usa `MemoryPoolStore`; sai com código 1 se a DefiLlama **e** todas as fontes Gecko falharem.

- [ ] **Step 1: Escrever o teste que falha**

```python
# acrescentar em central-rwa/backend/tests/test_pools_coleta.py
import json

from central_rwa import __main__ as cli_main


def test_comando_pools_dry_run(monkeypatch, capsys):
    monkeypatch.setattr("central_rwa.pools.comando.ClienteFontes", lambda: FakeCliente())
    cli_main.main(["pools", "--dry-run"])
    resumo = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert resumo["pre_corte"] > 0 and resumo["dry_run"] is True
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/test_pools_coleta.py::test_comando_pools_dry_run -v`
Expected: FAIL (`pools` não é um job conhecido; `ModuleNotFoundError: central_rwa.pools.comando`).

- [ ] **Step 3: Implementar o comando**

```python
# central-rwa/backend/central_rwa/pools/comando.py
"""python -m central_rwa pools [--dry-run]"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from ..db.connect import diagnose
from ..gha import annotate
from .coleta import coletar
from .fontes import ClienteFontes
from .repositorio import MemoryPoolStore, PostgresPoolStore


def rodar(argv: list[str]) -> None:
    p = argparse.ArgumentParser(prog="central_rwa pools")
    p.add_argument("--dry-run", action="store_true", help="coleta de verdade, mas não grava no banco")
    args = p.parse_args(argv)
    if args.dry_run:
        store = MemoryPoolStore()
    else:
        dsn = os.environ.get("SUPABASE_DB_URL")
        if not dsn:
            sys.exit("SUPABASE_DB_URL não definida. Use --dry-run para rodar sem banco.")
        try:
            store = PostgresPoolStore(dsn)
        except Exception as e:
            hint = diagnose(dsn, e)
            annotate("error", "Banco", hint)
            sys.exit(hint)
    inicio = datetime.now(timezone.utc)
    try:
        resumo = coletar(ClienteFontes(), store, inicio)
    finally:
        store.close()
    resumo["dry_run"] = args.dry_run
    resumo["duracao_s"] = round((datetime.now(timezone.utc) - inicio).total_seconds(), 1)
    if resumo["parciais"]:
        annotate("warning", "Scanner Pools", f"coleta parcial: {len(resumo['parciais'])} fonte(s) com falha")
    annotate("notice", "Scanner Pools",
             f"{resumo['pre_corte']} pools · {resumo['solidas']} Sólidas · {resumo['caca']} Caça · {resumo['barradas']} barradas")
    print(json.dumps(resumo, ensure_ascii=False, default=str))
    if resumo["lidas"] == 0:
        sys.exit(1)
```

E em `central-rwa/backend/central_rwa/__main__.py`, logo depois do bloco do `lab`:

```python
    if argv and argv[0] == "pools":  # Scanner Pools: coletor próprio, fora do roteador RWA
        from .config import load_env_file as _load
        from pathlib import Path as _P

        _load(_P(__file__).resolve().parents[1] / ".env")
        from .pools.comando import rodar as rodar_pools

        rodar_pools(argv[1:])
        return
```

Atualizar a docstring do `__main__.py`: acrescentar `Fora dos jobs: pools (Scanner Pools — veja pools --help).`

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/ -q`
Expected: PASS em tudo (os testes existentes da Central RWA continuam verdes).

- [ ] **Step 5: Criar o workflow**

```yaml
# .github/workflows/scanner-pools.yml
name: Scanner Pools · coleta (4h)

on:
  schedule:
    - cron: "15 */4 * * *"   # a cada 4 h, aos 15 min (não colide com a camada A da Central RWA)
  workflow_dispatch:

concurrency:
  group: central-rwa-db
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  pools:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    defaults:
      run:
        working-directory: central-rwa/backend
    env:
      SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: central-rwa/backend/pyproject.toml
      - run: pip install -e .
      - name: Migrations (idempotentes)
        run: |
          if [ -z "$SUPABASE_DB_URL" ]; then exit 0; fi
          python -m central_rwa migrate
      - name: Coletar pools
        run: |
          if [ -z "$SUPABASE_DB_URL" ]; then
            echo "::warning::SUPABASE_DB_URL não configurada — coleta pulada (configure o segredo para ativar)."
            exit 0
          fi
          python -m central_rwa pools
```

- [ ] **Step 6: Commit**

```bash
git add central-rwa/backend/central_rwa/__main__.py central-rwa/backend/central_rwa/pools/comando.py central-rwa/backend/tests/test_pools_coleta.py .github/workflows/scanner-pools.yml
git commit -m "Scanner coletor: comando pools e coleta agendada a cada 4h"
```

---

### Task 9: Verificação real

**Files:** nenhum arquivo novo; só execução e conferência.

- [ ] **Step 1: Rodar a coleta real sem gravar**

Run (em `central-rwa/backend`): `python -m central_rwa pools --dry-run`
Expected: termina em 5–15 min com um JSON onde `pre_corte` fica entre 800 e 3.000, `solidas` > 0, `caca` > 0 e `parciais` vazio ou com poucos itens.

- [ ] **Step 2: Conferir as pools que motivaram o trabalho**

Run:
```bash
python - <<'EOF'
from datetime import datetime, timezone
from central_rwa.pools.coleta import coletar
from central_rwa.pools.fontes import ClienteFontes
from central_rwa.pools.repositorio import MemoryPoolStore
s = MemoryPoolStore()
r = coletar(ClienteFontes(), s, datetime.now(timezone.utc))
bsc = [p for p in s.pools.values() if p["rede"] == "BNB Chain" and p["dex"] == "PancakeSwap"]
print("PancakeSwap/BSC:", len(bsc), "| Sólidas:", sum(p["trilho"] == "solida" for p in bsc))
print([ (p["par"], p["trilho"], p["nota"]) for p in bsc if "UNI" in p["par"].upper() ][:5])
print("top 10 Sólidas:", sorted(((p["nota"], p["par"], p["dex"], p["rede"]) for p in s.pools.values() if p["trilho"] == "solida"), reverse=True)[:10])
EOF
```
Expected: dezenas de pools da PancakeSwap na BNB Chain (muito mais que as ~29 de hoje); se houver UNI/WBNB com TVL ≥ 100 mil e volume ≥ 50 mil, ela aparece; o top 10 Sólidas não tem memecoin.

- [ ] **Step 3: Rodar a coleta gravando (com o segredo configurado localmente em `central-rwa/backend/.env`)**

Run: `python -m central_rwa migrate && python -m central_rwa pools`
Expected: JSON com `gravacao.novas` > 0. Conferir no navegador (qualquer página do ATLAS aberta por http, console):
```js
fetch(ATLAS_SUPABASE.url + "/rest/v1/scanner_pools?select=par,trilho,nota&order=nota.desc&limit=5",
  {headers:{apikey: ATLAS_SUPABASE.publishableKey}}).then(r=>r.json()).then(console.log)
```
Expected: 5 pools com `trilho` e `nota`.

- [ ] **Step 4: Disparar o workflow uma vez**

Em GitHub → Actions → "Scanner Pools · coleta (4h)" → Run workflow. Expected: termina verde, com a anotação "N pools · X Sólidas · Y Caça · Z barradas".

- [ ] **Step 5: Commit final (se algo foi ajustado na verificação)**

```bash
git add -A central-rwa .github/workflows/scanner-pools.yml
git commit -m "Scanner coletor: ajustes da verificacao real"
```

---

## Próximos planos (fora deste)

- **Parte 2** — `docs/superpowers/plans/2026-09-2X-scanner-site.md`: Scanner lendo `scanner_*`, abas Sólidas/Caça, coluna Nota, painel de evolução para qualquer pool, remoção dos painéis Revisar / Buscar pools novas / Ler print (e do Tesseract), cache com aviso quando o Supabase cair.
- **Parte 3** — migração das 93 pools (casar por `srcId`, depois rede + DEX + par normalizado + fee), backup de estrelas/níveis/lista de tokens/manuais, seção nova do Guia.
