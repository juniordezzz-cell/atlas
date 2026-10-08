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
    assert trilho(cand("WETH/USDT"), [None, None], [], AGORA) == ("solida", [])
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
    assert classe_par(cand("WETH/USDT")) == "grande_stable"
    assert classe_par(cand("NVDAx/USDC")) == "grande_stable"     # RWA com stable
    assert classe_par(cand("WBTC/WETH")) == "grande"
    assert classe_par(cand("WBNB/USDT")) == "cauda"              # BNB é altcoin (07/10)
    assert classe_par(cand("FOO/USDT")) == "cauda"
    # cauda longa precisa de 0,5%/dia
    baixa = cand("FOO/USDT", fee=0.25, tvl=500_000, vol=600_000)          # 0,25 × 1,2 = 0,30%/dia
    t, m = trilho(baixa, [info(), None], [], AGORA)
    assert t == "caca" and "abaixo do mínimo de 0.5%/dia para par com altcoin ou meme" in m[0]
    # a mesma eficiência basta para grande/stable (mínimo 0,05%/dia)
    assert trilho(cand("WETH/USDT", fee=0.25, vol=600_000), [None, None], [], AGORA) == ("solida", [])
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


def test_categoria_de_cada_token():
    from central_rwa.pools.classificacao import categoria_token, categorias
    assert categoria_token("USDC") == "stable"
    for t in ("WBTC", "cbBTC", "WETH", "SOL", "JitoSOL"):
        assert categoria_token(t) == "bluechip", t
    for t in ("WBNB", "AVAX", "SUI", "NEAR", "AERO", "GMX", "LCX", "MYX", "SAVAX", "wXIAOx"):
        assert categoria_token(t) == "altcoin", t
    for t in ("NVDAx", "GOOGLX", "SPCXx", "SPCX", "wTCENTx", "GLDx", "XAUt", "PAXG", "SP500", "NFLX", "RBLX"):
        assert categoria_token(t) == "rwa", t
    assert categoria_token("META") == "altcoin"                    # cripto homônima fora da Robinhood
    assert categoria_token("META", "Robinhood") == "rwa"
    assert categoria_token("SPY", "Robinhood") == "rwa"
    c = cand("FOO/USDT"); c.sinais["memecoin"] = {"detectada": True, "ids": ["foo"]}
    assert categorias(c, [info(cg="foo"), None]) == ["meme", "stable"]


def test_taxa_nao_informada_e_estimada_pelo_apr():
    from central_rwa.pools.nota import calcular_notas, taxa_inferida
    c = cand("WETH/USDT", fee=0, vol=1_000_000, apr=182.5)        # razão 2 → fee ≈ 182,5/365/2 = 0,25%
    assert taxa_inferida(c) == 0.25
    sem = cand("WETH/USDT", fee=0, vol=1_000_000)
    assert calcular_notas([c], {})[c.id][1]["taxa"] == 1.0           # 0,25% é o ponto bom
    assert calcular_notas([sem], {})[sem.id][1]["taxa"] == 0.3       # sem APR: neutro, como antes


def test_emissor_do_rwa_pelo_id_coingecko():
    from central_rwa.pools import config
    # os 6 SpaceX conferidos em 08/10/2026
    casos = {"spacex-xstocks": "xStocks", "spacex-backpack-securities": "Backpack",
             "spacex-bstocks-tokenized-stock": "Binance bStocks", "spacex-ondo-tokenized-stock": "Ondo",
             "spacex-coinbase-tokenized-stock": "Coinbase", "spacex-robinhood-tokenized-stock": "Robinhood"}
    for cg, nome in casos.items():
        assert config.emissor("SPCX", cg) == {"nome": nome, "provavel": False}, cg
    # sem cadastro: o sufixo dá o provável
    assert config.emissor("TSLAON", None) == {"nome": "Ondo", "provavel": True}
    assert config.emissor("NVDAx", None) == {"nome": "xStocks", "provavel": True}
    assert config.emissor("SPCX", None, "Robinhood") == {"nome": "Robinhood", "provavel": True}
    assert config.emissor("FOO", None) is None
    # sufixos novos também contam como RWA, sem pegar ticker ambíguo
    assert config.eh_rwa("SPCXON") and config.eh_rwa("SPCXB") and config.eh_rwa("SPCXC")
    assert not config.eh_rwa("MAC") and not config.eh_rwa("VB")


def test_rwa_controlado_pelo_emissor_nao_e_barrado():
    # 08/10/2026: xStocks na Solana têm mint/freeze do emissor — não é golpe
    x = info(simbolo="SPCXx", mint=True, freeze=True, dev=60.0, cg="spacex-xstocks")
    assert motivos_barrada(cand("SPCXx/USDC"), [x, None], []) == []
    assert "honeypot" in motivos_barrada(cand("SPCXx/USDC"), [info(simbolo="SPCXx", honeypot=True), None], [])
    # token comum com mint ativo continua barrado
    assert "mint ativo" in motivos_barrada(cand(), [info(mint=True), None], [])


def test_contrato_reconhecido_vale_pelo_endereco_nao_pelo_nome():
    from central_rwa.pools.classificacao import fraqueza_token
    wnear = TokenInfo(rede="Solana", endereco="3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG", simbolo="NEAR",
                      honeypot=False, mint_ativo=False, freeze_ativo=False, dev_pct=None, holders=17409,
                      coingecko_id=None, mcap=None, primeira_pool_em=None, consultado_em=AGORA)
    assert fraqueza_token("NEAR", wnear, AGORA, "Solana") is None
    copia = TokenInfo(rede="Solana", endereco="FaKeNEAR111", simbolo="NEAR",
                      honeypot=False, mint_ativo=False, freeze_ativo=False, dev_pct=None, holders=50,
                      coingecko_id=None, mcap=None, primeira_pool_em=None, consultado_em=AGORA)
    assert "sem cadastro na CoinGecko" in fraqueza_token("NEAR", copia, AGORA, "Solana")
