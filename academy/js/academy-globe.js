/* ============================================================
   ATLAS · academy/js/academy-globe.js
   Mapa global de liquidez — globo interativo em Canvas 2D puro.

   AcademyGlobe.mount(container, { nodes, onHover, onSelect }) -> { stop(), setNodes() }

   O mapa-múndi do Atlas: uma esfera com grade de meridianos/paralelos
   (dá o aspecto de globo detalhado) girando devagar. Cada HUB é uma
   blockchain real, posicionada por lat/lon, com tamanho pelo TVL e cor
   pela variação 24h; arcos animados entre os hubs simulam as rotas de
   liquidez (ambiente). Passar o mouse num hub chama onHover(node);
   clicar chama onSelect(node) (filtra o resto da tela).

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
  function rotY(p,a){ var c=Math.cos(a),s=Math.sin(a); return [p[0]*c-p[2]*s, p[1], p[0]*s+p[2]*c]; }
  function rotX(p,a){ var c=Math.cos(a),s=Math.sin(a); return [p[0], p[1]*c-p[2]*s, p[1]*s+p[2]*c]; }

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

      var dots=fibSphere(620), tilt=-0.42;
      var nodes=opts.nodes||[];

      // grade (meridianos e paralelos) pré-computada em vetores unitários
      var meridians=[], parallels=[];
      for (var lon=0; lon<360; lon+=30){ var line=[]; for (var lat=-90; lat<=90; lat+=6) line.push(llToVec(lat,lon)); meridians.push(line); }
      for (var la=-60; la<=60; la+=30){ var ring=[]; for (var lo=0; lo<=360; lo+=6) ring.push(llToVec(la,lo)); parallels.push(ring); }

      var arcs=[];
      function rebuildArcs(){ arcs=[]; if(nodes.length<2)return; for(var k=0;k<8;k++){ var a=nodes[(Math.random()*nodes.length)|0], b=nodes[(Math.random()*nodes.length)|0]; if(a===b)continue; arcs.push({a:a,b:b,t:Math.random(),speed:0.004+Math.random()*0.005,hue:Math.random()<0.5?"0,240,255":"255,215,0"}); } }
      rebuildArcs();

      var W=0,H=0,R=0,cx=0,cy=0,dpr=Math.min(window.devicePixelRatio||1,2);
      var maxT=1,minT=0;
      function calcTvl(){ var v=nodes.map(function(n){return Math.log10(Math.max(1,n.tvl||1));}); maxT=v.length?Math.max.apply(null,v):1; minT=v.length?Math.min.apply(null,v):0; }
      function resize(){ var w=container.clientWidth||360,h=container.clientHeight||360; W=w;H=h;R=Math.min(w,h)*0.44;cx=w/2;cy=h/2; canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0); }
      calcTvl(); resize();
      var ro=null; if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(resize); ro.observe(container); }

      var ang=0, raf=null, running=true, hoverId=null, pinnedId=null, mouse=null;
      function proj(v){ var q=rotX(rotY(v,ang),tilt); return {x:cx+q[0]*R, y:cy-q[1]*R, z:q[2]}; }

      function nodeProj(n){ return proj(n._v); }
      function pick(){ if(!mouse)return null; var best=null,bd=1e9; for(var i=0;i<nodes.length;i++){ var s=nodeProj(nodes[i]); if(s.z<0)continue; var d=Math.hypot(s.x-mouse.x,s.y-mouse.y); if(d<(nodes[i]._r+9)&&d<bd){bd=d;best=nodes[i];} } return best; }

      canvas.addEventListener("mousemove",function(e){ var r=canvas.getBoundingClientRect(); mouse={x:e.clientX-r.left,y:e.clientY-r.top}; var n=pick(); var id=n?n.id:null; if(id!==hoverId){ hoverId=id; canvas.style.cursor=n?"pointer":"grab"; if(n)onHover(n); else if(!pinnedId)onHover(null);} });
      canvas.addEventListener("mouseleave",function(){ mouse=null; hoverId=null; if(!pinnedId)onHover(null); });
      canvas.addEventListener("click",function(){ var n=pick(); if(n){ pinnedId=(pinnedId===n.id?null:n.id); onHover(pinnedId?n:null); onSelect(pinnedId?n:null); } });

      function polyline(line, color, width){ ctx.strokeStyle=color; ctx.lineWidth=width||1; var started=false; ctx.beginPath();
        for(var i=0;i<line.length;i++){ var s=proj(line[i]); if(s.z< -0.05){ started=false; continue; } if(!started){ ctx.moveTo(s.x,s.y); started=true; } else ctx.lineTo(s.x,s.y); } ctx.stroke(); }

      function draw(){
        if(!running)return;
        ctx.clearRect(0,0,W,H);
        // halo
        var g=ctx.createRadialGradient(cx,cy,R*0.1,cx,cy,R*1.22); g.addColorStop(0,"rgba(0,191,255,0.14)"); g.addColorStop(0.5,"rgba(0,191,255,0.045)"); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*1.22,0,TAU); ctx.fill();
        // disco do oceano
        ctx.fillStyle="rgba(8,20,36,0.55)"; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fill();
        // pontos da esfera (textura)
        for(var i=0;i<dots.length;i++){ var s=proj(dots[i]); if(s.z<-0.05)continue; var depth=(s.z+1)/2; ctx.fillStyle="rgba(90,160,210,"+(0.05+depth*0.16).toFixed(3)+")"; ctx.beginPath(); ctx.arc(s.x,s.y,0.5+depth*0.8,0,TAU); ctx.fill(); }
        // grade
        for(var m=0;m<meridians.length;m++) polyline(meridians[m],"rgba(0,240,255,0.09)",1);
        for(var p=0;p<parallels.length;p++) polyline(parallels[p],"rgba(0,240,255,0.09)",1);
        // borda do globo
        ctx.strokeStyle="rgba(0,240,255,0.22)"; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.stroke();

        // arcos (rotas de liquidez) — só quando os dois hubs estão na frente
        for(var j=0;j<arcs.length;j++){ var arc=arcs[j]; var pa=nodeProj(arc.a), pb=nodeProj(arc.b);
          var vis=((arc.a._v && (proj(arc.a._v).z)) + (proj(arc.b._v).z))/2; if(vis<-0.2){ if(!reduce){arc.t+=arc.speed; if(arc.t>=1)arc.t=0;} continue; }
          var mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2,dx=mx-cx,dy=my-cy,dist=Math.hypot(dx,dy)||1,lift=R*0.42;
          var ctrlx=mx+dx/dist*lift,ctrly=my+dy/dist*lift;
          ctx.strokeStyle="rgba("+arc.hue+",0.13)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.quadraticCurveTo(ctrlx,ctrly,pb.x,pb.y); ctx.stroke();
          var t=arc.t,it=1-t; var px=it*it*pa.x+2*it*t*ctrlx+t*t*pb.x, py=it*it*pa.y+2*it*t*ctrly+t*t*pb.y;
          var pg=ctx.createRadialGradient(px,py,0,px,py,6); pg.addColorStop(0,"rgba("+arc.hue+",0.8)"); pg.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(px,py,6,0,TAU); ctx.fill();
          ctx.fillStyle="rgba("+arc.hue+",0.95)"; ctx.beginPath(); ctx.arc(px,py,1.7,0,TAU); ctx.fill();
          if(!reduce){ arc.t+=arc.speed; if(arc.t>=1)arc.t=0; }
        }

        // hubs (blockchains) — ordena por z p/ os da frente ficarem por cima
        var span=(maxT-minT)||1;
        var ordered=nodes.map(function(n){ n._s=nodeProj(n); return n; }).sort(function(a,b){return a._s.z-b._s.z;});
        ordered.forEach(function(n){ var s=n._s; var bnorm=(Math.log10(Math.max(1,n.tvl||1))-minT)/span; n._r=4+bnorm*8; if(s.z<-0.2)return;
          var front=(s.z+1)/2; var col=n.change24h==null?"120,190,230":(n.change24h>=0?"0,226,138":"255,84,112"); var active=(n.id===hoverId||n.id===pinnedId);
          var gr=n._r*(2.3+(active?0.8:0));
          var ng=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,gr); ng.addColorStop(0,"rgba("+col+","+(0.5*front).toFixed(2)+")"); ng.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(s.x,s.y,gr,0,TAU); ctx.fill();
          ctx.fillStyle="rgba("+col+","+(0.6+front*0.35).toFixed(2)+")"; ctx.beginPath(); ctx.arc(s.x,s.y,n._r,0,TAU); ctx.fill();
          if(active){ ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,n._r+3.5,0,TAU); ctx.stroke(); }
          if(s.z>0.12||active){ ctx.font="600 10px 'JetBrains Mono', monospace"; ctx.textBaseline="middle"; ctx.textAlign=s.x>=cx?"left":"right";
            ctx.fillStyle="rgba(230,241,255,"+(active?1:0.6*front+0.25).toFixed(2)+")"; ctx.fillText(n.label, s.x+(s.x>=cx?1:-1)*(n._r+5), s.y); }
        });

        if(!reduce) ang+=0.0015;
        raf=requestAnimationFrame(draw);
      }
      function prep(){ nodes.forEach(function(n){ n._v=llToVec(n.lat||0,n.lon||0); }); calcTvl(); }
      prep(); draw();

      return {
        stop:function(){ running=false; if(raf)cancelAnimationFrame(raf); if(ro)ro.disconnect(); if(canvas.parentNode)canvas.parentNode.removeChild(canvas); },
        setNodes:function(ns){ nodes=ns||[]; prep(); rebuildArcs(); }
      };
    }
  };
})();
