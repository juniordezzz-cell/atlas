"""De onde vêm as pools. As funções parse_* são puras (testadas com
respostas gravadas); ClienteFontes faz as chamadas HTTP."""

from __future__ import annotations

import re
import time
from datetime import datetime

import httpx

from .. import USER_AGENT
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


def _simbolo(s: str) -> str:
    """WSOL é o SOL nativo embrulhado automaticamente pelas DEXs de Solana: a tela mostra SOL."""
    return "SOL" if s.strip().upper() == "WSOL" else s


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
            par="/".join(_simbolo(x) for x in simbolos[:2]),
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
            par="/".join(_simbolo(x) for x in simbolos[:2]),
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


def _sim_nao(v) -> bool | None:
    """A GeckoTerminal responde em texto ("yes"/"no"/"unknown") ou, em redes
    antigas, com booleano/nulo. Um endereço no lugar de "yes" também é sim."""
    if v is None or v is False:
        return False if v is False else None
    if v is True:
        return True
    t = str(v).strip().lower()
    if t in ("yes", "true"):
        return True
    if t in ("no", "false", ""):
        return False
    if t == "unknown":
        return None
    return True


def parse_token_info(payload: dict, rede: str, agora: datetime) -> TokenInfo:
    a = (payload.get("data") or {}).get("attributes") or {}
    holders = a.get("holders") or {}
    return TokenInfo(
        rede=rede,
        endereco=str(a.get("address") or ""),
        simbolo=str(a.get("symbol") or ""),
        honeypot=_sim_nao(a.get("is_honeypot")),
        mint_ativo=bool(_sim_nao(a.get("mint_authority"))),
        freeze_ativo=bool(_sim_nao(a.get("freeze_authority"))),
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


# ======================================================================
# HTTP
# ======================================================================

LLAMA_URL = "https://yields.llama.fi/pools"
GECKO = "https://api.geckoterminal.com/api/v2"


class ClienteFontes:
    """Chamadas HTTP. A GeckoTerminal libera ~6 req/min por IP: toda chamada a ela
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
