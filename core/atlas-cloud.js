/* ============================================================
   ATLAS · core/atlas-cloud.js  — Fase 2: dados na nuvem
   Espelha o portfólio (localStorage) no Firestore, por usuário.
   Depende de: firebase(app+auth+firestore compat), core/atlas-firebase.js
               (provedor), core/atlas-storage.js (registro de chaves),
               core/atlas-auth.js.

   COMO FUNCIONA (modelo "puxa ao abrir + aviso", sem tempo real)
   -------------------------------------------------------------
   - localStorage continua a cópia de trabalho local (offline, rápido).
   - Firestore é o espelho: atlas_users/{uid}/store/{chave} — um doc por
     chave de DADO ({ value, updatedAt, device }). Caches e a sessão NÃO
     sobem (AtlasStorage.isDiscardable).
   - Ao logar/abrir: puxa a nuvem e concilia por chave (last-write-wins
     por updatedAt vs. hora da última edição local). Nuvem vazia + local
     com dados → semeia a nuvem. Cloud vence e sobrescreve local → um
     backup local é guardado antes (nada some em silêncio) e a página
     recarrega uma vez para os stores lerem os dados novos.
   - A cada edição local (observador sobre localStorage.setItem/removeItem)
     → empurra aquela chave (debounce). Offline: o Firestore enfileira e
     envia ao reconectar (persistência habilitada).
   - Se OUTRO aparelho gravar algo enquanto este está aberto, um aviso
     discreto oferece recarregar — sem sobrescrever edição em andamento.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasCloud) return;
  var CFG = global.ATLAS_FIREBASE;
  if (!CFG || !global.firebase || !firebase.firestore || !global.AtlasStorage || !global.AtlasAuth) return;

  var db;
  try {
    db = firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) {} // offline queue (best-effort)
  } catch (e) { return; }

  var LS = global.localStorage;
  var MODS_KEY = "atlas.cloud.localmods.v1"; // { chave: tsMillis } — não sincroniza
  var DEV_KEY  = "atlas.cloud.device.v1";    // id deste navegador — não sincroniza
  var BAK_KEY  = "atlas.cloud.localbak.v1";  // backup de segurança antes de sobrescrever

  function isData(k) { return AtlasStorage.KEYS.indexOf(k) !== -1 && !AtlasStorage.isDiscardable(k) && k !== MODS_KEY && k !== DEV_KEY && k !== BAK_KEY; }
  function dataKeys() { return AtlasStorage.KEYS.filter(isData); }
  function docId(k) { return k.replace(/\./g, "__"); }

  function device() {
    try { var d = LS.getItem(DEV_KEY); if (!d) { d = "dev-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36); LS.setItem(DEV_KEY, d); } return d; }
    catch (e) { return "dev-x"; }
  }
  var DEVICE = device();

  function readMods() { try { return JSON.parse(LS.getItem(MODS_KEY) || "{}"); } catch (e) { return {}; } }
  function writeMods(m) { try { LS.setItem(MODS_KEY, JSON.stringify(m)); } catch (e) {} }
  function markMod(k) { var m = readMods(); m[k] = Date.now(); writeMods(m); }

  var uid = null, startupDone = false, applyingRemote = false, timers = {}, unsub = null, startedAt = 0;

  function storeCol() { return db.collection("atlas_users").doc(uid).collection("store"); }

  // ---------- observador de escritas locais ----------
  var origSet = Storage.prototype.setItem, origRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    origSet.apply(this, arguments); // a escrita original SEMPRE acontece primeiro
    try { if (this === LS && !applyingRemote && isData(k)) { markMod(k); if (uid && startupDone) schedulePush(k, false); } } catch (e) {}
  };
  Storage.prototype.removeItem = function (k) {
    origRemove.apply(this, arguments);
    try { if (this === LS && !applyingRemote && isData(k)) { markMod(k); if (uid && startupDone) schedulePush(k, true); } } catch (e) {}
  };

  function schedulePush(k, removed) { clearTimeout(timers[k]); timers[k] = setTimeout(function () { pushKey(k, removed); }, 1500); }

  function pushKey(k, removed) {
    if (!uid) return;
    var ref = storeCol().doc(docId(k));
    if (removed) { ref.delete().catch(function () {}); return; }
    var v = null; try { v = LS.getItem(k); } catch (e) {}
    if (v === null) { ref.delete().catch(function () {}); return; }
    ref.set({ value: v, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), device: DEVICE }).catch(function () {});
  }

  function pushAll() { dataKeys().forEach(function (k) { var v = null; try { v = LS.getItem(k); } catch (e) {} if (v !== null) pushKey(k, false); }); }

  // ---------- backup de segurança (uma vez, antes de sobrescrever) ----------
  function backupLocalOnce() {
    try {
      if (global.AtlasBackup && AtlasBackup.build) { LS.setItem(BAK_KEY, JSON.stringify(AtlasBackup.build())); return; }
      var d = {}; dataKeys().forEach(function (k) { var v = LS.getItem(k); if (v !== null) d[k] = v; });
      LS.setItem(BAK_KEY, JSON.stringify({ t: Date.now(), data: d }));
    } catch (e) {}
  }

  // ---------- sincronização de abertura ----------
  function startupSync() {
    startedAt = Date.now();
    storeCol().get().then(function (snap) {
      var cloud = {}; // key -> { value, at }
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var at = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0;
        cloud[doc.id.replace(/__/g, ".")] = { value: (d.value != null ? d.value : null), at: at };
      });
      var mods = readMods();
      var keys = dataKeys();
      var cloudEmpty = Object.keys(cloud).length === 0;

      if (cloudEmpty) {
        // primeira vez: semeia a nuvem com o que existe local
        var temLocal = keys.some(function (k) { var v = LS.getItem(k); return v !== null && v !== ""; });
        startupDone = true;
        if (temLocal) pushAll();
        listenOthers();
        return;
      }

      // nuvem tem dados: concilia por chave (last-write-wins por tempo)
      var changed = false, didBackup = false, pushBack = [];
      keys.forEach(function (k) {
        var c = cloud[k]; var localVal = null; try { localVal = LS.getItem(k); } catch (e) {}
        var localAt = mods[k] || 0;
        if (!c) { if (localVal !== null) pushBack.push(k); return; }        // só local tem → sobe depois
        if (c.value === localVal) return;                                   // igual → nada
        if (localAt > c.at) { pushBack.push(k); return; }                   // local mais novo → local vence
        // nuvem vence → aplica no local
        if (!didBackup && localVal !== null) { backupLocalOnce(); didBackup = true; }
        applyingRemote = true;
        try { if (c.value === null) LS.removeItem(k); else LS.setItem(k, c.value); } catch (e) {}
        applyingRemote = false;
        changed = true;
      });

      startupDone = true;
      pushBack.forEach(function (k) { pushKey(k, false); });

      if (changed) {
        // recarrega uma vez para os stores relerem o localStorage
        var flag = "atlas.cloud.reloaded." + uid;
        var already = false; try { already = sessionStorage.getItem(flag) === "1"; } catch (e) {}
        if (!already) { try { sessionStorage.setItem(flag, "1"); } catch (e) {} location.reload(); return; }
      }
      try { sessionStorage.removeItem("atlas.cloud.reloaded." + uid); } catch (e) {}
      listenOthers();
    }).catch(function () { startupDone = true; }); // falhou a nuvem → segue local, observador ativo
  }

  // ---------- aviso quando OUTRO aparelho muda algo ----------
  function listenOthers() {
    if (unsub) { try { unsub(); } catch (e) {} }
    var first = true;
    unsub = storeCol().onSnapshot(function (snap) {
      if (first) { first = false; return; } // ignora o estado inicial
      var outro = false;
      snap.docChanges().forEach(function (ch) {
        var d = ch.doc.data() || {};
        var at = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0;
        if (d.device && d.device !== DEVICE && at > startedAt) outro = true;
      });
      if (outro) avisoRecarregar();
    }, function () {});
  }

  var estiloPosto = false;
  function poeEstilo() {
    if (estiloPosto) return; estiloPosto = true;
    var s = document.createElement("style");
    s.textContent =
      ".atlas-cloud-aviso{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;" +
      "display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;" +
      "background:#0C1626;border:1px solid rgba(0,240,255,.28);box-shadow:0 18px 50px rgba(0,0,0,.5);" +
      "color:#E6F1FF;font-family:'Inter',system-ui,sans-serif;font-size:13.5px;max-width:92vw}" +
      ".atlas-cloud-aviso button{cursor:pointer;font-family:inherit}" +
      ".atlas-cloud-aviso>button:not(.atlas-cloud-aviso__x){font-size:12.5px;font-weight:600;color:#04121e;" +
      "background:linear-gradient(135deg,#00BFFF,#00F0FF);border:none;border-radius:8px;padding:7px 12px}" +
      ".atlas-cloud-aviso__x{background:none;border:none;color:rgba(230,241,255,.55);font-size:18px;line-height:1;padding:0 2px}";
    (document.head || document.documentElement).appendChild(s);
  }

  var avisoAberto = false;
  function avisoRecarregar() {
    if (avisoAberto) return; avisoAberto = true;
    poeEstilo();
    var bar = document.createElement("div");
    bar.className = "atlas-cloud-aviso";
    bar.setAttribute("role", "status");
    var txt = document.createElement("span"); txt.textContent = "Seus dados foram atualizados em outro aparelho.";
    var btn = document.createElement("button"); btn.type = "button"; btn.textContent = "Recarregar";
    btn.addEventListener("click", function () { location.reload(); });
    var x = document.createElement("button"); x.type = "button"; x.className = "atlas-cloud-aviso__x"; x.textContent = "×";
    x.addEventListener("click", function () { if (bar.parentNode) bar.parentNode.removeChild(bar); avisoAberto = false; });
    bar.appendChild(txt); bar.appendChild(btn); bar.appendChild(x);
    (document.body || document.documentElement).appendChild(bar);
  }

  // ---------- ciclo de vida ----------
  function onAuth() {
    var u = AtlasAuth.current && AtlasAuth.current();
    var novoUid = null;
    try { novoUid = firebase.auth().currentUser && firebase.auth().currentUser.uid; } catch (e) {}
    if (u && novoUid) {
      if (uid === novoUid) return;    // já sincronizado nesta sessão
      uid = novoUid; startupDone = false;
      startupSync();
    } else {
      uid = null; startupDone = false;
      if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    }
  }
  AtlasAuth.onChange(onAuth);
  onAuth(); // caso a sessão já esteja resolvida

  global.AtlasCloud = {
    status: function () { return { uid: uid, device: DEVICE, pronto: startupDone }; },
    forcarPush: pushAll
  };
})(window);
