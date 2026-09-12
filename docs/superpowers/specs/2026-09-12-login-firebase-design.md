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

## Fase 2 — Nuvem (Firestore) — DESIGN FINAL (aprovado)

**Objetivo:** cada conta tem seus dados no Firestore; o app abre com os **mesmos**
dados em qualquer aparelho. Sincroniza o **portfólio inteiro**.

**Projeto:** compartilhado `cryptotrack-br` (Opção A) — dados do ATLAS isolados
sob `atlas/...`, longe das coleções do MundoDeFi.

### O que sincroniza
As chaves de **dados** do registro canônico (`AtlasStorage.KEYS`, grupo "dados"
do `AtlasBackup` — carteiras, caixa, snapshots, preços manuais, teses, estudos,
notificações, e os estados de hold/trade/defi/rwa). **NÃO** sincroniza: caches
(`atlas.http.cache`, `atlas.assets.cache`, `atlas.fx`) nem `atlas.session.v1`
(sessão é do aparelho).

### Modelo no Firestore
`atlas/users/{uid}/store/{chaveId}` — **um documento por chave**. Cada doc:
`{ value: <string do localStorage>, updatedAt: <serverTimestamp>, device: <id> }`.
Um-doc-por-chave evita o limite de 1 MiB e permite empurrar só o que mudou.
(`chaveId` = a chave com `.` trocado por `__` para caber no nome do doc.)

### Regras de segurança (server-side)
Só o dono acessa a própria subárvore:
```
match /atlas/users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
Isso torna a posse dos dados **real** (não mais client-side). Complemento
opcional: exigir que o email esteja verificado.

### Fluxo
1. **Ao logar / abrir:** puxa todos os docs de `store` → escreve nas chaves locais
   → dispara um refresh dos stores/telas. A nuvem manda ao abrir.
2. **A cada mudança** numa chave de dado (via um observador sobre o `localStorage.setItem`
   das chaves de dados): empurra o doc daquela chave (debounce ~1,5 s), com
   `updatedAt` e `device`.
3. **Primeira sincronização num aparelho:**
   - nuvem vazia + local com dados → **sobe** o local (semeia a nuvem);
   - nuvem com dados + local vazio → **baixa**;
   - ambos com dados → nuvem vence, mas **antes** grava um backup local do que
     havia (via AtlasBackup) — nada some em silêncio.
4. **Conflito:** last-write-wins **por chave** (`updatedAt`).
5. **Entre aparelhos (sem tempo real):** um listener leve avisa quando OUTRO
   aparelho gravou algo mais novo enquanto este está aberto → mostra um aviso
   discreto "dados atualizados em outro aparelho — recarregar?". Não sobrescreve
   edição em andamento.

### Arquivos previstos
- `assets/vendor/firebase-firestore-compat-10.14.1.js` — SDK local.
- `core/atlas-cloud.js` — o motor de sincronização (pull/push/first-sync/notice),
  apoiado em `AtlasStorage.KEYS` e `AtlasBackup`.
- Wiring: incluir o firestore + `atlas-cloud.js` nas páginas (junto do que o
  `atlas-secure.js`/provider já carrega); regras coladas no console pelo usuário.

### Pré-requisitos do usuário (console)
1. Firestore → **Criar banco** (modo produção; região sul-americana ou us-central).
2. Colar as **regras** acima em Firestore → Rules.

### Fora de escopo (v1)
- Sincronização em tempo real (só aviso + recarregar).
- Merge fino dentro de uma chave (é last-write-wins por chave inteira).
