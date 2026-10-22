/* ============================================================
   ATLAS · academy/js/academy-cenario.js  (21/10/2026)
   Fundo animado do Academy: o "cenário futurista" pedido pelo dono,
   na linha do cenário das Ferramentas (core/ui/atlas-cenario.js), mas
   com outro clima: IA, DeFi e blockchain.

   Duas camadas, as duas leves:
   1. Rede neural: shader neuro-noise da Paper Shaders (já em
      assets/vendor, Apache-2.0), nas cores do ATLAS, com teto de
      pixels e velocidade baixa. A própria biblioteca pausa o shader
      com a aba oculta ou fora da tela.
   2. Blocos em rede: canvas 2D com poucos blocos que flutuam, ligações
      entre os próximos e "transações" correndo pelas ligações. No
      máximo 30 quadros por segundo, pausa com a aba oculta.

   Quem pediu menos movimento recebe um quadro parado. Sem WebGL, fica
   só a camada de blocos sobre um degradê em CSS. Tema claro: nada.

   Uso: <script type="module" src="<academy>/js/academy-cenario.js">
   Estilos em academy/css/academy.css (.ac-cenario).
   ============================================================ */
/* Importa só os 3 arquivos usados: o index.js da biblioteca puxaria os ~30
   shaders (cerca de 355 KB); assim, são cerca de 40 KB. */
import { ShaderMount } from '../../assets/vendor/paper-shaders-0.0.81/shader-mount.js';
import { neuroNoiseFragmentShader } from '../../assets/vendor/paper-shaders-0.0.81/shaders/neuro-noise.js';
import { getShaderColorFromString } from '../../assets/vendor/paper-shaders-0.0.81/get-shader-color-from-string.js';

const calmo = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. Rede neural (WebGL) ---------- */
function redeNeural(caixa) {
  const cor = getShaderColorFromString;
  try {
    const shader = new ShaderMount(
      caixa,
      neuroNoiseFragmentShader,
      {
        u_colorFront: cor('#67e8f9'), // ciano do curso, só nos fios mais fortes
        u_colorMid: cor('#1E5FB4'),   // azul royal do tema
        u_colorBack: cor('#05080F'),  // fundo do site
        u_brightness: 0.05,
        u_contrast: 0.32,
        u_fit: 2, u_scale: 1.25, u_rotation: 0,
        u_offsetX: 0, u_offsetY: 0, u_originX: 0.5, u_originY: 0.5,
        u_worldWidth: 0, u_worldHeight: 0,
      },
      undefined,
      calmo() ? 0 : 0.18, // devagar: o fundo não pode disputar com o texto
      0,
      1,           // densidade 1x
      960 * 540,   // teto de pixels: os fios ficam macios e a GPU folga
    );
    window.addEventListener('pagehide', () => shader.dispose(), { once: true });
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- 2. Blocos em rede (canvas 2D) ---------- */
function blocosEmRede(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let w = 0, h = 0, nos = [], pulsos = [], ultimo = 0, proximoPulso = 0, quadro = null;
  const ALCANCE = 170, FPS = 30;

  function medir() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w; canvas.height = h; // 1x de propósito: é um fundo
    const n = Math.max(12, Math.min(34, Math.round(w * h / 42000)));
    nos = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      t: 5 + Math.random() * 5, cor: Math.random() < 0.25 ? 'a78bfa' : '60a5fa',
    }));
    pulsos = [];
  }

  function ligacoes() {
    const l = [];
    for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) {
      const dx = nos[i].x - nos[j].x, dy = nos[i].y - nos[j].y, d = Math.hypot(dx, dy);
      if (d < ALCANCE) l.push([i, j, d]);
    }
    return l;
  }

  function desenhar(t, mover) {
    ctx.clearRect(0, 0, w, h);
    if (mover) for (const n of nos) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
    }
    const l = ligacoes();
    ctx.lineWidth = 1;
    for (const [i, j, d] of l) {
      ctx.strokeStyle = 'rgba(96,165,250,' + (0.26 * (1 - d / ALCANCE)).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(nos[i].x, nos[i].y); ctx.lineTo(nos[j].x, nos[j].y); ctx.stroke();
    }
    for (const n of nos) {
      ctx.strokeStyle = '#' + n.cor + 'a6';
      ctx.fillStyle = '#' + n.cor + '22';
      ctx.beginPath(); ctx.roundRect(n.x - n.t / 2, n.y - n.t / 2, n.t, n.t, 2); ctx.fill(); ctx.stroke();
    }
    /* Uma "transação" nova a cada ~0,9 s, correndo por uma ligação. */
    if (mover && t > proximoPulso && l.length) {
      const [i, j] = l[Math.floor(Math.random() * l.length)];
      pulsos.push({ a: nos[i], b: nos[j], ini: t });
      proximoPulso = t + 900;
    }
    pulsos = pulsos.filter(p => t - p.ini < 1400);
    for (const p of pulsos) {
      const k = (t - p.ini) / 1400, x = p.a.x + (p.b.x - p.a.x) * k, y = p.a.y + (p.b.y - p.a.y) * k;
      ctx.fillStyle = 'rgba(103,232,249,' + (0.9 * Math.sin(Math.PI * k)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function laco(t) {
    quadro = null;
    if (document.hidden) return;
    if (t - ultimo >= 1000 / FPS) { ultimo = t; desenhar(t, true); }
    quadro = requestAnimationFrame(laco);
  }
  function ligar() { if (!quadro && !calmo()) quadro = requestAnimationFrame(laco); }

  medir();
  desenhar(0, false);
  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { medir(); desenhar(performance.now(), false); }, 200); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ligar(); });
  window.addEventListener('pagehide', () => { if (quadro) cancelAnimationFrame(quadro); }, { once: true });
  ligar();
}

function montar() {
  if (document.querySelector('.ac-cenario')) return;
  if (document.documentElement.getAttribute('data-theme') === 'light') return;
  const raiz = document.createElement('div');
  raiz.className = 'ac-cenario';
  raiz.setAttribute('aria-hidden', 'true');
  const neural = document.createElement('div');
  neural.className = 'ac-cenario-neural';
  const blocos = document.createElement('canvas');
  blocos.className = 'ac-cenario-blocos';
  raiz.append(neural, blocos);
  document.body.prepend(raiz);
  document.documentElement.classList.add('ac-com-cenario');
  if (!redeNeural(neural)) raiz.classList.add('ac-cenario--css');
  blocosEmRede(blocos);
  /* Força um cálculo de layout para a transição de opacidade valer, sem
     depender de requestAnimationFrame (que para em aba oculta). */
  void raiz.offsetWidth;
  raiz.classList.add('ac-cenario--vivo');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
else montar();
