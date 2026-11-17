# Tom do texto e telas vazias — 17/11/2026

Registro para quem mexer depois (Claude ou Codex). Itens 3 e 4 da lista de
profissionalismo. Os itens "tirar emojis" e "Oráculo flutuante" ficaram como
estão, por decisão do dono.

## 3. Tom do texto

Regra seguida: texto neutro e direto; mensagem de erro diz o que aconteceu e o
que fazer, sem mostrar o erro técnico do navegador (`e.message`, "Failed to
fetch") e sem primeira pessoa ("Não consegui…"). **As respostas do Oráculo
continuam em primeira pessoa**: ele é um personagem.

| Onde | Antes | Depois |
|---|---|---|
| Calculadora de Market Cap | "Barato ou caro é o tamanho da pizza, não o preço da fatia." | "Avalie um token pelo valor de mercado, não pelo preço da unidade." |
| Calculadora de Market Cap | modo "Batalha", aba "Preço sonhado", "Dicionário", "Veredito da batalha" | "Comparar tokens", "Preço-alvo", "Glossário", "Conclusão da comparação" (também nos chips do card) |
| Calculadora de Market Cap | glossário com "tamanho da pizza", "fatias servidas" | definições sem metáfora |
| Scanner | aba "Battle Pools" | "Comparar pools" (o id interno `battle` não mudou) |
| Scanner | "Não consegui ler as pools do servidor (Failed to fetch)." | "Não foi possível carregar as pools do servidor agora. Mostrando só as suas pools manuais." |
| Scanner | rodapé técnico ("suas decisões por pool, ★, níveis… ficam no navegador") | "Valores em dólar, atualizados a cada 4 horas. Suas marcações e pools manuais ficam salvas neste navegador; use Exportar para guardar uma cópia." |
| Scanner (IA) | erro de rede cru | "Sem conexão com o servidor agora. Tente de novo em instantes." |
| Escada e Estratégia de Pools | "Sem acesso à API aqui… No arquivo local…", "No link do claude.ai a API fica bloqueada" | "Preços ao vivo indisponíveis. Mostrando dados guardados…", "Não foi possível consultar a DeFi Llama agora…" |
| Lucro, Staking, Juros, busca de token | "Não consegui buscar o preço (Failed to fetch). Digite à mão." | "Não foi possível buscar o preço agora. Digite o preço manualmente." |
| Mercado | "indisponível" / "tentar de novo" / "carregando…" | "Dados indisponíveis no momento." / "Tentar de novo" / "Carregando…" |
| Finanças | "Nenhum lançamento neste aparelho ainda" + botões "tenho 800 em caixa" | "Comece registrando o seu caixa" + "Exemplos:" com os botões entre aspas |
| Finanças (nuvem) | "Não consegui falar com a nuvem…", "Exporte um backup e me avise." | "Sem conexão com a nuvem no momento…", "Exporte um backup para não perder nenhum lançamento." |
| Staking | "sua fatia da rede cresce só uns 3%" | "sua participação na rede cresce cerca de 3%" |

Escada e Estratégia: editar só `Ferramentas/_fonte-quadro/quadro-src.html` e
rodar `node Ferramentas/_fonte-quadro/build.js`.

## 4. Telas vazias

O dono confirmou (17/11) manter o painel **zerado e inteiro** quando não há
dados (decisão de 08/10/2026). O que entrou é só uma faixa **"Primeiros
passos"** por cima dos números, com um botão para a ação certa, que some no
primeiro registro. Os blocos vazios ganharam uma linha dizendo o que aparece ali.

| Módulo | Quando aparece | Botão leva a | Arquivo |
|---|---|---|---|
| Hold | nenhuma posição | formulário de compra (`F.novaCompra`) | `hold/js/pages/dashboard.js` |
| DeFi | nenhuma pool, staking ou empréstimo aberto | `pools.html?new=1` | `defi/js/dashboard.js` |
| RWA | nenhum ativo | cadastro de ativo (`openAssetModal`) | `RWA/js/rwa-app.js` |
| Trade | nenhum registro de decisão nem operação | formulário de novo registro de decisão | `trade/modules/dashboard/dashboard.js` |

Visual comum: classes `.atlas-passos*`, bloco "PRIMEIROS PASSOS" em
`core/ui/atlas-shell.css` (o botão usa `--atlas-acao`).

## Verificação

- Faixa presente nos quatro módulos vazios e botão levando à ação certa
  (formulário/modal aberto, rota de nova posição).
- Celular a 390 px: faixa empilha, sem rolagem lateral.
- 10 telas editadas abrem sem erro de script e sem as palavras antigas.
- Testes: 346 passam.
