# Fundação — Módulo "Finanças" do ATLAS (Fase 1)

- **Data:** 2026-09-09
- **Fase:** 1 de 5 (Fundação)
- **Status:** Aprovado para escrita de plano de implementação
- **Escopo:** Rebrand MundoDeFi → ATLAS, redesign profissional mobile-first, PWA instalável, e reorganização do código base. **Sem features novas** nesta fase.

---

## 1. Contexto

A ferramenta atual ("Entradas e Saídas" / "Controle Financeiro") é um app web estático (HTML/CSS/JS puro) de controle financeiro pessoal, hoje branded como ferramenta **MundoDeFi PRO**. Ela será transformada em um **módulo do ecossistema ATLAS** (um gerenciador de portfólio cripto já existente, em `https://juniordezzz-cell.github.io/atlas/`), acessível através da área **"Ferramentas"** do ATLAS.

Esta Fase 1 estabelece a **fundação**: a ferramenta passa a parecer e se comportar como um módulo nativo do ATLAS, vira um PWA instalável, e perde toda a amarração com o MundoDeFi — inclusive login e nuvem, tornando-se **local-first**. As funcionalidades financeiras existentes são preservadas; nenhum recurso novo de produto entra aqui.

### Faseamento geral (contexto — não implementar além da Fase 1)

1. **Fase 1 — Fundação** (este documento)
2. Fase 2 — Contas, cartões & dívidas (refatoração do modelo de dados para múltiplas contas)
3. Fase 3 — Lançamentos mais poderosos (busca, filtros, tags, recorrência, importar extrato, anexos)
4. Fase 4 — Planejamento & metas (orçamento por categoria, metas, alertas)
5. Fase 5 — Relatórios & inteligência (relatórios avançados, PDF, previsão, notificações)

Cada fase tem seu próprio ciclo spec → plano → implementação.

---

## 2. Objetivos e não-objetivos

### Objetivos
- A ferramenta parece **indistinguível de um módulo nativo do ATLAS** (mesmo shell, tokens, fontes, temas claro/escuro).
- Navegação profissional e mobile-first (pílulas no desktop; barra inferior + "＋" no celular).
- **PWA instalável**, offline, tela cheia.
- **Local-first**: dados no navegador (localStorage), sem conta/nuvem/PRO.
- Remoção total de MundoDeFi (marca, login, assistente, Firebase, planos, links).
- Código reorganizado para sustentar as fases seguintes.

### Não-objetivos (fases futuras)
- Login do ATLAS / sincronização entre dispositivos.
- Contas/cartões/dívidas, lançamentos avançados, metas/orçamento, relatórios avançados, inteligência.
- Qualquer recurso financeiro novo.

---

## 3. Design de identidade e arquitetura

### 3.1 Onde o módulo vive
- Passa a ser uma pasta no repositório do ATLAS: **`atlas/ferramentas/financas/`** (nome/caminho final confirmável na publicação).
- Por ser mesma origem, **linka os arquivos de tema do ATLAS diretamente** — sem cópia, sem divergência de tokens:
  - `../../css/variables.css`
  - `../../css/global.css`
  - `../../themes/atlas-fonts.css`
  - `../../themes/atlas-theme.css`
  - `../../themes/atlas-effects.css`
  - `../../core/ui/atlas-shell.css`
  - `../../core/ui/atlas-palette.css`
  - (caminhos relativos exatos a validar contra a estrutura real do repo ATLAS no momento da integração)

### 3.2 Casca (shell)
- Mesmo esqueleto do ATLAS: `<html data-module="atlas" data-theme="dark" data-anim="on">`, `.app > aside.sidebar#atlasSidebar + header.topbar + main`.
- Sidebar global do ATLAS (Dashboard, Hold, Trade, DeFi, RWA, Carteiras, Academy, **Ferramentas** [ativo], Relatórios, Configurações) e topbar do ATLAS reaproveitados.
- Tema claro/escuro via `data-theme` no `<html>` (ATLAS já tem os dois temas completos).

### 3.3 Stack
- **Vanilla, multipágina, estático** — igual ao ATLAS. Sem framework, sem build step.

### Tokens ATLAS de referência (extraídos do site)
- Fundo `#05080F`; card `#0D1422`; azul-escuro `#0A1A2F`.
- Texto `#E6F1FF`; suave `rgba(230,241,255,.62)`; fraco `rgba(230,241,255,.38)`.
- Acento `#00BFFF` → `#00F0FF` (gradiente `linear-gradient(135deg,#00BFFF,#00F0FF)`); glow disponível.
- Positivo `#00E28A`; negativo `#FF5470`; dourado `#FFD700`.
- Borda `rgba(0,191,255,.10)` / forte `rgba(0,191,255,.22)`.
- Fonte UI/título **Inter**; números **JetBrains Mono**.
- Raio 14px (escala `--atlas-r-*`); sidebar 240px; topbar 64px; `--atlas-content-max:1400px`; espaçamento `--atlas-sp-*`; curvas/durações de animação `--atlas-ease*` / `--atlas-dur*`.
- **Regra:** todo CSS específico de finanças usa esses tokens; nada de valores hardcoded que possam descolar do ATLAS.

---

## 4. Navegação

### 4.1 Sub-navegação do módulo (desktop) — pílulas segmentadas
- Barra de seções no topo do `main`: **Visão geral · Entradas · Despesas · Investimentos · Relatórios · Análises**.
- Estilo pílula arredondada; **ativa com gradiente azul→ciano** e texto `#04121e`.
- Cada seção é uma página (`index.html`, `entradas.html`, etc.); a pílula da página atual fica ativa.

### 4.2 Navegação mobile — barra inferior + "＋"
- **Barra inferior fixa** (`position:fixed; bottom`) com fundo translúcido e blur, no alcance do polegar.
- Itens: **Início** (Visão geral), **Entradas**, **[＋]**, **Despesas**, **Mais**.
  - "Mais" abre um menu com Investimentos, Relatórios, Análises, Configurações.
- Botão **"＋" central** (FAB com gradiente/glow ATLAS) = **lançamento rápido** de entrada/despesa (abre um formulário/sheet enxuto). Reaproveita a lógica de adicionar lançamento já existente.
- Menu global do ATLAS continua no **☰** da topbar (gaveta + scrim do próprio ATLAS).
- Breakpoint: barra inferior aparece no mobile; pílulas aparecem no desktop. As pílulas podem virar scroll horizontal em larguras intermediárias.

---

## 5. Visão geral (dashboard) — layout "foco no essencial"

Hierarquia (de cima para baixo), toda usando cards ATLAS:

1. **Herói — Saldo do mês** em destaque (número grande, cor de acento), com micro-frase de contexto (ex.: "Você guardou 33% do que ganhou") e um mini-gráfico de tendência.
2. **Três indicadores menores**: Entradas (verde), Saídas (vermelho), Investido no mês.
3. **Gráfico de fluxo financeiro do mês** (entradas x saídas acumuladas) — card grande, largura total.
4. **Seções reveladas conforme rola**: distribuição das despesas, últimas movimentações, aporte do mês, desempenho mês a mês.

- Mantém os gráficos existentes (`charts.js`), reestilizados para os tokens ATLAS.
- Mais respiro/hierarquia que o dashboard atual (que empilha tudo); pensado mobile-first.

---

## 6. PWA

- **`manifest.webmanifest`**: nome ("Finanças" / nome de exibição a confirmar), `short_name`, ícones (maskable incluídos), `display: standalone`, `theme_color` `#05080F`, `background_color` `#05080F`, `start_url` da Visão geral, `scope` do módulo.
- **`sw.js`** (service worker): precache do shell e assets do módulo (app shell pattern); estratégia cache-first para estáticos, garantindo funcionamento offline. Sem dados remotos a sincronizar (local-first).
- Registro do SW nas páginas do módulo.
- Ícones do PWA no padrão visual ATLAS (assets do módulo).
- **Nota de integração:** `scope`/`start_url` dependem do caminho final dentro do ATLAS; manter configuráveis.

---

## 7. Modelo de dados — local-first

### 7.1 Persistência
- **localStorage**, chave `finance-dashboard-state` (já existente em `utils.js`).
- `getState()` / `saveState()` passam a **ler/gravar no localStorage** (com fallback seguro caso o storage falhe/esteja indisponível — try/catch, renderizar estado vazio).
- **Remover** toda a camada de nuvem: `ativarNuvem`, `desativarNuvem`, `persistirNuvem(Agora)`, `cloudDocRef`, `resetarNuvem` (o reset vira limpar o localStorage/estado), dependência de `firebase`.
- Manter `migrateState()` (migração idempotente de dados antigos: renome de tipos, campos de recorrência do planner).

### 7.2 Primeiro acesso
- Sem trava "modo demonstração". Todos editam.
- Primeiro acesso = **estado vazio** (`freshState()`), com tela de **boas-vindas no estilo ATLAS** ("Seu Finanças está pronto — e vazio") e botão opcional **"carregar dados de exemplo"** (usa o `defaultState` de demonstração).
- Estados vazios amigáveis em cada seção (sem dados → CTA claro).

### 7.3 Backup
- Exportar/importar JSON (já existe em `config.js`) preservado, operando sobre o localStorage.

---

## 8. Rebrand / limpeza (remoção de MundoDeFi)

**Remover:**
- Assistente Nexus: `js/nexus.js`, `js/nexus-intents.js`, `js/nexus-config.js`, `css/nexus.css` e o orbe/markup associado.
- Login/nuvem: dependência de `/nexus/nexus-auth.js` (`NexusAuth`), `js/pro-gate.js`, Firebase/Firestore, banner "Assine PRO — R$19,90", modo vitrine travado, classe `mdf-locked`, zonas `data-mdf-lock-zone`.
- Links/branding: "← Voltar ao MundoDeFi", ação "Sair"/logout, `logo` MundoDeFi, `<link rel="canonical">` e `og`/`twitter` para `mundodefi.com.br`, bloco `schema.org` com Organization/WebApplication/Offer MundoDeFi, `mundodefi-tokens.css`, `<meta description>` MundoDeFi.

**Substituir/ajustar:**
- Título, ícones, metadados e nome → ATLAS / "Finanças".
- **Investimentos** reposicionado como **"aporte do mês"**: apenas quanto a pessoa guardou/investiu no mês (valor por mês), sem preços de ativos, sem alocação/portfólio. Sem sobreposição com Hold/Trade/DeFi/RWA do ATLAS.

---

## 9. Reorganização do código

- Estrutura proposta do módulo:
  ```
  financas/
    index.html            (Visão geral)
    entradas.html
    despesas.html
    investimentos.html
    relatorios.html
    analises.html
    configuracoes.html
    manifest.webmanifest
    sw.js
    css/                  (componentes de finanças, sobre tokens ATLAS)
    js/                   (lógica de finanças em ES modules)
    assets/               (ícones do módulo / PWA)
  ```
- **Preservar** a lógica financeira (cálculos, resumos, derivação de fluxo/patrimônio, migração) de `utils.js`, `charts.js`, `dashboard.js`, `entradas.js`, `despesas.js`, `investimentos.js`, `relatorios.js`, `analises.js`, `config.js` — reorganizada em **ES modules** coesos (camada de dados isolada; helpers de formatação; renderização por página).
- CSS: manter apenas o específico de finanças (cards, tabelas, formulários, dashboard), reescrito contra os tokens ATLAS; descartar `styles.css`/`sidebar.css`/etc. do MundoDeFi na medida em que o shell ATLAS os substitui.
- Cada unidade com propósito único e interface clara, para facilitar as fases seguintes.

---

## 10. Estratégia de testes / verificação

- Cada seção renderiza corretamente dentro do shell ATLAS, nos temas **claro e escuro**.
- Fluxo de **adicionar / editar / excluir** entrada e despesa persiste no localStorage e sobrevive a reload.
- **Lançamento rápido** ("＋") cria lançamento e atualiza a Visão geral.
- **Migração** de um estado antigo (com tipos legados/planner) roda sem perda.
- **PWA**: passa nos critérios de instalabilidade (manifest + SW + ícones); abre offline em standalone.
- **Responsividade**: barra inferior no mobile, pílulas no desktop; sem scroll horizontal na página.
- **Estado vazio** e "carregar dados de exemplo" funcionam.
- Nenhuma referência remanescente a MundoDeFi/Firebase/Nexus no build final.

---

## 11. Riscos e pontos a validar na integração

- **Caminhos dos CSS do ATLAS**: confirmar a estrutura real de pastas do repo ATLAS e onde o módulo será colado (`ferramentas/financas/`), ajustando os caminhos relativos e `scope`/`start_url` do PWA.
- **Como o ATLAS registra "Ferramentas"**: hoje o ATLAS tem um lançador "Aplicativos"; a inserção do item/rota "Ferramentas → Finanças" na navegação do ATLAS pode exiger um pequeno ajuste do lado do ATLAS (fora do escopo do módulo em si, mas a alinhar).
- **Colisão de nomes/serviço**: garantir que o SW do módulo tenha `scope` restrito para não interferir em outros módulos do ATLAS.
- **Perda de dados de usuários atuais**: usuários que hoje têm dados no Firestore (PRO) não são migrados automaticamente para localStorage nesta fase — decisão consciente (base atual provavelmente mínima). Registrar como aceito.

---

## 12. Próximo passo

Escrever o **plano de implementação** desta fase (skill `writing-plans`), quebrando em tarefas executáveis e testáveis.
