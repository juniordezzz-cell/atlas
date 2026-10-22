"""Nota 0–100 pelos critérios do dono (Guia, tópico 16):

  taxa         30%  o fee tier da pool: 0,25%–0,8% é o ponto bom; 0,001% não paga
                    e 1% ou mais costuma ser pool ruim (degen)
  giro         30%  a Razão volume do dia ÷ TVL — o volume tem que passar o TVL
  rendimento   20%  a Eficiência %/dia (taxa × razão): junta as duas
  consistência 10%  a razão estável nos últimos 7 dias — não é pico
  profundidade  5%  TVL real
  tendência     5%  TVL subindo ou caindo na semana

A régua é absoluta (não percentil): a mesma pool tem a mesma nota não
importa quantas outras entrem na coleta. Cada componente vai de 0 a 1 e
fica gravado, para o Guia e a dica da tela explicarem a nota.

Desde 11/10/2026 taxa e rendimento são medidos contra a CLASSE do par:
stable/stable a 0,01% com giro alto é ótima, e antes tirava 41 (USDT/WBNB
da PancakeSwap) porque a régua única pedia 0,25–0,8%. E nas ve(3,3) a nota
conta só a taxa: a emissão (AERO/VELO impresso) aparece no APR, não pontua.

Desde 12/10/2026 a pool ve(3,3) que paga em emissão PERDE nota: quem deixa
a liquidez em stake recebe AERO/VELO no lugar da taxa, e o dono quer a renda
nos tokens do par. Perde até metade da nota, na proporção da renda que vem
em emissão (componente "emissao", de 0 a 1). Pool sem emissão não muda."""

from __future__ import annotations

import math
from statistics import mean, pstdev

from . import config
from .modelos import Candidata, Leitura

VE33 = {"Aerodrome", "Velodrome", "Aero", "THENA", "Pharaoh", "Ramses"}
PESOS = {"taxa": 0.30, "giro": 0.30, "rendimento": 0.20, "consistencia": 0.10, "profundidade": 0.05, "tendencia": 0.05}
TAXA_DESCONHECIDA = 0.3
PERDA_EMISSAO = 0.5       # pool 100% paga em emissão fica com metade da nota
# ve(3,3) sem dado nenhum da fonte (GeckoTerminal: THENA, parte da Velodrome):
# presume esta parte em emissão. Mediana medida na Aerodrome em 12/10/2026: 55%.
PARTE_EMISSAO_PRESUMIDA = 0.6   # fee 0 = a fonte não informou (ou taxa dinâmica): não é "taxa boa"


def razao(c: Candidata) -> float:
    """Volume do dia (últimas 24h) ÷ TVL."""
    return c.vol_24h / c.tvl if c.tvl > 0 else 0.0


def eficiencia(c: Candidata) -> float:
    """Quanto a pool rende por dia, em % do capital."""
    taxa = c.fee * razao(c)
    if c.dex in VE33:  # nas ve(3,3) o LP recebe as emissões, não a taxa
        lp = max(c.apr or 0, c.apr_reward or 0) / 365
        return max(taxa, lp)
    if c.fee <= 0 and c.apr:  # taxa dinâmica (Uniswap v4) chega como 0: vale o APR da fonte
        return c.apr / 365
    return taxa


def eficiencia_nota(c: Candidata) -> float:
    """Rendimento que pontua: nas ve(3,3) só a taxa × giro, sem a emissão."""
    return c.fee * razao(c) if c.dex in VE33 else eficiencia(c)


def parte_emissao(c: Candidata) -> float:
    """Que parte da renda da pool vem em emissão (AERO, VELO, THE…), de 0 a 1.
    Só nas ve(3,3), onde o LP em stake troca a taxa pela emissão; nas outras
    DEXs o reward é um extra pago junto com a taxa."""
    if c.dex not in VE33:
        return 0.0
    if c.apr is None and c.apr_reward is None:
        return PARTE_EMISSAO_PRESUMIDA   # a fonte não informa: presume (ver acima)
    if not c.apr_reward or c.apr_reward <= 0:
        return 0.0
    return c.apr_reward / (c.apr_reward + max(c.apr or 0, 0))


def classe_nota(c: Candidata) -> str:
    """Classe do par para a nota. Como em classificacao.classe_par, mas os
    majors que são altcoin (BNB, AVAX, SUI, HYPE, POL) contam como blue chip:
    USDT/WBNB é par de ativo grande, não de cauda. Sem categoria gravada,
    "cauda" — a régua antiga."""
    cats = c.sinais.get("categoria")
    if not cats or len(cats) != 2:
        return "cauda"
    ajust = ["bluechip" if cat == "altcoin" and (t.simbolo or "").upper() in config.MAJORS else cat
             for cat, t in zip(cats, (c.token_a, c.token_b))]
    if "altcoin" in ajust or "meme" in ajust:
        return "cauda"
    if ajust[0] == ajust[1] == "stable":
        return "stable"
    return "grande_stable" if "stable" in ajust else "grande"


# Taxa: (zero em, ponto bom de, até) em %. Rendimento: (zero em, cheio em) em %/dia.
TAXA_CLASSE = {"stable": (0.0001, 0.005, 0.1), "grande_stable": (0.001, 0.01, 0.3), "grande": (0.001, 0.01, 0.3)}
RENDIMENTO_CLASSE = {"stable": (0.001, 0.05), "grande_stable": (0.005, 0.2), "grande": (0.01, 0.3), "cauda": (0.01, 1.0)}


def _taxa_classe(fee: float, classe: str) -> float:
    if classe not in TAXA_CLASSE:
        return _taxa(fee)
    if fee <= 0:
        return TAXA_DESCONHECIDA
    zero, bom, ate = TAXA_CLASSE[classe]
    if fee <= zero:
        return 0.0
    if fee < bom:
        return (math.log10(fee) - math.log10(zero)) / (math.log10(bom) - math.log10(zero))
    if fee <= ate:
        return 1.0
    return max(0.5, 1.0 - 0.5 * (fee - ate) / (1.0 - ate))         # 1% -> 0,5


def _taxa(fee: float) -> float:
    """Fee tier em %. Régua em escala log até o ponto bom, depois cai no degen."""
    if fee <= 0:
        return TAXA_DESCONHECIDA
    if fee <= 0.001:
        return 0.0
    lg = math.log10(fee)
    if fee < 0.05:
        return 0.5 * (lg + 3) / (math.log10(0.05) + 3)                 # 0,001% -> 0 · 0,05% -> 0,5
    if fee < 0.25:
        return 0.5 + 0.5 * (lg - math.log10(0.05)) / math.log10(5)     # 0,05% -> 0,5 · 0,25% -> 1
    if fee <= 0.8:
        return 1.0                                                     # 0,25% a 0,8%: o ponto bom
    if fee <= 1:
        return 1.0 - 0.6 * (fee - 0.8) / 0.2                           # 1% -> 0,4
    return max(0.2, 0.4 - 0.2 * (fee - 1))                             # 2% ou mais -> 0,2


def taxa_inferida(c: Candidata) -> float:
    """Fee tier estimado quando a fonte não informa (fee 0): o APR de taxas
    da fonte é fee × razão × 365, então fee ≈ APR ÷ 365 ÷ razão. Sem APR ou
    sem giro, 0 — e _taxa devolve o valor neutro de taxa desconhecida.
    Antes a pool perdia até 21 pontos só por a fonte não informar."""
    r = razao(c)
    if c.fee > 0 or not c.apr or r <= 0 or c.dex in VE33:
        return 0.0
    return round(c.apr / 365 / r, 4)


def _rendimento(efic: float, classe: str = "cauda") -> float:
    if efic <= 0:
        return 0.0
    zero, cheio = RENDIMENTO_CLASSE.get(classe, RENDIMENTO_CLASSE["cauda"])   # cauda: 0,01%/dia -> 0 · 1%/dia -> 1
    return max(0.0, min(1.0, (math.log10(efic) - math.log10(zero)) / (math.log10(cheio) - math.log10(zero))))


def _giro(r: float) -> float:
    if r <= 0:
        return 0.0
    if r < 1:
        return 0.3 * r                                        # volume abaixo do TVL: capital parado
    if r < 3:
        return 0.3 + 0.2 * (r - 1)                            # 1× -> 0,3 · 3× -> 0,7
    return min(1.0, 0.7 + 0.3 * (r - 3) / 7)                  # 3× -> 0,7 · 10× -> 1


def _consistencia(ls: list[Leitura]) -> float:
    ult = sorted(ls, key=lambda x: x.dia)[-7:]
    razoes = [l.vol_24h / l.tvl for l in ult if l.tvl > 0]
    if len(razoes) < 3 or mean(razoes) == 0:
        return 0.5   # sem histórico suficiente: neutro
    cv = pstdev(razoes) / mean(razoes)
    return max(0.0, min(1.0, 1 - cv))


def _profundidade(tvl: float) -> float:
    if tvl <= 0:
        return 0.0
    return max(0.0, min(1.0, (math.log10(tvl) - 5) / 3))      # US$ 100 mil -> 0 · US$ 100 mi -> 1


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
    out: dict[str, tuple[float, dict]] = {}
    for c in cands:
        ls = leituras_por_pool.get(c.id, [])
        classe = classe_nota(c)
        comp = {
            "taxa": round(_taxa_classe(c.fee if c.fee > 0 else taxa_inferida(c), classe), 4),
            "rendimento": round(_rendimento(eficiencia_nota(c), classe), 4),
            "giro": round(_giro(razao(c)), 4),
            "consistencia": round(_consistencia(ls), 4),
            "profundidade": round(_profundidade(c.tvl), 4),
            "tendencia": round(_tendencia(ls), 4),
        }
        base = 100 * sum(PESOS[k] * v for k, v in comp.items())
        emissao = parte_emissao(c)
        comp["emissao"] = round(emissao, 4)
        if c.dex in VE33 and c.apr is None and c.apr_reward is None:
            comp["emissao_presumida"] = True
        out[c.id] = (round(base * (1 - PERDA_EMISSAO * emissao), 1), comp)
    return out
