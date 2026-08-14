/* ============================================================
   ATLAS · core/atlas-storage.js
   ------------------------------------------------------------
   O REGISTRO DE CHAVES — e a migração para uma convenção só.

   O problema
   ----------
   O ATLAS guardava dados sob TRÊS convenções de nome ao mesmo tempo:

     atlas.wallets.v2         ponto        (a maioria)
     atlas_defi_state_v3      underscore   (DeFi, RWA, alguns caches)
     HOLD_STATE_V2            maiúsculas   (Hold, o mais antigo)

   Não é só feiura. core/atlas-backup.js precisava de TRÊS expressões
   regulares para varrer tudo, e uma chave nova que escapasse das três
   ficaria de fora do backup — em silêncio. Num sistema onde o backup é
   a única proteção contra formatar o PC, "em silêncio" é o pior modo
   de falhar.

   A convenção, daqui em diante
   ----------------------------
       atlas.<módulo>.<coisa>.v<N>

   Módulo é hold, trade, defi, rwa — ou omitido quando o dado é do
   sistema (atlas.settings.v1, atlas.wallets.v2).

   A migração
   ----------
   Roda uma vez, no carregamento de QUALQUER página, antes de qualquer
   store abrir. Para cada nome antigo encontrado:

     1. copia para o nome novo (se o novo ainda não existir);
     2. LÊ DE VOLTA e compara byte a byte;
     3. só então apaga o antigo.

   Se a leitura de volta não bater, o antigo FICA e um aviso vai ao
   console. Preferir dois registros a zero registro não é preciosismo:
   é dado financeiro do usuário.

   Idempotente: rodar de novo não faz nada.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasStorage) return;

  /* ---------- nome antigo → nome canônico ---------- */
  var RENOMEIAS = {
    "HOLD_STATE_V2":              "atlas.hold.state.v2",
    "atlas_hold_local_wallet":    "atlas.hold.wallet.v1",
    "atlas.state.v1":             "atlas.trade.state.v1",
    "atlas_defi_state_v3":        "atlas.defi.state.v3",
    "atlas_defi_local_wallet":    "atlas.defi.wallet.v1",
    "atlas_defi_token_overrides": "atlas.defi.tokens.v1",
    "atlas_pools_registry_v1":    "atlas.defi.pools.v1",
    "atlas_rwa_state_v3":         "atlas.rwa.state.v3"
  };

  /* Chaves que o ATLAS ABANDONOU. Não migram: são apagadas.
     HOLD_SIDEBAR guardava o estado da sidebar colapsada do Hold, que o
     próprio router já removia a cada carga.
     atlas_defi_state_v2 é o formato pré-carteiras do DeFi; defi/js/data.js
     já leu e converteu para a v3 quando existia.
     atlas.defi.pools.v1 era o catálogo de pools do DefiLlama, que
     alimentava a busca removida na terceira auditoria. Sem quem leia,
     ficaria ocupando espaço — e não era pouco: milhares de pools, na
     casa dos megabytes, dentro de uma cota de 5 MB compartilhada com
     todo o resto do ATLAS. */
  var ABANDONADAS = ["HOLD_SIDEBAR", "atlas_defi_state_v2", "atlas.defi.pools.v1",
                     /* atlas.movements.v1 era o armazenamento do SEGUNDO
                        livro-razão. js/atlas-movements.js virou uma vista
                        sobre o livro de caixa e não grava mais nada — o que
                        estiver lá é cópia do que o caixa já sabe, e mantê-lo
                        seria manter a divergência de pé. */
                     "atlas.movements.v1"];

  /* Chaves descartáveis: cache que o sistema refaz sozinho. Ficam fora
     do backup (ver core/atlas-backup.js). */
  var DESCARTAVEIS = [
    "atlas.http.cache.v1",
    "atlas.assets.cache.v1",
    "atlas.fx.v1",
    /* A sessão é do DISPOSITIVO, não do patrimônio: restaurar um backup
       noutra máquina não pode arrastar "quem estava logado" junto. */
    "atlas.session.v1"
  ];

  /* Tudo o que o ATLAS possui, já com os nomes canônicos. É esta lista
     que o backup usa — não uma regex que pode deixar chave nova de fora. */
  var CANONICAS = [
    /* sistema */
    "atlas.settings.v1",
    "atlas.wallets.v2",
    "atlas.theses.v1",
    "atlas.future_studies.v1",
    /* ------------------------------------------------------------
       O LIVRO DE CAIXA — a chave mais importante do backup

       Todo saldo de carteira é DERIVADO deste arquivo. Deixá-lo de
       fora significaria restaurar um backup com as posições intactas
       e o caixa em zero — e, como o caixa é consequência do
       histórico, não haveria como reconstruí-lo a partir de mais
       nada. Ver wallets/walletCaixa.js.
       ------------------------------------------------------------ */
    "atlas.caixa.v1",
    "atlas.intro.seen.v1",
    "atlas.onboarding.v1",
    "atlas.notifications.v1",
    /* A sessão é do DISPOSITIVO, não do usuário: restaurar um backup
       noutra máquina não deve arrastar "quem estava logado" junto. Fica
       registrada aqui para o backup CONHECER a chave — e é descartável,
       como os caches. */
    "atlas.session.v1",
    /* módulos */
    "atlas.hold.state.v2",
    "atlas.hold.wallet.v1",
    "atlas.trade.state.v1",
    "atlas.defi.state.v3",
    "atlas.defi.wallet.v1",
    "atlas.defi.tokens.v1",
    "atlas.rwa.state.v3",
    /* ------------------------------------------------------------
       MEDIÇÕES DIÁRIAS — dado do usuário, não cache

       "Quanto isto valia naquele dia" é a única coisa que o ATLAS não
       consegue refazer depois: o preço de ontem não volta. Perder esta
       chave é perder o histórico inteiro do patrimônio, mesmo com
       todas as posições intactas. Ver core/atlas-snapshots.js. */
    "atlas.snapshots.v1",
    /* ------------------------------------------------------------
       PREÇOS INFORMADOS À MÃO — isto é DADO DO USUÁRIO, não cache

       Quando nenhuma API reconhece um ativo, o preço passa a ser o que
       o usuário digitou (ver core/atlas-precos.js). Fora desta lista,
       um backup/restauração levaria as posições e deixaria os preços
       para trás — e as posições voltariam sem valor de mercado e sem
       veredito de faixa, sem nada explicando o porquê.
       ------------------------------------------------------------ */
    "atlas.precos.manual.v1",
    /* caches (descartáveis) */
    "atlas.http.cache.v1",
    "atlas.assets.cache.v1",
    "atlas.assets.cg_key.v1",
    "atlas.fx.v1"
  ];

  function disponivel() {
    try {
      var k = "__atlas_storage_probe__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  var TEM_LS = disponivel();

  function ler(k) {
    try { return global.localStorage.getItem(k); } catch (e) { return null; }
  }
  function gravar(k, v) {
    try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function apagar(k) {
    try { global.localStorage.removeItem(k); } catch (e) {}
  }

  var relatorio = { migradas: [], mantidas: [], removidas: [] };

  function migrar() {
    if (!TEM_LS) return relatorio;

    Object.keys(RENOMEIAS).forEach(function (antigo) {
      var novo = RENOMEIAS[antigo];
      var valorAntigo = ler(antigo);
      if (valorAntigo === null) return;              // nada a fazer

      var valorNovo = ler(novo);

      /* Já migrado numa carga anterior (ou por outra aba): o antigo é
         resíduo. Só sai se o novo realmente tem conteúdo. */
      if (valorNovo !== null) {
        apagar(antigo);
        relatorio.removidas.push(antigo);
        return;
      }

      if (!gravar(novo, valorAntigo)) {
        relatorio.mantidas.push(antigo + " (falha ao gravar " + novo + ")");
        return;
      }

      /* Confere ANTES de apagar. Cota estourada e modo privado falham
         de formas que setItem nem sempre denuncia. */
      if (ler(novo) !== valorAntigo) {
        apagar(novo);
        relatorio.mantidas.push(antigo + " (leitura de volta não conferiu)");
        if (global.console) {
          console.warn("[AtlasStorage] migração de " + antigo + " abortada: " +
                       "o valor gravado em " + novo + " não confere. O dado " +
                       "antigo foi mantido.");
        }
        return;
      }

      apagar(antigo);
      relatorio.migradas.push(antigo + " → " + novo);
    });

    ABANDONADAS.forEach(function (k) {
      if (ler(k) !== null) { apagar(k); relatorio.removidas.push(k); }
    });

    if (relatorio.migradas.length && global.console) {
      console.info("[AtlasStorage] chaves migradas para a convenção nova:",
                   relatorio.migradas.join(", "));
    }
    return relatorio;
  }

  /* ---------- diagnóstico ----------
     Lista chaves do localStorage que PARECEM do ATLAS e não estão no
     registro. É o detector que faltava: com a varredura por regex, uma
     chave nova fora do padrão sumia do backup sem ninguém notar. */
  function orfas() {
    if (!TEM_LS) return [];
    var out = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k) continue;
        if (!/^atlas/i.test(k) && !/^HOLD_/.test(k)) continue;
        if (CANONICAS.indexOf(k) !== -1) continue;
        out.push(k);
      }
    } catch (e) {}
    return out;
  }

  migrar();

  global.AtlasStorage = {
    KEYS: CANONICAS.slice(),
    DISCARDABLE: DESCARTAVEIS.slice(),
    RENAMES: RENOMEIAS,
    isDiscardable: function (k) { return DESCARTAVEIS.indexOf(k) !== -1; },
    report: function () { return JSON.parse(JSON.stringify(relatorio)); },
    orphans: orfas,
    migrate: migrar
  };
})(typeof window !== "undefined" ? window : this);
