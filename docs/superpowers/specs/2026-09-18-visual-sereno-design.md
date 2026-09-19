# Visual sereno — redesign geral do ATLAS

**Data:** 2026-09-18
**Status:** aprovado em conversa (Partes 1 e 2), aguardando revisão do spec

## Problema

O site parece "quadrado" e "feito por IA":

- caixa dentro de caixa (estado vazio do Hold tem três molduras empilhadas);
- fileiras de cartões idênticos com borda e ícone no canto;
- par "SOBRETÍTULO EM CAIXA ALTA / Título" em toda seção;
- grade quadriculada no fundo (`themes/atlas-effects.css` §9);
- efeitos de luz: spotlight que segue o mouse e feixe na borda
  (`core/ui/atlas-magic.*`), fio de luz no topo dos cards (§10),
  cantoneiras de HUD nos KPIs (§11), "pulinho" de hover (§3);
- números em monoespaçada, com cara de terminal.

## Objetivo

Padrão de empresa séria / portfólio profissional: elegante, calmo,
escuro. O "cosmos" fica na paleta e no Boot; dentro do sistema o fundo é
liso.

## Escopo

**Entra:** Dashboard, Hold, Trade, DeFi (todas as páginas), RWA,
Academy, Carteiras, Relatórios, Configurações, Ferramentas (hub),
Scanner Pools, Login, Landing, Boas-vindas, o shell comum (sidebar,
topbar, seletor de carteira, Oráculo, toasts) e o tema claro.

**Fica de fora:** Boot (`index.html`), Finanças
(`Ferramentas/entradas-saidas/financas/`), `defi/testes.html`,
`pages/offline.html`.

## Linguagem visual (Parte 1)

### Fundo
- Sem grade, sem quadradinhos, sem estrelas, sem textura.
- Azul-noite liso com degradê vertical quase imperceptível.
- Os dois brilhos de cor do módulo nos cantos saem também (o fundo é
  calmo); no máximo um tom muito fraco no topo, sem desenho.

### Superfícies: de cartão para seção
- Painéis de conteúdo (`.card`, `.panel` e equivalentes por módulo)
  perdem borda, fundo, sombra e hover-lift. Título solto sobre o fundo;
  seções separadas por **espaço** e por **linha fina de 1px** apagada.
- Contêiner que é necessário (modal, menu, popover, drawer, "Primeiros
  passos") vira superfície **preenchida, sem contorno**, cantos ~20px,
  levemente mais clara que o fundo.
- Fim do aninhamento: estado vazio e gráfico ficam direto na seção.

### Números em destaque
- Fileiras de KPI viram **faixa de números**: rótulo pequeno, número
  grande (~2rem, peso 600), variação embaixo; divisão só por traço
  vertical fino. Sem caixa, sem ícone no canto.
- O número principal da tela (ex.: Patrimônio Total) é maior que os
  demais.
- Números em Inter com `tabular-nums` (sai a JetBrains Mono dos valores;
  ela pode continuar em código/hash).

### Tipografia de seção
- Some o sobretítulo em caixa alta quando repete ou enfeita o título;
  onde carrega informação vira texto discreto em caixa normal.
- Títulos de seção um pouco maiores.

### Cor e luz
- Acento do módulo aparece pouco: item ativo do menu, botão primário,
  variação positiva/negativa, foco de campo. Sai de ícones decorativos,
  bordas e brilhos.
- Sem glow em nada.
- Removidos: spotlight, feixe, fio de luz, cantoneiras HUD, hover-lift
  de card. Cards clicáveis: no hover só clareiam o fundo.
- Mantidos: contagem dos totais (number ticker), entrada suave das telas,
  fita de cotações do Academy.

### Adições aprovadas no checkpoint (2026-09-18)
- **Controles da topbar** (seletor de carteira, app launcher, sino,
  botão de tema, busca): saem as caixinhas com contorno; viram controles
  sem borda, fundo só no hover/aberto, cantos arredondados, sem glow
  (inclusive o avatar).
- **Marca** "ATLAS / SEU MAPA DE INVESTIMENTOS": a tagline vaza da
  sidebar (o "S" final passa da borda). Corrigir em todos os módulos para
  caber sem cortar nem vazar.
- **Ícones do menu em duotone**: o traço do ícone sobre um círculo suave
  na cor do módulo (≈14% de opacidade; ≈28% no item ativo). Vale para a
  navegação lateral e superior de todos os módulos do escopo. O desenho
  dos ícones pode ser trocado por glifos mais consistentes quando o
  atual for fraco.

### Intocados
Botões (exceto perder glow), campos de formulário (mantêm contorno),
tabelas (perdem só o contorno externo; linhas entre fileiras ficam),
modais (mantêm estrutura, perdem borda), cores de módulo, lógica/JS de
dados.

## Execução e segurança (Parte 2)

### Arquitetura
1. **`themes/atlas-sereno.css`** — camada nova, carregada **por último**
   via `<link>` em cada HTML do escopo (não por injeção JS, para não
   haver flash do visual antigo). Contém: fundo liso (anula
   `body::before`), neutralização dos §3/§10/§11 de `atlas-effects.css`,
   superfícies-seção, faixa de números, tipografia de seção, remoção de
   glow. Usa `html[...]`/especificidade para vencer os módulos sem
   `!important` sempre que possível.
   Reversão: remover o `<link>` devolve o visual antigo.
2. **`core/ui/atlas-magic.js`** — deixa de criar spotlight e feixe
   (remove `iniciarSpot` e o CSS correspondente em `atlas-magic.css`).
   Contagem e marquee continuam.
3. **Passes por módulo** — ajustes no CSS do próprio módulo só onde a
   camada central não alcança (estados vazios aninhados, grids de KPI
   específicos, cards internos). Ordem: shell comum → Dashboard → Hold →
   Trade → DeFi → RWA → Academy → Carteiras/Relatórios/Configurações/
   Ferramentas → Login/Landing/Boas-vindas → Scanner Pools (CSS inline
   próprio, passe dedicado).
4. **Service worker** — `atlas-sereno.css` entra no precache e `VERSAO`
   sobe (senão o navegador serve o visual antigo do cache).

### Regras de não-quebra
- Não alterar HTML estrutural nem JS de dados; só CSS, o `<link>` novo e
  a remoção do spotlight/feixe.
- Não zerar `--atlas-border` global: campos, tabelas e menus dependem
  dele.
- Nada de `display:none` em elemento com informação; sobretítulo só é
  escondido quando o título ao lado já diz o mesmo.
- Tema claro recebe as mesmas regras e é conferido.

### Verificação (por módulo, antes de seguir)
- Abrir no navegador (`?atlas-dev=1`, via http) em 1440px e 375px,
  tema escuro e claro.
- Conferir: console sem erro novo; modais abrem; menus/seletor de
  carteira funcionam; campos legíveis; nada cortado ou sobreposto; sem
  rolagem horizontal no celular.
- Screenshot antes/depois do Dashboard e do Hold após a camada central,
  como checkpoint visual com o usuário antes de espalhar.

### Commits
Um commit por etapa (camada central; cada módulo), para reverter uma
etapa sem perder as outras.
