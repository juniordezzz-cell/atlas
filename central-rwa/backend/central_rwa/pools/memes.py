"""Meme exige evidência por ID associado ao contrato, nunca substring do símbolo.
A categoria CoinGecko é incompleta; sem identificação significa desconhecido."""

from .modelos import Candidata, TokenInfo

# Reserva conservadora de IDs canônicos conhecidos; API amplia esta lista.
# Não usar símbolos: PEPE/UNI falsos podem compartilhar o mesmo nome.
CONHECIDOS = {'dogecoin', 'shiba-inu', 'pepe', 'bonk', 'floki', 'dogwifcoin',
              'brett', 'based-brett', 'popcat', 'book-of-meme', 'mog-coin',
              'official-trump', 'fartcoin', 'dogelon-mars'}


def identificar(c: Candidata, infos: list[TokenInfo | None], meme_ids: set[str],
                cobertura_ate: str | None = None) -> None:
    """`cobertura_ate`: último ID da categoria lido quando a lista veio
    incompleta (ordem alfabética). ID depois dele não foi conferido: a pool
    fica "nao_verificada" e não entra nas Sólidas por falta de dado."""
    ids = {i.coingecko_id for i in infos if i and i.coingecko_id}
    detectados = sorted(ids & (meme_ids | CONHECIDOS))
    if detectados:
        estado = 'detectada'
    elif not ids:
        estado = 'sem_identificacao'
    elif cobertura_ate is not None and any(i > cobertura_ate for i in ids):
        estado = 'nao_verificada'
    else:
        estado = 'nao_detectada'
    c.sinais['memecoin'] = {
        'detectada': bool(detectados), 'ids': detectados,
        'fonte': 'coingecko:meme-token',
        'estado': estado,
    }
