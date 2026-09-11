/* ============================================================
   ATLAS — Academy · Command Center de mercado
   SPA leve por rota de hash. Duas telas:
     #/               -> Dashboard (renderDashboard)
     #/ativo/<id>     -> Página do ativo (renderAsset)
   A busca do topo leva a #/ativo/<id>.
   ============================================================ */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var titleEl = document.getElementById("pageTitle");
  var subEl = document.getElementById("pageSub");

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var routes = {
    "": function (el) {
      setHead("Command Center", "Central de pesquisa de mercado — cripto e RWA em tempo real.");
      if (window.renderDashboard) renderDashboard(el);
      else el.textContent = "Carregando…";
    },
    "ativo": function (el, id) {
      setHead("Ativo", "Análise dedicada do ativo.");
      if (window.renderAsset) renderAsset(el, id);
      else el.textContent = "Carregando…";
    }
  };

  function setHead(t, s) {
    if (titleEl) titleEl.textContent = t;
    if (subEl) subEl.textContent = s;
  }

  function parse() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var p = h.split("/");
    return { name: p[0] || "", arg: decodeURIComponent(p[1] || "") };
  }

  var currentRoute = null;
  function render() {
    var r = parse();
    currentRoute = r.name;
    // avisa a tela anterior que saiu (para limpar timers de auto-refresh)
    if (window.__academyOnLeave) { try { window.__academyOnLeave(); } catch (e) {} window.__academyOnLeave = null; }
    clear(view);
    (routes[r.name] || routes[""])(view, r.arg);
    // marca item ativo da sidebar
    var items = document.querySelectorAll("#nav .nav-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", (items[i].getAttribute("data-route") || "") === r.name);
    }
  }

  window.AcademyRouter = {
    go: function (hash) { location.hash = hash; },
    current: function () { return currentRoute; }
  };

  // clique nos itens da sidebar
  document.querySelectorAll("#nav .nav-item").forEach(function (a) {
    a.addEventListener("click", function () { location.hash = "#/" + (a.getAttribute("data-route") || ""); });
  });

  // ---------- busca do topo (autocomplete) ----------
  var box = document.getElementById("globalSearch");
  var resultsBox = document.getElementById("searchResults");
  var lastResults = [];

  function hideResults() { if (resultsBox) { resultsBox.hidden = true; clear(resultsBox); } }

  function showResults(items) {
    if (!resultsBox) return;
    lastResults = items || [];
    clear(resultsBox);
    if (!items || !items.length) { resultsBox.hidden = true; return; }
    items.slice(0, 10).forEach(function (it) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "search-result";
      var sym = document.createElement("span");
      sym.className = "sr-sym";
      sym.textContent = it.symbol || "?";
      var name = document.createElement("span");
      name.className = "sr-name";
      name.textContent = it.name || "";
      row.appendChild(sym);
      row.appendChild(name);
      row.addEventListener("click", function () {
        box.value = "";
        hideResults();
        AcademyRouter.go("/ativo/" + it.id);
      });
      resultsBox.appendChild(row);
    });
    resultsBox.hidden = false;
  }

  window.__academySearchFirst = function () {
    if (lastResults && lastResults[0]) {
      box.value = "";
      hideResults();
      AcademyRouter.go("/ativo/" + lastResults[0].id);
    }
  };

  if (box) {
    var t;
    box.addEventListener("input", function () {
      clearTimeout(t);
      var q = box.value.trim();
      if (q.length < 2) { hideResults(); return; }
      t = setTimeout(function () {
        if (!window.AcademyData) return;
        AcademyData.search(q).then(showResults).catch(function () { hideResults(); });
      }, 250);
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); window.__academySearchFirst(); }
      if (e.key === "Escape") { hideResults(); }
    });
    document.addEventListener("click", function (e) {
      if (resultsBox && !resultsBox.contains(e.target) && e.target !== box) hideResults();
    });
  }

  window.addEventListener("hashchange", render);
  render();
})();
