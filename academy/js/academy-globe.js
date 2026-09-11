/* ============================================================
   ATLAS · academy/js/academy-globe.js
   Mapa global de liquidez — globo interativo em Canvas 2D puro.

   AcademyGlobe.mount(container, { nodes, onHover, onSelect }) -> { stop(), setNodes() }

   Uma esfera com grade de meridianos/paralelos girando devagar. Cada HUB
   é uma blockchain real (lat/lon), tamanho pelo TVL e cor pela variação
   24h; arcos animados = rotas de liquidez (ambiente). Hover chama
   onHover(node); clique chama onSelect(node).

   PERFORMANCE: ~30fps, DPI limitado, poucos pontos, grade leve e brilhos
   pré-renderizados (drawImage em vez de createRadialGradient por frame),
   para não travar em telas modestas / no preview.

   nodes: [{ id, label, tvl, change24h, lat, lon }]
   Respeita prefers-reduced-motion (globo estático, ainda interativo).
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyGlobe) return;

  var TAU = Math.PI * 2, D2R = Math.PI / 180;

  function fibSphere(n) {
    var pts = [], off = 2 / n, inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) { var y = i*off-1+off/2, r=Math.sqrt(1-y*y), phi=i*inc; pts.push([Math.cos(phi)*r, y, Math.sin(phi)*r]); }
    return pts;
  }
  function llToVec(lat, lon) { var a=lat*D2R, b=lon*D2R; return [Math.cos(a)*Math.cos(b), Math.sin(a), Math.cos(a)*Math.sin(b)]; }

  // sprite de brilho radial pré-renderizado por cor (reutilizado com drawImage)
  var glowCache = {};
  function glowSprite(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    var s = document.createElement("canvas"); s.width = s.height = 64;
    var c = s.getContext("2d");
    var g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(" + rgb + ",1)"); g.addColorStop(1, "rgba(" + rgb + ",0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    glowCache[rgb] = s; return s;
  }

  window.AcademyGlobe = {
    mount: function (container, opts) {
      opts = opts || {};
      var onHover = opts.onHover || function(){};
      var onSelect = opts.onSelect || function(){};
      var reduce=false; try{ reduce=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

      var canvas=document.createElement("canvas");
      canvas.style.display="block"; canvas.style.width="100%"; canvas.style.height="100%"; canvas.style.cursor="grab";
      container.appendChild(canvas);
      var ctx=canvas.getContext("2d");

      var dots=fibSphere(300), tilt=-0.42;
      var nodes=opts.nodes||[];

      // grade leve (meridianos a cada 45°, paralelos a cada 30°)
      var grid=[];
      for (var lon=0; lon<360; lon+=45){ var line=[]; for (var lat=-90; lat<=90; lat+=9) line.push(llToVec(lat,lon)); grid.push(line); }
      for (var la=-60; la<=60; la+=30){ var ring=[]; for (var lo=0; lo<=360; lo+=9) ring.push(llToVec(la,lo)); grid.push(ring); }

      var arcs=[];
      function rebuildArcs(){ arcs=[]; if(nodes.length<2)return; for(var k=0;k<6;k++){ var a=nodes[(Math.random()*nodes.length)|0], b=nodes[(Math.random()*nodes.length)|0]; if(a===b)continue; arcs.push({a:a,b:b,t:Math.random(),speed:0.005+Math.random()*0.005,hue:Math.random()<0.5?"0,240,255":"255,215,0"}); } }
      rebuildArcs();

      var W=0,H=0,R=0,cx=0,cy=0,dpr=Math.min(window.devicePixelRatio||1,1.5);
      var maxT=1,minT=0, haloGrad=null, cosT=Math.cos(tilt), sinT=Math.sin(tilt), cosA=1, sinA=0;
      function calcTvl(){ var v=nodes.map(function(n){return Math.log10(Math.max(1,n.tvl||1));}); maxT=v.length?Math.max.apply(null,v):1; minT=v.length?Math.min.apply(null,v):0; }
      function resize(){ var w=container.clientWidth||360,h=container.clientHeight||360; W=w;H=h;R=Math.min(w,h)*0.44;cx=w/2;cy=h/2; canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
        haloGrad=ctx.createRadialGradient(cx,cy,R*0.1,cx,cy,R*1.22); haloGrad.addColorStop(0,"rgba(0,191,255,0.13)"); haloGrad.addColorStop(0.5,"rgba(0,191,255,0.04)"); haloGrad.addColorStop(1,"rgba(0,0,0,0)"); }
      calcTvl(); resize();
      var ro=null; if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(resize); ro.observe(container); }

      // pausa a animação quando o globo sai da tela (scroll) ou a aba oculta —
      // um canvas repintando fora de vista é custo de compositing à toa.
      var inView=true, docVis=true, io=null;
      if(typeof IntersectionObserver!=="undefined"){ io=new IntersectionObserver(function(e){ inView=e[0].isIntersecting; },{threshold:0.01}); io.observe(container); }
      function onVis(){ docVis=!document.hidden; } document.addEventListener("visibilitychange", onVis);

      var ang=0, raf=null, running=true, hoverId=null, pinnedId=null, mouse=null, last=0;

      // projeção: rotação Y (ang) + inclinação X (tilt), ortográfica
      function proj(v){ var x=v[0]*cosA - v[2]*sinA, z=v[0]*sinA + v[2]*cosA, y=v[1];
        var y2=y*cosT - z*sinT, z2=y*sinT + z*cosT;
        return {x:cx+x*R, y:cy-y2*R, z:z2}; }

      function pick(){ if(!mouse)return null; var best=null,bd=1e9; for(var i=0;i<nodes.length;i++){ var s=proj(nodes[i]._v); if(s.z<0)continue; var d=Math.hypot(s.x-mouse.x,s.y-mouse.y); if(d<(nodes[i]._r+9)&&d<bd){bd=d;best=nodes[i];} } return best; }

      canvas.addEventListener("mousemove",function(e){ var r=canvas.getBoundingClientRect(); mouse={x:e.clientX-r.left,y:e.clientY-r.top}; var n=pick(); var id=n?n.id:null; if(id!==hoverId){ hoverId=id; canvas.style.cursor=n?"pointer":"grab"; if(n)onHover(n); else if(!pinnedId)onHover(null);} });
      canvas.addEventListener("mouseleave",function(){ mouse=null; hoverId=null; if(!pinnedId)onHover(null); });
      canvas.addEventListener("click",function(){ var n=pick(); if(n){ pinnedId=(pinnedId===n.id?null:n.id); onHover(pinnedId?n:null); onSelect(pinnedId?n:null); } });

      function polyline(line){ var started=false; ctx.beginPath();
        for(var i=0;i<line.length;i++){ var s=proj(line[i]); if(s.z< -0.05){ started=false; continue; } if(!started){ ctx.moveTo(s.x,s.y); started=true; } else ctx.lineTo(s.x,s.y); } ctx.stroke(); }

      function drawGlow(x,y,r,rgb,alpha){ ctx.globalAlpha=alpha; ctx.drawImage(glowSprite(rgb), x-r, y-r, r*2, r*2); ctx.globalAlpha=1; }

      function render(){
        ctx.clearRect(0,0,W,H);
        // halo (gradiente cacheado)
        ctx.fillStyle=haloGrad; ctx.beginPath(); ctx.arc(cx,cy,R*1.22,0,TAU); ctx.fill();
        // oceano
        ctx.fillStyle="rgba(8,20,36,0.55)"; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fill();
        // pontos
        for(var i=0;i<dots.length;i++){ var s=proj(dots[i]); if(s.z<-0.05)continue; var depth=(s.z+1)/2; ctx.fillStyle="rgba(90,160,210,"+(0.05+depth*0.15).toFixed(3)+")"; ctx.beginPath(); ctx.arc(s.x,s.y,0.5+depth*0.8,0,TAU); ctx.fill(); }
        // grade
        ctx.strokeStyle="rgba(0,240,255,0.09)"; ctx.lineWidth=1;
        for(var m=0;m<grid.length;m++) polyline(grid[m]);
        // borda
        ctx.strokeStyle="rgba(0,240,255,0.22)"; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.stroke();

        // arcos (rotas)
        for(var j=0;j<arcs.length;j++){ var arc=arcs[j]; var pa=proj(arc.a._v), pb=proj(arc.b._v);
          if((pa.z+pb.z)/2 < -0.2){ if(!reduce){arc.t+=arc.speed; if(arc.t>=1)arc.t=0;} continue; }
          var mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2,dx=mx-cx,dy=my-cy,dist=Math.hypot(dx,dy)||1,lift=R*0.42;
          var ctrlx=mx+dx/dist*lift,ctrly=my+dy/dist*lift;
          ctx.strokeStyle="rgba("+arc.hue+",0.13)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.quadraticCurveTo(ctrlx,ctrly,pb.x,pb.y); ctx.stroke();
          var t=arc.t,it=1-t; var px=it*it*pa.x+2*it*t*ctrlx+t*t*pb.x, py=it*it*pa.y+2*it*t*ctrly+t*t*pb.y;
          drawGlow(px,py,6,arc.hue,0.8);
          ctx.fillStyle="rgba("+arc.hue+",0.95)"; ctx.beginPath(); ctx.arc(px,py,1.6,0,TAU); ctx.fill();
          if(!reduce){ arc.t+=arc.speed; if(arc.t>=1)arc.t=0; }
        }

        // hubs (frente por cima)
        var span=(maxT-minT)||1;
        var ordered=nodes.map(function(n){ n._s=proj(n._v); return n; }).sort(function(a,b){return a._s.z-b._s.z;});
        ordered.forEach(function(n){ var s=n._s; var bnorm=(Math.log10(Math.max(1,n.tvl||1))-minT)/span; n._r=4+bnorm*8; if(s.z<-0.2)return;
          var front=(s.z+1)/2; var col=n.change24h==null?"120,190,230":(n.change24h>=0?"0,226,138":"255,84,112"); var active=(n.id===hoverId||n.id===pinnedId);
          drawGlow(s.x,s.y,n._r*(2.3+(active?0.8:0)),col,0.5*front);
          ctx.fillStyle="rgba("+col+","+(0.6+front*0.35).toFixed(2)+")"; ctx.beginPath(); ctx.arc(s.x,s.y,n._r,0,TAU); ctx.fill();
          if(active){ ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,n._r+3.5,0,TAU); ctx.stroke(); }
          if(s.z>0.12||active){ ctx.font="600 10px 'JetBrains Mono', monospace"; ctx.textBaseline="middle"; ctx.textAlign=s.x>=cx?"left":"right";
            ctx.fillStyle="rgba(230,241,255,"+(active?1:0.6*front+0.25).toFixed(2)+")"; ctx.fillText(n.label, s.x+(s.x>=cx?1:-1)*(n._r+5), s.y); }
        });
      }

      function loop(ts){
        if(!running)return;
        raf=requestAnimationFrame(loop);
        if(!inView || !docVis) return;      // fora da tela / aba oculta: não pinta
        if(ts-last < 32){ return; }          // ~30fps
        last=ts;
        if(!reduce){ ang+=0.0032; cosA=Math.cos(ang); sinA=Math.sin(ang); }
        render();
      }
      function prep(){ nodes.forEach(function(n){ n._v=llToVec(n.lat||0,n.lon||0); }); calcTvl(); }
      prep(); cosA=Math.cos(ang); sinA=Math.sin(ang); render(); raf=requestAnimationFrame(loop);

      return {
        stop:function(){ running=false; if(raf)cancelAnimationFrame(raf); if(ro)ro.disconnect(); if(io)io.disconnect(); document.removeEventListener("visibilitychange", onVis); if(canvas.parentNode)canvas.parentNode.removeChild(canvas); },
        setNodes:function(ns){ nodes=ns||[]; prep(); rebuildArcs(); }
      };
    }
  };
})();
