/* ============================================================
   ATLAS · academy/js/academy-globe.js
   Radar de liquidez DeFi — Canvas 2D puro, sem dependência.

   AcademyGlobe.mount(container, { nodes, onHover, onSelect }) -> { stop(), setNodes() }

   Um scópio de radar visto de cima. Cada blip é uma blockchain real:
     • RAIO   = TVL (maior TVL → mais perto do núcleo; escala log)
     • TAMANHO = TVL (log, sem bolota)
     • COR    = variação de TVL 24h (verde/vermelho)
   Os blips ficam PARADOS (rótulos legíveis); o que gira é a linha de
   varredura, que faz o blip "pingar" ao passar. Passar o mouse chama
   onHover(node); clicar chama onSelect(node) (filtra o resto da tela).

   Os anéis de alcance são rotulados por faixa de TVL, dando sentido ao
   raio. Respeita prefers-reduced-motion (radar estático, ainda interativo).

   nodes: [{ id, label, tvl, change24h }]  (lat/lon são ignorados)
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyGlobe) return;

  var TAU = Math.PI * 2;

  function fmtTvl(v) {
    if (v == null || !isFinite(v)) return "";
    if (v >= 1e12) return "$" + (v / 1e12).toFixed(1) + "T";
    if (v >= 1e9)  return "$" + (v / 1e9).toFixed(0) + "B";
    if (v >= 1e6)  return "$" + (v / 1e6).toFixed(0) + "M";
    return "$" + Math.round(v);
  }

  window.AcademyGlobe = {
    mount: function (container, opts) {
      opts = opts || {};
      var onHover = opts.onHover || function () {};
      var onSelect = opts.onSelect || function () {};
      var reduce = false;
      try { reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

      var canvas = document.createElement("canvas");
      canvas.style.display = "block"; canvas.style.width = "100%"; canvas.style.height = "100%";
      canvas.style.cursor = "crosshair";
      container.appendChild(canvas);
      var ctx = canvas.getContext("2d");

      var nodes = opts.nodes || [];
      var W=0,H=0,R=0,cx=0,cy=0,dpr=Math.min(window.devicePixelRatio||1,2);
      var tMin=0, tMax=1; // faixa log de TVL, para os rótulos dos anéis

      // posiciona cada blip: raio por TVL (log, invertido), ângulo distribuído
      function layout() {
        var vals = nodes.map(function (n) { return Math.log10(Math.max(1, n.tvl || 1)); });
        tMax = vals.length ? Math.max.apply(null, vals) : 1;
        tMin = vals.length ? Math.min.apply(null, vals) : 0;
        var span = (tMax - tMin) || 1;
        var n = nodes.length;
        nodes.forEach(function (nd, i) {
          var t = Math.log10(Math.max(1, nd.tvl || 1));
          var norm = (tMax - t) / span;                 // 0 = maior (centro), 1 = menor (borda)
          nd._radius = R * (0.17 + norm * 0.76);
          var ang = -Math.PI / 2 + (i / Math.max(1, n)) * TAU + 0.35; // fixo, espalhado
          nd._ang = ang;
          nd._x = cx + Math.cos(ang) * nd._radius;
          nd._y = cy + Math.sin(ang) * nd._radius;
          var bnorm = (t - tMin) / span;                // 0 = menor, 1 = maior
          nd._r = 3 + bnorm * 7;
        });
      }

      function resize() {
        var w=container.clientWidth||300, h=container.clientHeight||220;
        W=w; H=h; R=Math.min(w,h)*0.44; cx=w/2; cy=h/2;
        canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
        layout();
      }
      resize();
      var ro=null; if (typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(resize); ro.observe(container); }

      var sweep=-Math.PI/2, raf=null, running=true, hoverId=null, pinnedId=null, mouse=null;

      function pick() {
        if (!mouse) return null;
        var best=null, bestD=1e9;
        for (var i=0;i<nodes.length;i++){ var nd=nodes[i];
          var d=Math.hypot(nd._x-mouse.x, nd._y-mouse.y);
          if (d < nd._r+9 && d<bestD){ bestD=d; best=nd; } }
        return best;
      }

      canvas.addEventListener("mousemove", function (e) {
        var r=canvas.getBoundingClientRect(); mouse={x:e.clientX-r.left, y:e.clientY-r.top};
        var n=pick(); var id=n?n.id:null;
        if (id!==hoverId){ hoverId=id; canvas.style.cursor=n?"pointer":"crosshair"; if(n) onHover(n); else if(!pinnedId) onHover(null); }
      });
      canvas.addEventListener("mouseleave", function(){ mouse=null; hoverId=null; if(!pinnedId) onHover(null); });
      canvas.addEventListener("click", function(){ var n=pick(); if(n){ pinnedId=(pinnedId===n.id?null:n.id); onHover(pinnedId?n:null); onSelect(pinnedId?n:null); } });

      // faixas de TVL para rotular os anéis (a partir da escala log atual)
      function ringTvlAt(frac) { // frac: 0 centro .. 1 borda, na mesma curva do raio
        var norm = (frac - 0.17) / 0.76; if (norm<0) norm=0; if (norm>1) norm=1;
        var t = tMax - norm * ((tMax - tMin) || 1);
        return Math.pow(10, t);
      }

      function draw() {
        if (!running) return;
        ctx.clearRect(0,0,W,H);

        // grade: anéis concêntricos + rótulo de TVL
        var ringFracs=[0.30,0.55,0.80,1.0];
        ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.font="9px 'JetBrains Mono', monospace";
        ringFracs.forEach(function(f){
          ctx.strokeStyle="rgba(0,240,255,"+(0.06+ (f===1?0.06:0)).toFixed(3)+")"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(cx,cy,R*f,0,TAU); ctx.stroke();
          ctx.fillStyle="rgba(160,200,230,0.28)";
          ctx.fillText(fmtTvl(ringTvlAt(f)), cx+2, cy - R*f - 1);
        });
        // spokes
        ctx.strokeStyle="rgba(0,240,255,0.05)"; ctx.lineWidth=1;
        for (var s=0;s<8;s++){ var a=s/8*TAU; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*R, cy+Math.sin(a)*R); ctx.stroke(); }

        // varredura (setor com gradiente que arrasta atrás da linha)
        if (!reduce) {
          var steps=42, back=1.1; // ~63° de rastro
          for (var k=0;k<steps;k++){
            var a0=sweep-(k/steps)*back, a1=sweep-((k+1)/steps)*back;
            var alpha=0.12*(1-k/steps);
            ctx.fillStyle="rgba(0,240,255,"+alpha.toFixed(3)+")";
            ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a1,a0); ctx.closePath(); ctx.fill();
          }
          // linha de frente
          ctx.strokeStyle="rgba(120,240,255,0.5)"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(sweep)*R, cy+Math.sin(sweep)*R); ctx.stroke();
        }

        // blips
        nodes.forEach(function(nd){
          // "ping": intensidade quando a varredura acabou de passar pelo blip
          var ping=0;
          if (!reduce) { var da=((sweep-nd._ang)%TAU+TAU)%TAU; ping=da<0.9 ? (1-da/0.9) : 0; }
          var active=(nd.id===hoverId||nd.id===pinnedId);
          var col=nd.change24h==null?"120,190,230":(nd.change24h>=0?"0,226,138":"255,84,112");
          var glowR=nd._r*(2.2+ping*1.4);
          var g=ctx.createRadialGradient(nd._x,nd._y,0,nd._x,nd._y,glowR);
          g.addColorStop(0,"rgba("+col+","+(0.45+ping*0.4).toFixed(2)+")"); g.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(nd._x,nd._y,glowR,0,TAU); ctx.fill();
          ctx.fillStyle="rgba("+col+","+(0.85+ping*0.15).toFixed(2)+")";
          ctx.beginPath(); ctx.arc(nd._x,nd._y,nd._r,0,TAU); ctx.fill();
          if (active){ ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(nd._x,nd._y,nd._r+3.5,0,TAU); ctx.stroke(); }
          // rótulo (para fora do centro)
          var lx=nd._x+(nd._x>=cx?1:-1)*(nd._r+5);
          ctx.font="600 10px 'JetBrains Mono', monospace"; ctx.textBaseline="middle";
          ctx.textAlign=nd._x>=cx?"left":"right";
          ctx.fillStyle="rgba(230,241,255,"+(active?1:0.72).toFixed(2)+")";
          ctx.fillText(nd.label, lx, nd._y);
        });

        // núcleo central (coração do DeFi)
        var core=ctx.createRadialGradient(cx,cy,0,cx,cy,16);
        core.addColorStop(0,"rgba(0,240,255,0.85)"); core.addColorStop(0.4,"rgba(0,191,255,0.25)"); core.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=core; ctx.beginPath(); ctx.arc(cx,cy,16,0,TAU); ctx.fill();
        ctx.fillStyle="rgba(230,248,255,0.95)"; ctx.beginPath(); ctx.arc(cx,cy,2.6,0,TAU); ctx.fill();

        if(!reduce){ sweep+=0.014; if(sweep>Math.PI) sweep-=TAU; }
        raf=requestAnimationFrame(draw);
      }
      draw();

      return {
        stop: function(){ running=false; if(raf)cancelAnimationFrame(raf); if(ro)ro.disconnect(); if(canvas.parentNode)canvas.parentNode.removeChild(canvas); },
        setNodes: function(ns){ nodes=ns||[]; layout(); }
      };
    }
  };
})();
