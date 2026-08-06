# ATLAS · O componente de carteira (`/wallets`)

**Estado atual:** existe **um** componente de seleção de carteira no ATLAS
inteiro. Um markup, um CSS, uma lógica. Dashboard, Hold, Trade, DeFi, RWA e
Relatórios montam o mesmo componente e têm exatamente as mesmas funções.
Nenhum módulo cria, edita, exclui, salva, pinta ou guarda estado de carteira
por conta própria.

Divisão de responsabilidade: a central é dona da IDENTIDADE e dos NÚMEROS
agregados de cada carteira (tipo, nome, ícone, ordem, padrão, ativa por
módulo, capital, saldo, valor atual, ativos vinculados, persistência,
eventos). Cada módulo continua dono dos seus registros de domínio (o trade, a
posição) e apenas REPORTA seus totais. Chave de storage: `atlas.wallets.v2`.

---

## A pasta `/wallets`

| Arquivo | Papel | Expõe |
|---|---|---|
| `walletStore.js` | Persistência, estado, migração, eventos, ordem, padrão | `AtlasWalletStore` |
| `walletTypes.js` | Tipos (Global/Local), ícones, selos, emojis, rótulos | `AtlasWalletTypes` |
| `walletLedger.js` | Os números: capital / saldo / valor / ativos | `AtlasWalletLedger` |
| `walletManager.js` | **API pública** | `AtlasWallets` |
| `walletMenus.js` | Fechar menu ao clicar fora (utilitário único) | `AtlasCloseMenus` |
| `walletDialog.js` | Diálogo de **criar, renomear e excluir** | `AtlasWalletDialog` |
| `walletSelector.js` | **O componente** — markup e lógica | `WalletSelector` |
| `walletSelector.css` | **O CSS do componente** — o único que existe | — |

Ordem de carregamento em todas as páginas:
`walletStore → walletTypes → walletLedger → walletManager → walletMenus →
walletDialog → walletSelector`, com `<link>` para `walletSelector.css`.

## API `window.AtlasWallets`

Listagem e identidade: `all, globals, forModule, get, isIsolated,
activeGlobal, activeGlobalId, setActiveGlobal, create, rename, setEmoji,
setColor, remove, badge, typeIcon, iconGroups, emojiSet, typeLabel, typeTag,
initials, stamp, subscribe`.

Carteira padrão: `getDefault()`, `setDefault(id)`, `defaultId()`.
Ordem: `reorder(idsNaOrdem)`, `move(id, -1|+1)`.
Números (ledger): `report(module, walletId, {capital, saldo, valorAtual, assets})`,
`balanceOf(id[, module])`, `capitalOf(id[, module])`, `assetsOf(id[, module])`,
`ledgerOf(id)`.
Carteira ativa por módulo: `activeFor(module)`, `setActiveFor(module, id)`.

`subscribe(fn)` devolve a função que cancela a assinatura.

## Como um módulo monta o seletor

```js
WalletSelector.render(host, {
  module: "hold",        // dono das carteiras locais desta tela
  scope: "module",       // "module" (padrão) | "all"
  money: fn,             // opcional: formatador
  balanceModule: "hold", // opcional: fatia do ledger no subtítulo
  feed: fn,              // opcional: totais que o módulo reporta
  getActive: fn,         // opcional: quem manda na carteira ativa
  onSelect: fn,          // opcional: idem
  afterChange: fn        // opcional: (wallet, "create"|"rename"|"remove")
});
```

O `host` é uma `div` **sem classe nenhuma** — de propósito, para não existir
regra de módulo capaz de alcançar o componente.

Sem `getActive`/`onSelect`, o componente usa `AtlasWallets.activeFor/
setActiveFor` (é o caso do Dashboard e dos Relatórios). Hold, Trade, DeFi e
RWA passam os seus porque a partição de dados deles depende do estado
interno de cada um. Nos dois caminhos a tela é a mesma.

## Funções disponíveis — iguais em todos os módulos

selecionar carteira global · selecionar carteira local · criar carteira
global · criar carteira local · renomear carteira · excluir carteira.

Única trava: a **última** carteira global não pode ser excluída (o ATLAS
precisa de pelo menos uma para consolidar patrimônio). O botão fica
desabilitado, não some — a linha tem o mesmo tamanho em qualquer caso.

---

## Regras que vieram de bugs reais — não desfazer

1. **Os ícones nascem no componente.** Ele não chama helper de ícone de
   módulo. As assinaturas divergiam (`icon(nome, CLASSE)` no Hold,
   `icon(nome)` no DeFi/RWA, `icon(nome, tamanho)` no Trade); no Hold o SVG
   saía sem `width`/`height`, esticava, e o "Nova carteira" virava um bloco
   de 226×220px.
2. **Não existe folha/scrim atrás do menu.** Ela cobria o menu nos módulos,
   porque as topbars criam contexto de empilhamento e prendem o `z-index` do
   seletor lá dentro; todo clique no menu acertava a folha. Fechar ao clicar
   fora é o listener de **captura** de `walletMenus.js`.
3. **Um listener de clique por host** (delegado, sobrevive ao rerender) e
   **uma assinatura do store por página**, que repinta todos os seletores
   montados.
4. **O CSS é literal, não usa token de tema.** Os módulos têm conjuntos de
   tokens diferentes (`--primary`, `--accent`, `--azure`, `--azul-principal`)
   com valores diferentes. Herdar token era a própria fonte da divergência.
5. **Nenhum arquivo CSS de módulo pode ter regra de seletor de carteira.**
   As classes antigas (`.wsel*`, `.wallet-sel`, `.wallet-menu`, `.wallet-opt`,
   `.wallet-add`, `.wallet__*` do seletor, `.w-*`) foram removidas de
   `hold/css`, `defi/css`, `css/dashboard.css`, `trade/assets/css`,
   `RWA/css`, `themes/atlas-effects.css` e `core/ui/atlas-shell.css`.

## Arquivos removidos

`js/wallets.js`, `core/ui/atlas-wallet-dialog.js` e
`RWA/components/shell.js` — os três eram cópias mortas. O RWA rodava um
seletor duplicado dentro de `RWA/js/rwa-app.js` (com HTML e listeners
próprios, e sem opção de criar carteira); hoje ele chama o componente.

## Pendência conhecida — `reload: true`

Dashboard (`js/dashboard.js`) e DeFi (`defi/js/components.js`) ainda passam
`reload: true`: as views deles montam KPIs, gráficos e listas no load e não
reagem à troca de carteira. É **provisório** e está isolado nessa única
opção. Substituir por atualização reativa é tarefa própria, fora do escopo
da unificação do componente.

## Academy

Não tem seletor porque **não tem dado nenhum particionado por carteira** —
`academy/js/academy.js` nunca consulta `AtlasWallets`. Colocar um seletor lá
seria inventar uma função que não faz nada.
