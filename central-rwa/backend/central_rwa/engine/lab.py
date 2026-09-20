"""Laboratório: roda os agentes fora do banco, para testar cesta e regras.

Não é produção. Serve para responder "e se a cesta 2 tivesse mais ativos?" ou
"e se o gatilho fosse 4%?" sem precisar do Supabase e sem sujar o placar.

Usa o MESMO motor do job (`train_agent`), para o que o laboratório mede ser o
que a produção faria. O histórico vem do Yahoo (a mesma fonte do backfill) e
fica num cache local em `.cache/bars/` — um arquivo por ativo, fora do git.

METODOLOGIA (a mesma da produção, aqui feita à mão):
a variante é ESCOLHIDA pelo resultado do TREINO (antes do corte); a validação
é só relatada. `escolher()` implementa isso — nunca ordene pela validação.
"""

from __future__ import annotations

import json
import statistics
from dataclasses import dataclass, field
from datetime import date
from itertools import product
from pathlib import Path

from ..config import CONFIG_DIR, ProviderConfig, load_yaml
from ..models import DailyBar
from ..reference import ReferenceRegistry
from .agents import AgentDef, parse_agents
from .events import daily_moves, is_trigger, kind_of
from .runner import MIN_BARS, train_agent

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "bars"
ANOS_PADRAO = 12  # baixa mais do que a janela, para dar para deslocar o início
JANELA_ANOS = 10  # a mesma janela do backfill (watchlist.yaml: history_years)


def inicio_producao(hoje: date | None = None, anos: int = JANELA_ANOS) -> date:
    """O mesmo primeiro dia que o backfill usou (collectors/history.py).
    O resultado de um agente MUDA conforme o início da série — a estatística de
    cada evento olha todos os anteriores — então o laboratório precisa usar a
    mesma janela da produção para os números baterem com os do site."""
    hoje = hoje or date.today()
    return date(hoje.year - anos, hoje.month, min(hoje.day, 28))


# ----------------------------------------------------------------- histórico


def _cache_file(ticker: str) -> Path:
    return CACHE_DIR / f"{ticker.replace('/', '_')}.json"


def load_cached(ticker: str) -> list[DailyBar]:
    f = _cache_file(ticker)
    if not f.exists():
        return []
    raw = json.loads(f.read_text(encoding="utf-8"))
    return [DailyBar(**b) for b in raw["bars"]]


def download(ticker: str, registry: ReferenceRegistry, anos: int = ANOS_PADRAO) -> list[DailyBar]:
    """Baixa do Yahoo e grava no cache. O Yahoo bloqueia IP por excesso de uso:
    o cache existe para não repetir o download a cada experimento."""
    from ..providers.yahoo import Yahoo

    start = date(date.today().year - anos, 1, 1)
    serie = Yahoo(ProviderConfig(name="yahoo")).daily_history(registry.get(ticker), start)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cache_file(ticker).write_text(
        json.dumps({"ticker": ticker, "fonte": serie.source, "baixado_em": date.today().isoformat(),
                    "bars": [b.model_dump(mode="json") for b in serie.bars]}),
        encoding="utf-8",
    )
    return serie.bars


def bars_source(tickers: list[str], registry: ReferenceRegistry | None = None, baixar: bool = True,
                inicio: date | None = None):
    """Devolve (bars_of, disponiveis, faltando). `bars_of` é a mesma interface
    que `train_agent` recebe do banco em produção. `inicio` corta a série no
    mesmo dia em que o backfill começou (o padrão)."""
    registry = registry or ReferenceRegistry.load()
    inicio = inicio or inicio_producao()
    cache: dict[str, list[DailyBar]] = {}
    faltando: list[str] = []
    for t in dict.fromkeys(tickers):
        bars = [b for b in load_cached(t) if b.day >= inicio]
        if not bars and baixar:
            try:
                bars = [b for b in download(t, registry) if b.day >= inicio]
            except Exception as e:  # sem histórico o ativo fica de fora, e o relatório diz qual
                faltando.append(f"{t}: {type(e).__name__} {str(e)[:120]}")
                bars = []
        if len(bars) < MIN_BARS:
            if bars or not baixar:
                faltando.append(f"{t}: só {len(bars)} pregões (mínimo {MIN_BARS})")
            continue
        cache[t] = bars
    return (lambda t: cache.get(t, [])), sorted(cache), faltando


# ------------------------------------------------------------------- placar


@dataclass
class Periodo:
    """As mesmas contas da view crwa_placar_periodo."""

    operacoes: int = 0
    acerto_pct: float | None = None
    medio_pct: float | None = None
    mediano_pct: float | None = None
    base_media_pct: float | None = None  # "não fazer nada"
    soma_pct: float | None = None

    @property
    def vantagem_pct(self) -> float | None:
        if self.medio_pct is None or self.base_media_pct is None:
            return None
        return round(self.medio_pct - self.base_media_pct, 2)


def _periodo(rows) -> Periodo:
    p = Periodo(operacoes=len(rows))
    if not rows:
        return p
    rets = [r.ret_net_pct for r in rows if r.ret_net_pct is not None]
    bases = [r.baseline_pct for r in rows if r.baseline_pct is not None]
    if rets:
        p.acerto_pct = round(100 * sum(1 for r in rets if r > 0) / len(rets), 1)
        p.medio_pct = round(statistics.fmean(rets), 2)
        p.mediano_pct = round(statistics.median(rets), 2)
        p.soma_pct = round(sum(rets), 1)
    if bases:
        p.base_media_pct = round(statistics.fmean(bases), 2)
    return p


@dataclass
class Resultado:
    nome: str
    agente: AgentDef
    treino: Periodo
    validacao: Periodo
    sem_historico: list[str] = field(default_factory=list)
    recusas: dict[str, dict[str, int]] = field(default_factory=dict)  # periodo -> motivo -> nº
    gatilhos: dict[str, int] = field(default_factory=dict)  # periodo -> nº de gatilhos
    por_ativo: dict[str, dict[str, int]] = field(default_factory=dict)  # periodo -> ticker -> operações

    def concentracao_de(self, periodo: str) -> tuple[str, float] | None:
        ops = self.por_ativo.get(periodo) or {}
        if not ops:
            return None
        ticker, n = max(ops.items(), key=lambda kv: kv[1])
        return ticker, round(100 * n / sum(ops.values()), 1)

    @property
    def concentracao(self) -> tuple[str, float] | None:
        """O ativo que mais operou na validação (ou no treino, se a validação
        não teve operação) e a fatia dele. Uma cesta em que um ativo responde
        por quase tudo não é uma cesta: é aquele ativo com outro nome."""
        return self.concentracao_de("validacao") or self.concentracao_de("treino")

    @property
    def veredito(self) -> str:
        v = self.validacao
        if not v.operacoes:
            return "sem operações na validação"
        if v.vantagem_pct is None:
            return "sem 'não fazer nada' para comparar"
        if v.vantagem_pct <= 0:
            return f"não se sustentou ({v.vantagem_pct:+.2f} p.p. vs. não fazer nada)"
        conc = self.concentracao
        aviso = f" — mas {conc[1]:.0f}% das operações são de {conc[0]}" if conc and conc[1] >= 80 and len(self.agente.cesta) > 1 else ""
        if v.operacoes < 20:
            return f"promissor, mas só {v.operacoes} operações ({v.vantagem_pct:+.2f} p.p.){aviso}"
        return f"se sustentou ({v.vantagem_pct:+.2f} p.p. em {v.operacoes} operações){aviso}"


def avaliar(nome: str, agent: AgentDef, bars_of, tickers: list[str]) -> Resultado:
    recusas: dict[str, dict[str, int]] = {"treino": {}, "validacao": {}}
    gatilhos = {"treino": 0, "validacao": 0}

    def trace(ticker: str, m, motivo: str) -> None:
        periodo = "treino" if m.day < agent.corte_validacao else "validacao"
        gatilhos[periodo] += 1
        chave = motivo.split(" (")[0]  # tira os números do motivo, para agrupar
        recusas[periodo][chave] = recusas[periodo].get(chave, 0) + 1

    positions, info = train_agent(agent, bars_of, tickers, trace=trace)
    treino = [p for p in positions if p.entry_day < agent.corte_validacao]
    val = [p for p in positions if p.entry_day >= agent.corte_validacao]
    por_ativo = {"treino": _por_ativo(treino), "validacao": _por_ativo(val)}
    return Resultado(nome, agent, _periodo(treino), _periodo(val), info.sem_historico, recusas, gatilhos, por_ativo)


def _por_ativo(rows) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        out[r.ticker] = out.get(r.ticker, 0) + 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def escolher(resultados: list[Resultado], minimo_treino: int = 30) -> Resultado | None:
    """A escolha olha SÓ o treino: melhor vantagem sobre o 'não fazer nada',
    entre as variantes com amostra de treino suficiente. A validação não entra
    na conta — ela só é relatada depois."""
    elegiveis = [r for r in resultados if r.treino.operacoes >= minimo_treino and r.treino.vantagem_pct is not None]
    return max(elegiveis, key=lambda r: r.treino.vantagem_pct) if elegiveis else None


# ------------------------------------------------------------- experimentos


def variantes(base: AgentDef, cestas: dict[str, list[str]], grade: dict[str, list]) -> list[tuple[str, AgentDef]]:
    """Produto cartesiano das cestas pelos valores da grade.

    Cada chave da grade é ou o nome de uma regra (valores soltos), ou um apelido
    para um conjunto de regras que andam juntas (valores em dicionário):

        grade:
          gatilho_pct: [4, 5]                                   # uma regra
          prazo: [{prazo_pregoes: 5, prazo_maximo_pregoes: 8}]  # várias juntas
    """
    from dataclasses import replace

    chaves = sorted(grade)
    out: list[tuple[str, AgentDef]] = []
    for cesta_nome, cesta in (cestas or {"": list(base.cesta)}).items():
        for combo in product(*(grade[k] for k in chaves)) if chaves else [()]:
            regras: dict = {}
            partes: list[str] = []
            for k, v in zip(chaves, combo):
                if isinstance(v, dict):
                    regras.update(v)
                    partes.append(f"{k}={'/'.join(str(x) for x in v.values())}")
                else:
                    regras[k] = v
                    partes.append(f"{k}={v}")
            if "setups" in regras:
                regras["setups"] = tuple(regras["setups"])
            nome = " · ".join(filter(None, [cesta_nome, *partes])) or base.id
            rules = replace(base.rules, **regras)
            if rules.prazo_maximo_pregoes < rules.prazo_pregoes:
                raise ValueError(f"{nome}: prazo_maximo_pregoes ({rules.prazo_maximo_pregoes}) menor que prazo_pregoes ({rules.prazo_pregoes})")
            out.append((nome, replace(base, cesta=tuple(cesta), rules=rules)))
    return out


def carregar_experimentos(nome: str = "experimentos.yaml") -> tuple[dict, list[AgentDef]]:
    raw = load_yaml(nome)
    agents = parse_agents(load_yaml("agents.yaml"))
    return raw, agents


def contar_gatilhos(bars_of, tickers: list[str], gatilho_pct: float, corte: date) -> dict[str, dict[str, int]]:
    """Quantos pregões passam do gatilho, por ativo e período. É o teto de
    operações possíveis: se aqui já são poucos, a regra não é o gargalo."""
    out: dict[str, dict[str, int]] = {}
    for t in tickers:
        bars = bars_of(t)
        if len(bars) < MIN_BARS:
            continue
        c = {"queda_treino": 0, "queda_validacao": 0, "alta_treino": 0, "alta_validacao": 0}
        for m in daily_moves(bars):
            if is_trigger(m.ret_pct, gatilho_pct):
                lado = "queda" if kind_of(m.ret_pct) == "queda_brusca" else "alta"
                c[f"{lado}_{'treino' if m.day < corte else 'validacao'}"] += 1
        out[t] = c
    return out


# --------------------------------------------------------------- relatório


def _n(v: float | None, casas: int = 2) -> str:
    return "—" if v is None else f"{v:+.{casas}f}"


def resumo(resultados: list[Resultado]) -> str:
    """Quantas variantes ganharam do 'não fazer nada' em cada período. Se a
    grade inteira perde na validação, não é a variante que está errada: é a
    ideia. Se metade ganha no treino e quase nenhuma na validação, o que a
    grade achou foi o passado."""
    def ganha(p: Periodo) -> bool:
        return bool(p.operacoes and p.vantagem_pct is not None and p.vantagem_pct > 0)

    n = len(resultados)
    com_val = [r for r in resultados if r.validacao.operacoes]
    return (f"{sum(ganha(r.treino) for r in resultados)}/{n} variantes ganham do 'não fazer nada' no treino; "
            f"{sum(ganha(r.validacao) for r in resultados)}/{n} na validação "
            f"({len(com_val)} chegaram a operar na validação)")


def tabela(resultados: list[Resultado], escolhido: Resultado | None = None) -> str:
    largura = max([30, *(len(r.nome) for r in resultados)]) + 2
    cab = (f"{'variante':<{largura}} {'op.tr':>6} {'médio':>8} {'base':>8} {'vant.':>7} | "
           f"{'op.val':>6} {'médio':>8} {'base':>8} {'vant.':>7} | maior ativo")
    linhas = [cab, "-" * len(cab)]
    for r in resultados:
        marca = " *" if escolhido is not None and r is escolhido else "  "
        conc = r.concentracao
        linhas.append(
            f"{(r.nome + marca):<{largura}} {r.treino.operacoes:>6} {_n(r.treino.medio_pct):>8} {_n(r.treino.base_media_pct):>8} "
            f"{_n(r.treino.vantagem_pct):>7} | {r.validacao.operacoes:>6} {_n(r.validacao.medio_pct):>8} "
            f"{_n(r.validacao.base_media_pct):>8} {_n(r.validacao.vantagem_pct):>7} | "
            + (f"{conc[0]} {conc[1]:.0f}%" if conc else "—")
        )
    return "\n".join(linhas)


def detalhe(r: Resultado) -> str:
    out = [
        f"variante: {r.nome}",
        f"  cesta ({len(r.agente.cesta)}): {', '.join(r.agente.cesta)}",
        f"  regras: {json.dumps(r.agente.regras_dict(), ensure_ascii=False, sort_keys=True, default=list)}",
        f"  gatilhos: treino {r.gatilhos.get('treino', 0)} · validação {r.gatilhos.get('validacao', 0)}",
        f"  veredito: {r.veredito}",
    ]
    for periodo in ("treino", "validacao"):
        ops = r.por_ativo.get(periodo) or {}
        if ops:
            out.append(f"  operações por ativo ({periodo}): " + ", ".join(f"{t} {n}" for t, n in ops.items()))
    if r.sem_historico:
        out.append(f"  sem histórico: {', '.join(r.sem_historico)}")
    for periodo, motivos in r.recusas.items():
        if motivos:
            out.append(f"  o que aconteceu com cada gatilho ({periodo}):")
            for motivo, n in sorted(motivos.items(), key=lambda kv: -kv[1]):
                out.append(f"    {n:>5}  {motivo}")
    return "\n".join(out)


def relatorio_placar(argv: list[str] | None = None) -> None:
    """`lab placar`: roda os agentes como estão em agents.yaml e mostra o placar
    que o site vai exibir depois do próximo deploy — sem precisar do banco."""
    import argparse

    ap = argparse.ArgumentParser(prog="central_rwa lab placar", description="placar dos agentes de agents.yaml")
    ap.add_argument("--sem-rede", action="store_true", help="usa só o cache local, não baixa nada")
    ap.add_argument("--agente", help="só este agente")
    ap.add_argument("--detalhe", action="store_true", help="mostra regras, motivos e operações por ativo")
    args = ap.parse_args(argv)

    agentes = [a for a in parse_agents(load_yaml("agents.yaml")) if not args.agente or a.id == args.agente]
    todos = sorted({t for a in agentes for t in a.cesta})
    bars_of, disponiveis, faltando = bars_source(todos, baixar=not args.sem_rede)
    print(f"{len(agentes)} agentes · {len(disponiveis)} ativos com histórico · série desde {inicio_producao()}")
    if faltando:
        print("sem histórico utilizável: " + "; ".join(faltando))
    resultados = [avaliar(f"{a.id} · {a.nome}", a, bars_of, disponiveis) for a in agentes]
    print()
    print(tabela(resultados))
    print()
    for r in resultados:
        print(f"{r.nome}: {r.veredito}")
        if args.detalhe:
            print(detalhe(r))


def load_agentes_corte() -> date:
    """O corte da validação vale para todos os agentes (agents.yaml)."""
    return date.fromisoformat(str(load_yaml("agents.yaml").get("corte_validacao", "2023-01-01")))


def relatorio_risco(argv: list[str] | None = None) -> None:
    """`lab risco`: mede o ATR% dos candidatos e corta a lista em tercis."""
    import argparse

    from .risco import MAX_CESTAS, classificar, propor

    ap = argparse.ArgumentParser(prog="central_rwa lab risco", description="classifica os candidatos por risco (ATR%)")
    ap.add_argument("--arquivo", default="candidatos.yaml", help=f"lista de candidatos em {CONFIG_DIR}")
    ap.add_argument("--sem-rede", action="store_true", help="usa só o cache local, não baixa nada")
    args = ap.parse_args(argv)

    raw = load_yaml(args.arquivo)
    temas = {k: list(v.get("tickers") or []) for k, v in (raw.get("temas") or {}).items()}
    nomes = {k: v.get("nome", k) for k, v in (raw.get("temas") or {}).items()}
    todos = sorted({t for ts in temas.values() for t in ts})
    bars_of, disponiveis, faltando = bars_source(todos, baixar=not args.sem_rede)

    candidatos, (baixo, alto) = classificar(temas, bars_of)
    print(f"{len(todos)} candidatos · {len(disponiveis)} com histórico · corte dos tercis: "
          f"ATR% ≤ {baixo} conservador · ≤ {alto} mediano · acima disso agressivo")
    if faltando:
        print("sem histórico utilizável: " + "; ".join(faltando))
    print()
    print(f"{'ticker':<8} {'ATR%':>6} {'classe':<13} {'pregões':>8}  temas")
    print("-" * 78)
    for c in candidatos:
        atr = f"{c.atr_pct:.2f}" if c.atr_pct is not None else "—"
        print(f"{c.ticker:<8} {atr:>6} {(c.classe or c.motivo):<13} {c.pregoes_total:>8}  "
              + ", ".join(nomes.get(t, t) for t in c.temas))

    # Só entra na cesta quem já existia dois anos antes do corte da validação:
    # ativo recém-listado não tem treino, só validação.
    estreia = date(load_agentes_corte().year - 2, 1, 1)
    propostas = propor(candidatos, estreia_ate=estreia)
    print(f"fora das cestas por estrearem depois de {estreia}: "
          + ", ".join(c.ticker for c in candidatos if c.classe and (c.primeiro_dia or date.max) > estreia))
    print()
    print(f"cestas possíveis dentro da regra (5 a 8 ativos, no máximo {MAX_CESTAS} cestas):")
    for p in propostas:
        print()
        print(f"  {p.classe} · {nomes.get(p.tema, p.tema)}")
        print(f"    cesta: [{', '.join(p.tickers)}]")
        if p.sobra:
            print(f"    fora: {', '.join(p.sobra)}  ← {p.nota}")
    if len(propostas) > MAX_CESTAS:
        print()
        print(f"!! {len(propostas)} grupos possíveis para no máximo {MAX_CESTAS} cestas: a escolha final é sua.")


def rodar(argv: list[str] | None = None) -> None:
    import argparse

    argv = list(argv or [])
    if argv and argv[0] == "risco":
        relatorio_risco(argv[1:])
        return
    if argv and argv[0] == "placar":
        relatorio_placar(argv[1:])
        return

    ap = argparse.ArgumentParser(prog="central_rwa lab", description="testa cesta e regras sem tocar no banco")
    ap.add_argument("--agente", help="só este experimento (id do agente base)")
    ap.add_argument("--arquivo", default="experimentos.yaml", help=f"grade de experimentos em {CONFIG_DIR}")
    ap.add_argument("--sem-rede", action="store_true", help="usa só o cache local, não baixa nada")
    ap.add_argument("--inicio", type=date.fromisoformat, default=None,
                    help=f"primeiro pregão da série (padrão: {inicio_producao()}, a janela do backfill)")
    ap.add_argument("--minimo-treino", type=int, default=30, help="operações mínimas no treino para a variante poder ser escolhida")
    args = ap.parse_args(argv)

    raw, agents = carregar_experimentos(args.arquivo)
    por_id = {a.id: a for a in agents}
    cestas_nomeadas = raw.get("cestas") or {}

    for exp in raw.get("experimentos") or []:
        base_id = str(exp["agente"])
        if args.agente and base_id != args.agente:
            continue
        base = por_id.get(base_id)
        if base is None:
            print(f"!! experimento ignorado: agente '{base_id}' não existe em agents.yaml")
            continue
        cestas = {nome: list(cestas_nomeadas[nome]) for nome in (exp.get("cestas") or [])} or {"cesta atual": list(base.cesta)}
        grade = exp.get("grade") or {}
        combos = variantes(base, cestas, grade)
        todos = sorted({t for _, a in combos for t in a.cesta})
        inicio = args.inicio or inicio_producao()
        bars_of, disponiveis, faltando = bars_source(todos, baixar=not args.sem_rede, inicio=inicio)

        print(f"\n=== {exp.get('titulo', base_id)} ===")
        print(f"base: {base.id} · série desde {inicio} · corte da validação: {base.corte_validacao} · "
              f"{len(combos)} variantes · {len(disponiveis)} ativos com histórico")
        if faltando:
            print("sem histórico utilizável: " + "; ".join(faltando))

        resultados = [avaliar(nome, agente, bars_of, disponiveis) for nome, agente in combos]
        escolhido = escolher(resultados, args.minimo_treino)
        resultados.sort(key=lambda r: (r.treino.vantagem_pct is None, -(r.treino.vantagem_pct or 0)))
        print(tabela(resultados, escolhido))
        print(resumo(resultados))
        print(f"\nescolha pelo TREINO (mínimo de {args.minimo_treino} operações); a validação abaixo é só o resultado:")
        print(detalhe(escolhido) if escolhido else "  nenhuma variante teve treino suficiente.")


if __name__ == "__main__":  # pragma: no cover
    rodar()
