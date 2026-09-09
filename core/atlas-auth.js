/* ============================================================
   ATLAS · core/atlas-auth.js
   A costura da sessão — pronta para um provedor real, funcionando
   sem nenhum.

   POR QUE ISTO EXISTE AGORA
   -------------------------
   Autenticação de verdade é uma FASE FUTURA, e este arquivo não a
   implementa nem exige que ninguém configure nada. Ele resolve um
   problema que existe hoje e prepara o terreno para amanhã.

   O problema de hoje: "Sair" era um link para login.html. Nada era
   encerrado, porque nada era começado — não havia sessão. Entrar,
   sair e entrar de novo eram três navegações sem estado nenhum, e o
   sistema não sabia dizer se havia alguém do outro lado.

   O terreno de amanhã: quando um provedor real entrar (Firebase,
   Supabase, o que for), ele se registra aqui e TODO o resto do
   sistema continua chamando as mesmas quatro funções. Nenhuma tela
   precisa saber qual provedor está atrás.

   O QUE ELE NÃO FAZ — E ISSO É DE PROPÓSITO
   -----------------------------------------
   No modo "local" (o de hoje) ele NÃO barra ninguém. Abrir
   dashboard.html direto continua funcionando exatamente como sempre
   funcionou.

   Barrar seria teatro: sem provedor, a "sessão" é um registro no
   mesmo localStorage que o usuário controla — trancar a porta com a
   chave pendurada na fechadura. Pior, quebraria o uso atual em troca
   de uma segurança que não existe.

   O portão liga sozinho no dia em que um provedor for registrado.
   Até lá, a sessão serve para o sistema SABER quem entrou, e para o
   "Sair" significar alguma coisa.

   COMO UM PROVEDOR ENTRA (fase futura)
   ------------------------------------
     AtlasAuth.registerProvider({
       nome: "firebase",
       current:  function () { return { email, name } | null; },
       signIn:   function (creds) { return Promise<user>; },
       signOut:  function () { return Promise; },
       onChange: function (fn) { ... }        // opcional
     });

   Registrado o provedor, mode() passa a devolver o nome dele,
   protegido() passa a valer e as telas não mudam uma linha.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasAuth) return;

  var KEY = "atlas.session.v1";
  var provedor = null;
  var ouvintes = [];

  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }

  /* ---------- sessão local ---------- */

  function lerLocal() {
    return safe(function () {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.email) ? s : null;
    }, null);
  }

  function gravarLocal(sessao) {
    safe(function () {
      if (sessao) global.localStorage.setItem(KEY, JSON.stringify(sessao));
      else global.localStorage.removeItem(KEY);
    });
  }

  function avisar() {
    var u = API.current();
    ouvintes.slice().forEach(function (fn) { safe(function () { fn(u); }); });
    safe(function () {
      document.dispatchEvent(new CustomEvent("atlas:auth", { detail: u }));
    });
  }

  /* O nome de exibição continua vindo de onde sempre veio
     (AtlasSettings.profile, que lê o estado do Hold). A sessão guarda
     IDENTIDADE, não perfil — duas coisas diferentes que, misturadas,
     viram dois lugares de verdade divergindo em silêncio. */
  function nomeDePerfil() {
    if (global.AtlasSettings && AtlasSettings.profile) {
      return safe(function () { return AtlasSettings.profile().name; }, "");
    }
    return "";
  }

  var API = {
    /* "local" enquanto não houver provedor. Quem quiser saber se a
       autenticação é real pergunta por isto, não por um booleano
       escondido. */
    mode: function () { return provedor ? (provedor.nome || "provedor") : "local"; },

    real: function () { return !!provedor; },

    registerProvider: function (p) {
      if (!p || typeof p.signIn !== "function" || typeof p.signOut !== "function") return false;
      provedor = p;
      if (typeof p.onChange === "function") {
        safe(function () { p.onChange(function () { avisar(); }); });
      }
      avisar();
      return true;
    },

    current: function () {
      if (provedor) return safe(function () { return provedor.current() || null; }, null);
      var s = lerLocal();
      if (!s) return null;
      return { email: s.email, name: nomeDePerfil() || s.email.split("@")[0], desde: s.desde };
    },

    autenticado: function () { return !!API.current(); },

    signIn: function (creds) {
      creds = creds || {};
      if (provedor) return Promise.resolve(provedor.signIn(creds)).then(function (u) { avisar(); return u; });
      /* Modo local: registra que alguém entrou. Não valida nada, e o
         arquivo inteiro diz isso em voz alta — o login já era simulado
         antes deste arquivo existir. */
      var email = String(creds.email || "").trim() || "voce@atlas.local";
      gravarLocal({ email: email, desde: Date.now(), modo: "local" });
      avisar();
      return Promise.resolve(API.current());
    },

    signOut: function () {
      var p = provedor ? Promise.resolve(provedor.signOut()) : Promise.resolve(gravarLocal(null));
      return p.then(function () {
        avisar();
        return true;
      });
    },

    /* Chamado pelas telas internas. No modo local devolve true sempre e
       não redireciona — ver a nota longa no topo. Com provedor real,
       manda para o login quem não tiver sessão. */
    protegido: function (paraOnde) {
      if (!provedor) return true;
      if (API.autenticado()) return true;
      var destino = paraOnde ||
        ((global.AtlasShell && AtlasShell.raiz) ? AtlasShell.raiz() + "pages/login.html" : "login.html");
      safe(function () { global.location.replace(destino); });
      return false;
    },

    onChange: function (fn) { if (typeof fn === "function") ouvintes.push(fn); return fn; },
    offChange: function (fn) {
      var i = ouvintes.indexOf(fn);
      if (i >= 0) ouvintes.splice(i, 1);
    }
  };

  /* Outra aba encerrou a sessão: esta acompanha. */
  safe(function () {
    global.addEventListener("storage", function (e) {
      if (e && e.key === KEY) avisar();
    });
  });

  global.AtlasAuth = API;
})(window);
