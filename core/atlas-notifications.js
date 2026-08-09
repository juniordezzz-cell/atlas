/* ============================================================
   ATLAS · core/atlas-notifications.js
   A central de alertas: um lugar, um estado de leitura.

   POR QUE ISTO EXISTE
   -------------------
   O sino da barra superior já mostrava alertas de verdade (item 2.4),
   mas com três buracos que o transformavam em enfeite:

     1. Só existia no shell da raiz. Dentro do Hold, do Trade, do DeFi
        ou do RWA — que é onde o usuário passa o tempo — não havia sino
        nenhum. O alerta esperava o usuário voltar ao Dashboard.

     2. Lia window.ATLAS_DATA, que só o Dashboard monta. Em Relatórios
        e em Configurações a lista chegava vazia mesmo havendo alerta.

     3. Não havia LIDO. A bolinha acendia enquanto o alerta existisse,
        então um alerta permanente ("3 teses abertas há mais de 72h")
        deixava a bolinha acesa para sempre. Uma bolinha que nunca apaga
        é uma bolinha que ninguém olha — e aí o alerta que importava
        passa despercebido no meio.

   O QUE MUDA
   ----------
   Os alertas passam a vir de AtlasConsolidation.alerts(), que soma os
   quatro módulos e funciona em qualquer página. O estado de leitura é
   por ALERTA, não por sessão: cada um ganha uma identidade estável
   derivada do próprio conteúdo, e uma vez lido não volta a acender.
   Se o texto mudar — de "3 teses abertas" para "5 teses abertas" — a
   identidade muda junto e ele acende de novo, que é o comportamento
   certo: é um alerta diferente.

   POR QUE A IDENTIDADE VEM DO CONTEÚDO
   ------------------------------------
   Alerta no ATLAS não é registro: é uma LEITURA do estado atual,
   recalculada a cada carga. Não existe "id do alerta" para guardar
   porque o alerta não é gravado em lugar nenhum. Derivar a identidade
   de módulo + nível + texto é o que dá estabilidade entre uma carga e
   outra sem inventar uma tabela de notificações que ninguém escreve.

   COMO USAR
   ---------
     AtlasNotifications.list()        → [{ id, level, module, texto, quando, lido }]
     AtlasNotifications.unread()      → quantos não lidos
     AtlasNotifications.markAllRead()
     AtlasNotifications.onChange(fn)
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasNotifications) return;

  var KEY = "atlas.notifications.v1";
  var LIMITE_LIDOS = 200;      // teto do histórico de lidos

  var ouvintes = [];

  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }

  /* ---------- identidade estável a partir do conteúdo ---------- */

  /* Hash de 32 bits (FNV-1a). Não é criptografia: é só um jeito curto e
     determinístico de transformar o texto do alerta numa chave que cabe
     no localStorage e não muda entre cargas. */
  function digitos(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  function idDe(a) {
    return (a.module || "atlas") + ":" + (a.level || "info") + ":" + digitos(String(a.texto || ""));
  }

  /* ---------- estado de leitura ---------- */

  function lerLidos() {
    return safe(function () {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === "object" && o.lidos) ? o.lidos : {};
    }, {});
  }

  function gravarLidos(mapa) {
    /* O mapa cresce: alerta que some da lista continua marcado. Sem teto,
       ele viraria um dicionário eterno no armazenamento do usuário.
       Guardamos os mais recentes e descartamos o resto — o pior caso de
       descartar um lido antigo é o alerta reacender uma vez. */
    var chaves = Object.keys(mapa);
    if (chaves.length > LIMITE_LIDOS) {
      chaves.sort(function (a, b) { return mapa[b] - mapa[a]; });
      var podado = {};
      chaves.slice(0, LIMITE_LIDOS).forEach(function (k) { podado[k] = mapa[k]; });
      mapa = podado;
    }
    safe(function () {
      global.localStorage.setItem(KEY, JSON.stringify({ lidos: mapa }));
    });
    return mapa;
  }

  function avisar() {
    ouvintes.slice().forEach(function (fn) { safe(function () { fn(); }); });
    safe(function () {
      document.dispatchEvent(new CustomEvent("atlas:notifications"));
    });
  }

  /* ---------- leitura dos alertas ---------- */

  function brutos() {
    /* AtlasConsolidation soma os quatro módulos e não depende de nenhuma
       página ter montado nada — por isso funciona no Hold, no Trade e em
       Configurações, e não só no Dashboard. */
    if (global.AtlasConsolidation && global.AtlasConsolidation.alerts) {
      return safe(function () { return global.AtlasConsolidation.alerts() || []; }, []);
    }
    /* Reserva: a lista que o Dashboard monta. Mantida para uma página
       que carregue js/data.js sem a consolidação. */
    return safe(function () {
      var d = global.ATLAS_DATA;
      return (d && Array.isArray(d.alertas)) ? d.alertas : [];
    }, []);
  }

  function list() {
    var lidos = lerLidos();
    var vistos = {};
    return brutos().map(function (a) {
      var id = idDe(a);
      /* Dois alertas idênticos vindos de módulos diferentes já são
         distintos pelo prefixo. Idênticos de verdade (mesma origem,
         mesmo texto) são o MESMO alerta: contar duas vezes só inflaria
         a bolinha. */
      if (vistos[id]) return null;
      vistos[id] = 1;
      return {
        id: id,
        level: a.level || "info",
        module: a.module || null,
        texto: a.texto,
        quando: a.quando || "agora",
        lido: !!lidos[id]
      };
    }).filter(Boolean);
  }

  function unread() {
    return list().filter(function (a) { return !a.lido; }).length;
  }

  function markAllRead() {
    var lidos = lerLidos(), agora = Date.now(), mudou = false;
    list().forEach(function (a) {
      if (!lidos[a.id]) { lidos[a.id] = agora; mudou = true; }
    });
    if (mudou) { gravarLidos(lidos); avisar(); }
    return mudou;
  }

  function markRead(id) {
    if (!id) return false;
    var lidos = lerLidos();
    if (lidos[id]) return false;
    lidos[id] = Date.now();
    gravarLidos(lidos);
    avisar();
    return true;
  }

  /* Usado por Configurações: devolve a bolinha ao estado original sem
     mexer em nenhum dado do usuário — alerta não é dado, é leitura. */
  function reset() {
    safe(function () { global.localStorage.removeItem(KEY); });
    avisar();
  }

  /* Outra aba marcou como lido: esta acompanha. */
  safe(function () {
    global.addEventListener("storage", function (e) {
      if (e && e.key === KEY) avisar();
    });
  });

  global.AtlasNotifications = {
    list: list,
    unread: unread,
    markRead: markRead,
    markAllRead: markAllRead,
    reset: reset,
    onChange: function (fn) { if (typeof fn === "function") ouvintes.push(fn); return fn; },
    offChange: function (fn) {
      var i = ouvintes.indexOf(fn);
      if (i >= 0) ouvintes.splice(i, 1);
    }
  };
})(window);
