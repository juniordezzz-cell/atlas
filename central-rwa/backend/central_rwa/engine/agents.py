"""Definição dos agentes: cada agente opera uma CESTA de ativos com regras
próprias. Lido de config/agents.yaml — mudar a cesta ou uma regra é editar
o arquivo; o próximo deploy retreina e o placar mostra o efeito."""

from __future__ import annotations

from dataclasses import dataclass, fields, replace
from datetime import date

from ..config import load_yaml
from .swing import Rules

_RULE_FIELDS = {f.name for f in fields(Rules)}


@dataclass(frozen=True)
class AgentDef:
    id: str
    nome: str
    descricao: str
    cesta: tuple[str, ...]
    rules: Rules
    corte_validacao: date
    ativo: bool = True

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
        out.append(AgentDef(aid, a.get("nome", aid), a.get("descricao", ""), tuple(a.get("cesta") or []), rules, corte, bool(a.get("ativo", True))))
    return out


def load_agents() -> list[AgentDef]:
    return [a for a in parse_agents(load_yaml("agents.yaml")) if a.ativo]
