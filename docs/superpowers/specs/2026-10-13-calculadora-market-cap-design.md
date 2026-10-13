# Calculadora de Market Cap — design

Data: 13/10/2026 · Status: aprovado em conversa, aguardando revisão desta spec

## Objetivo

Terceira ferramenta da bancada (`pages/ferramentas.html`). Ensina, com números
ao vivo, que o preço da unidade não diz se um token está barato ou caro: quem
diz é o valor de mercado. Serve ao dono nos vídeos e a quem usa o ATLAS.

Frase-guia: "Barato ou caro é o tamanho da pizza, não o preço da fatia."

### Decisões do dono

- Desbloqueios: só a **proporção** (circulando × falta entrar) com dados
  gratuitos, mais **link para fora** com o detalhe. Nenhuma API paga.
- Link para fora: primeiro a documentação oficial do projeto; o Tokenomist
  como segunda opção. Evitar mandar o usuário para concorrentes diretos.
- Comparação: **régua fixa** de projetos conhecidos **e** posição no ranking.
- Modos da calculadora: **preço sonhado → tamanho**, **valer como → preço** e
  **meu dinheiro**. Comparar dois tokens lado a lado fica para uma versão futura.
  **Atualização (13/10/2026):** o dono achou "Valer como" desnecessária e ela
  saiu. Ficam só "Preço sonhado" e "Meu dinheiro".
- **Ferramenta de estudo, sem ligação com o portfólio.** Não lê nem grava
  carteiras, posições ou caixa. "Meu dinheiro" é só uma simulação com valor
  digitado. O topo da página diz: "Simulação para estudo. Não é recomendação
  de investimento e não usa os dados da sua carteira."

### Fora do escopo

- Cronograma de desbloqueio (datas, grupos, próximos eventos).
- Comparação de dois tokens lado a lado.
- Guardar consultas ou qualquer dado do usuário. A ferramenta só consulta.

## Onde mora

- `Ferramentas/calculadora-market-cap/index.html`: a tela, com o login
  obrigatório do ATLAS (`core/atlas-auth.js` + `core/atlas-secure.js`), como
  toda ferramenta.
- `Ferramentas/calculadora-market-cap/calculo.js`: as contas, puras, sem DOM
  nem rede. Exporta para o navegador (`window.AtlasMcapCalc`) e para o Node
  (`module.exports`).
- `Ferramentas/calculadora-market-cap/calculo.test.cjs`: testes do `node --test`.
- `Ferramentas/calculadora-market-cap/app.js` e `estilo.css`: a tela.
- Dados: `core/http.js` + `core/providers/registry.js` +
  `core/providers/coingecko.js`, já existentes (sem chave, com cache).
- Card em `pages/ferramentas.html` numa **seção nova, "Estudar o mercado"**
  (contador 1), separada de "Gerir o dinheiro". O "Em breve" continua onde
  está. Ícone em volume com prefixo próprio nos ids do SVG (`mcap-`).
- `sw.js`: incluir os arquivos novos e subir a versão do cache.

O "F" maiúsculo de `Ferramentas/` importa (o GitHub Pages diferencia).

## A tela, de cima para baixo

### 1. Busca

Campo com autocomplete (`CoinGecko.search`): ícone, nome, símbolo e ranking.
Ao escolher, a tela carrega o token. O id escolhido vai para a URL
(`?token=jupiter`), para abrir direto num token e compartilhar o link.
Sem token na URL, a tela abre com a busca e a explicação, sem token padrão.

### 2. Ficha do token

- Preço, valor de mercado, FDV e posição no ranking.
- Barra de oferta: "X% circulando · Y% ainda vai entrar", com as quantidades
  em tokens.
- Sem oferta máxima: "sem teto de emissão". A proporção usa a oferta total e
  diz isso.
- Links (aba nova, `rel="noopener"`):
  1. "Documentação oficial do projeto": `links.whitepaper`; se faltar,
     `links.homepage`; se faltar também, o link não aparece.
  2. "Cronograma em gráfico (Tokenomist)":
     `https://tokenomist.ai/<id-coingecko>`. Se o Tokenomist usar outro slug,
     a página dele cai na busca, o que é aceitável.

### 3. Calculadora (três abas)

Todo resultado sai em duas colunas: **com os tokens de hoje** (circulação) e
**quando tudo desbloquear** (oferta total, ou máxima se não houver total).

- **Preço sonhado:** entrada = preço em US$. Saídas por coluna: valor de
  mercado exigido; multiplicador sobre o tamanho atual; régua (quantos BTC,
  ETH, SOL… cabem); posição no ranking ("ficaria entre A e B" ou "maior que
  o Bitcoin").
- **Valer como:** entrada = um projeto da régua (ou um valor em US$ digitado).
  Saída por coluna: o preço que o token teria e o multiplicador sobre o
  preço atual.
- **Meu dinheiro:** entradas = valor investido em US$ e preço-alvo. Saídas:
  tokens comprados ao preço atual; quanto valeriam no preço-alvo; lucro ou
  prejuízo em US$ e %; e o valor de mercado que esse alvo exige (as duas
  colunas), para a pessoa ver o tamanho da aposta.

### 4. Explicação

No fim da página, curta, com os números do token da tela (sem exemplo fixo):
pizza e fatias; o que é FDV e por que os tokens que faltam entrar importam;
por que ter mais unidades não dá vantagem; que um token pequeno sobe mais
fácil, mas também cai e some mais fácil, porque a liquidez manda.

## Régua

Bitcoin, Ethereum, Solana, AAVE, Uniswap e Hyperliquid (ids da CoinGecko:
`bitcoin`, `ethereum`, `solana`, `aave`, `uniswap`, `hyperliquid`). Os valores
saem da mesma lista do ranking. Se algum não vier na lista, ele some da régua
em vez de mostrar valor velho ou zero.

## Dados e chamadas

| Chamada | Uso | Cache |
|---|---|---|
| `search(q)` | autocomplete | 24 h (já existe) |
| `assetFull(id)` | ficha do token | 3 min (já existe) |
| `topMovers({order:"market_cap_desc", perPage:250})` | ranking e régua | 10 min, compartilhado |

Se o `topMovers` atual não permitir 250 por página ou um TTL próprio, a
mudança é mínima e fica no provedor. Os outros consumidores não podem mudar
de comportamento.

## As contas (`calculo.js`)

- `ofertaCheia = total ?? max`. Mudou na implementação (13/10/2026): o FDV
  da CoinGecko usa a oferta total. No JUP, o máximo de 10 bi ficou velho
  depois da queima, e o total é 6,86 bi. A ficha avisa quando o teto do
  contrato é maior que o total.
- `faltaEntrar = ofertaCheia − circulante` (mínimo 0)
- `pctCirculando = circulante ÷ ofertaCheia`
- `mcapNoPreco(preco, oferta) = preco × oferta`
- `precoNoMcap(mcap, oferta) = mcap ÷ oferta`
- `multiplicador = alvo ÷ atual`
- `regua(mcap, projetos)` = para cada projeto, `mcap ÷ mcapProjeto`
- `posicaoNoRanking(mcap, lista)` = vizinhos acima e abaixo; acima do 1º,
  "maior que o 1º"
- `meuDinheiro(valor, precoAtual, precoAlvo)` = tokens, valor final, lucro
  em US$ e em %

Toda função recebe números já tratados e devolve `null` quando falta dado.
Nunca devolve `NaN` nem `Infinity`.

## Casos difíceis

- **Circulação ausente ou zero:** a coluna "hoje" mostra "indisponível" com o
  motivo, e a outra coluna continua funcionando.
- **Oferta máxima e total ausentes:** sem coluna de desbloqueio, com o aviso
  "a CoinGecko não informa a oferta total deste token".
- **Circulação maior que a oferta cheia** (dado inconsistente da fonte):
  trata como 100% circulando e avisa.
- **Erro de rede ou limite (429):** mensagem padrão do `AtlasHttp`. Se houver
  cache, mostra o último dado com o horário.
- **Entrada inválida** (vazia, negativa, texto): o resultado fica em branco,
  sem erro na tela.
- **Valores absurdos:** a conta roda normalmente. O formato encurta números
  grandes (mi, bi, tri) e a régua deixa o absurdo evidente.

## Visual

Segue o visual sereno do ATLAS (sem grade, brilho ou HUD) e o shell das
outras ferramentas. Ícone do token sempre visível (`data-atlas-token`). Na
largura de celular, as duas colunas viram uma pilha.

## Testes

- `node --test Ferramentas/calculadora-market-cap/calculo.test.cjs`. Gabarito
  com os números do texto original: SKY a US$ 0,077 com 23,4 bi em circulação
  dá ≈ US$ 1,80 bi; a US$ 1 dá US$ 23,4 bi, ≈ 13×; AAVE × 13 ≈ US$ 2.090; US$
  100 a US$ 160,78 compram ≈ 0,622 AAVE. Mais os casos difíceis (sem máxima,
  circulação zero, circulação maior que a oferta, entradas inválidas,
  posição acima do 1º).
- No navegador com `?atlas-dev=1` em localhost: buscar JUP, conferir a ficha,
  as três abas e os links; testar um token sem oferta máxima (ETH); testar a
  largura de celular; zero erro no console.
