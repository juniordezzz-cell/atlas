/* ============================================================
   Laboratório de Agentes (no PC) · pagina/cidade.js

   A cidade em 3D (Three.js r170, cópia em vendor/). Três níveis:
     cidade → uma casa por rede (tamanho pelo TVL das pools do Scanner),
              Ethereum, BNB Chain e Arbitrum em obra, torre do Supervisor;
     casa   → uma sala por plataforma (Raydium, Orca, Aerodrome...);
     sala   → uma mesa por pool, com lâmpada âmbar quando há oportunidade.
   Os agentes (bonecos de blocos) andam até as pools que olharam na última
   rodada: comemoram onde acharam, balançam a cabeça onde descartaram.
   Tudo vem de /api/painel: nada aqui é inventado.

   criarCidade(elemento, { porDia, aoEscolherPool, aoMudarNivel, aoPassar })
     → { atualizar(dados), etapa(nome), focarPool(id), voltar(), ir(nivel, rede, dex) }
   ============================================================ */

import * as THREE from "./vendor/three.module.min.js";

const COR = {
  chao: 0x0f1c2e, rua: 0x16273d, linha: 0x2a3f5c, parede: 0x1b2f4a, paredeClara: 0x243c5c,
  ambar: 0xf2b33d, apagada: 0x3a4a60, papel: 0xe8e3d6, Solana: 0x5ec4b6, Base: 0x8b98ff, obra: 0x55627a,
  pele: 0xe8cfa8, mesa: 0x6b4f37,
};
export const REDES = [
  { id: "Solana", x: -26, z: 4, viva: true },
  { id: "Base", x: 26, z: 4, viva: true },
  { id: "Ethereum", x: 0, z: -34, viva: false },
  { id: "BNB Chain", x: -40, z: -26, viva: false },
  { id: "Arbitrum", x: 40, z: -26, viva: false },
];
export const AGENTES = {
  base: { cor: 0xc9d4e3, coisa: "regua" },
  concentrador: { cor: 0x4fd1c5, coisa: "lupa" },
  curva: { cor: 0xf78fb3, coisa: "arco" },
  pontas: { cor: 0xff9f5a, coisa: "sinais" },
  grade: { cor: 0xa3e635, coisa: "grade" },
  acumulador: { cor: 0x34d399, coisa: "cofre" },
  acumulador_token: { cor: 0xfacc15, coisa: "sacola" },
};
const ESCALA = { cidade: 2.4, casa: 1.3, sala: 1 };
const VELOCIDADE = { cidade: 12, casa: 6, sala: 3.2 };
const VISTA = { cidade: 120, casa: 70, sala: 34 };
const TORRE = { x: 0, z: 2 };

/** Nome da plataforma como uma sala só ("Aero" e "Aerodrome" são a mesma). */
export function nomeSala(dex) {
  const d = String(dex || "?").trim();
  return /^aero(drome)?$/i.test(d) ? "Aerodrome" : d;
}

const dinheiro = (v) => (v < 0 ? "−" : "") + "US$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const grande = (v) => v >= 1e9 ? `US$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`
  : `US$ ${Math.round(v / 1e6).toLocaleString("pt-BR")} mi`;
const caixa = new THREE.BoxGeometry(1, 1, 1);
const esfera = new THREE.SphereGeometry(0.5, 14, 10);
const materiais = new Map();
function mat(cor, { brilho = 0, intensidade = 1, transparente = false, opacidade = 1 } = {}) {
  const k = `${cor}|${brilho}|${intensidade}|${opacidade}`;
  if (!materiais.has(k)) {
    materiais.set(k, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0.05,
      emissive: brilho || 0x000000, emissiveIntensity: intensidade, transparent: transparente, opacity: opacidade }));
  }
  return materiais.get(k);
}
function em(o, x, y, z) { o.position.set(x, y, z); return o; }
function bloco(w, h, d, cor, opcoes) {
  const m = new THREE.Mesh(caixa, mat(cor, opcoes));
  m.scale.set(w, h, d);
  return m;
}

/** Texto que sempre olha para a câmera. */
function rotulo(linhas, { altura = 2, cor = "#e8e3d6", fundo = "rgba(15,28,46,0.82)", destaque = null } = {}) {
  const ls = [].concat(linhas);
  const px = 44, pad = 18, c = document.createElement("canvas"), g = c.getContext("2d");
  const fonte = (i) => `${i === 0 ? 700 : 400} ${i === 0 ? px : px * 0.72}px "Bricolage Grotesque", "Atkinson Hyperlegible", sans-serif`;
  let w = 0;
  ls.forEach((t, i) => { g.font = fonte(i); w = Math.max(w, g.measureText(t).width); });
  const alturas = ls.map((_, i) => (i === 0 ? px : px * 0.72) * 1.25);
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(alturas.reduce((s, x) => s + x, 0) + pad * 1.4);
  if (fundo) { g.fillStyle = fundo; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 14); g.fill(); }
  let y = pad * 0.7;
  ls.forEach((t, i) => {
    g.font = fonte(i); g.fillStyle = i === 1 && destaque ? destaque : i === 0 ? cor : "#93a0b4";
    g.textBaseline = "top"; g.fillText(t, pad, y); y += alturas[i];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(altura * c.width / c.height, altura, 1);
  s.renderOrder = 10;
  return s;
}

/** Um agente de blocos, com a cor e a ferramenta dele. */
function boneco(id) {
  const a = AGENTES[id] || { cor: 0xcccccc, coisa: null };
  const g = new THREE.Group();
  const pernaE = bloco(0.22, 0.5, 0.24, 0x24364f), pernaD = bloco(0.22, 0.5, 0.24, 0x24364f);
  pernaE.position.set(-0.14, 0.25, 0); pernaD.position.set(0.14, 0.25, 0);
  const corpo = bloco(0.62, 0.62, 0.36, a.cor); corpo.position.y = 0.81;
  const cabeca = new THREE.Group(); cabeca.position.y = 1.32;
  const rosto = bloco(0.46, 0.42, 0.42, COR.pele); cabeca.add(rosto);
  const olho = (x) => { const o = bloco(0.07, 0.07, 0.02, 0x0f1c2e); o.position.set(x, 0.03, 0.22); return o; };
  cabeca.add(olho(-0.1), olho(0.1));
  const cabelo = bloco(0.5, 0.12, 0.46, a.cor); cabelo.position.y = 0.24; cabeca.add(cabelo);
  g.add(pernaE, pernaD, corpo, cabeca);
  const coisa = new THREE.Group();
  if (a.coisa === "regua") { const r = bloco(1.1, 0.06, 0.14, 0xf2e6c4); r.position.set(0.5, 0.8, 0.25); coisa.add(r); }
  if (a.coisa === "lupa") {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 18), mat(0xdfe7ef));
    aro.position.set(0.45, 1.05, 0.25); const cabo = bloco(0.06, 0.3, 0.06, 0x6b4f37); cabo.position.set(0.45, 0.78, 0.25);
    coisa.add(aro, cabo);
  }
  if (a.coisa === "arco") {
    const arco = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 24, Math.PI), mat(a.cor, { brilho: a.cor, intensidade: 0.6 }));
    arco.position.set(0, 1.55, 0); coisa.add(arco);
  }
  if (a.coisa === "sinais") {
    for (const x of [-0.42, 0.42]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 10), mat(0xff6b4a, { brilho: 0xff6b4a, intensidade: 0.7 }));
      c.position.set(x, 1.12, 0.12); coisa.add(c);
    }
  }
  if (a.coisa === "grade") {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const q = bloco(0.14, 0.14, 0.04, a.cor); q.position.set(-0.17 + i * 0.17, 0.66 + j * 0.17, -0.22); coisa.add(q);
    }
  }
  if (a.coisa === "cofre") { const c = bloco(0.42, 0.42, 0.26, 0x1f6f55); c.position.set(0, 0.85, -0.32); coisa.add(c); }
  if (a.coisa === "sacola") {
    const s = new THREE.Mesh(esfera, mat(0xd4a017, { brilho: 0x6b4f00, intensidade: 0.4 }));
    s.scale.setScalar(0.42); s.position.set(0.42, 0.55, 0.1); coisa.add(s);
  }
  g.add(coisa);
  g.userData = { tipo: "agente", id, pernaE, pernaD, cabeca, corpo };
  return g;
}

export function criarCidade(el, opcoes = {}) {
  const porDia = opcoes.porDia || ((v) => v / 30);
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(COR.chao);
  el.append(renderer.domElement);

  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0x9fb8d8, 0x0b1420, 1.1));
  const lua = new THREE.DirectionalLight(0xcfdcff, 1.4);
  lua.position.set(-40, 80, 50);
  cena.add(lua);
  const mundo = new THREE.Group(); cena.add(mundo);
  const povo = new THREE.Group(); cena.add(povo);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
  const cam = { alvo: new THREE.Vector3(), az: Math.PI / 4, vista: VISTA.cidade, de: null, t: 1 };

  let dados = null, nivel = "cidade", redeAtual = null, salaAtual = null;
  let lugares = new Map();        // pool_id → { x, z } no nível atual
  let alvosNivel = [];            // objetos clicáveis
  let destaque = null;
  const agentes = new Map();
  let etapaAtual = "esperando";
  let ultimaChave = null;
  let tamMesa = 1.5;          // altura dos rótulos e dos bonecos na sala (cresce com a sala)

  // ---------- câmera ----------
  function enquadrar() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1, a = w / h;
    camera.left = -cam.vista * a / 2; camera.right = cam.vista * a / 2;
    camera.top = cam.vista / 2; camera.bottom = -cam.vista / 2;
    const D = 200;
    camera.position.set(cam.alvo.x + Math.sin(cam.az) * D, cam.alvo.y + D * 0.82, cam.alvo.z + Math.cos(cam.az) * D);
    camera.lookAt(cam.alvo);
    camera.updateProjectionMatrix();
  }
  function voar(x, z, vista) {
    cam.de = { x0: cam.alvo.x, z0: cam.alvo.z, v0: cam.vista, x, z, v: vista };
    cam.t = reduzir ? 1 : 0;
    if (reduzir) { cam.alvo.set(x, 0, z); cam.vista = vista; }
  }
  function redimensionar() {
    renderer.setSize(el.clientWidth, el.clientHeight, false);
    enquadrar();
  }
  new ResizeObserver(redimensionar).observe(el);

  // ---------- dados ----------
  const poolsPor = () => new Map((dados?.pools || []).map((p) => [p.pool_id, p]));
  function melhorPorPool() {
    const m = new Map();
    for (const a of dados?.achados || []) {
      if (a.agente === "acumulador_token") continue;
      const v = porDia(a.media_usd, a);
      if (!m.has(a.pool_id) || v > m.get(a.pool_id).dia) m.set(a.pool_id, { dia: v, a });
    }
    return m;
  }
  function analisesPor() {
    const m = new Map();
    for (const x of dados?.analises || []) {
      if (!m.has(x.pool_id)) m.set(x.pool_id, []);
      m.get(x.pool_id).push(x);
    }
    return m;
  }
  /** Pools que cada agente olhou (procura) e onde achou algo, na última rodada. */
  function trabalhoDosAgentes() {
    const t = new Map(Object.keys(AGENTES).map((id) => [id, { olhou: [], achou: new Set(), descartou: new Map() }]));
    for (const x of dados?.analises || []) {
      const ag = t.get(x.agente);
      if (!ag) continue;
      if (x.procura) ag.olhou.push(x.pool_id);
      if (x.achado) ag.achou.add(x.pool_id);
      if (x.procura && x.descarta === true) ag.descartou.set(x.pool_id, x.motivo);
    }
    return t;
  }

  // ---------- construção dos níveis ----------
  function limpar() {
    for (const o of [...mundo.children]) {
      o.traverse((x) => { if (x.isSprite) { x.material.map?.dispose(); x.material.dispose(); } });
      mundo.remove(o);
    }
    alvosNivel = []; lugares = new Map(); destaque = null;
  }
  function chao(tamanho, cor = COR.chao) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(tamanho, tamanho), mat(cor));
    p.rotation.x = -Math.PI / 2; mundo.add(p);
    const grade = new THREE.GridHelper(tamanho, Math.max(1, Math.round(tamanho / 4)), COR.linha, COR.rua);
    grade.position.y = 0.01; grade.material.transparent = true; grade.material.opacity = 0.5; mundo.add(grade);
  }

  function construirCidade() {
    chao(200);
    const pools = dados?.pools || [];
    const melhor = melhorPorPool();
    const tvl = {};
    for (const p of pools) tvl[p.rede] = (tvl[p.rede] || 0) + (p.tvl || 0);
    const maxTvl = Math.max(1, ...Object.values(tvl));
    // ruas até a torre
    for (const r of REDES) {
      const dx = r.x - TORRE.x, dz = r.z - TORRE.z, comp = Math.hypot(dx, dz);
      const rua = bloco(3, 0.05, comp, COR.rua); rua.position.set((r.x + TORRE.x) / 2, 0.03, (r.z + TORRE.z) / 2);
      rua.rotation.y = Math.atan2(dx, dz); mundo.add(rua);
    }
    for (const r of REDES) {
      const g = new THREE.Group(); g.position.set(r.x, 0, r.z);
      const daRede = pools.filter((p) => p.rede === r.id);
      const razao = r.viva ? Math.sqrt((tvl[r.id] || 0) / maxTvl) : 0.35;
      const lado = 12 + 12 * razao, andares = r.viva ? 2 + Math.round(5 * razao) : 2, alt = andares * 3;
      const corParede = r.viva ? COR.parede : COR.obra;
      const corpo = bloco(lado, alt, lado * 0.8, corParede); corpo.position.y = alt / 2; g.add(corpo);
      const teto = bloco(lado + 1, 0.8, lado * 0.8 + 1, r.viva ? COR[r.id] : 0x3a4558); teto.position.y = alt + 0.4; g.add(teto);
      if (r.viva) {
        const comAchado = daRede.filter((p) => melhor.has(p.pool_id)).length;
        const janelas = [];
        const colunas = Math.max(3, Math.round(lado / 2.6));
        for (let a = 0; a < andares; a++) for (let c = 0; c < colunas; c++) janelas.push([a, c]);
        const acesas = Math.round(janelas.length * (daRede.length ? comAchado / daRede.length : 0));
        janelas.forEach(([a, c], i) => {
          const acesa = (i * 7919) % janelas.length < acesas;
          const j = bloco(1.1, 1.3, 0.1, acesa ? COR.ambar : 0x22324a, acesa ? { brilho: COR.ambar, intensidade: 0.9 } : {});
          j.position.set(-lado / 2 + (c + 0.5) * (lado / colunas), 1.6 + a * 3, lado * 0.4 + 0.06);
          g.add(j);
        });
        const porta = bloco(2.4, 2.6, 0.12, 0x0b1420); porta.position.set(0, 1.3, lado * 0.4 + 0.07); g.add(porta);
        g.add(em(rotulo([r.id, `${daRede.length} pools · ${grande(tvl[r.id] || 0)} de TVL`, `${comAchado} com oportunidade`],
          { altura: 9, destaque: r.id === "Solana" ? "#5ec4b6" : "#8b98ff" }), 0, alt + 7, 0));
        corpo.userData = { tipo: "casa", rede: r.id, dica: `${r.id}: clique para entrar` };
        alvosNivel.push(corpo);
        for (const p of daRede) lugares.set(p.pool_id, { x: r.x, z: r.z + lado * 0.4 + 3 });
      } else {
        // andaime
        for (const x of [-lado / 2 - 0.6, lado / 2 + 0.6]) for (const z of [-lado * 0.4 - 0.6, lado * 0.4 + 0.6]) {
          const poste = bloco(0.25, alt + 3, 0.25, 0xc9a227); poste.position.set(x, (alt + 3) / 2, z); g.add(poste);
        }
        for (let y = 2; y < alt + 3; y += 2.5) {
          const tabua = bloco(lado + 1.4, 0.2, 0.5, 0xc9a227); tabua.position.set(0, y, lado * 0.4 + 0.6); g.add(tabua);
        }
        g.add(em(rotulo([r.id, "em obra"], { altura: 6 }), 0, alt + 5.5, 0));
        corpo.userData = { tipo: "obra", dica: `${r.id}: em obra (entra depois dos perfis)` };
        alvosNivel.push(corpo);
      }
      mundo.add(g);
    }
    // torre do Supervisor
    const t = new THREE.Group(); t.position.set(TORRE.x, 0, TORRE.z);
    const base = bloco(6, 1, 6, COR.paredeClara); base.position.y = 0.5; t.add(base);
    const haste = bloco(2.4, 16, 2.4, COR.parede); haste.position.y = 9; t.add(haste);
    const anel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.25, 8, 32), mat(COR.ambar, { brilho: COR.ambar, intensidade: 0.8 }));
    anel.rotation.x = Math.PI / 2; anel.position.y = 16.5; t.add(anel); t.userData.anel = anel;
    const rod = dados?.rodada;
    t.add(em(rotulo(["Supervisor", rod ? `${rod.achados} achados · ${rod.disputas} disputas · ${rod.conflitos} conflitos` : "esperando a primeira rodada"],
      { altura: 6 }), 0, 22, 0));
    haste.userData = { tipo: "torre", dica: "Supervisor: junta o trabalho de todos e monta o ranking" };
    alvosNivel.push(haste);
    mundo.add(t);
    voar(0, -4, VISTA.cidade);
  }

  /** Arruma retângulos (salas) em fileiras de até `largura`. */
  function arrumar(itens, largura, folga) {
    let x = 0, z = 0, alturaFila = 0;
    const out = [];
    for (const it of itens) {
      if (x > 0 && x + it.w > largura) { x = 0; z += alturaFila + folga; alturaFila = 0; }
      out.push({ ...it, x: x + it.w / 2, z: z + it.d / 2 });
      x += it.w + folga; alturaFila = Math.max(alturaFila, it.d);
    }
    const W = Math.max(...out.map((o) => o.x + o.w / 2)), D = Math.max(...out.map((o) => o.z + o.d / 2));
    for (const o of out) { o.x -= W / 2; o.z -= D / 2; }
    return { salas: out, W, D };
  }

  function mesasDaSala(pools, cx, cz, w, d, miniatura) {
    const melhor = melhorPorPool();
    const maxDia = Math.max(0.01, ...[...melhor.values()].map((m) => m.dia));
    const an = analisesPor();
    const cols = Math.max(1, Math.ceil(Math.sqrt(pools.length * w / d)));
    const linhas = Math.ceil(pools.length / cols);
    const passoX = w / cols, passoZ = d / Math.max(1, linhas);
    const ordenadas = [...pools].sort((a, b) => (melhor.get(b.pool_id)?.dia ?? -1) - (melhor.get(a.pool_id)?.dia ?? -1));
    ordenadas.forEach((p, i) => {
      const x = cx - w / 2 + passoX * (i % cols + 0.5), z = cz - d / 2 + passoZ * (Math.floor(i / cols) + 0.5);
      const m = melhor.get(p.pool_id);
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const k = miniatura ? 0.7 : 1;
      const tampo = bloco(2.4 * k, 0.9 * k, 1.4 * k, COR.mesa); tampo.position.y = 0.45 * k; g.add(tampo);
      const forca = m ? 0.35 + 0.65 * Math.min(1, m.dia / maxDia) : 0;
      const lampada = new THREE.Mesh(esfera, m ? mat(COR.ambar, { brilho: COR.ambar, intensidade: 0.4 + 1.6 * forca })
        : mat(p.pronta ? COR.apagada : 0x2a3446));
      lampada.scale.setScalar((m ? 0.5 + 0.5 * forca : 0.45) * k); lampada.position.y = 1.4 * k; g.add(lampada);
      // Sem PointLight: a lâmpada brilha pelo emissive (luzes de verdade derrubavam o desempenho).
      if (!miniatura) {
        const linhasRotulo = m ? [p.par, `${dinheiro(m.dia)} por dia`] : [p.par, p.pronta ? "nada que ganhe da faixa única" : "esperando 7 dias de preços"];
        g.add(em(rotulo(linhasRotulo, { altura: tamMesa, destaque: m ? "#f2b33d" : null }), 0, 2 + tamMesa * 0.6, 0));
      }
      const motivos = (an.get(p.pool_id) || []).filter((x) => x.procura && x.descarta === true).map((x) => x.motivo);
      tampo.userData = { tipo: "mesa", pool_id: p.pool_id, rede: p.rede, dex: nomeSala(p.dex),
        dica: m ? `${p.par}: ${dinheiro(m.dia)} por dia (${m.a.nome})` : `${p.par}: ${motivos[0] ? "descartada, " + motivos[0] : p.pronta ? "nenhum agente ganhou da faixa única" : "ainda sem 7 dias de preços"}` };
      alvosNivel.push(tampo);
      lugares.set(p.pool_id, { x, z: z + 1.6 * k, mesa: g });
      mundo.add(g);
    });
  }

  function salasDaRede(rede) {
    const grupos = new Map();
    for (const p of dados?.pools || []) if (p.rede === rede) {
      const s = nomeSala(p.dex);
      if (!grupos.has(s)) grupos.set(s, []);
      grupos.get(s).push(p);
    }
    return [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  }

  function paredes(cx, cz, w, d, cor) {
    const h = 1.6, e = 0.3;
    const porta = Math.min(4, w / 3);
    const lados = [
      [w, e, cx, cz - d / 2], [e, d, cx - w / 2, cz], [e, d, cx + w / 2, cz],
      [(w - porta) / 2, e, cx - (w + porta) / 4, cz + d / 2], [(w - porta) / 2, e, cx + (w + porta) / 4, cz + d / 2],
    ];
    for (const [lw, ld, x, z] of lados) { const p = bloco(lw, h, ld, cor); p.position.set(x, h / 2, z); mundo.add(p); }
  }

  function construirCasa(rede) {
    const melhor = melhorPorPool();
    const salas = salasDaRede(rede).map(([nome, pools]) => {
      const cols = Math.ceil(Math.sqrt(pools.length * 1.3)), linhas = Math.ceil(pools.length / cols);
      return { nome, pools, w: Math.max(10, cols * 2.6 + 4), d: Math.max(9, linhas * 2.6 + 5) };
    });
    if (!salas.length) return construirCidade();
    const { salas: arrumadas, W, D } = arrumar(salas, 64, 6);
    const tamRotulo = Math.max(4, Math.max(W, D) * 0.085);
    chao(Math.max(W, D) + 60);
    const piso = bloco(W + 8, 0.2, D + 8, 0x13233a); piso.position.y = 0.1; mundo.add(piso);
    for (const s of arrumadas) {
      const chaoSala = bloco(s.w, 0.25, s.d, 0x1a2c45); chaoSala.position.set(s.x, 0.2, s.z); mundo.add(chaoSala);
      paredes(s.x, s.z, s.w, s.d, COR[rede] ?? COR.paredeClara);
      mesasDaSala(s.pools, s.x, s.z, s.w - 3, s.d - 3, true);
      const top = s.pools.map((p) => melhor.get(p.pool_id)?.dia).filter((v) => v != null).sort((a, b) => b - a)[0];
      mundo.add(em(rotulo([s.nome, `${s.pools.length} pools`, top != null ? `melhor: ${dinheiro(top)} por dia` : "nenhuma oportunidade agora"],
        { altura: tamRotulo, destaque: top != null ? "#f2b33d" : null }), s.x, 4 + tamRotulo, s.z - s.d / 2));
      chaoSala.userData = { tipo: "sala", rede, dex: s.nome, dica: `${s.nome}: clique para entrar` };
      alvosNivel.push(chaoSala);
    }
    voar(0, 0, Math.min(150, Math.max(34, Math.max(W, D) * 1.1)));
  }

  function construirSala(rede, dex) {
    const pools = (salasDaRede(rede).find(([n]) => n === dex) || [null, []])[1];
    if (!pools.length) return construirCasa(rede);
    const cols = Math.ceil(Math.sqrt(pools.length * 1.4));
    const w = Math.max(16, cols * 5.2), d = Math.max(12, Math.ceil(pools.length / cols) * 5.4);
    chao(Math.max(w, d) + 40);
    const piso = bloco(w + 4, 0.2, d + 4, 0x1a2c45); piso.position.y = 0.1; mundo.add(piso);
    paredes(0, 0, w + 4, d + 4, COR[rede] ?? COR.paredeClara);
    const vista = Math.max(VISTA.sala, Math.max(w, d) * 1.05);
    tamMesa = Math.max(1.5, vista * 0.045);
    mesasDaSala(pools, 0, 0, w, d, false);
    voar(0, 0, vista);
  }

  function construir() {
    limpar();
    if (nivel === "sala") construirSala(redeAtual, salaAtual);
    else if (nivel === "casa") construirCasa(redeAtual);
    else construirCidade();
    for (const ag of agentes.values()) { ag.g.scale.setScalar(nivel === "sala" ? Math.max(1, tamMesa / 1.5) : ESCALA[nivel]); ag.destino = null; ag.pausa = Math.random() * 1.5; }
    posicionarAgentes();
    opcoes.aoMudarNivel?.({ nivel, rede: redeAtual, dex: salaAtual });
  }

  // ---------- agentes ----------
  function noEscopo(pool_id) {
    const p = poolsPor().get(pool_id);
    if (!p) return false;
    if (nivel === "cidade") return true;
    if (nivel === "casa") return p.rede === redeAtual;
    return p.rede === redeAtual && nomeSala(p.dex) === salaAtual;
  }
  function posicionarAgentes() {
    const trab = trabalhoDosAgentes();
    let i = 0;
    for (const [id, ag] of agentes) {
      ag.trabalho = trab.get(id);
      const meus = ag.trabalho.olhou.filter(noEscopo);
      ag.g.visible = nivel === "cidade" || meus.length > 0;
      const ang = (i++ / agentes.size) * Math.PI * 2;
      const raio = nivel === "cidade" ? 6 : 3;
      const inicio = meus.length ? lugares.get(meus[0]) : null;
      ag.g.position.set((inicio?.x ?? TORRE.x) + Math.cos(ang) * raio, 0, (inicio?.z ?? TORRE.z + 4) + Math.sin(ang) * raio);
    }
  }
  function proximoDestino(ag, idx) {
    const t = ag.trabalho;
    const olhou = t ? t.olhou.filter(noEscopo) : [];
    if (!olhou.length) {   // sem trabalho aqui: fica perto da torre (na cidade)
      ag.alvoPool = null;
      const ang = Math.random() * Math.PI * 2;
      return { x: TORRE.x + Math.cos(ang) * 7, z: TORRE.z + 6 + Math.sin(ang) * 4 };
    }
    const achou = olhou.filter((p) => t.achou.has(p));
    const rodando = etapaAtual === "agentes";
    const lista = !rodando && achou.length && Math.random() < 0.8 ? achou : olhou;
    let pool = lista[Math.floor(Math.random() * lista.length)];
    if (pool === ag.alvoPool && lista.length > 1) pool = lista[(lista.indexOf(pool) + 1) % lista.length];
    ag.alvoPool = pool;
    const l = lugares.get(pool);
    // vários agentes na mesma mesa: lado a lado
    const off = (idx - 3) * (nivel === "sala" ? 0.9 * ag.g.scale.x : nivel === "casa" ? 1.2 : 2.2);
    const jitter = nivel === "cidade" ? (Math.random() - 0.5) * 8 : 0;
    return { x: l.x + off + jitter, z: l.z + (nivel === "cidade" ? Math.random() * 4 : 0) };
  }
  function chegou(ag) {
    const t = ag.trabalho, p = ag.alvoPool;
    if (!p) { ag.reacao = null; ag.pausa = 2 + Math.random() * 3; return; }
    if (t.achou.has(p)) { ag.reacao = "festa"; ag.pausa = nivel === "cidade" ? 2.5 : 4 + Math.random() * 3; soltarCartao(ag); }
    else if (t.descartou.has(p)) { ag.reacao = "nao"; ag.pausa = 1.6; }
    else { ag.reacao = "olha"; ag.pausa = 1.5 + Math.random(); }
    ag.tReacao = 0;
    if (etapaAtual === "agentes") ag.pausa *= 0.4;
  }
  const cartoes = [];
  function soltarCartao(ag) {
    if (reduzir) return;
    const c = bloco(0.5, 0.34, 0.04, COR.ambar, { brilho: COR.ambar, intensidade: 1 });
    c.position.copy(ag.g.position); c.position.y = 2 * ag.g.scale.x;
    c.scale.multiplyScalar(ag.g.scale.x);
    cena.add(c); cartoes.push({ c, t: 0 });
  }
  function criarAgentes() {
    for (const id of Object.keys(AGENTES)) {
      const g = boneco(id);
      povo.add(g);
      agentes.set(id, { id, g, destino: null, pausa: Math.random() * 2, reacao: null, tReacao: 0, fase: Math.random() * 6 });
    }
  }

  function animarAgentes(dt) {
    let idx = 0;
    for (const ag of agentes.values()) {
      const i = idx++;
      if (!ag.g.visible) continue;
      const u = ag.g.userData;
      ag.tReacao += dt;
      if (!ag.destino) {
        ag.pausa -= dt;
        if (ag.reacao === "festa" && !reduzir) ag.g.position.y = Math.abs(Math.sin(ag.tReacao * 7)) * 0.5 * ag.g.scale.x;
        else ag.g.position.y = 0;
        u.cabeca.rotation.y = ag.reacao === "nao" && !reduzir ? Math.sin(ag.tReacao * 14) * 0.5 : 0;
        u.pernaE.rotation.x = u.pernaD.rotation.x = 0;
        if (ag.pausa <= 0) { ag.destino = proximoDestino(ag, i); ag.reacao = null; ag.g.position.y = 0; u.cabeca.rotation.y = 0; }
        continue;
      }
      const dx = ag.destino.x - ag.g.position.x, dz = ag.destino.z - ag.g.position.z, dist = Math.hypot(dx, dz);
      const v = VELOCIDADE[nivel] * (nivel === "sala" ? ag.g.scale.x : 1) * (etapaAtual === "agentes" ? 2 : 1);
      if (dist < 0.15 || reduzir) {
        ag.g.position.x = ag.destino.x; ag.g.position.z = ag.destino.z; ag.destino = null; chegou(ag);
        ag.g.rotation.y = cam.az;   // vira de frente para quem olha
        continue;
      }
      const passo = Math.min(dist, v * dt);
      ag.g.position.x += dx / dist * passo; ag.g.position.z += dz / dist * passo;
      ag.g.rotation.y = Math.atan2(dx, dz);
      ag.fase += dt * v * 1.6 / ag.g.scale.x;
      u.pernaE.rotation.x = Math.sin(ag.fase) * 0.6; u.pernaD.rotation.x = -Math.sin(ag.fase) * 0.6;
      ag.g.position.y = Math.abs(Math.sin(ag.fase)) * 0.06 * ag.g.scale.x;
    }
    for (let k = cartoes.length - 1; k >= 0; k--) {
      const c = cartoes[k]; c.t += dt;
      c.c.position.y += dt * 1.5; c.c.rotation.y += dt * 3;
      if (c.t > 1.6) { cena.remove(c.c); cartoes.splice(k, 1); }
    }
  }

  // ---------- clique, passar o mouse e arrastar ----------
  const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
  let arrasto = null;
  function pegar(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const visiveis = [...agentes.values()].filter((a) => a.g.visible).map((a) => a.g);
    const h = raio.intersectObjects([...visiveis, ...alvosNivel], true)[0];
    if (!h) return null;
    let o = h.object;
    while (o && !o.userData?.tipo) o = o.parent;
    return o?.userData ?? null;
  }
  function dicaAgente(id) {
    const ag = agentes.get(id), nome = (dados?.agentes || []).find((a) => a.id === id)?.nome || id;
    const p = ag.alvoPool && poolsPor().get(ag.alvoPool);
    if (!p) return `${nome}: sem pool para olhar aqui`;
    if (ag.trabalho.achou.has(ag.alvoPool)) {
      const a = (dados.achados || []).find((x) => x.agente === id && x.pool_id === ag.alvoPool);
      return `${nome} em ${p.par}: achou ${a ? (a.tokens ? `+${a.tokens.ganho_pct.toFixed(1)}% de tokens` : dinheiro(porDia(a.media_usd, a)) + " por dia") : "oportunidade"}`;
    }
    const m = ag.trabalho.descartou.get(ag.alvoPool);
    return m ? `${nome} em ${p.par}: descartou, ${m}` : `${nome} em ${p.par}: olhou, não ganhou da faixa única`;
  }
  const tela = renderer.domElement;
  tela.addEventListener("pointerdown", (e) => { arrasto = { x: e.clientX, az: cam.az, moveu: false }; tela.setPointerCapture(e.pointerId); });
  tela.addEventListener("pointermove", (e) => {
    if (arrasto) {
      const dx = e.clientX - arrasto.x;
      if (Math.abs(dx) > 4) arrasto.moveu = true;
      if (arrasto.moveu) { cam.az = arrasto.az - dx * 0.006; enquadrar(); }
      return;
    }
    const u = pegar(e);
    tela.style.cursor = u && ["casa", "sala", "mesa"].includes(u.tipo) ? "pointer" : "grab";
    opcoes.aoPassar?.(u ? { texto: u.tipo === "agente" ? dicaAgente(u.id) : u.dica, x: e.clientX, y: e.clientY } : null);
  });
  tela.addEventListener("pointerup", (e) => {
    const foiClique = arrasto && !arrasto.moveu;
    arrasto = null;
    if (!foiClique) return;
    const u = pegar(e);
    if (!u) return;
    if (u.tipo === "casa") ir("casa", u.rede);
    else if (u.tipo === "sala") ir("sala", u.rede, u.dex);
    else if (u.tipo === "mesa") {
      if (nivel !== "sala") ir("sala", u.rede, u.dex);
      marcar(u.pool_id);
      opcoes.aoEscolherPool?.(u.pool_id);
    }
  });
  tela.addEventListener("pointerleave", () => opcoes.aoPassar?.(null));
  tela.addEventListener("wheel", (e) => {
    e.preventDefault();
    cam.vista = Math.min(260, Math.max(12, cam.vista * (e.deltaY > 0 ? 1.1 : 0.9)));
    enquadrar();
  }, { passive: false });

  function marcar(pool_id) {
    const l = lugares.get(pool_id);
    if (destaque) { mundo.remove(destaque); destaque = null; }
    if (!l) return;
    destaque = new THREE.Mesh(new THREE.TorusGeometry(2, 0.12, 8, 40), mat(COR.papel, { brilho: COR.papel, intensidade: 0.8 }));
    destaque.rotation.x = Math.PI / 2; destaque.position.set(l.x, 0.35, l.z - 1.6);
    mundo.add(destaque);
    voar(l.x, l.z - 1.6, Math.min(cam.vista, 26));
  }

  // ---------- navegação ----------
  function ir(n, rede = null, dex = null) {
    nivel = n; redeAtual = rede; salaAtual = dex;
    construir();
  }
  function voltar() {
    if (nivel === "sala") ir("casa", redeAtual);
    else if (nivel === "casa") ir("cidade");
  }
  function focarPool(pool_id) {
    const p = poolsPor().get(pool_id);
    if (!p) return;
    const dex = nomeSala(p.dex);
    if (!(nivel === "sala" && redeAtual === p.rede && salaAtual === dex)) ir("sala", p.rede, dex);
    marcar(pool_id);
  }

  // ---------- laço ----------
  const relogio = new THREE.Clock();
  function quadro() {
    requestAnimationFrame(quadro);
    if (document.hidden) { relogio.getDelta(); return; }
    const dt = Math.min(0.05, relogio.getDelta());
    if (cam.t < 1 && cam.de) {
      cam.t = Math.min(1, cam.t + dt / 0.8);
      const k = 1 - Math.pow(1 - cam.t, 3), d = cam.de;
      cam.alvo.set(d.x0 + (d.x - d.x0) * k, 0, d.z0 + (d.z - d.z0) * k);
      cam.vista = d.v0 + (d.v - d.v0) * k;
      enquadrar();
    }
    animarAgentes(dt);
    if (destaque && !reduzir) destaque.scale.setScalar(1 + Math.sin(relogio.elapsedTime * 4) * 0.08);
    renderer.render(cena, camera);
  }

  criarAgentes();
  redimensionar();
  construir();
  quadro();

  return {
    /** Novos dados da tela. Só refaz a cena quando muda a rodada, as pools ou o valor escolhido. */
    atualizar(novos, chave = "") {
      dados = novos;
      const k = `${novos?.rodada?.em}|${novos?.pools?.length}|${chave}`;
      if (k === ultimaChave) return;
      ultimaChave = k;
      const marcado = destaque ? [...lugares].find(([, l]) => Math.abs(l.x - destaque.position.x) < 0.01)?.[0] : null;
      const vista = cam.vista, az = cam.az;
      construir();
      if (marcado) marcar(marcado); else { cam.de = null; cam.t = 1; cam.vista = vista; }
      cam.az = az; enquadrar();
    },
    etapa(e) { etapaAtual = e; },
    focarPool, voltar, ir,
    nivel: () => ({ nivel, rede: redeAtual, dex: salaAtual }),
  };
}
