/* ============================================================
   BATTLE POOLS — duas pools lado a lado (11/10/2026)
   Pedido do dono: o mesmo ativo em pools concorrentes (SPCX/SOL na Raydium
   × SPCXB/WBNB na PancakeSwap, ou duas SOL/USDC na Raydium) — onde rende
   mais e qual está crescendo. Placar com o vencedor de cada linha e gráfico
   de 24 h / 3 dias / 7 dias com as fotos de 4 em 4 h do servidor
   (ScannerServidor.snapshots). Usa as funções de cálculo da tabela
   (efic, ratio, volDia, fApr…), então os números batem com o Descobrir.
   Todo texto que vem de fora (par, plataforma, rede, busca) passa por esc().
   ============================================================ */
(function(){
  const CHAVE = "scanner_battle_v1";
  const CORES = { a: "#5b8cff", b: "#f5943b" };
  const PERIODOS = { "24h": [1, "24 horas"], "3d": [3, "3 dias"], "7d": [7, "7 dias"] };
  const METRICAS = { tvl: "TVL", vol: "Volume 24h", rend: "Rendimento/dia" };

  let st = { a: null, b: null, periodo: "24h", metrica: "tvl", modo: "usd" };
  try { Object.assign(st, JSON.parse(localStorage.getItem(CHAVE) || "{}")); } catch (e) {}
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) {} };
  const pool = id => (id == null ? null : state.pools.find(p => p.id === id) || null);

  /* ---- fotos de cada pool (servidor: de 4 em 4 h; manual: o histórico local) ---- */
  function fotos(p){
    if (!p) return Promise.resolve([]);
    if (!p.servidor || !window.ScannerServidor) return Promise.resolve((p.history || []).slice());
    if (!p._fotos) {
      p._fotos = ScannerServidor.snapshots(p.sid)
        .catch(() => ScannerServidor.historico(p.sid))
        .catch(() => []);
    }
    return p._fotos;
  }
  function pontos(lista, dias){
    const ini = Date.now() - dias * 86400000;
    return lista.filter(s => s.ts >= ini && s.tvl > 0).sort((x, y) => x.ts - y.ts).map(s => {
      const vol = +s.vol24h > 0 ? +s.vol24h : 0;
      // rendimento da foto: taxa × giro; sem taxa informada, o APR das taxas da fonte
      const rend = s.fee > 0 ? s.fee * vol / s.tvl : (s.apr > 0 ? s.apr / 365 : 0);
      return { ts: s.ts, tvl: +s.tvl, vol, rend };
    });
  }
  const valorDe = (pt, m) => m === "tvl" ? pt.tvl : m === "vol" ? pt.vol : pt.rend;
  const variacao = (pts, m) => (pts.length < 2 || !valorDe(pts[0], m)) ? null
    : (valorDe(pts[pts.length - 1], m) / valorDe(pts[0], m) - 1) * 100;

  /* ---- escolha das pools ---- */
  function escolher(lado, id){
    st[lado] = id; salvar();
    render();
  }
  function trocar(){ [st.a, st.b] = [st.b, st.a]; salvar(); render(); }
  function buscar(lado, q){
    const box = document.getElementById("btlRes-" + lado);
    if (!box) return;
    q = (q || "").trim();
    if (!q) { box.innerHTML = ""; return; }
    const outro = st[lado === "a" ? "b" : "a"];
    const achadas = state.pools.filter(p => trilhoDe(p) !== "oculta" && p.id !== outro && radarMatch(p, q))
      .sort((x, y) => y.tvl - x.tvl).slice(0, 8);
    box.innerHTML = achadas.length ? achadas.map(p => `
      <button type="button" class="btl-opcao" onclick="BattlePools.escolher('${lado}', ${Number(p.id)})">
        <b>${esc(p.pool)}</b><span>${esc(p.platform)} · ${esc(p.network)} · TVL ${fUSD(p.tvl)}</span>
      </button>`).join("") : `<div class="btl-vazio">Nenhuma pool com "${esc(q)}".</div>`;
  }
  /* botão ⚔ do Descobrir e do Radar: preenche o lado vazio (ou o B) e abre a aba */
  function adicionar(id){
    if (st.a === id || st.b === id) { switchTab("battle"); return; }
    if (st.a == null) st.a = id; else st.b = id;
    salvar(); switchTab("battle");
  }

  /* ---- tela ---- */
  function seletor(lado){
    const p = pool(st[lado]);
    const cor = CORES[lado], nome = lado.toUpperCase();
    return `<div class="btl-lado" style="--btl:${cor}">
      <div class="btl-rotulo"><i></i>Pool ${nome}</div>
      ${p ? `<div class="btl-escolhida">
          <div><b>${esc(p.pool)}</b><span>${esc(p.platform)} · ${esc(p.network)}</span></div>
          <button type="button" class="linkbtn" onclick="BattlePools.escolher('${lado}', null)">trocar</button>
        </div>` : `<input type="text" id="btlBusca-${lado}" class="btl-busca" autocomplete="off"
          placeholder="Buscar pool (ex: SPCX, SOL/USDC, Raydium)…" oninput="BattlePools.buscar('${lado}', this.value)">
        <div class="btl-res" id="btlRes-${lado}"></div>`}
    </div>`;
  }

  function placar(pa, pb, fa, fb){
    const per = PERIODOS[st.periodo][1];
    const dTa = variacao(fa, "tvl"), dTb = variacao(fb, "tvl"), dVa = variacao(fa, "vol"), dVb = variacao(fb, "vol");
    const money = v => "$" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const aprV = p => { const a = aprOf(p); return a ? a.v : null; };
    const linhas = [
      ["Rendimento por dia", efic(pa), efic(pb), v => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + "%", true],
      ["APR", aprV(pa), aprV(pb), v => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%", true],
      ["US$ 1.000 rendem por dia", efic(pa) * 10, efic(pb) * 10, money, true],
      ["US$ 1.000 rendem por mês", efic(pa) * 300, efic(pb) * 300, money, true],
      ["Razão (giro)", ratio(pa), ratio(pb), fRatio, true],
      ["Nota", pa.nota, pb.nota, v => Math.round(v), true],
      ["TVL", pa.tvl, pb.tvl, fUSD, true],
      ["Volume 24h", volDia(pa), volDia(pb), fUSD, true],
      [`TVL em ${per}`, dTa, dTb, fPctSigned, true],
      [`Volume em ${per}`, dVa, dVb, fPctSigned, true],
      ["Taxa", null, null, null, false, feeHTML(pa), feeHTML(pb)],
    ];
    const corpo = linhas.map(([rot, va, vb, fmt, compara, ha, hb]) => {
      const ok = compara && va != null && vb != null && isFinite(va) && isFinite(vb) && va !== vb;
      const ga = ok && va > vb, gb = ok && vb > va;
      const cel = (v, h, g) => `<td class="${g ? "btl-win" : ""}">${h != null ? h : (v == null || !isFinite(v) ? '<span class="muted2">—</span>' : fmt(v))}${g ? " ✓" : ""}</td>`;
      return `<tr><th>${rot}</th>${cel(va, ha, ga)}${cel(vb, hb, gb)}</tr>`;
    }).join("");
    return `<table class="btl-placar">
      <thead><tr><th></th><th style="color:${CORES.a}">${esc(pa.pool)}<small>${esc(pa.platform)} · ${esc(pa.network)}</small></th>
        <th style="color:${CORES.b}">${esc(pb.pool)}<small>${esc(pb.platform)} · ${esc(pb.network)}</small></th></tr></thead>
      <tbody>${corpo}</tbody></table>
      <p class="btl-veredito">${veredito(pa, pb, dTa, dTb)}</p>`;
  }

  /* fatos, não recomendação */
  function veredito(pa, pb, dTa, dTb){
    const ea = efic(pa), eb = efic(pb), frases = [];
    const vezes = x => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    if (ea > 0 && eb > 0 && ea !== eb) {
      const [m, n, x] = ea > eb ? ["A", "B", ea / eb] : ["B", "A", eb / ea];
      frases.push(`a <b>Pool ${m}</b> rende ${vezes(x)}× mais por dia que a Pool ${n}`);
    }
    if (pa.tvl > 0 && pb.tvl > 0 && pa.tvl !== pb.tvl) {
      const [m, x] = pa.tvl > pb.tvl ? ["A", pa.tvl / pb.tvl] : ["B", pb.tvl / pa.tvl];
      frases.push(`a <b>Pool ${m}</b> tem TVL ${vezes(x)}× maior (mais profunda: entra e sai com menos derrapagem)`);
    }
    if (dTa != null && dTb != null) {
      const rumo = d => d >= 0 ? "crescendo" : "encolhendo";
      frases.push(`em ${PERIODOS[st.periodo][1]} a Pool A está ${rumo(dTa)} (${fPctSigned(dTa)}) e a Pool B ${rumo(dTb)} (${fPctSigned(dTb)})`);
    }
    const ve = [pa, pb].filter(ehVe33);
    const nota = ve.length ? ` Nas DEXs ve(3,3) (${ve.map(p => esc(p.platform)).join(", ")}) o rendimento inclui emissões, pagas no token da DEX.` : "";
    const txt = frases.length ? frases.join("; ") + "." : "";
    return (txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "") + nota +
      " Rendimento supõe volume e TVL constantes e liquidez no range todo — é referência, não promessa.";
  }

  function grafico(fa, fb){
    const m = st.metrica, pct = st.modo === "pct";
    const serie = pts => {
      const base = pts.length ? valorDe(pts[0], m) : 0;
      return pts.map(pt => ({ ts: pt.ts, v: pct ? (base ? (valorDe(pt, m) / base - 1) * 100 : 0) : valorDe(pt, m) }));
    };
    const sa = serie(fa), sb = serie(fb);
    if (sa.length < 2 && sb.length < 2) {
      BattlePools._hover = null;
      return `<div class="radar-empty">Poucas fotos nesse período — o servidor tira uma a cada coleta (de 4 em 4 h). Tente um período maior.</div>`;
    }
    const W = 760, H = 280, pl = 58, pr = 14, pt = 14, pb = 26;
    const dias = PERIODOS[st.periodo][0], t1 = Date.now(), t0 = t1 - dias * 86400000;
    const vals = sa.concat(sb).map(s => s.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (!pct) lo = Math.min(lo, 0);
    if (hi === lo) { hi += 1; if (pct) lo -= 1; }
    const folga = (hi - lo) * 0.08; hi += folga; if (pct) lo = Math.max(-100, lo - folga);   // nada cai mais de 100%
    const x = t => pl + (t - t0) / (t1 - t0) * (W - pl - pr);
    const y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const fmtEixo = v => pct ? (v >= 0 ? "+" : "") + v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"
      : m === "rend" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + "%" : radarAxisUSD(v);
    const grade = [0, 0.5, 1].map(f => lo + f * (hi - lo)).map(v =>
      `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#1e2735"/>
       <text x="${pl - 6}" y="${(y(v) + 4).toFixed(1)}" fill="#6b7891" font-size="10" text-anchor="end">${fmtEixo(v)}</text>`).join("");
    const zero = pct && lo < 0 && hi > 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#3a465c" stroke-dasharray="3 4"/>` : "";
    const linha = (s, cor) => s.length < 2 ? "" :
      `<polyline points="${s.map(d => `${x(d.ts).toFixed(1)},${y(d.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linejoin="round"/>` +
      s.map(d => `<circle cx="${x(d.ts).toFixed(1)}" cy="${y(d.v).toFixed(1)}" r="2.4" fill="${cor}"/>`).join("");
    const dataEixo = t => new Date(t).toLocaleString("pt-BR", dias === 1 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" });
    const rotX = `<text x="${pl}" y="${H - 7}" fill="#6b7891" font-size="10">${dataEixo(t0)}</text>
      <text x="${W - pr}" y="${H - 7}" fill="#6b7891" font-size="10" text-anchor="end">agora</text>`;
    BattlePools._hover = { sa, sb, x, t0, t1, W, pl, pr, fmt: fmtEixo };
    return `<div class="btl-chartbox">
      <svg id="btlSvg" class="radar-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${METRICAS[m]} das duas pools em ${PERIODOS[st.periodo][1]}"
        onmousemove="BattlePools.hover(event)" onmouseleave="BattlePools.hover(null)">${grade}${zero}${linha(sa, CORES.a)}${linha(sb, CORES.b)}
        <line id="btlCross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="#55627a" stroke-width="1" style="display:none"/>${rotX}</svg>
      <div class="radar-tip" id="btlTip"></div>
    </div>`;
  }
  function hover(e){
    const h = BattlePools._hover, svg = document.getElementById("btlSvg"), tip = document.getElementById("btlTip"), cr = document.getElementById("btlCross");
    if (!h || !svg || !tip) return;
    if (!e) { tip.style.display = "none"; if (cr) cr.style.display = "none"; return; }
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * h.W;
    const t = h.t0 + (sx - h.pl) / (h.W - h.pl - h.pr) * (h.t1 - h.t0);
    const perto = s => s.length ? s.reduce((m, d) => Math.abs(d.ts - t) < Math.abs(m.ts - t) ? d : m) : null;
    const a = perto(h.sa), b = perto(h.sb), ref = a || b;
    if (!ref) return;
    if (cr) { cr.setAttribute("x1", h.x(ref.ts)); cr.setAttribute("x2", h.x(ref.ts)); cr.style.display = ""; }
    const quando = new Date(ref.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    tip.replaceChildren();
    const linhaTip = (cor, rot, v) => { const d = document.createElement("div"); const s = document.createElement("span"); s.style.color = cor; s.textContent = "● "; const b2 = document.createElement("b"); b2.textContent = h.fmt(v); d.append(s, rot + ": ", b2); return d; };
    const topo = document.createElement("div"); topo.style.cssText = "color:#8a94a8;margin-bottom:3px"; topo.textContent = quando;
    tip.append(topo);
    if (a) tip.append(linhaTip(CORES.a, "A", a.v));
    if (b) tip.append(linhaTip(CORES.b, "B", b.v));
    tip.style.display = "block";
    const px = h.x(ref.ts) / h.W * r.width;
    tip.style.left = Math.min(px + 12, r.width - 150) + "px"; tip.style.top = "12px";
  }

  function botoes(grupo, opcoes, atual){
    return `<div class="btl-seg" role="group">${Object.entries(opcoes).map(([k, rot]) =>
      `<button type="button" class="${k === atual ? "on" : ""}" aria-pressed="${k === atual}" onclick="BattlePools.set('${grupo}','${k}')">${Array.isArray(rot) ? rot[1] : rot}</button>`).join("")}</div>`;
  }
  const VALIDOS = { periodo: PERIODOS, metrica: METRICAS, modo: { usd: 1, pct: 1 } };
  function set(k, v){ if (VALIDOS[k] && VALIDOS[k][v]) { st[k] = v; salvar(); render(); } }

  let geracao = 0;
  function render(){
    const el = document.getElementById("tab-battle");
    if (!el) return;
    const pa = pool(st.a), pb = pool(st.b);
    const topo = `<div class="btl-escolha">${seletor("a")}
      <button type="button" class="btl-vs" onclick="BattlePools.trocar()" title="Trocar A e B" aria-label="Trocar A e B">⚔</button>${seletor("b")}</div>`;
    if (!pa || !pb) {
      el.innerHTML = topo + `<div class="radar-empty">Escolha duas pools para a batalha — por exemplo, a mesma ação em DEXs concorrentes (SPCX/SOL na Raydium × SPCXB/WBNB na PancakeSwap) ou duas SOL/USDC na mesma DEX. Também dá para mandar uma pool para cá pelo ⚔ do Descobrir ou do Radar.</div>`;
      return;
    }
    el.innerHTML = topo + `<div class="radar-empty">Carregando o histórico das duas pools…</div>`;
    const g = ++geracao;
    Promise.all([fotos(pa), fotos(pb)]).then(([la, lb]) => {
      if (g !== geracao) return;   // trocou de pool no meio do carregamento
      const dias = PERIODOS[st.periodo][0], fa = pontos(la, dias), fb = pontos(lb, dias);
      el.innerHTML = topo + `
        <div class="btl-controles">${botoes("periodo", PERIODOS, st.periodo)}${botoes("metrica", METRICAS, st.metrica)}${botoes("modo", { usd: "Valor", pct: "Variação %" }, st.modo)}</div>
        ${grafico(fa, fb)}
        <div class="btl-legenda"><span><i style="background:${CORES.a}"></i>A · ${esc(pa.pool)} (${esc(pa.platform)})</span><span><i style="background:${CORES.b}"></i>B · ${esc(pb.pool)} (${esc(pb.platform)})</span></div>
        ${placar(pa, pb, fa, fb)}`;
    });
  }

  window.BattlePools = { render, escolher, buscar, trocar, adicionar, set, hover, _hover: null };
})();
