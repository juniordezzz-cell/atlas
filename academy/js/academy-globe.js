/* ============================================================
   ATLAS · academy/js/academy-globe.js
   Mapa de redes DeFi em globo — Canvas 2D puro, sem dependência.

   AcademyGlobe.mount(container, { nodes, onHover }) -> { stop(), setNodes() }

   UTILIDADE REAL: cada nó é uma blockchain de verdade, posicionada no
   globo, com TAMANHO pelo TVL e COR pela variação 24h. Passar o mouse
   (ou tocar) num nó chama onHover(node) para a leitura ao lado mostrar
   TVL, variação e participação. Clicar fixa a seleção.

   Os arcos entre os nós são AMBIENTE (as fontes gratuitas não dão o
   volume de ponte par-a-par) — sinalizam conexão, não valor.

   nodes: [{ id, label, tvl, change24h, share, lat, lon }]
   Respeita prefers-reduced-motion (quadro estático, ainda interativo).
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyGlobe) return;

  var TAU = Math.PI * 2;

  function fibSphere(n) {
    var pts = [], off = 2 / n, inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = i * off - 1 + off / 2, r = Math.sqrt(1 - y * y), phi = i * inc;
      pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
    }
    return pts;
  }
  function llToVec(lat, lon) {
    var a = lat * Math.PI / 180, b = lon * Math.PI / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
  }
  function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0]*c - p[2]*s, p[1], p[0]*s + p[2]*c]; }
  function rotX(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c]; }

  window.AcademyGlobe = {
    mount: function (container, opts) {
      opts = opts || {};
      var onHover = opts.onHover || function () {};
      var reduce = false;
      try { reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

      var canvas = document.createElement("canvas");
      canvas.style.display = "block"; canvas.style.width = "100%"; canvas.style.height = "100%";
      canvas.style.cursor = "grab";
      container.appendChild(canvas);
      var ctx = canvas.getContext("2d");

      var bg = fibSphere(300);   // esfera de fundo (dimmed)
      var tilt = -0.42;
      var nodes = opts.nodes || [];
      var arcs = [];
      function rebuildArcs() {
        arcs = [];
        if (nodes.length < 2) return;
        for (var k = 0; k < Math.min(7, nodes.length); k++) {
          var a = nodes[(Math.random() * nodes.length) | 0];
          var b = nodes[(Math.random() * nodes.length) | 0];
          if (a === b) continue;
          arcs.push({ a: a, b: b, t: Math.random(), speed: 0.004 + Math.random() * 0.005,
                      hue: Math.random() < 0.5 ? "0,240,255" : "255,215,0" });
        }
      }
      rebuildArcs();

      var W=0,H=0,R=0,cx=0,cy=0,dpr=Math.min(window.devicePixelRatio||1,2);
      function resize() {
        var w=container.clientWidth||300, h=container.clientHeight||300;
        W=w; H=h; R=Math.min(w,h)*0.40; cx=w/2; cy=h/2;
        canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
      }
      resize();
      var ro=null; if (typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(resize); ro.observe(container); }

      var ang=0, raf=null, running=true, hoverId=null, pinnedId=null, mouse=null;

      function projVec(v) { var q=rotX(rotY(v,ang),tilt); return { x:cx+q[0]*R, y:cy-q[1]*R, z:q[2] }; }

      // hit-test: nó mais próximo do mouse, voltado pra frente
      function pickNode() {
        if (!mouse) return null;
        var best=null, bestD=22;
        for (var i=0;i<nodes.length;i++){ var n=nodes[i]; var s=projVec(n._v); if (s.z<0) continue;
          var d=Math.hypot(s.x-mouse.x, s.y-mouse.y); if (d<bestD){ bestD=d; best=n; } }
        return best;
      }

      canvas.addEventListener("mousemove", function (e) {
        var r=canvas.getBoundingClientRect(); mouse={x:e.clientX-r.left, y:e.clientY-r.top};
        var n=pickNode(); var id=n?n.id:null;
        if (id!==hoverId){ hoverId=id; canvas.style.cursor=n?"pointer":"grab"; if(n) onHover(n); else if(!pinnedId) onHover(null); }
      });
      canvas.addEventListener("mouseleave", function(){ mouse=null; hoverId=null; if(!pinnedId) onHover(null); });
      canvas.addEventListener("click", function(){ var n=pickNode(); if(n){ pinnedId=(pinnedId===n.id?null:n.id); onHover(n); } });

      function draw() {
        if (!running) return;
        ctx.clearRect(0,0,W,H);

        // halo
        var g=ctx.createRadialGradient(cx,cy,R*0.1,cx,cy,R*1.2);
        g.addColorStop(0,"rgba(0,191,255,0.12)"); g.addColorStop(0.5,"rgba(0,191,255,0.04)"); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*1.2,0,TAU); ctx.fill();

        // esfera de fundo (pontos fracos)
        for (var i=0;i<bg.length;i++){ var s=projVec(bg[i]); if(s.z<-0.1)continue;
          var depth=(s.z+1)/2; ctx.fillStyle="rgba(90,160,210,"+(0.06+depth*0.22).toFixed(3)+")";
          ctx.beginPath(); ctx.arc(s.x,s.y,0.5+depth*0.9,0,TAU); ctx.fill(); }

        // anel do equador
        ctx.strokeStyle="rgba(0,240,255,0.10)"; ctx.lineWidth=1; ctx.beginPath();
        for (var e=0;e<=64;e++){ var a=e/64*TAU; var q=rotX(rotY([Math.cos(a),0,Math.sin(a)],ang),tilt);
          var X=cx+q[0]*R, Y=cy-q[1]*R; if(e===0)ctx.moveTo(X,Y); else ctx.lineTo(X,Y); } ctx.stroke();

        // arcos ambiente entre nós
        for (var j=0;j<arcs.length;j++){ var arc=arcs[j]; var pa=projVec(arc.a._v), pb=projVec(arc.b._v);
          var mx=(pa.x+pb.x)/2, my=(pa.y+pb.y)/2, dx=mx-cx, dy=my-cy, dist=Math.hypot(dx,dy)||1, lift=R*0.45;
          var ctrlx=mx+dx/dist*lift, ctrly=my+dy/dist*lift;
          ctx.strokeStyle="rgba("+arc.hue+",0.10)"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.quadraticCurveTo(ctrlx,ctrly,pb.x,pb.y); ctx.stroke();
          var t=arc.t, it=1-t; var px=it*it*pa.x+2*it*t*ctrlx+t*t*pb.x, py=it*it*pa.y+2*it*t*ctrly+t*t*pb.y;
          var pg=ctx.createRadialGradient(px,py,0,px,py,6); pg.addColorStop(0,"rgba("+arc.hue+",0.7)"); pg.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(px,py,6,0,TAU); ctx.fill();
          ctx.fillStyle="rgba("+arc.hue+",0.9)"; ctx.beginPath(); ctx.arc(px,py,1.6,0,TAU); ctx.fill();
          if(!reduce){ arc.t+=arc.speed; if(arc.t>=1) arc.t=0; }
        }

        // núcleo
        var core=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.28);
        core.addColorStop(0,"rgba(0,240,255,0.55)"); core.addColorStop(0.3,"rgba(0,191,255,0.15)"); core.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=core; ctx.beginPath(); ctx.arc(cx,cy,R*0.28,0,TAU); ctx.fill();

        // nós = redes reais (tamanho=TVL, cor=variação)
        var maxTvl=1; nodes.forEach(function(n){ if(n.tvl>maxTvl)maxTvl=n.tvl; });
        var ordered=nodes.map(function(n){ var s=projVec(n._v); n._s=s; return n; }).sort(function(a,b){ return a._s.z-b._s.z; });
        ordered.forEach(function(n){ var s=n._s; if(s.z<-0.2) return;
          var front=(s.z+1)/2; var rad=4+Math.sqrt(n.tvl/maxTvl)*9;
          var col=n.change24h==null?"120,190,230":(n.change24h>=0?"0,226,138":"255,84,112");
          var active=(n.id===hoverId||n.id===pinnedId);
          // brilho
          var ng=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,rad*2.4);
          ng.addColorStop(0,"rgba("+col+","+(0.5*front).toFixed(2)+")"); ng.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(s.x,s.y,rad*2.4,0,TAU); ctx.fill();
          ctx.fillStyle="rgba("+col+","+(0.55+front*0.4).toFixed(2)+")"; ctx.beginPath(); ctx.arc(s.x,s.y,rad,0,TAU); ctx.fill();
          if(active){ ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,rad+3,0,TAU); ctx.stroke(); }
          // rótulo (só na frente)
          if(s.z>0.15 || active){ ctx.fillStyle="rgba(230,241,255,"+(active?1:0.7*front+0.2).toFixed(2)+")";
            ctx.font="600 10px 'JetBrains Mono', monospace"; ctx.textAlign="left"; ctx.textBaseline="middle";
            ctx.fillText(n.label, s.x+rad+4, s.y); }
        });

        if(!reduce) ang+=0.0016;
        raf=requestAnimationFrame(draw);
      }

      function prep() { nodes.forEach(function(n){ n._v=llToVec(n.lat, n.lon); }); }
      prep(); draw();

      return {
        stop: function(){ running=false; if(raf)cancelAnimationFrame(raf); if(ro)ro.disconnect(); if(canvas.parentNode)canvas.parentNode.removeChild(canvas); },
        setNodes: function(ns){ nodes=ns||[]; prep(); rebuildArcs(); }
      };
    }
  };
})();
