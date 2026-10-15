/* ============================================================
   ATLAS · core/ui/atlas-cenario.js
   O "cenário" do fundo: um degradê de malha (mesh gradient) que
   flui devagar, desenhado em WebGL pela Paper Shaders
   (github.com/paper-design/shaders, Apache-2.0), copiada em
   assets/vendor/paper-shaders-0.0.81/.

   Piloto de 15/10/2026: entra só na página Ferramentas e nas
   ferramentas. Se o dono aprovar, passa para o resto do site.
   Registro: docs/visual-ferramentas-2026-10-15.md

   Como usar numa página:
     <link rel="stylesheet" href="<raiz>/core/ui/atlas-cenario.css">
     <script type="module" src="<raiz>/core/ui/atlas-cenario.js"></script>
   O import abaixo é relativo a ESTE arquivo, então funciona em
   qualquer profundidade de pasta.

   Paleta: <html data-cenario="ambar"> troca a mistura de cores
   (ver PALETAS). Sem o atributo, vale "atlas".
   ============================================================ */
import {
  ShaderMount,
  meshGradientFragmentShader,
  getShaderColorFromString,
} from '../../assets/vendor/paper-shaders-0.0.81/index.js';

// Cores escuras de propósito: o cenário é fundo, não protagonista.
// A primeira domina; as outras são as manchas que passeiam.
const PALETAS = {
  atlas: ['#070B15', '#0D2142', '#0F4C5E', '#2B2470'],
  ambar: ['#070B15', '#221833', '#4A2E16', '#0D2142'],
};

function montar() {
  if (document.querySelector('.atlas-cenario')) return;
  // tema claro: o cenário escuro não combina; fica o fundo liso
  if (document.documentElement.getAttribute('data-theme') === 'light') return;

  const caixa = document.createElement('div');
  caixa.className = 'atlas-cenario';
  caixa.setAttribute('aria-hidden', 'true');
  document.body.prepend(caixa);
  // libera o fundo opaco do body para o cenário aparecer (atlas-cenario.css)
  document.documentElement.classList.add('atlas-com-cenario');

  const nome = document.documentElement.getAttribute('data-cenario') || 'atlas';
  const cores = (PALETAS[nome] || PALETAS.atlas).map(getShaderColorFromString);
  // quem pediu menos movimento recebe o quadro parado (velocidade 0)
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let shader;
  try {
    shader = new ShaderMount(
      caixa,
      meshGradientFragmentShader,
      {
        u_colors: cores,
        u_colorsCount: cores.length,
        u_distortion: 0.75,
        u_swirl: 0.12,
        u_grainMixer: 0,
        u_grainOverlay: 0.06, // grão leve: some com as faixas do degradê
        u_fit: 2,             // cobre a tela inteira
        u_scale: 1,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      undefined,
      parado ? 0 : 0.12, // bem devagar
      0,
      1,              // densidade mínima 1x (o padrão 2x é desperdício num degradê)
      1280 * 720,     // teto de pixels: o degradê é macio, a GPU agradece
    );
  } catch (e) {
    // sem WebGL: fica o degradê em CSS do atlas-cenario.css
    caixa.classList.add('atlas-cenario--css');
    return;
  }
  caixa.classList.add('atlas-cenario--vivo');

  // libera a GPU ao sair da página
  window.addEventListener('pagehide', () => shader && shader.dispose(), { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', montar, { once: true });
} else {
  montar();
}
