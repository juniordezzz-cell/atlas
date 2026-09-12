# Design — Login Firebase + nuvem (multi-aparelho)

- **Data:** 2026-09-12
- **Autor:** Junior + Claude (Opus 4.8)
- **Status:** Fase 1 implementada; Fase 2 esboçada
- **Projeto Firebase:** `cryptotrack-br` (dedicado ao ATLAS, separado do MundoDeFi)

---

## Objetivo

Dar ao ATLAS **login de verdade** e, depois, **acesso multi-aparelho**: entrar com
a mesma conta Google no celular, notebook e tablet e ver os mesmos dados.

Decisões do usuário:
- **App inteiro barrado** (sem sessão, ninguém entra).
- **Só Google** (sem senha).
- **Só convidados** (allowlist de emails).
- Sequência: **Fase 1 (login) agora; Fase 2 (nuvem) depois**, sincronizando o
  portfólio inteiro.

## Princípios (cultura do ATLAS)

- **Sem CDN / offline-first:** o SDK do Firebase é **hospedado pelo próprio ATLAS**
  (`assets/vendor/firebase-*-compat-10.14.1.js`), como já ocorre com fontes e
  Chart.js. Quem já entrou abre o app **offline** (sessão persistida).
- **Sem build:** SDK **compat** (UMD, global `firebase`), casando com os `<script>`
  clássicos do projeto.
- **Costura preservada:** o ATLAS já tinha `core/atlas-auth.js` desenhado para
  receber um provedor real. Firebase entra por `registerProvider` — nenhuma tela
  interna muda.
- **A apiKey do Firebase Web é pública** (não é segredo). Quem protege os dados
  são as **regras do Firestore** (Fase 2).

---

## Fase 1 — Login (IMPLEMENTADA)

### Arquivos
- `assets/vendor/firebase-app-compat-10.14.1.js` · `firebase-auth-compat-10.14.1.js`
  — SDK local.
- `core/atlas-firebase-config.js` — **único arquivo editado à mão**: a `config` do
  console + `allowedEmails` (a lista de convidados).
- `core/atlas-firebase.js` — provedor: inicializa o Firebase, `signInWithPopup`
  (Google), confere a allowlist, registra em `AtlasAuth`. Persistência LOCAL.
  Expõe `AtlasFirebase.whenReady(cb)` (estado inicial resolvido).
- `core/atlas-secure.js` — **a trava, um include por página**: esconde o conteúdo,
  carrega em cadeia (config → SDK → provedor), espera resolver e então mostra a
  página (autenticado+autorizado) ou manda pro login. Páginas públicas (login,
  offline, landing, boas-vindas) são ignoradas. **Fail-open** se o SDK não carregar
  (não trancar por soluço de rede; não há dado na nuvem ainda).
- `pages/login.html` + `js/login.js` — botão "Entrar com Google", trata rejeição da
  allowlist e erros (`unauthorized-domain`, `popup-blocked`…).
- `core/atlas-secure.js` incluído no `<head>` de todas as 17 páginas protegidas
  (index, academy, hold, trade, RWA, defi/*, pages/{dashboard,carteiras,
  configuracoes,ferramentas,relatorios}); `sw.js` → v41.

### Allowlist (Fase 1 = client-side)
Depois do login Google, o email é conferido contra `ATLAS_FIREBASE.allowedEmails`;
fora da lista → `signOut` + recusa. Na Fase 1 isso barra a **interface** (não há
backend). A proteção real vem na Fase 2 (regras do Firestore).

### Pré-requisitos no console (do usuário)
1. Authentication → Sign-in method → **ativar Google**.
2. Authentication → Settings → Authorized domains → adicionar `localhost` e o
   domínio do GitHub Pages.
3. Manter `allowedEmails` atualizada em `core/atlas-firebase-config.js`.

### Verificado
Sem sessão, qualquer página protegida (inclusive a raiz) **redireciona pro login**;
o SDK carrega; o provedor registra (`AtlasAuth.real()===true`); o botão Google
aparece. O login Google real é teste do usuário (não se loga a conta dele aqui).

---

## Fase 2 — Nuvem (Firestore) — ESBOÇO (spec própria depois)

**Objetivo:** cada conta tem seus dados no Firestore; o app abre com os **mesmos**
dados em qualquer aparelho.

**Arquitetura recomendada (não reescrever o ATLAS):**
- **localStorage continua a cópia de trabalho local** (offline, rápido).
- **Firestore é o espelho na nuvem**, sob `users/<uid>/...`.
- Ao logar: puxa a nuvem → localStorage. A cada mudança: empurra localStorage →
  nuvem. **Conflito** (edição em dois aparelhos): definir política (last-write-wins
  por chave, ou merge) na spec da Fase 2.
- **Regras de segurança** do Firestore: cada usuário só lê/escreve `users/<uid>`.
  Isso torna a allowlist e a posse dos dados **server-side** — proteção real.

**Escopo:** portfólio inteiro (carteiras, posições, movimentações, configurações).

**Fora de escopo agora:** a Fase 2 ganha spec e plano próprios.
