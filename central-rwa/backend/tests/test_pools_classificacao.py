from datetime import date, datetime, timedelta, timezone

from central_rwa.pools.classificacao import motivos_barrada, passa_pre_corte, token_solido, trilho
from central_rwa.pools.modelos import Candidata, Leitura, TokenInfo, TokenRef

AGORA = datetime(2026, 9, 23, 22, tzinfo=timezone.utc)


def cand(par="FOO/USDT", fee=0.25, tvl=500_000, vol=600_000, apr=None, reward=None):
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
    assert token_solido("FOO", info(dias=None), AGORA)           # idade desconhecida: vale CoinGecko + mcap (07/10)
    assert not token_solido("FOO", info(mcap=5e6), AGORA)
    assert not token_solido("FOO", info(holders=500), AGORA)
    assert not token_solido("FOO", info(cg=None), AGORA)


def test_trilho():
    assert trilho(cand("WBNB/USDT"), [None, None], [], AGORA) == ("solida", [])
    t, m = trilho(cand("FOO/USDT"), [info(dias=5), None], [], AGORA)
    assert t == "caca" and "token fraco" in m[0] and "menos de 30 dias" in m[0]   # token novo vai para Pendentes
    assert trilho(cand("FOO/USDT", vol=1_500_000), [info(), None], [], AGORA) == ("solida", [])   # 0,75%/dia
    assert trilho(cand("FOO/USDT"), [info(honeypot=True), None], [], AGORA)[0] == "barrada"


def test_token_fraco_vai_para_pendentes_com_motivo():
    t, m = trilho(cand("FOO/USDT"), [None, None], [], AGORA)
    assert t == "caca" and "FOO ainda sem dados" in m[0]
    t, m = trilho(cand("FOO/USDT"), [info(cg=None), None], [], AGORA)
    assert t == "caca" and "sem cadastro na CoinGecko" in m[0]
    assert trilho(cand("FOO/USDT", vol=1_500_000), [info(holders=None), None], [], AGORA)[0] == "solida"   # holders não informado não reprova


def test_rendimento_minimo_pela_classe_do_par():
    from central_rwa.pools.classificacao import classe_par
    assert classe_par(cand("USDC/USDT")) == "stable"
    assert classe_par(cand("WBNB/USDT")) == "grande_stable"
    assert classe_par(cand("WBNB/WETH")) == "grande"
    assert classe_par(cand("FOO/USDT")) == "cauda"
    # cauda longa precisa de 0,5%/dia
    baixa = cand("FOO/USDT", fee=0.25, tvl=500_000, vol=600_000)          # 0,25 × 1,2 = 0,30%/dia
    t, m = trilho(baixa, [info(), None], [], AGORA)
    assert t == "caca" and "abaixo do mínimo de 0.5%/dia para cauda longa" in m[0]
    # a mesma eficiência basta para grande/stable (mínimo 0,05%/dia)
    assert trilho(cand("WBNB/USDT", fee=0.25, vol=600_000), [None, None], [], AGORA) == ("solida", [])
    # stable/stable com 0,01% × 1,2 = 0,012%/dia passa; 0,005% × 1,2 não
    assert trilho(cand("USDC/USDT", fee=0.01, vol=600_000), [None, None], [], AGORA)[0] == "solida"
    assert trilho(cand("USDC/USDT", fee=0.005, vol=600_000), [None, None], [], AGORA)[0] == "caca"


def test_volume_suspeito_em_pool_nova():
    c = cand("WBNB/USDT", vol=12_000_000)                    # razão 24
    c.criada_em = AGORA - timedelta(days=5)
    t, m = trilho(c, [None, None], [], AGORA)
    assert t == "caca" and "volume suspeito" in m[0]
    c.criada_em = AGORA - timedelta(days=60)                 # pool antiga com giro alto: segue
    assert trilho(c, [None, None], [], AGORA)[0] == "solida"
