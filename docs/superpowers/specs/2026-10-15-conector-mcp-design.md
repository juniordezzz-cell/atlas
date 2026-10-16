# Conector MCP do Atlas — documento de projeto

Data: 15/10/2026 · Estado: **decisões do dono registradas (ver final); aguardando aprovação para o plano de implementação**

## Objetivo

Registrar operações no Atlas conversando com o Claude, em qualquer aparelho
(celular, navegador, desktop), sem abrir o site e sem montar a operação passo
a passo. O Claude se conecta ao Atlas como faz com o Canva: por um conector MCP
personalizado adicionado na conta do dono.

Exemplos que precisam funcionar:

- "adiciona 20 USDT na JRB1"
- "fiz um Pix e converti, agora tem 40 USDT na Binance, adiciona"
- "transfere 30 USDT da Binance para o Hold"
- "comprei 10,5 MORPHO a 2,35 na Binance há dois dias"
- "montei uma pool na Sui, 20 dólares em SUI e 20 em CETUS"
- "vendi metade do PYTH da OKX"
- um print da Binance com "atualiza a Binance"
- "quanto eu tenho de PYTH somando tudo?"

## O que já existe e será reaproveitado

| Peça | Onde | Papel no conector |
|---|---|---|
| Hold | `hold/js/state.js`, chave `atlas.hold.state.v2` | Posições por carteira (`carteira[]`), `operacoes[]`, `vendas[]`, preço médio ponderado, resultado realizado |
| Carteiras | `wallets/walletStore.js`, chave `atlas.wallets.v2` | Cadastro (`id`, `name`, `type`, `module`) e ledger agregado |
| Caixa | `wallets/walletCaixa.js`, chave `atlas.caixa.v1` | Livro de eventos: `deposito`, `saque`, `transferencia`, `swap`, `aporte`… Saldo é sempre soma de eventos |
| Oráculo | `core/atlas-oraculo-operacoes.js` e docs `oraculo-*.md` | Regras de prévia, confirmar/cancelar, nunca criar depósito implícito, uma operação por vez |
| Nuvem | `core/atlas-cloud.js` | Firestore `atlas_users/{uid}/store/{chave com "." → "__"}` com `{ value: <string do localStorage>, updatedAt, device }`. Outro aparelho gravando gera aviso de recarregar |
| Supabase | `central-rwa/supabase/functions/` | Edge Functions já usadas (`oraculo-imagem`, `scanner-chat`); `oraculo-imagem` já valida token Firebase, e-mail verificado e usuário autorizado |

O conector **não** cria um banco novo nem um segundo formato de dados. Ele
escreve nas mesmas chaves que o site, no mesmo formato, como se fosse mais um
aparelho do dono.

## Arquitetura

```
Claude (celular / web / desktop)
   │  MCP (Streamable HTTP) + token OAuth
   ▼
Supabase Edge Function  atlas-mcp   (Deno, index.ts consolidado)
   │  ├─ /mcp              ferramentas
   │  ├─ /authorize, /token, /register, /.well-known/*   OAuth
   │  └─ domínio puro: hold, caixa, carteiras (mesmas regras do site)
   │  conta de serviço Firebase (secret no Supabase)
   ▼
Firestore  atlas_users/{uid}/store/{chave}
   ▲
   │  sincronização já existente (puxa ao abrir + aviso de mudança)
Site Atlas (GitHub Pages)
```

### Por que Supabase Edge Function

- O site é estático no GitHub Pages; não roda servidor.
- O projeto já tem Edge Functions em produção e o processo de implantação
  manual documentado em [oraculo-imagem.md](../../oraculo-imagem.md).
- Fica em HTTPS público, que é o que o Claude precisa para alcançar o conector.

Implantação segue o padrão atual: um `index.ts` consolidado colado no editor do
Supabase. GitHub Pages não publica a função.

## Login (OAuth)

Conectores personalizados do Claude usam OAuth. A função faz o papel de
servidor de autorização, mas **quem prova a identidade é o login Google do
próprio Atlas** (Firebase Auth), reaproveitando a lista `allowedEmails`.

1. O dono adiciona a URL do conector no Claude (Configurações → Conectores →
   Adicionar conector personalizado).
2. O Claude registra o cliente (`/register`) e abre `/authorize`.
3. `/authorize` mostra uma página mínima com "Entrar com Google" via Firebase,
   igual ao site.
4. A página envia o ID token do Firebase para a função. A função verifica a
   assinatura, `email_verified` e se o e-mail está em `allowedEmails`. Só então
   emite o código de autorização.
5. `/token` troca o código (com PKCE) por um token de acesso de curta duração e
   um token de renovação. Os tokens são guardados com hash numa tabela do
   Supabase; revogar = apagar a linha.

O `uid` do Firebase fica preso ao token. Nenhuma ferramenta aceita `uid` como
parâmetro: ela só enxerga `atlas_users/{uid do token}`.

## Ferramentas

Toda ferramenta que grava é feita em **dois passos**, como o Oráculo:

1. `preparar_*` valida, calcula e devolve uma prévia legível mais um
   `id_previa` (válido por 10 minutos). Não grava nada.
2. `confirmar(id_previa)` relê os dados atuais, revalida e grava. Se algo mudou
   desde a prévia (saldo, posição), recusa e pede nova prévia.

`cancelar(id_previa)` descarta. A trava fica no servidor: mesmo que o Claude
pule a pergunta ao dono, nada é gravado sem `confirmar`.

### Leitura

| Ferramenta | Parâmetros | Devolve |
|---|---|---|
| `listar_carteiras` | — | id, nome, tipo, módulo, valor atual e caixa de cada carteira |
| `ver_posicoes` | `carteira?`, `token?` | quantidade, preço médio, custo, valor atual, resultado aberto e realizado; total consolidado |
| `ver_caixa` | `carteira?` | saldo de caixa por moeda e últimos eventos |
| `historico` | `carteira?`, `token?`, `desde?`, `limite?` | operações em ordem cronológica, com origem (site ou Claude) |

### Escrita (sempre com prévia)

| Ferramenta | Parâmetros | Efeito ao confirmar |
|---|---|---|
| `preparar_deposito` | `carteira`, `token`, `quantidade`, `data?` | evento `deposito` no caixa, qualquer token (decisão 1) |
| `preparar_saque` | `carteira`, `token`, `quantidade`, `data?` | evento `saque`; recusa se faltar saldo |
| `preparar_alocacao` | `carteira`, `token`, `quantidade`, `destino` (`hold` ou `defi`) | move do caixa para o módulo (`aporte`), sem mudar o patrimônio; recusa se faltar caixa |
| `preparar_compra` | `carteira`, `token`, `quantidade`, `preco?`, `taxa?`, `data?` | compra no Hold (mesma conta de preço médio do site), debita caixa; recusa se faltar caixa, **sem criar depósito** |
| `preparar_pool` | `carteira`, `rede`, `protocolo?`, `tokens[]` (token, quantidade, preço?), `faixa?`, `data?` | abre pool no DeFi debitando caixa; se faltar caixa, a prévia mostra a entrada de **capital externo** pelo valor que falta (decisão 2) |
| `preparar_fechar_pool` | `carteira`, `pool`, `valor_final?`, `taxas?` | fecha a pool com as regras atuais do Oráculo e devolve ao caixa |
| `preparar_venda` | `carteira`, `token`, `quantidade` ou `fracao`, `preco?`, `taxa?`, `data?` | venda no Hold, apura resultado antes de baixar a quantidade, credita caixa |
| `preparar_transferencia` | `origem`, `destino`, `token`, `quantidade` | move entre carteiras, patrimônio total igual |
| `preparar_swap` | `carteira`, `envia`, `recebe` | troca na mesma carteira, transfere custo contábil, sem inventar lucro |
| `preparar_conciliacao` | `carteira`, `saldos[]` (token, quantidade, valor?) | compara com o registrado e propõe uma lista de operações explícitas, cada uma marcada; o dono confirma o que fizer sentido |
| `confirmar` / `cancelar` | `id_previa` | grava ou descarta |
| `desfazer_ultima` | — | prévia que reverte a última gravação feita pelo Claude (guarda o valor anterior da chave) |

Quando `preco` não vem, a função busca o preço do momento na mesma fonte usada
pelo site e mostra na prévia de onde veio o número.

### Prints

O próprio Claude lê a imagem na conversa e chama `preparar_conciliacao` com as
linhas que extraiu. O conector não recebe imagem, não chama OpenRouter e não
usa a função `oraculo-imagem`. A validação continua matemática no servidor:
quantidade × preço precisa bater com o valor do print dentro de uma tolerância,
e divergência bloqueia a prévia.

## Gravação e concorrência

Cada chave guarda o bloco inteiro (por exemplo, todo o Hold). Para não perder
edições:

1. Ler o documento e guardar o `updateTime`.
2. Aplicar a operação com as funções de domínio.
3. Gravar com pré-condição `updateTime` igual ao lido. Se alguém gravou no meio,
   repetir do passo 1 (até 3 vezes) e, se ainda falhar, devolver erro sem gravar.
4. Gravar `device: "claude-mcp"` e `updatedAt` do servidor. O site aberto vê a
   mudança e oferece recarregar, como já faz com outro aparelho.

Risco que continua existindo: se o site estiver aberto com uma edição local
ainda não enviada (debounce de 1,5 s, ou aparelho offline), a regra atual do
site é "a edição mais recente vence". A mitigação nesta etapa é a pré-condição
acima mais o aviso do site. Uma mudança no site para mesclar em vez de
sobrescrever fica fora deste projeto.

Antes de cada gravação, o valor anterior da chave vai para
`atlas_users/{uid}/mcp_backup/{carimbo}` (máximo de 50, os mais antigos saem).
É isso que permite `desfazer_ultima`.

## Regras de domínio compartilhadas

As contas (preço médio, apuração de venda, eventos de caixa) não podem existir
em duas versões. O plano:

1. Extrair as funções puras de `hold/js/state.js` e `wallets/walletCaixa.js`
   para `core/dominio/*.mjs`, sem `window`, `document` ou `localStorage`.
2. O site passa a chamar esses módulos; o comportamento atual não muda.
3. O `index.ts` consolidado da função inclui os mesmos módulos.
4. Os testes do domínio rodam nos dois lados (`node --test`).

**Atualização de 16/10/2026 (fases 2 e 3).** Em vez de extrair funções para `core/dominio/`, o conector executa o próprio código do site (`wallets/walletStore.js`, `walletTypes.js`, `walletLedger.js`, `walletManager.js`, `walletCaixa.js`, `hold/js/state.js`), gerado em `site-gerado.mjs`, sobre um `localStorage` em memória. O site não muda, e não existe segunda versão das regras. Também ficou decidido: compra sem caixa aceita `cobrir_falta` (igual ao formulário do site); alocação para o Hold é uma compra no Hold; alocação para DeFi fica com pools na fase 4; carteira nova só global nesta fase. Plano: [fases 2 e 3](../plans/2026-10-16-conector-mcp-fases-2-3.md).

## Segurança

- Só o e-mail em `allowedEmails` conecta. Qualquer outro recebe recusa no login.
- A conta de serviço do Firebase fica apenas como secret no Supabase. O dono
  gera e cola no painel; ela nunca entra no repositório nem no navegador.
- O Firestore é compartilhado com o MundoDeFi (`cryptotrack-br`). A função só
  monta caminhos `atlas_users/{uid do token}/...`; caminho fora disso é erro.
- Nada de chave de corretora, carteira privada ou execução em blockchain. O
  conector só registra o que o dono já fez.
- Limite de 60 chamadas por minuto por token. Logs registram a ferramenta e o
  resultado, nunca valores de saldo.
- Fase 5 opcional: tela "Conexões do Claude" nas Configurações, para listar e
  revogar tokens sem abrir o Supabase.

## Entrega em fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1 | Função `atlas-mcp` com OAuth + `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico` | O dono conecta pelo celular e pergunta "quanto tenho de PYTH?" com a resposta batendo com o site |
| 2 | Domínio extraído para `core/dominio/` com testes; site usando os módulos | Testes atuais do Oráculo e do Hold continuam passando |
| 3 | Carteiras padrão, depósito, saque, alocação para Hold/DeFi, compra e venda com datas retroativas, `confirmar`, `desfazer_ultima` | "adiciona 20 USDT na JRB1" aparece no caixa da JRB1 após recarregar o site |
| 4 | Abrir e fechar pool (inclusive do zero, com capital externo), transferência, swap e conciliação por print | "montei uma pool na Sui, 20 dólares em SUI e 20 em CETUS" com a carteira zerada vira uma pool de $ 40 e uma entrada externa de $ 40 |
| 5 (opcional) | "Conexões do Claude" nas Configurações: botão de emergência para revogar o acesso | O dono revoga um token e o Claude perde o acesso |

A fase 5 não é necessária para o conector funcionar. Até ela existir, revogar
é apagar a linha do token na tabela do Supabase.

Cada fase é uma PR própria, com o contrato atualizado em
`docs/oraculo-operacoes.md` quando mexer em regra de operação (pedido do
`AGENTS.md`).

## Testes

- Domínio: `node --test core/dominio/*.test.mjs`.
- Handler: testes no estilo de `oraculo-imagem/handler.test.mjs`, com Firestore
  falso, cobrindo prévia sem gravação, confirmação revalidando, recusa por
  saldo, pré-condição de concorrência e caminho fora de `atlas_users/{uid}`.
- OAuth: e-mail fora da lista recusado, PKCE errado recusado, token revogado
  recusado.
- Ponta a ponta: conector apontado para um usuário de teste do Firebase antes
  de ligar no usuário real.

## Decisões do dono (15/10/2026)

1. **Tudo entra primeiro no caixa da carteira**, qualquer token. "Adiciona 20
   USDT na JRB1" é `deposito` no caixa da JRB1. Nada vai para Hold ou DeFi
   sozinho: o dono pede a movimentação depois ("transfere da carteira para o
   Hold", "para o DeFi").
2. **Pool pode ser aberta do zero**, mesmo com caixa insuficiente. Exemplo:
   "montei uma pool na Sui, 20 dólares em SUI e 20 em CETUS". Registro: entrada
   de **capital externo** pelo valor que falta + abertura da pool, na mesma
   prévia e na mesma confirmação. O patrimônio total fica certo e o extrato
   mostra de onde veio o dinheiro. Isso é uma **exceção explícita** à regra
   atual do Oráculo ("nunca criar depósito para cobrir falta de caixa"), válida
   só para abertura de pool e só quando o dono declara a pool. Compra no Hold e
   swap continuam recusando por falta de caixa. Quando implementar, atualizar
   `docs/oraculo-operacoes.md` e `AGENTS.md` na mesma PR.
3. **Carteiras padrão:** Binance, OKX, JRB1 e TXFlow. O conector cria as que
   faltarem (com prévia) na primeira vez. O dono renomeia depois pelo site.
4. **Firebase:** usar o projeto `cryptotrack-br` com conta de serviço. O
   MundoDeFi será descontinuado, mas o conector continua restrito a
   `atlas_users/{uid}`.
5. **Datas retroativas entram na fase 3.** "Semana passada", "há dois dias"
   viram uma data exata na prévia. Sem preço informado, a prévia usa o preço
   histórico daquele dia e diz a fonte.
6. **Sem valor em reais.** Um Pix convertido em USDT registra só o depósito em
   USDT. O Atlas não guarda o custo em BRL.
7. **Funciona com o PC desligado.** Tudo roda no Supabase e no Firestore; o
   celular com o app do Claude basta.

Token mencionado no exemplo: CETUS (rede Sui).
