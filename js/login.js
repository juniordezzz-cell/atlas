/* ===================================================================
   ATLAS — Login (SIMULADO)

   Não valida credenciais: qualquer submit entra. Autenticação real é
   uma FASE FUTURA do projeto.

   O que este arquivo faz de verdade é ABRIR SESSÃO em AtlasAuth. No
   modo local isso não protege nada — e não pretende proteger. Serve
   para o sistema saber que alguém entrou, e para o "Sair" do menu de
   perfil ter o que encerrar. Quando um provedor real for registrado,
   este mesmo código passa a autenticar de verdade sem mudar uma linha:
   AtlasAuth.signIn delega para o provedor.
   =================================================================== */

const form = document.getElementById('loginForm');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = form.querySelector('.btn-entrar');
  const email = (form.querySelector('input[type=email]') || {}).value || '';

  btn.textContent = 'Entrando...';
  btn.style.opacity = '0.8';

  const entrar = window.AtlasAuth
    ? AtlasAuth.signIn({ email })
    : Promise.resolve();

  /* O atraso não é enfeite: sem ele o clique parece não ter efeito em
     máquina rápida. Meio segundo é o mínimo que se lê como resposta. */
  entrar
    .catch(() => null)
    .then(() => setTimeout(() => { window.location.href = 'dashboard.html'; }, 550));
});
