/* ============================================================
   Estúdio de Agentes de Pools · motor/simulador.mjs

   Motor do Simulador de Pools LP fora do navegador (Fase 1, 11/11/2026).

   O trecho marcado como "core" (entre as marcas core) e a função statsOf são CÓPIA EXATA de
   estudio/referencia/simulador-pools.html. Não edite aqui: mude o simulador
   e copie de novo. O teste simulador.test.mjs falha se os dois divergirem,
   e compara os números do HTML com os deste módulo, valor a valor.

   O que vem depois do bloco copiado é só a costura sem tela: gerar os
   caminhos (makePaths do HTML) e o caça-estratégias (hunt do HTML).
   ============================================================ */

//<core>
const Kc=c=>2-Math.sqrt(1-c)-1/Math.sqrt(1+c);
function denom(P,a,b){const sa=Math.sqrt(a),sb=Math.sqrt(b);
 if(P<=a)return P*(1/sa-1/sb); if(P>=b)return sb-sa; return 2*Math.sqrt(P)-sa-P/sb;}
function amounts(L,P,a,b){const sa=Math.sqrt(a),sb=Math.sqrt(b);
 if(P<=a)return[L*(1/sa-1/sb),0]; if(P>=b)return[0,L*(sb-sa)];
 const s=Math.sqrt(P);return[L*(1/s-1/sb),L*(s-sa)];}
function mkPos(cap,a,b,P){const L=cap/denom(P,a,b);const[x,y]=amounts(L,P,a,b);return{cap,a,b,L,x0:x,y0:y};}
function val(ps,P){let s=0;for(const q of ps){const[x,y]=amounts(q.L,P,q.a,q.b);s+=x*P+y}return s}
function actL(ps,P){let s=0;for(const q of ps)if(P>=q.a&&P<=q.b)s+=q.L;return s}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function genZ(n,steps,seed){const r=mulberry32(seed),Z=new Float32Array(n*steps);
 for(let i=0;i<Z.length;i++){let u=0;while(!u)u=r();Z[i]=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());}return Z}
function buildPaths(Z,n,steps,M,vol){const dt=M.days/365/steps,sd=vol*Math.sqrt(dt),dr=(M.mu-vol*vol/2)*dt,l0=Math.log(M.p0),W=steps+1,D=new Float32Array(n*W);
 for(let s=0;s<n;s++){let l=l0;D[s*W]=M.p0;for(let i=0;i<steps;i++){l+=dr+M.kappa*(l0-l)*dt+sd*Z[s*steps+i];D[s*W+i+1]=Math.exp(l);}}
 return{n,steps,data:D,dtDays:M.days/steps}}
const r4=v=>+(+v).toPrecision(4);
// modelos: devolve [{cap,a,b}]
function build(tpl,N,C,lo,hi,P0){
 N=Math.max(1,N|0);
 if(tpl==='acc'){const H=Math.min(hi,P0);if(H<=lo)return[{cap:C,a:lo,b:hi}];
  const o=[];for(let j=0;j<N;j++)o.push({cap:C/N,a:r4(lo*Math.pow(H/lo,j/N)),b:r4(lo*Math.pow(H/lo,(j+1)/N))});return o}
 if(tpl==='single'||N===1)return[{cap:C,a:lo,b:hi}];
 if(tpl==='nested'){const c=(P0>lo&&P0<hi)?P0:Math.sqrt(lo*hi),o=[];
  for(let i=0;i<N;i++){const f=i/N;o.push({cap:C/N,a:r4(lo+(c-lo)*f),b:r4(hi-(hi-c)*f)})}return o}
 const e=[];for(let j=0;j<=N;j++)e.push(lo*Math.pow(hi/lo,j/N));
 let c=0;for(let j=0;j<N;j++)if(P0>=e[j])c=j;
 const w=[];for(let j=0;j<N;j++){const d=Math.abs(j-c);w.push(tpl==='curve'?N-d:tpl==='bidask'?1+d:1)}
 const sw=w.reduce((s,x)=>s+x,0);
 return w.map((x,j)=>({cap:C*x/sw,a:r4(e[j]),b:r4(e[j+1])}));
}
// avalia uma estratégia em todos os caminhos
function evalStrat(defs,rebal,PX,M,trace){
 const P0=M.p0,n=PX.n,steps=PX.steps,W=steps+1,D=PX.data;
 const base=defs.map(d=>mkPos(d.cap,d.a,d.b,P0));
 let cap=0,x0=0,y0=0,lo0=Infinity,hi0=0;for(const q of base){cap+=q.cap;x0+=q.x0;y0+=q.y0;lo0=Math.min(lo0,q.a);hi0=Math.max(hi0,q.b)}
 const rel=defs.map(d=>({w:d.cap/cap,ra:d.a/P0,rb:d.b/P0}));
 const canReb=rebal&&P0>lo0&&P0<hi0;
 const volStep=M.vday*PX.dtDays,kc=Kc(M.conc),gasOC=M.gas*2*base.length;
 const R={cap,n,gasOC,pnl:new Float64Array(n),fees:new Float64Array(n),il:new Float64Array(n),tir:new Float64Array(n),reb:new Float64Array(n),cost:new Float64Array(n),hodl:new Float64Array(n),L0:actL(base,P0),tr:null};
 for(let s=0;s<n;s++){
  let pos=base,lo=lo0,hi=hi0,fees=0,inr=0,reb=0,rc=0;const o=s*W;
  const tr=(trace===s)?{t:[],p:[],f:[]}:null;
  for(let i=0;i<steps;i++){
   const p=D[o+i];
   if(canReb&&(p<lo||p>hi)){const v=val(pos,p),c=M.gas*2*pos.length+v*0.5*M.swap,v2=Math.max(0,v-c);
    pos=rel.map(r=>mkPos(v2*r.w,p*r.ra,p*r.rb,p));lo=p*lo0/P0;hi=p*hi0/P0;reb++;rc+=c;}
   let La=0;for(const q of pos)if(p>=q.a&&p<=q.b)La+=q.L;
   if(La>0){fees+=volStep*M.fee*La/(M.tvl/(Math.sqrt(p)*kc)+La);inr++;}
   if(tr&&i%Math.max(1,Math.floor(steps/120))===0){tr.t.push((i*PX.dtDays).toFixed(1));tr.p.push(p);tr.f.push(fees);}
  }
  const pe=D[o+steps],v=val(pos,pe),h=x0*pe+y0;
  R.fees[s]=fees;R.il[s]=v+rc-h;R.cost[s]=gasOC+rc;R.pnl[s]=v+fees-gasOC-cap;R.tir[s]=inr/steps;R.reb[s]=reb;R.hodl[s]=h-cap;
  if(tr)R.tr=tr;
 }
 return R}
const mean=a=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i];return s/a.length};
const sdev=a=>{const m=mean(a);let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-m)**2;return Math.sqrt(s/a.length)};
const pct=(a,q)=>{const s=Float64Array.from(a).sort();return s[Math.min(s.length-1,Math.floor(q*s.length))]};
const frac=(a,f)=>{let c=0;for(let i=0;i<a.length;i++)if(f(a[i],i))c++;return c/a.length};
//</core>

function statsOf(R,days){const m=mean(R.pnl),sd=sdev(R.pnl);
 return{mean:m,med:pct(R.pnl,.5),p10:pct(R.pnl,.1),p90:pct(R.pnl,.9),fees:mean(R.fees),il:mean(R.il),cost:mean(R.cost),tir:mean(R.tir)*100,reb:mean(R.reb),
  loss:frac(R.pnl,v=>v<0)*100,beat:frac(R.pnl,(v,i)=>v>R.hodl[i])*100,rr:sd>0?m/sd:0,apr:mean(R.fees)/R.cap*365/days*100}}

/* ---------- costura sem tela (mesma lógica de makePaths/sub/defs/hunt do HTML) ---------- */
export const MODELOS = ["single","nested","curve","bidask","spot","acc"];
export const NOMES = {single:"Faixa única",nested:"Aninhadas",curve:"Curve",bidask:"Bid-Ask",spot:"Spot",acc:"Acumulação"};

/** Caminhos de preço do mercado M, como makePaths do simulador. */
export function caminhos(M){const steps=Math.min(M.days*24,1440);const Z=genZ(M.nsim,steps,M.seed);return buildPaths(Z,M.nsim,steps,M,M.vol)}
/** Usa só os n primeiros caminhos, como sub() do simulador. */
export const sub=(px,n)=>({...px,n:Math.min(px.n,n)});
/** Posições válidas, como defs() do simulador. */
export const validas=pos=>pos.filter(p=>p.cap>0&&p.b>p.a&&p.a>0);

/**
 * Caça-estratégias: todos os modelos com 1 a 6 posições, mesmo capital, faixa
 * e rebalanceamento, nos mesmos caminhos (até 300, como no simulador).
 * Devolve [{t, n, st}] na ordem do simulador; ordene por st[métrica].
 */
export function cacar(M,{cap,lo,hi,reb=0},px=caminhos(M)){
 const p=sub(px,300),list=[];
 for(const t of MODELOS)for(let n=1;n<=6;n++){if(t==="single"&&n>1)continue;if(t!=="single"&&t!=="acc"&&n===1)continue;
  const d=build(t,n,cap,lo,hi,M.p0),st=statsOf(evalStrat(d,reb,p,M),M.days);list.push({t,n,st});}
 return list}

export {Kc,denom,amounts,mkPos,val,actL,mulberry32,genZ,buildPaths,r4,build,evalStrat,mean,sdev,pct,frac,statsOf};
