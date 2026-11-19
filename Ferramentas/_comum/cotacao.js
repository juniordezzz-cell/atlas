/* ATLAS · Ferramentas/_comum/cotacao.js
   Cotação em várias fontes, igual em toda a bancada (19/11/2026).
   A CoinGecko gratuita limita requisições e deixava as telas sem preço:
   ela passou a ser só a segunda opção em tudo.

       dólar em reais ... Coinbase → CoinGecko
       preço do token ... Coinbase (só a lista conferida) → DefiLlama
                          (CoinPaprika, se o token veio da busca dela) → CoinGecko
       busca de token ... CoinPaprika → CoinGecko
       BTC/ETH 24h ...... Binance → CoinGecko
       série diária ..... DefiLlama → CoinGecko (quem já usa a Binance
                          continua com ela na frente)

   Todas públicas e sem chave. Rede só pelo AtlasHttp; a leitura das
   respostas mora em calculos.js, com testes. Cada função devolve
   Promise<{ valor, fonte }> e rejeita só quando NENHUMA fonte respondeu:
   aí a página mostra o aviso dela, sem "carregando" eterno.

   Precisa de ../../core/http.js e ./calculos.js antes deste arquivo. */
(function () {
  'use strict';
  var C = window.AtlasCalculos;
  var COINBASE = 'https://api.coinbase.com/v2';
  var LLAMA = 'https://coins.llama.fi';
  var PAPRIKA = 'https://api.coinpaprika.com/v1';
  var BINANCE = 'https://data-api.binance.vision/api/v3';
  var GECKO = 'https://api.coingecko.com/api/v3';

  function get(url, ttl, timeout) {
    return AtlasHttp.getJSON(url, { ttl: ttl, timeout: timeout || 8000, retries: 1 });
  }
  function tentativa(fonte, url, ttl, ler) {
    return { fonte: fonte, buscar: function () { return get(url, ttl).then(ler); } };
  }

  /* ── dólar em reais ── */
  function dolarEmReais() {
    return C.tentarEmOrdem([
      tentativa('Coinbase', COINBASE + '/exchange-rates?currency=USD', 600000, C.dolarEmReaisDeCoinbase),
      tentativa('CoinGecko', GECKO + '/simple/price?ids=tether&vs_currencies=brl,usd', 600000, C.dolarEmReaisDeCoingecko)
    ]);
  }

  /* ── busca ── */
  function buscar(q) {
    q = String(q || '').trim();
    if (q.length < 2) return Promise.resolve({ valor: [], fonte: '' });
    return C.tentarEmOrdem([
      tentativa('CoinPaprika', PAPRIKA + '/search?q=' + encodeURIComponent(q) + '&c=currencies&limit=10', 3600000, C.buscaDeCoinpaprika),
      tentativa('CoinGecko', GECKO + '/search?query=' + encodeURIComponent(q), 300000, C.buscaDeCoingecko)
    ]);
  }

  /* ── id da CoinGecko de um token (para DefiLlama e CoinGecko) ──
     Token da CoinPaprika fora da lista conferida: procura o par exato
     (símbolo + nome) na busca da CoinGecko. Só roda quando as outras
     fontes já falharam, e guarda o resultado na memória da página. */
  var idsAchados = {};
  function idCoingecko(token) {
    var conhecido = C.idCoingeckoConhecido(token);
    if (conhecido) return Promise.resolve(conhecido);
    if (!token || !token.id) return Promise.resolve(null);
    if (idsAchados[token.id] !== undefined) return Promise.resolve(idsAchados[token.id]);
    var termo = token.nome || token.sym || '';
    if (!termo) return Promise.resolve(null);
    return get(GECKO + '/search?query=' + encodeURIComponent(termo), 300000).then(function (d) {
      return (idsAchados[token.id] = C.idCoingeckoDaBusca(d, token.sym, token.nome));
    }, function () { return null; });
  }

  /* ── preço em US$ ──
     token = { id, fonte, sym, nome }, ou só o id da CoinGecko (texto). */
  function normalizar(token) {
    if (typeof token === 'string') return { id: token, fonte: 'coingecko' };
    return token || {};
  }
  function preco(token) {
    token = normalizar(token);
    var sym = C.simboloCoinbase(token);
    var daPaprika = token.fonte === 'coinpaprika';
    var cgDireto = C.idCoingeckoConhecido(token);
    return C.tentarEmOrdem([
      sym && tentativa('Coinbase', COINBASE + '/exchange-rates?currency=' + sym, 30000, C.precoDeCoinbase),
      daPaprika
        ? tentativa('CoinPaprika', PAPRIKA + '/tickers/' + encodeURIComponent(token.id), 60000, C.precoDeCoinpaprika)
        : cgDireto && tentativa('DefiLlama', LLAMA + '/prices/current/coingecko:' + encodeURIComponent(cgDireto), 60000,
            function (d) { return C.precoDeDefiLlama(d, cgDireto); }),
      { fonte: 'CoinGecko', buscar: function () {
        return idCoingecko(token).then(function (id) {
          if (!id) return null;
          return get(GECKO + '/simple/price?ids=' + encodeURIComponent(id) + '&vs_currencies=usd', 60000)
            .then(function (d) { return C.precoDeCoingecko(d, id); });
        });
      } }
    ]);
  }

  /* ── BTC/ETH com 24h ── idCg = 'bitcoin', sym = 'BTC' */
  function ticker24h(sym, idCg) {
    return C.tentarEmOrdem([
      tentativa('Binance', BINANCE + '/ticker/24hr?symbol=' + encodeURIComponent(sym + 'USDT'), 60000, C.tickerDeBinance),
      tentativa('CoinGecko', GECKO + '/simple/price?ids=' + encodeURIComponent(idCg) + '&vs_currencies=usd&include_24hr_change=true', 60000,
        function (d) { return C.tickerDeCoingecko(d, idCg); })
    ]);
  }

  /* ── série diária de 1 ano em US$ ── devolve [{ t, v }] */
  function serieAnual(idCg) {
    var inicio = Math.floor(Date.now() / 1000) - 365 * 86400;
    return C.tentarEmOrdem([
      { fonte: 'DefiLlama', buscar: function () {
        return AtlasHttp.getJSON(LLAMA + '/chart/coingecko:' + encodeURIComponent(idCg) + '?start=' + inicio + '&span=366&period=1d',
          { ttl: 0, timeout: 15000, retries: 1 }).then(function (d) { return C.serieDeDefiLlama(d, idCg, 30); });
      } },
      { fonte: 'CoinGecko', buscar: function () {
        return AtlasHttp.getJSON(GECKO + '/coins/' + encodeURIComponent(idCg) + '/market_chart?vs_currency=usd&days=365',
          { ttl: 0, timeout: 15000, retries: 1 }).then(function (d) { return C.serieDeCoingecko(d, 2); });
      } }
    ]);
  }

  window.AtlasCotacao = {
    dolarEmReais: dolarEmReais, buscar: buscar, preco: preco,
    idCoingecko: idCoingecko, ticker24h: ticker24h, serieAnual: serieAnual
  };
})();
