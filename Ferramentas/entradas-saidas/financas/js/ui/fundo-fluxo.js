/* ============================================================
   fundo-fluxo.js — fundo "fios de fluxo" do Finanças (opção A)
   ------------------------------------------------------------
   Escolhido pelo dono em 23/10/2026: linhas finas de luz azul
   ondulando devagar sobre preto, como gráficos de dinheiro entrando
   e saindo. Diferente do Scanner (manchas) e do Academy (rede
   neural). As opções B e C estão guardadas em
   docs/visual-financas/fundos-opcoes.html.

   Canvas 2D, resolução 1×, no máximo 30 quadros por segundo, pausa
   com a aba oculta. "Menos movimento": um quadro parado. Tema
   claro: sem fundo.
   ============================================================ */
(function () {
  const raiz = document.documentElement;
  const canvas = document.createElement("canvas");
  canvas.className = "fp-fundo";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const parado = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fios = Array.from({ length: 10 }, (_, i) => ({
    y: 0.14 + i * 0.08,
    a: 0.025 + Math.random() * 0.045,
    f: 1.2 + Math.random() * 2.2,
    v: 0.03 + Math.random() * 0.05,
    p: Math.random() * 9,
    al: 0.08 + Math.random() * 0.24
  }));

  function medir() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }

  function altura(o, u, t) {
    return o.y + Math.sin(u * o.f * 6.283 + t * o.v * 6 + o.p) * o.a + Math.sin(u * 13 + t * 0.5 + o.p) * 0.006;
  }

  function desenhar(t) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#03060C";
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.25, h * 0.1, 0, w * 0.25, h * 0.1, Math.max(w, h) * 0.9);
    g.addColorStop(0, "rgba(0,70,140,.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const passos = Math.max(40, Math.round(w / 16));
    for (const o of fios) {
      ctx.beginPath();
      for (let i = 0; i <= passos; i++) {
        const u = i / passos, y = altura(o, u, t) * h;
        if (i) ctx.lineTo(u * w, y); else ctx.moveTo(0, y);
      }
      ctx.strokeStyle = `rgba(0,191,255,${o.al})`;
      ctx.lineWidth = 1.1;
      ctx.shadowColor = "rgba(0,191,255,.5)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // o pontinho que corre pelo fio: o "dinheiro" passando
      const u = (t * o.v * 0.5 + o.p) % 1;
      ctx.fillStyle = `rgba(0,240,255,${Math.min(1, o.al + 0.3)})`;
      ctx.beginPath();
      ctx.arc(u * w, altura(o, u, t) * h, 1.8, 0, 7);
      ctx.fill();
    }
  }

  // cada ligar() começa uma "geração"; o laço antigo para sozinho
  let ultimo = 0, rodando = false, geracao = 0;
  function laco(minha) {
    return function quadro(ms) {
      if (!rodando || minha !== geracao) return;
      if (ms - ultimo >= 33) { ultimo = ms; desenhar(ms / 1000); }
      requestAnimationFrame(quadro);
    };
  }

  function ligar() {
    const claro = raiz.getAttribute("data-theme") === "light";
    canvas.hidden = claro;
    raiz.classList.toggle("fp-com-fundo", !claro);
    rodando = !claro && !parado && document.visibilityState !== "hidden";
    if (claro) return;
    if (parado) { desenhar(12); return; }
    if (rodando) requestAnimationFrame(laco(++geracao));
  }

  medir();
  addEventListener("resize", () => { medir(); if (parado) desenhar(12); });
  document.addEventListener("visibilitychange", () => { rodando = false; ligar(); });
  new MutationObserver(() => { rodando = false; ligar(); }).observe(raiz, { attributes: true, attributeFilter: ["data-theme"] });
  ligar();
})();
