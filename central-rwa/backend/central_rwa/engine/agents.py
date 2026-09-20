"""Definição dos agentes: cada agente opera uma CESTA de ativos com regras
próprias. Lido de config/agents.yaml — mudar a cesta ou uma regra é editar
o arquivo; o próximo deploy retreina e o placar mostra o efeito.

REGRA DE ESTRUTURA (docs/central-rwa/CESTAS.md): no máximo 10 cestas, cada uma
com 5 a 8 ativos. O limite não é estética: cestas de tamanhos diferentes não
dão para comparar entre si — um agente não pode parecer melhor só porque
treinou em menos ruído que o outro. Um tema que não cabe em 8 vira duas
sub-cestas. A `régua` (tipo: regua) é a exceção: ela roda em todos os ativos
de propósito, para servir de ponto de partida.
"""

from __future__ import annotations

from dataclasses import dataclass, fields, replace
from datetime import date

from ..config import load_yaml
from .risco import tickers_validos
from .swing import Rules

_RULE_FIELDS = {f.name for f in fields(Rules)}

MAX_CESTAS = 10
MIN_ATIVOS = 5
MAX_ATIVOS = 8
TIPOS = ("cesta", "regua")


@dataclass(frozen=True)
class AgentDef:
    id: str
    nome: str
    descricao: str
    cesta: tuple[str, ...]
    rules: Rules
    corte_validacao: date
    ativo: bool = True
    tipo: str = "cesta"

    def regras_dict(self) -> dict:
        r = self.rules
        return {f: (list(getattr(r, f)) if isinstance(getattr(r, f), tuple) else getattr(r, f)) for f in _RULE_FIELDS}


def parse_agents(raw: dict) -> list[AgentDef]:
    corte = date.fromisoformat(str(raw.get("corte_validacao", "2023-01-01")))
    out: list[AgentDef] = []
    seen: set[str] = set()
    for a in raw.get("agents") or []:
        aid = str(a["id"])
        if aid in seen:
            raise ValueError(f"agente duplicado: {aid}")
        seen.add(aid)
        regras = dict(a.get("regras") or {})
        desconhecidas = set(regras) - _RULE_FIELDS
        if desconhecidas:
            raise ValueError(f"{aid}: regras desconhecidas {sorted(desconhecidas)}")
        if "setups" in regras:
            regras["setups"] = tuple(regras["setups"])
        rules = replace(Rules(), **regras)
        # Prazo maior que o máximo faz a posição nunca fechar: o agente fica mudo.
        if rules.prazo_maximo_pregoes < rules.prazo_pregoes:
            raise ValueError(f"{aid}: prazo_maximo_pregoes ({rules.prazo_maximo_pregoes}) menor que prazo_pregoes ({rules.prazo_pregoes})")
        tipo = str(a.get("tipo", "cesta"))
        if tipo not in TIPOS:
            raise ValueError(f"{aid}: tipo '{tipo}' desconhecido (use {' ou '.join(TIPOS)})")
        # tickers_validos também pega o YAML que vira booleano (ON, NO).
        cesta = tuple(tickers_validos(a.get("cesta"), f"cesta do agente {aid}"))
        if len(set(cesta)) != len(cesta):
            raise ValueError(f"{aid}: ativo repetido na cesta")
        if tipo == "cesta" and not MIN_ATIVOS <= len(cesta) <= MAX_ATIVOS:
            raise ValueError(
                f"{aid}: a cesta tem {len(cesta)} ativos; a regra é de {MIN_ATIVOS} a {MAX_ATIVOS} "
                f"(tema grande demais vira duas sub-cestas; para uma régua, use tipo: regua)"
            )
        out.append(AgentDef(aid, a.get("nome", aid), a.get("descricao", ""), cesta, rules, corte, bool(a.get("ativo", True)), tipo))
    cestas = [a for a in out if a.tipo == "cesta" and a.ativo]
    if len(cestas) > MAX_CESTAS:
        raise ValueError(f"{len(cestas)} cestas ativas; o máximo é {MAX_CESTAS}")
    return out


def load_agents() -> list[AgentDef]:
    return [a for a in parse_agents(load_yaml("agents.yaml")) if a.ativo]
