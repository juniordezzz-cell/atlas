/* ===================================================================
   ATLAS — Login (SIMULADO)
   Não valida credenciais reais. Qualquer submit cai no dashboard.
   Firebase Auth entra numa etapa futura (Próximos Passos).
   =================================================================== */

const form = document.getElementById('loginForm');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = form.querySelector('.btn-entrar');
  btn.textContent = 'Entrando...';
  btn.style.opacity = '0.8';
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 550);
});
