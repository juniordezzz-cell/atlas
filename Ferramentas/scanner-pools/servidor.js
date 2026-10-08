/* ============================================================
   Scanner Pools · servidor.js — as pools vêm do coletor, não do navegador

   O Scanner era uma lista manual: só existia o que alguém tinha gravado
   no localStorage, e a busca trazia no máximo 30 pools. Agora um coletor
   (central-rwa/backend/central_rwa/pools, nominalmente a cada 2 h no GitHub Actions)
   busca na DefiLlama e na GeckoTerminal, barra token perigoso, separa
   Sólidas de Pendentes de análise, dá nota e publica nas visões públicas scanner_* do
   Supabase. Este arquivo lê essas visões e junta com o que é SEU:

     marcas   ★, nível do Radar e anotações, por pool do servidor
     tokens   lista antiga: bloqueios preservados; aprovações por token inativas
     decisoes aprovação/rejeição por identidade da pool
     manuais  pools que você registrou no "+ Pool" (ficam no navegador)

   Tudo aqui é função pura ou fetch isolado, para a bateria testar.
   ============================================================ */
(function (g) {
  "use strict";

  var CACHE_KEY = "estudo_pools_liquidez_servidor_cache";
  var MARCAS_KEY = "estudo_pools_liquidez_marcas";
  var TOKENS_KEY = "estudo_pools_liquidez_tokens";
  var DECISOES_KEY = "estudo_pools_liquidez_decisoes_v1";
  var MIGRADO_KEY = "estudo_pools_liquidez_migrado_v1";
  var PAGINA = 1000; // teto de linhas por resposta do PostgREST no Supabase

  var EMBRULHADOS = { WETH: "ETH", WBNB: "BNB", WSOL: "SOL", WAVAX: "AVAX", WHYPE: "HYPE", WPOL: "POL" };
  /* mesma lista do coletor (central_rwa/pools/config.py MAJORS): esses
     tokens nunca são "o token" de uma pool — aprovar/bloquear mira o outro */
  var MAJORS = ["USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC",
    "BTC", "WBTC", "CBBTC", "BTCB", "TBTC", "ETH", "WETH", "WSTETH", "STETH", "CBETH", "RETH", "WEETH",
    "SOL", "WSOL", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF", "BNB", "WBNB", "AVAX", "WAVAX", "POL",
    "MATIC", "WPOL", "SUI", "HYPE", "WHYPE"];

  function ls() { try { return g.localStorage; } catch (e) { return null; } }
  function lerJSON(k, padrao) {
    var s = ls(); if (!s) return padrao;
    try { var v = JSON.parse(s.getItem(k) || "null"); return v == null ? padrao : v; } catch (e) { return padrao; }
  }
  function gravarJSON(k, v) { var s = ls(); if (!s) return; try { s.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* id numérico estável a partir do id do servidor: o resto do app põe o id
     dentro de onclick="…(id)" e exige número (ver SEC-002 no index.html).
     FNV-1a 32 bits + deslocamento, para nunca colidir com os ids pequenos
     das pools manuais. */
  function idNumerico(sid) {
    var h = 0x811c9dc5;
    for (var i = 0; i < sid.length; i++) { h ^= sid.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 1e10 + h;
  }

  function normPar(par) {
    return String(par || "").split(/[\/\-]/).map(function (t) { return t.trim().toUpperCase(); })
      .filter(Boolean).map(function (t) { return EMBRULHADOS[t] || t; }).join("/");
  }

  function tokensDoPar(par) {
    return String(par || "").split(/[\/\-]/).map(function (t) { return t.trim().toUpperCase(); }).filter(Boolean);
  }
  function tokenAlvo(par) {
    /* o token "da pool": o que não é stable/major (o primeiro, se os dois forem) */
    var t = tokensDoPar(par);
    var fora = t.filter(function (x) { return MAJORS.indexOf(x) === -1; });
    return fora.length ? fora : [];
  }

  /* WSOL é o SOL nativo, embrulhado sozinho pelas DEXs de Solana: na tela é
     SOL (o coletor já grava assim; isto cobre as linhas antigas). */
  function nomePar(par) {
    return String(par || "").split(/([\/\-])/).map(function (t) { return t.trim().toUpperCase() === "WSOL" ? "SOL" : t; }).join("");
  }

  /* Linha de scanner_pools → objeto de pool do Scanner. */
  function paraPool(row, marca) {
    marca = marca || {};
    var p = {
      id: idNumerico(row.id),
      sid: row.id,
      servidor: true,
      pool: nomePar(row.par),
      platform: row.dex,
      network: row.rede,
      fee: Number(row.fee) || 0,
      tvl: Number(row.tvl) || 0,
      vol24h: Number(row.vol_24h) || 0,
      vol7d: row.vol_7d == null ? null : Number(row.vol_7d),
      vol30d: null,
      apr: row.apr == null ? null : Number(row.apr),
      aprReward: row.apr_reward == null ? null : Number(row.apr_reward),
      updatedAt: row.visto_em ? Date.parse(row.visto_em) : null,
      trilho: row.trilho,
      nota: Number(row.nota) || 0,
      componentes: row.componentes || {},
      motivos: row.motivos || [],
      sinais: row.sinais || {},
      criadaEm: row.criada_em ? Date.parse(row.criada_em) : null,
      varTvl7d: row.var_tvl_7d == null ? null : Number(row.var_tvl_7d),
      leituras: Number(row.leituras) || 0,
      /* contrato e ID CoinGecko de cada lado: o ✕ bloqueia por eles */
      tokens: [{ simbolo: String(row.simbolo_a || "").toUpperCase(), endereco: row.token_a || null, cg: row.cg_a || null },
               { simbolo: String(row.simbolo_b || "").toUpperCase(), endereco: row.token_b || null, cg: row.cg_b || null }],
      history: [],
      fav: !!marca.fav,
      notes: marca.notes || ""
    };
    if (marca.level) p.level = marca.level;
    return p;
  }

  /* O que é do usuário numa pool do servidor, e só isso, vai para as marcas. */
  function extrairMarcas(pools) {
    var out = {};
    (pools || []).forEach(function (p) {
      if (!p.servidor) return;
      if (p.fav || p.level || (p.notes && p.notes.trim())) {
        out[p.sid] = { fav: !!p.fav, level: p.level || null, notes: p.notes || "" };
      }
    });
    return out;
  }

  /* Decisões por pool abaixo dos cortes e segurança. `caca` é legado do schema.
     Aprovações antigas por símbolo não aprovam novas pools. */
  function chaveDecisao(p) {
    var sinais = p.sinais || {};
    var endereco = sinais.endereco_pool || (sinais.conferencia || {}).endereco;
    if (!endereco && String(p.sid || '').indexOf('gecko:') === 0) endereco = p.sid.split(':').slice(2).join(':');
    if (endereco) {
      if (p.network !== 'Solana' && p.network !== 'Sui') endereco = endereco.toLowerCase();
      return p.network + ':' + endereco;
    }
    return p.sid || 'manual:' + p.id;
  }
  /* ---------- categoria de cada token (decisão do dono, 07/10/2026) ----------
     As MESMAS listas de central_rwa/pools/config.py. A categoria gravada pelo
     coletor (sinais.categoria, que sabe quem é meme pelo ID CoinGecko) vale
     primeiro; esta conta cobre pools manuais e as lidas antes da regra. */
  var CAT_STABLES = ["USDC", "USDT", "USDG", "USD1", "DAI", "FDUSD", "PYUSD", "USDE", "USDS", "USDC.E", "USDBC"];
  var CAT_BLUECHIPS = ["BTC", "WBTC", "CBBTC", "BTCB", "TBTC", "ETH", "WETH", "WSTETH", "STETH", "CBETH", "RETH", "WEETH",
    "SOL", "WSOL", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF"];
  var CAT_ACOES = ["AAPL", "AMZN", "GOOGL", "GOOG", "MSFT", "NVDA", "TSLA", "META", "NFLX", "AMD", "INTC", "AVGO",
    "PLTR", "MSTR", "CRCL", "COIN", "HOOD", "RBLX", "GME", "MCD", "KO", "PEP", "JPM", "V", "MA",
    "STRC", "SPCX", "TCENT", "BABA", "ORCL", "CRM", "UBER", "ABNB", "DIS", "NKE", "WMT", "COST",
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "TBLL"];
  var CAT_AMBIGUAS = ["META", "GME", "COIN", "AMD", "V", "MA", "KO", "DIS", "DIA"];
  var CAT_COMMODITIES = ["GLD", "SLV", "IAU", "USO", "PAXG", "XAUT", "SP500"];
  var CAT_RWA_EXTRA = ["XAUT", "PAXG", "BUIDL", "USTB", "USYC", "OUSG", "SP500"];
  function ehRwa(sim, rede) {
    var s = String(sim || "").toUpperCase();
    if (CAT_RWA_EXTRA.indexOf(s) !== -1 || CAT_COMMODITIES.indexOf(s) !== -1) return true;
    var sufs = ["ON", "X", "B", "C"];                      /* Ondo, xStocks, bStocks, Coinbase */
    for (var i = 0; i < sufs.length; i++) {
      var suf = sufs[i];
      if (s.length <= suf.length + 1 || s.slice(-suf.length) !== suf) continue;
      var base = s.slice(0, -suf.length);
      if (base.charAt(0) === "W" && CAT_ACOES.indexOf(base.slice(1)) !== -1) base = base.slice(1);
      if (suf !== "X" && CAT_AMBIGUAS.indexOf(base) !== -1) continue;
      if (CAT_ACOES.indexOf(base) !== -1 || (suf === "X" && CAT_COMMODITIES.indexOf(base) !== -1)) return true;
    }
    return CAT_ACOES.indexOf(s) !== -1 && (CAT_AMBIGUAS.indexOf(s) === -1 || rede === "Robinhood");
  }
  function categoriaToken(sim, rede) {
    var s = String(sim || "").toUpperCase();
    if (CAT_STABLES.indexOf(s) !== -1) return "stable";
    if (CAT_BLUECHIPS.indexOf(s) !== -1) return "bluechip";
    if (ehRwa(s, rede)) return "rwa";
    return "altcoin";
  }
  function categoriasDaPool(p) {
    var cs = p && p.sinais && Array.isArray(p.sinais.categoria) ? p.sinais.categoria : null;
    var t = tokensDoPar(p && p.pool), rede = p && p.network;
    /* a do coletor vale (só ela sabe quem é meme), mas "altcoin" gravado por
       uma regra de RWA mais antiga (SPCXB, SPCXON antes de 08/10) vira RWA */
    if (cs && cs.length === 2) return cs.map(function (c, i) { return c === "altcoin" && ehRwa(t[i], rede) ? "rwa" : c; });
    cs = t.slice(0, 2).map(function (x) { return categoriaToken(x, rede); });
    /* sem a categoria do coletor: meme detectada marca o lado altcoin */
    if (((p.sinais || {}).memecoin || {}).detectada) cs = cs.map(function (c) { return c === "altcoin" ? "meme" : c; });
    return cs;
  }
  /* emissor do RWA: o ID CoinGecko diz (spacex-xstocks, …-ondo-tokenized-stock);
     sem ele, o sufixo do símbolo dá o provável. Mesma lista do config.py. */
  var EMISSORES = [["xstock", "xStocks"], ["backpack", "Backpack"], ["bstock", "Binance bStocks"],
    ["ondo", "Ondo"], ["coinbase", "Coinbase"], ["robinhood", "Robinhood"], ["backed", "Backed"],
    ["dinari", "Dinari"], ["remora", "Remora"], ["prestock", "PreStocks"], ["pax-gold", "Paxos"], ["tether-gold", "Tether"]];
  var SUFIXO_EMISSOR = [["ON", "Ondo"], ["X", "xStocks"], ["B", "Binance bStocks"], ["C", "Coinbase"]];
  function emissorToken(sim, cg, rede) {
    var id = String(cg || "").toLowerCase();
    for (var i = 0; i < EMISSORES.length; i++) if (id.indexOf(EMISSORES[i][0]) !== -1) return { nome: EMISSORES[i][1], provavel: false };
    if (rede === "Robinhood") return { nome: "Robinhood", provavel: true };
    var s = String(sim || "").toUpperCase();
    for (var j = 0; j < SUFIXO_EMISSOR.length; j++) {
      var suf = SUFIXO_EMISSOR[j][0], base = s.slice(0, -suf.length);
      if (s.length > suf.length + 1 && s.slice(-suf.length) === suf && !(suf !== "X" && CAT_AMBIGUAS.indexOf(base) !== -1) &&
          (CAT_ACOES.indexOf(base) !== -1 || CAT_COMMODITIES.indexOf(base) !== -1)) return { nome: SUFIXO_EMISSOR[j][1], provavel: true };
    }
    return null;
  }
  /* um por lado do par; null onde o token não é RWA ou o emissor é desconhecido */
  function emissoresDaPool(p) {
    var gravado = (p.sinais || {}).emissor, cats = categoriasDaPool(p), toks = p.tokens || [], par = tokensDoPar(p.pool);
    return cats.map(function (c, i) {
      if (c !== "rwa") return null;
      if (Array.isArray(gravado) && gravado[i]) return gravado[i];
      return emissorToken((toks[i] && toks[i].simbolo) || par[i], toks[i] && toks[i].cg, p.network);
    });
  }
  function rotuloEmissor(p) {
    return emissoresDaPool(p).filter(Boolean).map(function (e) { return e.nome + (e.provavel ? " (provável)" : ""); }).join(" · ");
  }
  var CAT_NOME = { stable: "Stable", bluechip: "Blue chip", rwa: "RWA", meme: "Meme", altcoin: "Altcoin" };
  /* "RWA / Stable", "Blue chip / Blue chip", "Altcoin / Altcoin": stable sempre por último */
  function rotuloCategoria(p) {
    var cs = categoriasDaPool(p).slice();
    if (cs.length < 2) return "?";
    if (cs[0] === "stable" && cs[1] !== "stable") cs.reverse();
    return CAT_NOME[cs[0]] + " / " + CAT_NOME[cs[1]];
  }

  /* A mesma pool vinda da DefiLlama e da GeckoTerminal: a da DefiLlama
     carrega o endereço on-chain na conferência; a da GeckoTerminal com esse
     endereço sai da lista (o coletor faz o mesmo desde 08/10; isto cobre as
     linhas antigas ainda ativas no banco). */
  function semDuplicatas(pools) {
    var conferidos = {};
    pools.forEach(function (p) {
      var e = ((p.sinais || {}).conferencia || {}).endereco;
      if (String(p.sid || "").indexOf("llama:") === 0 && e) conferidos[chaveEndereco(p.network, e)] = 1;
    });
    return pools.filter(function (p) {
      var sid = String(p.sid || "");
      if (sid.indexOf("gecko:") !== 0) return true;
      return !conferidos[chaveEndereco(p.network, sid.split(":").slice(2).join(":"))];
    });
  }

  /* ---------- bloqueio por contrato (07/10/2026) ----------
     O ✕ grava o token pelo endereço na rede e, se tiver, pelo ID CoinGecko.
     Endereço separa o oficial de uma cópia com o mesmo nome; o ID pega o
     mesmo token oficial nas outras redes (cada rede tem outro endereço). */
  function chaveEndereco(rede, endereco) {
    if (!endereco) return null;
    var e = String(endereco);
    if (rede !== "Solana" && rede !== "Sui") e = e.toLowerCase();
    return rede + ":" + e;
  }
  /* os tokens desta pool que o ✕ bloquearia: o lado que não é major/stable */
  function bloqueiosDaPool(p) {
    var alvo = tokenAlvo(p.pool);
    return (p.tokens || []).filter(function (t) { return t && alvo.indexOf(t.simbolo) !== -1; })
      .map(function (t) { return { simbolo: t.simbolo, rede: p.network, endereco: t.endereco || null, cg: t.cg || null }; });
  }
  function bloqueadaPorEndereco(p, lista) {
    if (!lista.length || !p.tokens) return false;
    var chaves = {}, cgs = {};
    lista.forEach(function (b) { var k = chaveEndereco(b.rede, b.endereco); if (k) chaves[k] = 1; if (b.cg) cgs[b.cg] = 1; });
    return p.tokens.some(function (t) {
      if (!t) return false;
      var k = chaveEndereco(p.network, t.endereco);
      return (k && chaves[k]) || (t.cg && cgs[t.cg]);
    });
  }

  function trilhoEfetivo(p, lista, decisoes) {
    var r = Number(p.tvl) > 0 ? Number(p.vol24h) / Number(p.tvl) : 0;
    if (!Number.isFinite(Number(p.tvl)) || Number(p.tvl) < 100000 || !Number.isFinite(r) || r <= 0.50 || p.trilho === 'barrada') return 'oculta';
    var meme = !!((p.sinais || {}).memecoin || {}).detectada;
    if (meme && r <= 2) return 'oculta';
    var d = (decisoes || {})[chaveDecisao(p)] || (decisoes || {})[p.sid];
    if (d === 'rejeitada') return 'oculta';
    if (!p.servidor) return 'solida';
    var alvo = tokenAlvo(p.pool);
    var bloq = (lista && lista.bloqueados) || [];
    if (alvo.some(function (t) { return bloq.indexOf(t) !== -1; })) return "oculta";
    if (bloqueadaPorEndereco(p, (lista && lista.bloqueadosEnd) || [])) return "oculta";
    if (d === 'aprovada') return 'solida';
    /* lista de memecoins incompleta na coleta: token não conferido não é
       "sem memecoin" — vai para Pendentes até uma coleta completa */
    var naoVerificada = ((p.sinais || {}).memecoin || {}).estado === 'nao_verificada';
    /* desde 07/10 o coletor também manda para Pendentes token fraco, volume
       suspeito e rendimento abaixo do mínimo da classe — sempre com motivo.
       `caca` sem motivo é legado do schema e continua valendo como Sólida. */
    var comMotivo = p.trilho === 'caca' && Array.isArray(p.motivos) && p.motivos.length > 0;
    /* sem classe_par = classificada antes das regras de 07/10 (a pool não
       foi lida desde então): não pode ficar nas Sólidas com a regra velha */
    var regraVelha = !(p.sinais || {}).classe_par;
    return (meme || naoVerificada || comMotivo || regraVelha) ? 'caca' : 'solida';
  }

  /* ---------- transição das pools gravadas no navegador ----------
     Casa cada pool local com a do servidor: primeiro pelo id da fonte
     (srcId "llama:…", que é o mesmo id do servidor), depois por rede +
     DEX + par normalizado + taxa. Nada é apagado: a local casada some da
     lista (vira marca da do servidor) e a não casada vira manual. */
  function chave(rede, dex, par, fee) {
    return [String(rede || "").toLowerCase(), String(dex || "").toLowerCase(), normPar(par),
      Math.round((Number(fee) || 0) * 10000)].join("|");
  }
  function casarLocais(locais, servidor) {
    var porId = {}, porChave = {};
    servidor.forEach(function (s) {
      porId[s.sid] = s;
      var k = chave(s.network, s.platform, s.pool, s.fee);
      if (!porChave[k]) porChave[k] = s;
    });
    var casadas = [], manuais = [];
    (locais || []).forEach(function (l) {
      var alvo = (l.srcId && porId[l.srcId]) || porChave[chave(l.network, l.platform, l.pool, l.fee)];
      if (alvo) casadas.push({ local: l, servidor: alvo }); else manuais.push(l);
    });
    return { casadas: casadas, manuais: manuais };
  }
  /* Leva ★, nível, notas e o histórico local para a pool do servidor. */
  function migrar(locais, servidor, marcas) {
    var r = casarLocais(locais, servidor);
    r.casadas.forEach(function (c) {
      var m = marcas[c.servidor.sid] || {};
      marcas[c.servidor.sid] = {
        fav: !!(m.fav || c.local.fav),
        level: m.level || c.local.level || null,
        notes: [m.notes, c.local.notes].filter(function (x) { return x && x.trim(); }).join("\n")
      };
    });
    return { marcas: marcas, casadas: r.casadas, manuais: r.manuais };
  }

  /* ---------- leitura do Supabase ---------- */
  function cfg() { return g.ATLAS_SUPABASE || null; }

  function buscarVisao(visao, query, fetchImpl) {
    var c = cfg();
    if (!c || !c.url || !c.publishableKey) return Promise.reject(new Error("Supabase não configurado"));
    var f = fetchImpl || g.fetch.bind(g);
    var todas = [];
    function pagina(ini) {
      return f(c.url + "/rest/v1/" + visao + "?" + query, {
        headers: { apikey: c.publishableKey, Authorization: "Bearer " + c.publishableKey,
                   Range: ini + "-" + (ini + PAGINA - 1), "Range-Unit": "items" }
      }).then(function (r) {
        if (!r.ok && r.status !== 206) throw new Error("Supabase HTTP " + r.status);
        return r.json();
      }).then(function (linhas) {
        todas = todas.concat(linhas || []);
        return (linhas || []).length === PAGINA ? pagina(ini + PAGINA) : todas;
      });
    }
    return pagina(0);
  }

  /* Devolve { pools: linhas, status: linhas, em: ms, doCache: bool }.
     Falhou? Usa a última leitura boa, avisando a idade. Sem cache: erro. */
  function carregar(fetchImpl) {
    return Promise.all([
      buscarVisao("scanner_pools", "select=*&order=nota.desc", fetchImpl),
      buscarVisao("scanner_status", "select=*", fetchImpl)
    ]).then(function (res) {
      var dado = { pools: res[0], status: res[1], em: Date.now(), doCache: false };
      gravarJSON(CACHE_KEY, dado);
      return dado;
    }).catch(function (e) {
      var c = lerJSON(CACHE_KEY, null);
      if (c && c.pools) { c.doCache = true; c.erro = String(e && e.message || e); return c; }
      throw e;
    });
  }

  /* Leituras diárias de UMA pool (painel de evolução), no formato de
     history do Scanner. Buscadas só quando a pool é aberta. */
  function historicoDiario(sid, fetchImpl) {
    return buscarVisao("scanner_leituras", "select=*&pool_id=eq." + encodeURIComponent(sid) + "&order=dia.asc", fetchImpl);
  }
  function snapshots(sid, fetchImpl) {
    return buscarVisao("scanner_snapshots", "select=*&pool_id=eq." + encodeURIComponent(sid) + "&order=observado_em.asc", fetchImpl)
      .then(function (rows) {
        return rows.map(function (r) {
          return { ts: Date.parse(r.observado_em), tvl: Number(r.tvl) || 0,
            vol24h: Number(r.vol_24h) || 0, vol7d: r.vol_7d == null ? null : Number(r.vol_7d),
            vol30d: null, fee: Number(r.fee) || 0, apr: r.apr == null ? null : Number(r.apr) };
        }).filter(function (r) { return Number.isFinite(r.ts); });
      });
  }
  function historico(sid, fetchImpl) {
    return historicoDiario(sid, fetchImpl)
      .then(function (ls2) {
        return ls2.map(function (l) {
          return { ts: Date.parse(l.dia + "T12:00:00"), tvl: Number(l.tvl) || 0, vol24h: Number(l.vol_24h) || 0,
                   vol7d: l.vol_7d == null ? null : Number(l.vol_7d), vol30d: null,
                   fee: Number(l.fee) || 0, apr: l.apr == null ? null : Number(l.apr) };
        });
      });
  }

  g.ScannerServidor = {
    CACHE_KEY: CACHE_KEY, MARCAS_KEY: MARCAS_KEY, TOKENS_KEY: TOKENS_KEY, MIGRADO_KEY: MIGRADO_KEY, DECISOES_KEY: DECISOES_KEY,
    idNumerico: idNumerico, normPar: normPar, nomePar: nomePar, tokenAlvo: tokenAlvo,
    paraPool: paraPool, extrairMarcas: extrairMarcas, trilhoEfetivo: trilhoEfetivo,
    chaveDecisao: chaveDecisao,
    casarLocais: casarLocais, migrar: migrar,
    carregar: carregar, historico: historico, historicoDiario: historicoDiario, snapshots: snapshots,
    lerMarcas: function () { return lerJSON(MARCAS_KEY, {}); },
    gravarMarcas: function (m) { gravarJSON(MARCAS_KEY, m); },
    lerTokens: function () { var t = lerJSON(TOKENS_KEY, {}); return { aprovados: t.aprovados || [], bloqueados: t.bloqueados || [], bloqueadosEnd: t.bloqueadosEnd || [] }; },
    bloqueiosDaPool: bloqueiosDaPool, chaveEndereco: chaveEndereco, semDuplicatas: semDuplicatas, emissorToken: emissorToken, emissoresDaPool: emissoresDaPool, rotuloEmissor: rotuloEmissor,
    categoriaToken: categoriaToken, categoriasDaPool: categoriasDaPool, rotuloCategoria: rotuloCategoria,
    gravarTokens: function (t) { gravarJSON(TOKENS_KEY, t); },
    lerDecisoes: function () { return lerJSON(DECISOES_KEY, {}); },
    gravarDecisoes: function (d) { gravarJSON(DECISOES_KEY, d); },
    jaMigrou: function () { return !!lerJSON(MIGRADO_KEY, null); },
    marcarMigrado: function (info) { gravarJSON(MIGRADO_KEY, info); }
  };
})(window);
