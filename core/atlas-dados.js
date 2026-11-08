/* ============================================================
   ATLAS · core/atlas-dados.js
   Roteador de dados: o único caminho das ferramentas até as APIs.
   Mapa das fontes e da ordem de cada cadeia: docs/apis/roteamento.md
   Testes: node --test core/testes/atlas-dados.test.cjs

   Duas camadas.
   - Baixo: pedir(fonte, url) — fila por fonte (intervalo mínimo entre
     pedidos), disjuntor (fonte que deu 429 ou caiu fica pausada por
     alguns minutos, combinado entre as abas pelo localStorage), pedido
     igual simultâneo vira um só. A rede em si é o AtlasHttp.
   - Cima: um método por tipo de dado (precos, buscar, ficha, velas,
     historico, cambio, serieBcb, pools). Cada um tenta as fontes na
     ordem combinada e guarda o último dado bom, com a hora, para quando
     tudo falhar. A CoinGecko vem por último em tudo que outra fonte
     entrega.

   Depende de: core/http.js (AtlasHttp). Opcional: core/dados/tokens-top.js
   (catálogo local dos maiores tokens, usado na busca sem rede).
   Exposto em: window.AtlasDados. No Node: require(...).criar(opts).
   ============================================================ */
(function (raiz) {
  'use strict';

  var FONTES = {
    defillama:     { nome: 'DefiLlama',      intervalo: 150 },
    binance:       { nome: 'Binance',        intervalo: 60 },
    coinpaprika:   { nome: 'CoinPaprika',    intervalo: 400 },
    coinlore:      { nome: 'CoinLore',       intervalo: 1000 },
    coingecko:     { nome: 'CoinGecko',      intervalo: 6000 },
    geckoterminal: { nome: 'GeckoTerminal',  intervalo: 2500 },
    erapi:         { nome: 'open.er-api',    intervalo: 1000 },
    bcb:           { nome: 'Banco Central',  intervalo: 200 }
  };
  var PAUSA_LIMITE = 3 * 60 * 1000;   // depois de um 429
  var PAUSA_QUEDA = 60 * 1000;        // depois de rede fora / erro 5xx
  var CHAVE_ULTIMO = 'atlas.dados.ultimo.v1';
  var MAX_ULTIMOS = 400;
  var LL = 'https://coins.llama.fi';
  var BN = 'https://data-api.binance.vision/api/v3';
  var CP = 'https://api.coinpaprika.com/v1';
  var CG = 'https://api.coingecko.com/api/v3';
  var IMG_CG = 'https://coin-images.coingecko.com/coins/images/';
  var STABLES = { USDT: 1, USDC: 1, DAI: 1, FDUSD: 1, USDE: 1, PYUSD: 1, TUSD: 1, BUSD: 1 };
  var MS = { '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5 };

  function criar(o) {
    o = o || {};
    var agora = o.agora || function () { return Date.now(); };
    var http = function () { return o.http || raiz.AtlasHttp; };
    var arm = o.armazenamento || null;
    var catalogo = function () { return o.catalogo || raiz.ATLAS_TOKENS_TOP || { lista: [] }; };
    var emVoo = {}, filas = {}, ultimoInicio = {}, memoria = {};

    function intervaloDe(fonte) {
      if (o.intervalos && fonte in o.intervalos) return o.intervalos[fonte];
      if (o.intervalos) return 0;
      return (FONTES[fonte] && FONTES[fonte].intervalo) || 0;
    }
    function ler(k) { try { return arm ? arm.getItem(k) : null; } catch (e) { return null; } }
    function gravar(k, v) { try { if (arm) arm.setItem(k, v); } catch (e) { /* cheio ou bloqueado */ } }
    function nomeDe(fonte) { return (FONTES[fonte] && FONTES[fonte].nome) || fonte; }

    /* ---------- disjuntor ---------- */
    function pausadaAte(fonte) { var v = +ler('atlas.dados.pausa.' + fonte); return isFinite(v) ? v : 0; }
    function pausar(fonte, ms) { gravar('atlas.dados.pausa.' + fonte, String(agora() + ms)); }

    /* ---------- camada de baixo ---------- */
    function pedir(fonte, url, op) {
      op = op || {};
      if (agora() < pausadaAte(fonte)) {
        var p = new Error(nomeDe(fonte) + ' em pausa por limite de uso.');
        p.pausada = true; p.fonte = fonte;
        return Promise.reject(p);
      }
      if (emVoo[url]) return emVoo[url];
      var anterior = filas[fonte] || Promise.resolve();
      var vez = anterior.then(function () {
        var espera = Math.max(0, (ultimoInicio[fonte] || 0) + intervaloDe(fonte) - agora());
        return espera > 0 ? new Promise(function (r) { setTimeout(r, espera); }) : null;
      });
      filas[fonte] = vez.catch(function () {});
      var promessa = vez.then(function () {
        ultimoInicio[fonte] = agora();
        return http().getJSON(url, { ttl: op.ttl || 0, timeout: op.timeout || 10000, retries: 0 });
      }).then(function (d) {
        delete emVoo[url];
        return d;
      }, function (e) {
        delete emVoo[url];
        var st = (e && e.status) || 0;
        if (st === 429) pausar(fonte, PAUSA_LIMITE);
        else if (st === 0 || st >= 500) pausar(fonte, PAUSA_QUEDA);
        if (e) e.fonte = fonte;
        throw e;
      });
      emVoo[url] = promessa;
      return promessa;
    }

    /* resposta grande reaproveitada em memória por alguns minutos */
    function guardado(chave, ms, fn) {
      var h = memoria[chave];
      if (h && agora() - h.t < ms) return Promise.resolve(h.v);
      return fn().then(function (v) { memoria[chave] = { t: agora(), v: v }; return v; });
    }

    /* ---------- último dado bom ---------- */
    function ultimos() { try { return JSON.parse(ler(CHAVE_ULTIMO) || '{}') || {}; } catch (e) { return {}; } }
    function lembrar(chave, valor, fonte) {
      var tudo = ultimos();
      tudo[chave] = { v: valor, t: agora(), f: fonte };
      var ks = Object.keys(tudo);
      if (ks.length > MAX_ULTIMOS) {
        ks.sort(function (a, b) { return tudo[a].t - tudo[b].t; })
          .slice(0, ks.length - MAX_ULTIMOS).forEach(function (k) { delete tudo[k]; });
      }
      gravar(CHAVE_ULTIMO, JSON.stringify(tudo));
    }
    function lembrado(chave) { return ultimos()[chave] || null; }

    /* tenta as etapas na ordem; cada etapa devolve valor ou rejeita/null */
    function cadeia(etapas) {
      var i = 0, ultimoErro = null;
      function prox() {
        if (i >= etapas.length) return Promise.reject(ultimoErro || new Error('Nenhuma fonte respondeu.'));
        var etapa = etapas[i++];
        return Promise.resolve().then(etapa).then(function (v) {
          return v == null ? prox() : v;
        }, function (e) { ultimoErro = e; return prox(); });
      }
      return prox();
    }

    var symOk = function (s) { return /^[A-Z0-9]{2,15}$/.test(String(s || '')); };
    var num = function (v) { var n = Number(v); return isFinite(n) ? n : null; };

    /* lista de 250 da CoinPaprika, usada por preço e ficha (2 min em memória) */
    function tickersPaprika() {
      return guardado('cp.tickers', 120000, function () { return pedir('coinpaprika', CP + '/tickers?limit=250'); });
    }
    function paprikaPorSimbolo(lista, sym) {
      var achados = (lista || []).filter(function (t) { return String(t.symbol).toUpperCase() === sym; });
      achados.sort(function (a, b) { return (a.rank || 1e9) - (b.rank || 1e9); });
      return achados[0] || null;
    }

    /* ---------- preço atual ---------- */
    function precos(itens) {
      itens = (itens || []).filter(function (x) { return x && x.id; });
      var r = { precos: {}, fontes: {}, salvos: [], quando: {} };
      var faltam = function () { return itens.filter(function (x) { return r.precos[x.id] == null; }); };
      function marcar(id, usd, fonte) {
        if (!(usd > 0)) return;
        r.precos[id] = usd; r.fontes[id] = fonte; r.quando[id] = agora();
        lembrar('preco:' + id, usd, fonte);
      }
      var cg = function (x) { return x.id.indexOf('pk:') !== 0; };
      function etapaLlama() {
        var ids = faltam().filter(cg).map(function (x) { return x.id; });
        var lotes = [];
        for (var k = 0; k < ids.length; k += 100) lotes.push(ids.slice(k, k + 100));
        return Promise.all(lotes.map(function (lote) {
          var u = LL + '/prices/current/' + lote.map(function (i) { return 'coingecko:' + encodeURIComponent(i); }).join(',');
          return pedir('defillama', u).then(function (d) {
            Object.keys((d && d.coins) || {}).forEach(function (k) {
              var c = d.coins[k];
              if (c.confidence != null && c.confidence < 0.9) return;
              marcar(decodeURIComponent(k.slice(10)), num(c.price), 'DefiLlama');
            });
          }, function () {});
        }));
      }
      function etapaBinance() {
        var lista = faltam().filter(function (x) { var s = String(x.sym || '').toUpperCase(); return symOk(s) && !STABLES[s]; }).slice(0, 20);
        return Promise.all(lista.map(function (x) {
          var s = String(x.sym).toUpperCase() + 'USDT';
          return pedir('binance', BN + '/ticker/price?symbol=' + s).then(function (d) {
            var t = Array.isArray(d) ? d.filter(function (y) { return y.symbol === s; })[0] : d;
            if (t) marcar(x.id, num(t.price), 'Binance');
          }, function () {});
        }));
      }
      function etapaPaprika() {
        var lista = faltam();
        if (!lista.length) return null;
        var diretos = lista.filter(function (x) { return !cg(x); });
        var outros = lista.filter(cg);
        return Promise.all([
          outros.length ? tickersPaprika().then(function (ts) {
            outros.forEach(function (x) {
              var t = paprikaPorSimbolo(ts, String(x.sym || '').toUpperCase());
              if (t && t.quotes && t.quotes.USD) marcar(x.id, num(t.quotes.USD.price), 'CoinPaprika');
            });
          }, function () {}) : null
        ].concat(diretos.map(function (x) {
          return pedir('coinpaprika', CP + '/tickers/' + encodeURIComponent(x.id.slice(3))).then(function (t) {
            if (t && t.quotes && t.quotes.USD) marcar(x.id, num(t.quotes.USD.price), 'CoinPaprika');
          }, function () {});
        })));
      }
      function etapaGecko() {
        var ids = faltam().filter(cg).map(function (x) { return x.id; });
        if (!ids.length) return null;
        return pedir('coingecko', CG + '/simple/price?ids=' + ids.map(encodeURIComponent).join(',') + '&vs_currencies=usd').then(function (d) {
          ids.forEach(function (id) { if (d && d[id]) marcar(id, num(d[id].usd), 'CoinGecko'); });
        }, function () {});
      }
      var etapas = [etapaLlama, etapaBinance, etapaPaprika, etapaGecko];
      var seq = Promise.resolve();
      etapas.forEach(function (e) { seq = seq.then(function () { return faltam().length ? e() : null; }); });
      return seq.then(function () {
        faltam().forEach(function (x) {
          var u = lembrado('preco:' + x.id);
          if (u) { r.precos[x.id] = u.v; r.fontes[x.id] = u.f; r.quando[x.id] = u.t; r.salvos.push(x.id); }
        });
        return r;
      });
    }
    function preco(id, sym) {
      return precos([{ id: id, sym: sym }]).then(function (r) {
        if (r.precos[id] == null) return null;
        return { usd: r.precos[id], fonte: r.fontes[id], quando: r.quando[id], salvo: r.salvos.indexOf(id) !== -1 };
      });
    }

    /* ---------- busca de token ---------- */
    function buscar(q) {
      q = String(q || '').trim();
      if (q.length < 2) return Promise.resolve([]);
      var ql = q.toLowerCase(), qu = q.toUpperCase();
      var locais = (catalogo().lista || []).filter(function (c) {
        return String(c[1]).toUpperCase().indexOf(qu) === 0 || String(c[2]).toLowerCase().indexOf(ql) !== -1 || c[0].indexOf(ql) === 0;
      }).sort(function (a, b) {
        var ea = String(a[1]).toUpperCase() === qu ? 0 : 1, eb = String(b[1]).toUpperCase() === qu ? 0 : 1;
        return ea - eb || (a[4] || 1e9) - (b[4] || 1e9);
      }).slice(0, 8).map(function (c) {
        return { id: c[0], sym: String(c[1]).toUpperCase(), nome: c[2], img: c[3] ? IMG_CG + c[3] : '', rank: c[4] || null, fonte: 'catálogo' };
      });
      if (locais.length) return Promise.resolve(locais);
      return cadeia([
        function () {
          return pedir('coingecko', CG + '/search?query=' + encodeURIComponent(q), { ttl: 86400000 }).then(function (d) {
            var l = ((d && d.coins) || []).slice(0, 8).map(function (c) {
              return { id: c.id, sym: String(c.symbol || '').toUpperCase(), nome: c.name, img: c.large || c.thumb || '', rank: c.market_cap_rank || null, fonte: 'CoinGecko' };
            });
            return l.length ? l : null;
          });
        },
        function () {
          return pedir('coinpaprika', CP + '/search?q=' + encodeURIComponent(q) + '&c=currencies&limit=8', { ttl: 86400000 }).then(function (d) {
            var l = ((d && d.currencies) || []).map(function (c) {
              return { id: 'pk:' + c.id, sym: String(c.symbol || '').toUpperCase(), nome: c.name, img: '', rank: c.rank || null, fonte: 'CoinPaprika' };
            });
            return l.length ? l : null;
          });
        }
      ]).catch(function () { return []; });
    }
    function doCatalogo(id) {
      var c = (catalogo().lista || []).filter(function (x) { return x[0] === id; })[0];
      return c ? { id: c[0], sym: String(c[1]).toUpperCase(), nome: c[2], img: c[3] ? IMG_CG + c[3] : '', rank: c[4] || null } : null;
    }

    /* ---------- ficha do token (market cap, oferta, ATH) ---------- */
    function ficha(id, sym) {
      sym = String(sym || '').toUpperCase();
      var cat = doCatalogo(id) || {};
      function max24min24(f) {
        if (!symOk(sym) || STABLES[sym]) return f;
        return pedir('binance', BN + '/ticker/24hr?symbol=' + sym + 'USDT').then(function (t) {
          var ultimo = num(t && t.lastPrice);
          if (ultimo && f.usd && Math.abs(ultimo / f.usd - 1) < 0.08) { f.max24 = num(t.highPrice); f.min24 = num(t.lowPrice); }
          return f;
        }, function () { return f; });
      }
      return cadeia([
        function () {
          var achar = id.indexOf('pk:') === 0
            ? pedir('coinpaprika', CP + '/tickers/' + encodeURIComponent(id.slice(3)))
            : tickersPaprika().then(function (ts) { return paprikaPorSimbolo(ts, sym); });
          return achar.then(function (t) {
            if (!t || !t.quotes || !t.quotes.USD) return null;
            var u = t.quotes.USD;
            return max24min24({ usd: num(u.price), mcap: num(u.market_cap), vol24: num(u.volume_24h), ch24: num(u.percent_change_24h),
              supply: num(t.circulating_supply), ath: num(u.ath_price), athDist: num(u.percent_from_price_ath),
              max24: null, min24: null, nome: t.name || cat.nome, sym: String(t.symbol || sym).toUpperCase(), img: cat.img || '', fonte: 'CoinPaprika' });
          });
        },
        function () {
          if (id.indexOf('pk:') === 0) return null;
          return pedir('coingecko', CG + '/coins/markets?vs_currency=usd&ids=' + encodeURIComponent(id) + '&price_change_percentage=24h').then(function (d) {
            var c = d && d[0]; if (!c) return null;
            return { usd: num(c.current_price), mcap: num(c.market_cap), vol24: num(c.total_volume), ch24: num(c.price_change_percentage_24h),
              supply: num(c.circulating_supply), ath: num(c.ath), athDist: num(c.ath_change_percentage), max24: num(c.high_24h), min24: num(c.low_24h),
              nome: c.name, sym: String(c.symbol || sym).toUpperCase(), img: c.image || cat.img || '', fonte: 'CoinGecko' };
          });
        }
      ]).then(function (f) {
        lembrar('ficha:' + id, f, f.fonte);
        f.quando = agora(); f.salvo = false;
        return f;
      }, function (e) {
        var u = lembrado('ficha:' + id);
        if (!u) throw e;
        var f = u.v; f.quando = u.t; f.salvo = true;
        return f;
      });
    }

    /* ---------- velas ---------- */
    var CG_DIAS = { '15m': 1, '1h': 7, '4h': 30, '1d': 180, '1w': 365 };
    function deFechamentos(pares) {
      return pares.map(function (p, i) {
        var ant = i ? pares[i - 1][1] : p[1];
        return { t: p[0], o: ant, h: Math.max(ant, p[1]), l: Math.min(ant, p[1]), c: p[1] };
      });
    }
    function velas(id, sym, intervalo, limite, precoRef) {
      sym = String(sym || '').toUpperCase(); limite = limite || 200;
      return cadeia([
        function () {
          if (!symOk(sym) || STABLES[sym]) return null;
          return pedir('binance', BN + '/klines?symbol=' + sym + 'USDT&interval=' + intervalo + '&limit=' + limite).then(function (d) {
            var cs = (d || []).map(function (k) { return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }; });
            if (cs.length < 3) return null;
            if (precoRef && Math.abs(cs[cs.length - 1].c / precoRef - 1) >= 0.08) return null;
            return { velas: cs, fonte: 'Binance' };
          });
        },
        function () {
          if (id.indexOf('pk:') === 0) return null;
          return pedir('coingecko', CG + '/coins/' + encodeURIComponent(id) + '/ohlc?vs_currency=usd&days=' + (CG_DIAS[intervalo] || 30)).then(function (d) {
            var cs = (d || []).map(function (k) { return { t: k[0], o: k[1], h: k[2], l: k[3], c: k[4] }; });
            return cs.length >= 3 ? { velas: cs.slice(-limite), fonte: 'CoinGecko' } : null;
          });
        },
        function () {
          if (id.indexOf('pk:') === 0) return null;
          // contado para trás a partir de agora: "start" antes do token existir volta vazio; máximo de 500 pontos
          var fim = Math.floor(agora() / 1000);
          return pedir('defillama', LL + '/chart/coingecko:' + encodeURIComponent(id) + '?end=' + fim + '&span=' + Math.min(500, limite) + '&period=' + intervalo).then(function (d) {
            var k = d && d.coins && d.coins[Object.keys(d.coins)[0]];
            if (!k || !k.prices || k.prices.length < 3) return null;
            return { velas: deFechamentos(k.prices.map(function (p) { return [p.timestamp * 1000, p.price]; })), fonte: 'DefiLlama' };
          });
        }
      ]);
    }

    /* ---------- histórico longo ---------- */
    function historico(id, sym, dias) {
      sym = String(sym || '').toUpperCase(); dias = dias || 365;
      var kl = function (intervalo, limite) {
        return pedir('binance', BN + '/klines?symbol=' + sym + 'USDT&interval=' + intervalo + '&limit=' + limite).then(function (d) {
          return (d || []).map(function (k) { return { t: k[0], v: +k[4] }; }).filter(function (p) { return p.v > 0; });
        }, function () { return []; });
      };
      return guardado('hist:' + id + ':' + dias, 600000, function () {
        return cadeia([
          function () {
            if (!symOk(sym) || STABLES[sym]) return null;
            return Promise.all([dias > 1000 ? kl('1w', Math.min(1000, Math.ceil(dias / 7))) : Promise.resolve([]), kl('1d', Math.min(1000, dias))]).then(function (rs) {
              var diario = rs[1], inicio = diario.length ? diario[0].t : Infinity;
              var serie = rs[0].filter(function (p) { return p.t < inicio; }).concat(diario);
              return serie.length >= 3 ? { serie: serie, fonte: 'Binance' } : null;
            });
          },
          function () {
            if (id.indexOf('pk:') === 0) return null;
            // contado para trás a partir de agora (máximo de 500 pontos; antes de o token existir não vem nada)
            var semanal = dias > 500, span = Math.min(500, semanal ? Math.ceil(dias / 7) : dias);
            var fim = Math.floor(agora() / 1000);
            return pedir('defillama', LL + '/chart/coingecko:' + encodeURIComponent(id) + '?end=' + fim + '&span=' + span + '&period=' + (semanal ? '1w' : '1d'), { timeout: 15000 }).then(function (d) {
              var k = d && d.coins && d.coins[Object.keys(d.coins)[0]];
              if (!k || !k.prices || k.prices.length < 3) return null;
              return { serie: k.prices.map(function (p) { return { t: p.timestamp * 1000, v: p.price }; }), fonte: 'DefiLlama' };
            });
          },
          function () {
            if (id.indexOf('pk:') === 0) return null;
            return pedir('coingecko', CG + '/coins/' + encodeURIComponent(id) + '/market_chart?vs_currency=usd&days=' + Math.min(365, dias)).then(function (d) {
              var s = ((d && d.prices) || []).map(function (p) { return { t: p[0], v: p[1] }; });
              return s.length >= 3 ? { serie: s, fonte: 'CoinGecko' } : null;
            });
          }
        ]);
      });
    }

    /* ---------- câmbio (moeda por 1 dólar) ---------- */
    function cambio() {
      return cadeia([
        function () {
          return pedir('erapi', 'https://open.er-api.com/v6/latest/USD', { ttl: 3600000 }).then(function (d) {
            var t = d && d.rates; if (!t || !(t.BRL > 0)) return null;
            return { por: { usd: 1, brl: t.BRL, eur: t.EUR, gbp: t.GBP }, fonte: 'open.er-api' };
          });
        },
        function () {
          var simbolos = encodeURIComponent(JSON.stringify(['USDTBRL', 'EURUSDT', 'GBPUSDT']));
          return pedir('binance', BN + '/ticker/price?symbols=' + simbolos).then(function (d) {
            var m = {}; (d || []).forEach(function (x) { m[x.symbol] = num(x.price); });
            if (!(m.USDTBRL > 0)) return null;
            return { por: { usd: 1, brl: m.USDTBRL, eur: m.EURUSDT ? 1 / m.EURUSDT : null, gbp: m.GBPUSDT ? 1 / m.GBPUSDT : null }, fonte: 'Binance' };
          });
        },
        function () {
          return pedir('coingecko', CG + '/exchange_rates', { ttl: 3600000 }).then(function (d) {
            var r = d && d.rates; if (!r || !r.usd || !r.brl) return null;
            var u = r.usd.value;
            return { por: { usd: 1, brl: r.brl.value / u, eur: r.eur ? r.eur.value / u : null, gbp: r.gbp ? r.gbp.value / u : null }, fonte: 'CoinGecko' };
          });
        }
      ]).then(function (c) {
        lembrar('cambio', c.por, c.fonte);
        c.quando = agora(); c.salvo = false;
        return c;
      }, function (e) {
        var u = lembrado('cambio');
        if (!u) throw e;
        return { por: u.v, fonte: u.f, quando: u.t, salvo: true };
      });
    }

    /* ---------- Banco Central (SGS) ---------- */
    function serieBcb(numero, op) {
      op = op || {};
      var base = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + numero + '/dados';
      var url = op.ultimos ? base + '/ultimos/' + op.ultimos + '?formato=json'
        : base + '?formato=json&dataInicial=' + op.dataInicial + '&dataFinal=' + op.dataFinal;
      var chave = op.ultimos ? 'bcb:' + numero + ':' + op.ultimos : null;
      return pedir('bcb', url, { ttl: op.ultimos ? 12 * 3600000 : 0, timeout: 15000 }).then(function (d) {
        if (!Array.isArray(d) || !d.length) throw new Error('Banco Central sem dados.');
        if (chave) lembrar(chave, d, 'Banco Central');
        return { dados: d, quando: agora(), salvo: false };
      }, function (e) {
        var u = chave && lembrado(chave);
        if (!u) throw e;
        return { dados: u.v, quando: u.t, salvo: true };
      });
    }

    /* ---------- pools e APR ---------- */
    function pools() {
      return guardado('pools', 15 * 60000, function () {
        return pedir('defillama', 'https://yields.llama.fi/pools', { timeout: 30000 }).then(function (d) { return (d && d.data) || []; });
      });
    }

    function quandoTexto(ms) {
      if (!ms) return '';
      var d = new Date(ms);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return {
      pedir: pedir, precos: precos, preco: preco, buscar: buscar, doCatalogo: doCatalogo, ficha: ficha,
      velas: velas, historico: historico, cambio: cambio, serieBcb: serieBcb, pools: pools,
      quandoTexto: quandoTexto, fontes: FONTES
    };
  }

  var exporta = { criar: criar };
  if (typeof module !== 'undefined' && module.exports) module.exports = exporta;
  if (typeof window !== 'undefined' && !window.AtlasDados) {
    var armazenamento = null;
    try { armazenamento = window.localStorage; } catch (e) { armazenamento = null; }
    window.AtlasDados = criar({ armazenamento: armazenamento });
    window.AtlasDados.criar = criar;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
