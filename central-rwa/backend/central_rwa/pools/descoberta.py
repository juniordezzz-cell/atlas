"""Descoberta por contrato antes do corte; versão/taxa distinta não é duplicata.
Orçamento de 24 contratos x 1 página, com janela rotativa entre coletas.
Limitação: a API retorna top pools por contrato, não todo o universo on-chain."""
from datetime import datetime
import re

from . import config
from .fontes import normalizar_par, parse_gecko_pools
from .modelos import Candidata

MAX_CONTRATOS = 24
PRIORITARIOS = [('Base', '0xc3de830ea07524a0761646a6a4e4be0e114a3c83')]  # UNI: regressão do usuário
FAMILIAS = {'uniswap': 'Uniswap', 'pancakeswap': 'PancakeSwap', 'raydium': 'Raydium',
            'orca': 'Orca', 'meteora': 'Meteora', 'aerodrome': 'Aerodrome',
            'velodrome': 'Velodrome', 'thena': 'THENA', 'camelot': 'Camelot',
            'sushiswap': 'SushiSwap', 'curve': 'Curve', 'quickswap': 'QuickSwap',
            'traderjoe': 'LFJ', 'pharaoh': 'Pharaoh', 'cetus': 'Cetus',
            'hyperswap': 'HyperSwap', 'ramses': 'Ramses'}


def _dex(slug):
    return next((name for prefix, name in FAMILIAS.items() if slug.startswith(prefix)), None)


def _par(c):
    return sorted(normalizar_par(c.par).split('/'))


def _mesma(c, g):
    def contratos(p):
        ends = [p.token_a.endereco, p.token_b.endereco]
        if not all(ends):
            return None
        return set(ends if p.rede in {'Solana', 'Sui'} else [e.lower() for e in ends])
    # Símbolo não é identidade: sem dois contratos conhecidos não inferir fusão.
    if contratos(c) is None or contratos(c) != contratos(g):
        return False
    known = c.sinais.get('endereco_pool') or (c.sinais.get('conferencia') or {}).get('endereco')
    if known and known != g.sinais.get('endereco_pool'):
        return False
    ver = re.search(r'\bv[234]\b', c.projeto.replace('-', ' '))
    return (c.rede == g.rede and c.dex == g.dex and _par(c) == _par(g)
            and abs(c.fee-g.fee) < 1e-8 and c.tvl > 0
            and abs(c.tvl-g.tvl)/c.tvl <= .15
            and (not ver or re.search(r'\b' + ver.group() + r'\b', g.projeto.replace('-', ' '))))


def complementar(cli, todas: list[Candidata], agora: datetime):
    resumo = {'contratos': 0, 'adicionadas': 0, 'pendentes': 0}
    if not hasattr(cli, 'token_pools'):
        return todas, resumo
    pesos = {}
    for c in todas:
        for t in (c.token_a, c.token_b):
            if not t.endereco or t.simbolo.upper() in config.MAJORS:
                continue
            e = t.endereco if c.rede in {'Solana', 'Sui'} else t.endereco.lower()
            k = (c.rede, e)
            pesos[k] = max(pesos.get(k, 0), c.tvl)
    seeds = [k for k in sorted(pesos, key=lambda k: (-pesos[k], k)) if k not in PRIORITARIOS]
    count = MAX_CONTRATOS-len(PRIORITARIOS)
    if seeds:
        offset = (int(agora.timestamp()) // (4*3600) * count) % len(seeds)
        seeds = (seeds[offset:]+seeds[:offset])[:count]
    selecionados = PRIORITARIOS + seeds
    resumo['pendentes'] = len(set(pesos)-set(selecionados))
    resultado = list(todas)
    vistos = {c.id for c in resultado}
    for rede, endereco in selecionados:
        net = config.GECKO_NET.get(rede)
        if not net:
            continue
        itens = cli.token_pools(net, endereco, paginas=1)
        resumo['contratos'] += 1
        for item in itens:
            slug = (((item.get('relationships') or {}).get('dex') or {}).get('data') or {}).get('id', '')
            dex = _dex(slug)
            if not dex:
                continue
            for g in parse_gecko_pools({'data': [item]}, dex, rede, slug):
                if g.id in vistos:
                    continue
                g.sinais['endereco_pool'] = g.id.split(':', 2)[2]
                # Só fundir correspondência única da DefiLlama; nunca fundir hooks
                # ou endereços Gecko distintos por semelhança de TVL/par.
                matches = [c for c in todas if c.fonte == 'defillama' and _mesma(c, g)]
                if len(matches) == 1 and not matches[0].sinais.get('endereco_pool'):
                    c = matches[0]
                    c.sinais['endereco_pool'] = g.sinais['endereco_pool']
                    c.sinais['descoberta'] = {'fonte': 'geckoterminal', 'id': g.id}
                    vistos.add(g.id)
                    continue
                if len(matches) == 1 and matches[0].sinais.get('endereco_pool') == g.sinais['endereco_pool']:
                    vistos.add(g.id)
                    continue
                resultado.append(g)
                vistos.add(g.id)
                resumo['adicionadas'] += 1
    return resultado, resumo
