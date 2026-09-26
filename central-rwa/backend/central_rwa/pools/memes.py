"""Meme exige evidência por ID associado ao contrato, nunca substring do símbolo.
A categoria CoinGecko é incompleta; sem identificação significa desconhecido."""

from .modelos import Candidata, TokenInfo

# Reserva conservadora de IDs canônicos conhecidos; API amplia esta lista.
# Não usar símbolos: PEPE/UNI falsos podem compartilhar o mesmo nome.
CONHECIDOS = {'dogecoin', 'shiba-inu', 'pepe', 'bonk', 'floki', 'dogwifcoin',
              'brett', 'based-brett', 'popcat', 'book-of-meme', 'mog-coin',
              'official-trump', 'fartcoin', 'dogelon-mars'}


def identificar(c: Candidata, infos: list[TokenInfo | None], meme_ids: set[str]) -> None:
    ids = {i.coingecko_id for i in infos if i and i.coingecko_id}
    detectados = sorted(ids & (meme_ids | CONHECIDOS))
    c.sinais['memecoin'] = {
        'detectada': bool(detectados), 'ids': detectados,
        'fonte': 'coingecko:meme-token',
        'estado': 'detectada' if detectados else ('nao_detectada' if ids else 'sem_identificacao'),
    }
