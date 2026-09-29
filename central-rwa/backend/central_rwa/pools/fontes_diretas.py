"""Pools das APIs públicas das DEXs; IDs usam o endereço on-chain.

O prefixo gecko preserva as decisões por pool quando a mesma pool também
aparece na GeckoTerminal. Ausência de volume permanece zero para o pré-corte.
"""
from __future__ import annotations

from math import isfinite

from .modelos import Candidata, TokenRef


def _number(value) -> float:
    try:
        number = float(value)
        return number if isfinite(number) and number >= 0 else 0.0
    except (TypeError, ValueError):
        return 0.0


def _candidate(row, *, dex: str, address: str, a: dict, b: dict,
               tvl, volume, weekly, fee, apr, project: str):
    if not address or not a.get('address') or not b.get('address') or not a.get('symbol') or not b.get('symbol'):
        return None
    tvl = _number(tvl)
    volume = _number(volume)
    fee = _number(fee)
    return Candidata(
        id=f'gecko:solana:{address}', fonte=dex.lower(), rede='Solana', dex=dex,
        par=f"{a['symbol'].replace('WSOL', 'SOL')}/{b['symbol'].replace('WSOL', 'SOL')}",
        token_a=TokenRef(a['address'], a['symbol']), token_b=TokenRef(b['address'], b['symbol']),
        fee=fee, tvl=tvl, vol_24h=volume, vol_7d=_number(weekly) if weekly is not None else None,
        apr=_number(apr) if apr is not None else None, apr_reward=None, projeto=project,
        sinais={'endereco_pool': address, 'fonte_direta': dex},
    )


def parse_orca(rows: list[dict]) -> list[Candidata]:
    pools = []
    for row in rows:
        stats = row.get('stats') or {}
        day = stats.get('24h') or {}
        week = stats.get('7d') or {}
        # Orca informa feeRate em centésimos de basis point: 400 = 0,04%.
        pool = _candidate(row, dex='Orca', address=row.get('address'),
                          a=row.get('tokenA') or {}, b=row.get('tokenB') or {},
                          tvl=row.get('tvlUsdc'), volume=day.get('volume'), weekly=week.get('volume'),
                          fee=_number(row.get('feeRate')) / 10000, apr=None, project='orca-whirlpool')
        if pool:
            pools.append(pool)
    return pools


def parse_raydium(rows: list[dict]) -> list[Candidata]:
    pools = []
    for row in rows:
        day = row.get('day') or {}
        week = row.get('week') or {}
        # Raydium expressa feeRate como fração: 0,0025 = 0,25%.
        pool = _candidate(row, dex='Raydium', address=row.get('id'),
                          a=row.get('mintA') or {}, b=row.get('mintB') or {},
                          tvl=row.get('tvl'), volume=day.get('volume'), weekly=week.get('volume'),
                          fee=_number(row.get('feeRate')) * 100, apr=day.get('feeApr'),
                          project='raydium-clmm' if row.get('type') == 'Concentrated' else 'raydium-amm')
        if pool:
            pools.append(pool)
    return pools
