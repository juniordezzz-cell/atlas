/* ============================================================
   ATLAS · core/atlas-precos.js
   ------------------------------------------------------------
   RESOLUÇÃO DE PREÇO — a cadeia única do sistema inteiro.

   Regra do ATLAS, decidida na terceira auditoria e válida para
   TODOS os módulos (Hold, Trade, DeFi, RWA):

     a API é o caminho principal; quando nenhuma fonte reconhece
     o ativo, quem informa o preço é o usuário — e a partir daí
     a API não passa por cima até ele mandar.

   A cadeia, em ordem:

     1. preço MANUAL do usuário   se existe, MANDA (com data e origem)
     2. stablecoin conhecida      vale 1 por definição, não vai à rede
     3. id curado -> API          o caminho normal (CoinGecko)
     4. busca por símbolo         só com símbolo IDÊNTICO
     5. fonte secundária (DEX)    GeckoTerminal, para o que não está
                                  listado em lugar nenhum mas é negociado
     6. nada                      "sem preço" — a tela PEDE o valor

   DUAS FONTES PERMITEM UMA COISA QUE UMA SÓ NÃO PERMITE: DISCORDAR
   ----------------------------------------------------------------
   Com uma fonte, um preço errado é indistinguível de um preço certo.
   Com duas, a diferença entre elas é informação. Quando o símbolo foi
   resolvido pela BUSCA — o caminho mais frágil, porque casa por texto
   e não por id — o preço é conferido contra a DEX. Divergência acima
   de LIMITE_DIVERGENCIA volta em `divergentes`, e a tela avisa em vez
   de escolher sozinha qual das duas está certa.

   O que este arquivo NÃO faz
   --------------------------
   Não conhece módulo nenhum e não guarda tabela de ids. Quem sabe
   traduzir "SOL" em "solana" é o registro de cada módulo, que se
   apresenta aqui com registrarRegistro(). O DeFi já tem o seu
   (defi/js/tokens.js); Hold, Trade e RWA entram na Fase 3.

   POR QUE O MANUAL VENCE A API
   ----------------------------
   Porque o manual só existe quando a API falhou em reconhecer o
   ativo — e uma API que volta a responder com o ativo ERRADO
   (símbolo colidindo com outra moeda) é pior que não responder.
   Deixar o número do usuário ser sobrescrito em silêncio é o mesmo
   defeito que esta auditoria veio corrigir, invertido.

   O manual ENVELHECE, e isso aparece: passados VALIDADE_DIAS, o
   preço continua valendo (é o único que existe) mas vem marcado
   `vencido: true`, para a tela poder dizer que o número é velho em
   vez de exibi-lo com cara de agora.

   Exposto em: window.AtlasPrecos
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasPrecos) return;

  var KEY = "atlas.precos.manual.v1";
  var VALIDADE_DIAS = 7;

  /* Divergência tolerada entre a fonte primária e a secundária, em %.
     Preço de DEX e preço de agregador nunca batem exatamente: um é a
     última negociação numa pool, o outro é média ponderada entre
     mercados. Medido nas ações tokenizadas reais do usuário, a
     diferença ficou entre 0,2% e 0,4%. Três por cento é folga
     suficiente para não gritar à toa e apertado o bastante para pegar
     ativo trocado — que erra por ordem de grandeza, não por decimal. */
  var LIMITE_DIVERGENCIA = 3;

  /* Stablecoins: mesma lista do AtlasPrice, replicada só como
     reserva para a página que não carregou aquele arquivo. Quando
     AtlasPrice existe, ele é quem responde — uma definição só. */
  var STABLES = {
    USDC: 1, USDT: 1, DAI: 1, USDE: 1, FDUSD: 1,
    PYUSD: 1, TUSD: 1, USDD: 1, BUSD: 1, USDS: 1
  };

  function norm(s) { return String(s == null ? "" : s).trim().toUpperCase(); }

  function num(v) {
    var x = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(x) ? x : NaN;
  }

  function isStable(sim) {
    var s = norm(sim);
    if (global.AtlasPrice && global.AtlasPrice.isStable) return global.AtlasPrice.isStable(s);
    return STABLES[s] != null;
  }

  /* ---------------- preços manuais (localStorage) ---------------- */

  var _memManual = null;   // reserva para file:// sem storage

  function lerTodos() {
    try {
      var raw = global.localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === "object") ? o : (_memManual || {});
    } catch (e) { return _memManual || {}; }
  }

  function gravarTodos(o) {
    _memManual = o;
    try { global.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* fica em memória */ }
  }

  function diasDesde(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  /* ---------------- registros de id (por módulo) ---------------- */

  var registros = [];

  function idDe(sim) {
    var s = norm(sim);
    if (!s) return null;
    for (var i = 0; i < registros.length; i++) {
      var id = null;
      try { id = registros[i](s); } catch (e) { id = null; }
      if (id) return String(id);
    }
    return null;
  }

  function provedor() {
    if (!global.AtlasProviders || !global.AtlasProviders.get) return null;
    return global.AtlasProviders.get("coingecko") || null;
  }

  /* A fonte secundária é procurada pela MARCA `secundario`, não pelo
     nome nem pela ordem de registro: trocar de provedor de DEX no
     futuro não pode exigir editar este arquivo, e a ordem das tags
     <script> não pode decidir qual fonte manda no dinheiro. */
  function provedorSecundario() {
    if (!global.AtlasProviders || !global.AtlasProviders.list) return null;
    var nomes = global.AtlasProviders.list();
    for (var i = 0; i < nomes.length; i++) {
      var p = global.AtlasProviders.get(nomes[i]);
      if (p && p.secundario && typeof p.pricesBySymbols === "function") return p;
    }
    return null;
  }

  /* ============================================================
     API
     ============================================================ */

  var API = {
    VALIDADE_DIAS: VALIDADE_DIAS,

    /* Um módulo declara COMO traduzir símbolo em id de API.
       fn(SIMBOLO) -> id | null */
    registrarRegistro: function (fn) {
      if (typeof fn === "function" && registros.indexOf(fn) === -1) registros.push(fn);
      return API;
    },
    idDe: idDe,
    isStable: isStable,

    /* ---------------- manual ---------------- */

    /* { usd, em, dias, vencido, nota } | null */
    manual: function (sim) {
      var s = norm(sim);
      if (!s) return null;
      var r = lerTodos()[s];
      if (!r) return null;
      var v = num(r.usd);
      if (!isFinite(v) || v <= 0) return null;
      var d = diasDesde(r.em);
      return {
        usd: v,
        em: r.em || null,
        nota: r.nota || "",
        dias: d,
        vencido: d != null && d > VALIDADE_DIAS
      };
    },

    definirManual: function (sim, usd, opts) {
      var s = norm(sim);
      var v = num(usd);
      if (!s || !isFinite(v) || v <= 0) return false;
      opts = opts || {};
      var todos = lerTodos();
      todos[s] = {
        usd: v,
        em: opts.em || new Date().toISOString(),
        nota: opts.nota || ""
      };
      gravarTodos(todos);
      return true;
    },

    limparManual: function (sim) {
      var s = norm(sim);
      var todos = lerTodos();
      if (!todos[s]) return false;
      delete todos[s];
      gravarTodos(todos);
      return true;
    },

    manuais: function () { return lerTodos(); },

    /* ---------------- resolução ---------------- */

    /* Um símbolo. Devolve
         { usd, fonte, em, vencido, id } | null
       fonte: "manual" | "stable" | "registro" | "busca" */
    de: function (sim) {
      return API.deVarios([sim]).then(function (d) {
        var s = norm(sim);
        if (d.valores[s] == null) return null;
        return {
          usd: d.valores[s],
          fonte: d.fonte[s] || null,
          em: d.em[s] || null,
          vencido: d.vencidos.indexOf(s) !== -1,
          id: idDe(s)
        };
      });
    },

    /* ------------------------------------------------------------
       Vários símbolos numa passada só.

       Devolve
         valores   { SIMBOLO: precoUSD }
         fonte     { SIMBOLO: "manual"|"stable"|"registro"|"busca" }
         em        { SIMBOLO: ISO }   só para os manuais
         vencidos  [SIMBOLO...]       manuais mais velhos que a validade
         faltando  [SIMBOLO...]       nenhuma fonte respondeu
         erro      Error|null         falha de rede/limite (mensagem pronta)

       `faltando` é o gatilho da regra: a tela PEDE o preço desses.
       ------------------------------------------------------------ */
    deVarios: function (simbolos) {
      var alvos = (simbolos || []).map(norm).filter(Boolean);
      var unicos = [], visto = {};
      alvos.forEach(function (s) { if (!visto[s]) { visto[s] = 1; unicos.push(s); } });

      var valores = {}, fonte = {}, em = {}, detalhe = {}, vencidos = [], erro = null;
      var porId = {}, ids = [], desconhecidos = [];

      unicos.forEach(function (s) {
        /* 1. manual manda */
        var m = API.manual(s);
        if (m) {
          valores[s] = m.usd; fonte[s] = "manual"; em[s] = m.em;
          if (m.vencido) vencidos.push(s);
          return;
        }
        /* 2. stablecoin não vai à rede */
        if (isStable(s)) { valores[s] = 1; fonte[s] = "stable"; return; }
        /* 3. id curado -> lote na API */
        var id = idDe(s);
        if (id) {
          if (!porId[id]) { porId[id] = []; ids.push(id); }
          porId[id].push(s);
        } else {
          /* 4. busca por símbolo */
          desconhecidos.push(s);
        }
      });

      var prov = provedor();
      if ((ids.length || desconhecidos.length) && !prov && !global.AtlasPrice) {
        erro = new Error("Provedor de preços não carregado nesta página.");
      }

      /* pricesRaw PROPAGA o erro; prices engole. Um 429 do CoinGecko
         não pode virar "sem preço" silencioso — é a diferença entre
         "não conheço esse ativo" e "a fonte está fora do ar", e só a
         primeira justifica pedir o preço ao usuário. */
      var lote = null;
      if (ids.length && prov) {
        if (prov.pricesRaw) lote = prov.pricesRaw(ids);
        else if (prov.prices) lote = prov.prices(ids);
      }
      var pLote = lote
        ? lote.then(function (mapa) {
            ids.forEach(function (id) {
              var v = mapa[id];
              if (typeof v === "number" && isFinite(v) && v > 0) {
                porId[id].forEach(function (s) { valores[s] = v; fonte[s] = "registro"; });
              }
            });
          }).catch(function (e) { erro = erro || e; })
        : Promise.resolve();
      if (ids.length && !lote && prov) {
        erro = erro || new Error("Provedor de preços sem capacidade de cotação nesta página.");
      }

      var pSoltos = desconhecidos.map(function (s) {
        if (!global.AtlasPrice) return Promise.resolve();
        return global.AtlasPrice.bySymbol(s).then(function (r) {
          if (r && typeof r.usd === "number" && isFinite(r.usd) && r.usd > 0) {
            valores[s] = r.usd; fonte[s] = "busca";
          }
        }).catch(function (e) { erro = erro || e; });
      });

      function resultado(divergentes) {
        return {
          valores: valores, fonte: fonte, em: em, detalhe: detalhe,
          vencidos: vencidos, divergentes: divergentes || [],
          faltando: unicos.filter(function (s) { return valores[s] == null; }),
          erro: erro,
          consultadoEm: new Date().toISOString()
        };
      }

      return Promise.all([pLote].concat(pSoltos)).then(function () {
        var sec = provedorSecundario();
        if (!sec) return resultado([]);

        /* Quem ainda não tem preço: a secundária é a última chance
           antes de pedir o valor ao usuário. */
        var semPreco = unicos.filter(function (s) { return valores[s] == null; });
        /* Quem veio da BUSCA: tem preço, mas pelo caminho que casa por
           texto. Vale conferir contra um mercado real. */
        var conferir = unicos.filter(function (s) { return fonte[s] === "busca"; });

        if (!semPreco.length && !conferir.length) return resultado([]);

        return sec.pricesBySymbols(semPreco.concat(conferir)).then(function (mapa) {
          var divergentes = [];

          semPreco.forEach(function (s) {
            var r = mapa[s];
            if (!r) return;
            valores[s] = r.usd;
            fonte[s] = "dex";
            detalhe[s] = r;
          });

          conferir.forEach(function (s) {
            var r = mapa[s];
            if (!r) return;
            detalhe[s] = r;
            var a = valores[s], b = r.usd;
            if (!(a > 0 && b > 0)) return;
            var pct = Math.abs(a - b) / ((a + b) / 2) * 100;
            if (pct > LIMITE_DIVERGENCIA) {
              divergentes.push({
                simbolo: s, primaria: a, secundaria: b,
                pct: pct, rede: r.rede, liquidez: r.liquidez
              });
            }
          });

          return resultado(divergentes);
        }).catch(function () {
          /* A secundária é rede de segurança: se ela cair, o resultado
             da primária continua valendo. Falha aqui não vira erro. */
          return resultado([]);
        });
      });
    },

    /* Rótulo humano da origem — usado igual em todas as telas, para
       o usuário nunca precisar adivinhar de onde veio um número. */
    fonteLabel: function (f, curto) {
      if (f === "manual")   return "informado por você";
      if (f === "stable")   return curto ? "stablecoin" : "stablecoin (US$ 1 por definição)";
      if (f === "registro") return curto ? "API" : "API · id do registro";
      if (f === "busca")    return curto ? "API · busca" : "API · busca por símbolo";
      if (f === "dex")      return curto ? "DEX" : "DEX · pool com liquidez (fonte secundária)";
      return "sem preço";
    },

    LIMITE_DIVERGENCIA: LIMITE_DIVERGENCIA,

    /* Um símbolo por vez, direto na secundária — para a tela poder
       oferecer "conferir este preço" sem refazer a busca inteira. */
    conferirNaDex: function (sim) {
      var sec = provedorSecundario();
      if (!sec) return Promise.resolve(null);
      return sec.priceBySymbol(norm(sim)).catch(function () { return null; });
    }
  };

  global.AtlasPrecos = API;
})(typeof window !== "undefined" ? window : this);
