/* ============================================================
   ATLAS · core/atlas-backup.js
   ------------------------------------------------------------
   ARQUIVO ÚNICO DE BACKUP.

   Todo dado do ATLAS mora no localStorage do navegador. Este
   módulo é a única peça que sabe empacotar tudo isso num .json
   e devolver de volta. Se um módulo novo criar uma chave nova,
   ela entra no backup SOZINHA — a varredura é por padrão de
   nome, não por lista fixa.

   Por que isso importa
   --------------------
   O localStorage vive no perfil do Chrome, não na pasta do
   projeto. Trocar os arquivos do site não apaga nada. Mas
   formatar o PC, limpar dados de navegação ou trocar de
   navegador apaga TUDO, sem aviso e sem volta. Este arquivo é
   o seguro contra isso.

   API
   ---
     AtlasBackup.scan()              -> [{key, bytes, group}]
     AtlasBackup.stats()             -> {keys, bytes, human, groups}
     AtlasBackup.build()             -> objeto do backup (payload)
     AtlasBackup.download()          -> dispara o download do .json
     AtlasBackup.parse(text)         -> payload validado (lança erro se inválido)
     AtlasBackup.inspect(payload)    -> resumo legível do que há no arquivo
     AtlasBackup.restore(payload,op) -> grava no localStorage
     AtlasBackup.filename()          -> nome sugerido do arquivo
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasBackup) return;

  var FORMAT = "atlas.backup";
  var FORMAT_VERSION = 1;

  /* ============================================================
     1. Quais chaves pertencem ao ATLAS

     Duas frentes, de propósito:
       - PATTERNS pega qualquer chave futura que siga a convenção
       - EXPLICIT garante as chaves legadas que fogem do padrão
     ============================================================ */

  var PATTERNS = [
    /^atlas[._:]/i,      // atlas.settings.v1 · atlas_defi_state_v3 · atlas:currency
    /^axiom[._:]/i,      // herança do Trade antes do rebrand
    /^HOLD_/             // HOLD_STATE_V2 · HOLD_SIDEBAR
  ];

  /* A lista explícita agora vem do REGISTRO ÚNICO de chaves
     (core/atlas-storage.js), em vez de ser mantida à mão aqui.

     Antes eram duas listas para sincronizar, e a daqui já estava
     defasada: trazia atlas.state.v1, atlas_defi_state_v3,
     atlas_rwa_state_v3 e HOLD_STATE_V2 — nomes que a migração do 3.6
     aposentou. Uma chave nova continua coberta pelos PATTERNS, e
     AtlasStorage.orphans() denuncia o que escapar dos dois. */
  var EXPLICIT = (window.AtlasStorage && window.AtlasStorage.KEYS)
    ? window.AtlasStorage.KEYS.slice()
    : [
        /* reserva, para o backup nunca depender de outro arquivo ter
           carregado — se AtlasStorage faltar, o essencial ainda entra */
        "atlas.settings.v1",
        "atlas.wallets.v2",
        "atlas.theses.v1",
        "atlas.movements.v1",
        "atlas.future_studies.v1",
        "atlas.hold.state.v2",
        "atlas.trade.state.v1",
        "atlas.defi.state.v3",
        "atlas.rwa.state.v3",
        "atlas.snapshots.v1"
      ];

  /* Caches são descartáveis: o site refaz sozinho na primeira
     conexão. Ficam de fora para o arquivo não inchar à toa. */
  var CACHE_KEYS = {
    "atlas.assets.cache.v1": 1,
    "atlas.http.cache.v1": 1,
    "atlas.fx.v1": 1,
    /* A sessão não é cache, mas é descartável pelo mesmo motivo: ela é
       do DISPOSITIVO, não do patrimônio. Restaurar um backup noutra
       máquina não pode arrastar "quem estava logado" junto. */
    "atlas.session.v1": 1
  };

  /* Chaves descartáveis por PADRÃO de nome (a lista acima é exata).
     ------------------------------------------------------------------
     A antiga tela de Configurações do DeFi tinha um botão "Backup
     local" que gravava atlas_defi_backup_<timestamp> e nunca limpava
     nada: cada clique deixava uma cópia inteira do módulo no
     localStorage, para sempre. São fotografias mortas de um estado
     antigo — entrariam no arquivo de backup multiplicando o tamanho
     dele sem acrescentar nada.

     Aquela tela foi removida (as preferências dela duplicavam as
     globais e o tema claro dela nem funcionava), então nenhuma chave
     nova dessas aparece. As que já existem no navegador do usuário
     ficam fora do backup a partir daqui. */
  var CACHE_PATTERNS = [
    /^atlas_defi_backup_/i
  ];

  function isCache(key) {
    if (CACHE_KEYS[key]) return true;
    for (var i = 0; i < CACHE_PATTERNS.length; i++) {
      if (CACHE_PATTERNS[i].test(key)) return true;
    }
    return false;
  }

  /* Rótulo humano por chave — usado no resumo da tela.
     Os nomes antigos continuam aqui: um arquivo de backup EXPORTADO
     antes do 3.6 traz as chaves velhas, e ao inspecioná-lo o usuário
     precisa entender o que está restaurando. */
  var LABELS = {
    /* convenção atual */
    "atlas.settings.v1":       "Configurações",
    "atlas.wallets.v2":        "Carteiras",
    "atlas.theses.v1":         "Teses",
    /* O livro de caixa é a chave mais importante do backup: todo saldo
       de carteira é derivado dele, e não há como reconstruí-lo a partir
       de mais nada. Ver wallets/walletCaixa.js. */
    "atlas.caixa.v1":          "Caixa e movimentações",
    "atlas.precos.manual.v1":  "Preços informados por você",
    /* aposentada: atlas-movements virou uma vista sobre o caixa e não
       grava mais nada. Só aparece em arquivos antigos. */
    "atlas.movements.v1":      "Movimentações (nome antigo)",
    "atlas.future_studies.v1": "Estudos",
    "atlas.intro.seen.v1":     "Apresentação já vista",
    "atlas.hold.state.v2":     "Hold",
    "atlas.hold.wallet.v1":    "Hold · carteira local",
    "atlas.trade.state.v1":    "Trade",
    "atlas.defi.state.v3":     "DeFi",
    "atlas.defi.wallet.v1":    "DeFi · carteira local",
    "atlas.defi.tokens.v1":    "DeFi · tokens",
    "atlas.defi.pools.v1":     "DeFi · catálogo de pools",
    "atlas.rwa.state.v3":      "RWA",
    "atlas.snapshots.v1":      "Histórico de patrimônio (medições diárias)",
    "atlas.assets.cg_key.v1":  "Chave da API CoinGecko",
    /* nomes aposentados — só aparecem em arquivos antigos */
    "atlas.state.v1":          "Trade (nome antigo)",
    "atlas_defi_state_v3":     "DeFi (nome antigo)",
    "atlas_defi_state_v2":     "DeFi (versão antiga)",
    "atlas_rwa_state_v3":      "RWA (nome antigo)",
    "atlas_rwa_state_v2":      "RWA (versão antiga)",
    "HOLD_STATE_V2":           "Hold (nome antigo)",
    "HOLD_SIDEBAR":            "Hold · barra lateral",
    "atlas:currency":          "Moeda",
    "atlas:movement":          "Movimento",
    "atlas:settings":          "Preferências (legado)"
  };

  function labelFor(key) { return LABELS[key] || key; }

  function belongs(key) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].test(key)) return true;
    }
    return EXPLICIT.indexOf(key) !== -1;
  }

  /* ============================================================
     2. Varredura
     ============================================================ */

  function safeStorage() {
    try {
      if (!window.localStorage) return null;
      return window.localStorage;
    } catch (e) { return null; }   // file:// com storage bloqueado
  }

  function scan() {
    var ls = safeStorage();
    var out = [];
    if (!ls) return out;

    for (var i = 0; i < ls.length; i++) {
      var key = ls.key(i);
      if (!key || !belongs(key)) continue;
      var val = "";
      try { val = ls.getItem(key) || ""; } catch (e) { continue; }
      out.push({
        key: key,
        label: labelFor(key),
        bytes: val.length,
        group: isCache(key) ? "cache" : "dados"
      });
    }
    out.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    return out;
  }

  function human(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function stats() {
    var list = scan();
    var dados = list.filter(function (e) { return e.group === "dados"; });
    var bytes = dados.reduce(function (s, e) { return s + e.bytes; }, 0);
    return {
      keys: dados.length,
      bytes: bytes,
      human: human(bytes),
      groups: dados.map(function (e) { return e.label; })
    };
  }

  /* ============================================================
     3. Montagem do arquivo
     ============================================================ */

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
           "_" + pad(d.getHours()) + "h" + pad(d.getMinutes());
  }

  function filename() { return "atlas-backup_" + stamp() + ".json"; }

  function build() {
    var ls = safeStorage();
    var data = {};
    var manifest = [];

    scan().forEach(function (entry) {
      if (entry.group === "cache") return;         // cache não entra
      try {
        data[entry.key] = ls.getItem(entry.key);
      } catch (e) { return; }
      manifest.push({ key: entry.key, label: entry.label, bytes: entry.bytes });
    });

    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      app: "ATLAS",
      createdAt: new Date().toISOString(),
      origin: location.href,
      manifest: manifest,
      data: data
    };
  }

  /* ============================================================
     4. Download

     Blob + <a download> funciona sob file:// no Chrome/Edge.
     Se por algum motivo falhar, cai para data: URL.
     ============================================================ */

  function download() {
    var payload = build();
    var text = JSON.stringify(payload, null, 2);
    var name = filename();

    try {
      var blob = new Blob([text], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 400);
    } catch (e) {
      var a2 = document.createElement("a");
      a2.href = "data:application/json;charset=utf-8," + encodeURIComponent(text);
      a2.download = name;
      a2.click();
    }

    return { name: name, bytes: text.length, keys: payload.manifest.length };
  }

  /* ============================================================
     5. Leitura e validação

     Recusar arquivo estranho é mais importante que aceitar:
     um import errado sobrescreve dados reais.
     ============================================================ */

  function parse(text) {
    var obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      throw new Error("Arquivo não é um JSON válido.");
    }
    if (!obj || typeof obj !== "object") {
      throw new Error("Arquivo vazio ou em formato desconhecido.");
    }
    if (obj.format !== FORMAT) {
      throw new Error("Este arquivo não é um backup do ATLAS.");
    }
    if (!obj.data || typeof obj.data !== "object") {
      throw new Error("Backup sem dados dentro.");
    }
    var keys = Object.keys(obj.data);
    if (!keys.length) {
      throw new Error("Backup não contém nenhum registro.");
    }
    for (var i = 0; i < keys.length; i++) {
      if (!belongs(keys[i])) {
        throw new Error("Backup contém chave estranha ao ATLAS: " + keys[i]);
      }
    }
    return obj;
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("Nenhum arquivo escolhido.")); return; }
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || "")); };
      fr.onerror = function () { reject(new Error("Não foi possível ler o arquivo.")); };
      fr.readAsText(file);
    });
  }

  function inspect(payload) {
    var when = "";
    try {
      when = new Date(payload.createdAt).toLocaleString("pt-BR");
    } catch (e) { when = payload.createdAt || "—"; }

    var man = payload.manifest || Object.keys(payload.data).map(function (k) {
      return { key: k, label: labelFor(k), bytes: (payload.data[k] || "").length };
    });
    var bytes = man.reduce(function (s, e) { return s + (e.bytes || 0); }, 0);

    return {
      createdAt: when,
      keys: man.length,
      bytes: bytes,
      human: human(bytes),
      labels: man.map(function (e) { return e.label || labelFor(e.key); })
    };
  }

  /* ============================================================
     6. Restauração

     mode "replace" (padrão) — apaga as chaves ATLAS atuais e grava
                               as do arquivo. Estado idêntico ao do
                               dia do backup.
     mode "merge"            — só sobrescreve o que existe no arquivo,
                               preserva o resto.

     Antes de qualquer escrita, guarda uma cópia de emergência em
     memória; se a gravação falhar no meio, desfaz.
     ============================================================ */

  function restore(payload, mode) {
    var ls = safeStorage();
    if (!ls) throw new Error("localStorage indisponível neste navegador.");

    mode = mode === "merge" ? "merge" : "replace";

    // cópia de emergência do estado atual
    var rollback = {};
    scan().forEach(function (e) {
      if (e.group === "cache") return;
      try { rollback[e.key] = ls.getItem(e.key); } catch (err) {}
    });

    try {
      if (mode === "replace") {
        Object.keys(rollback).forEach(function (k) {
          if (!(k in payload.data)) {
            try { ls.removeItem(k); } catch (err) {}
          }
        });
      }
      Object.keys(payload.data).forEach(function (k) {
        var v = payload.data[k];
        if (typeof v !== "string") v = JSON.stringify(v);
        ls.setItem(k, v);
      });
    } catch (err) {
      // desfaz tudo
      Object.keys(rollback).forEach(function (k) {
        try { ls.setItem(k, rollback[k]); } catch (e2) {}
      });
      throw new Error("Falha ao gravar. Nada foi alterado. (" + err.message + ")");
    }

    return { keys: Object.keys(payload.data).length, mode: mode };
  }

  /* ============================================================
     API
     ============================================================ */
  window.AtlasBackup = {
    FORMAT: FORMAT,
    scan: scan,
    stats: stats,
    build: build,
    download: download,
    parse: parse,
    readFile: readFile,
    inspect: inspect,
    restore: restore,
    filename: filename,
    human: human,
    label: labelFor
  };
})();
