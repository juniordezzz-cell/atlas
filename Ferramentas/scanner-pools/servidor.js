/* ============================================================
   Scanner Pools · servidor.js — as pools vêm do coletor, não do navegador

   O Scanner era uma lista manual: só existia o que alguém tinha gravado
   no localStorage, e a busca trazia no máximo 30 pools. Agora um coletor
   (central-rwa/backend/central_rwa/pools, a cada 4 h no GitHub Actions)
   busca na DefiLlama e na GeckoTerminal, barra token perigoso, separa
   Sólidas de Caça, dá nota e publica nas visões públicas scanner_* do
   Supabase. Este arquivo lê essas visões e junta com o que é SEU:

     marcas   ★, nível do Radar e anotações, por pool do servidor
     tokens   sua lista: aprovados (contam como Sólida) e bloqueados
     manuais  pools que você registrou no "+ Pool" (ficam no navegador)

   Tudo aqui é função pura ou fetch isolado, para a bateria testar.
   ============================================================ */
(function (g) {
  "use strict";

  var CACHE_KEY = "estudo_pools_liquidez_servidor_cache";
  var MARCAS_KEY = "estudo_pools_liquidez_marcas";
  var TOKENS_KEY = "estudo_pools_liquidez_tokens";
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

  /* Trilho efetivo com a SUA lista por cima (camada 3): bloqueado some,
     aprovado vira Sólida. Não libera o que a segurança barrou — barradas
     nem chegam das visões. */
  function trilhoEfetivo(p, lista) {
    if (!p.servidor) return "solida";          // pool manual: é sua, aparece no padrão
    var alvo = tokenAlvo(p.pool);
    var bloq = (lista && lista.bloqueados) || [], aprov = (lista && lista.aprovados) || [];
    if (alvo.some(function (t) { return bloq.indexOf(t) !== -1; })) return "oculta";
    if (p.trilho === "caca" && alvo.length && alvo.every(function (t) { return aprov.indexOf(t) !== -1; })) return "solida";
    return p.trilho;
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
  function historico(sid, fetchImpl) {
    return buscarVisao("scanner_leituras", "select=*&pool_id=eq." + encodeURIComponent(sid) + "&order=dia.asc", fetchImpl)
      .then(function (ls2) {
        return ls2.map(function (l) {
          return { ts: Date.parse(l.dia + "T12:00:00"), tvl: Number(l.tvl) || 0, vol24h: Number(l.vol_24h) || 0,
                   vol7d: l.vol_7d == null ? null : Number(l.vol_7d), vol30d: null,
                   fee: Number(l.fee) || 0, apr: l.apr == null ? null : Number(l.apr) };
        });
      });
  }

  g.ScannerServidor = {
    CACHE_KEY: CACHE_KEY, MARCAS_KEY: MARCAS_KEY, TOKENS_KEY: TOKENS_KEY, MIGRADO_KEY: MIGRADO_KEY,
    idNumerico: idNumerico, normPar: normPar, nomePar: nomePar, tokenAlvo: tokenAlvo,
    paraPool: paraPool, extrairMarcas: extrairMarcas, trilhoEfetivo: trilhoEfetivo,
    casarLocais: casarLocais, migrar: migrar,
    carregar: carregar, historico: historico,
    lerMarcas: function () { return lerJSON(MARCAS_KEY, {}); },
    gravarMarcas: function (m) { gravarJSON(MARCAS_KEY, m); },
    lerTokens: function () { var t = lerJSON(TOKENS_KEY, {}); return { aprovados: t.aprovados || [], bloqueados: t.bloqueados || [] }; },
    gravarTokens: function (t) { gravarJSON(TOKENS_KEY, t); },
    jaMigrou: function () { return !!lerJSON(MIGRADO_KEY, null); },
    marcarMigrado: function (info) { gravarJSON(MIGRADO_KEY, info); }
  };
})(window);
