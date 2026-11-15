# Ferramenta Medo e Ganância (14/11/2026)

Registro para quem mexer depois (Claude ou Codex).

## O pedido

O dono estuda economia comportamental e queria entender, com números, a frase
"compre no medo, venda na ganância" para hold. O painel nasceu fora do ATLAS,
na pasta `Desktop/Laboratorio de Sentimento` (um HTML com dados fixos em JSON),
e cresceu até 7 abas. Em 14/11 ele pediu para trazer para o site, porque vê
"potencial de ferramenta para o Atlas". Entrou na bancada, seção
**Estudar o mercado**.

## Onde está

| Arquivo | O que faz |
|---|---|
| `Ferramentas/medo-e-ganancia/index.html` | Página, no padrão da bancada (login, cenário, `atlas-shell.js` no fim) |
| `Ferramentas/medo-e-ganancia/app.js` | Dados, desenho e controles das 7 abas |
| `Ferramentas/medo-e-ganancia/estatistica.js` | Contas puras: retornos por prazo, ondas de medo, queda depois da onda, marcos de lucro (+50%, 2×, 3×, 5×, 10×) e simulação de aportes. `window.AtlasMedoGanancia` / `require` |
| `Ferramentas/medo-e-ganancia/estatistica.test.cjs` | Testes das contas |
| `Ferramentas/medo-e-ganancia/aba-agora.js` | Desenho da aba Agora (`window.AbaAgora.render(ctx, el)`). O mesmo arquivo roda no painel do Laboratório de Sentimento: recebe os ajudantes da página num objeto `ctx` |
| `Ferramentas/medo-e-ganancia/estilo.css` | Só o visual desta ferramenta, sobre `../_comum/ferramenta.css` |
| `Ferramentas/medo-e-ganancia/dados-luna.js` | Velas diárias fixas da LUNA original até 13/05/2022 |
| `assets/vendor/lightweight-charts-4.2.0/` | Biblioteca de gráfico do TradingView (Apache 2.0), com a licença |
| `assets/ferramentas/card-medo.svg` | Capa provisória do card |

## As abas

Em 15/11 o painel passou de 8 para 5 abas, porque o dono não achava a resposta
direta ("a SOL está 50% abaixo do topo desde janeiro: quem comprou assim, o que
aconteceu?"). Cada aba abre com um "Como ler" recolhível; o glossário fica no
rodapé, valendo para todas.

| Aba | Pergunta que responde |
|---|---|
| Agora (abre primeiro) | O token está caindo: quem comprou no mesmo cenário, o que aconteceu? Situação de hoje (queda desde o topo de 12 meses e de 90 dias, há quantos dias); placar (voltou ao topo, no lucro em 1 e 2 anos, chegou ao alvo em até 1 ano); tabela com um ciclo por linha (3m, 6m, 1 ano, 2 anos, volta ao topo, alvo, pior queda); o mesmo placar nos 8 tokens; quedas de 10% a 50% e quanto demoraram para voltar |
| Gráfico | Como preço e índice andaram juntos? Velas de 15m a semanal, índice em painel próprio sincronizado, faixas nos dias de medo, setas no começo de cada onda |
| Estudo | Comprar com o índice em tal faixa rendeu quanto, e em quais tokens? Mapa de calor por faixa × prazo, distribuição do pior ao melhor caso, mapa dos 8 tokens e placar medo × dia qualquer |
| Ondas de pânico | Depois que o medo começa, quanto ainda cai e em quantos dias dobra? Ondas com queda extra e dias até o fundo, e os marcos de +50% a 10× (antiga aba Medo → Lucro) |
| Aportes | Fixo, reserva para o medo, calibrado e calibrado com realização (vende 3% com índice ≥ 80). Valor, frequência, ano de início e multiplicador no medo são escolhas do usuário |

Endereços antigos continuam funcionando: `#retornos` e `#tokens` abrem Estudo,
`#lucro` abre Ondas de pânico, `#guia` abre Agora.

O token e o limiar de medo (5 a 45, padrão 25) valem para todas as abas. Cada
aba só calcula quando é aberta. A aba aberta vai para o endereço (`#agora`, etc.)
e as escolhas ficam em `localStorage` (`atlas.medoGanancia.v1`).

## Dados

Nada de `fetch` direto, nada de arquivo de dados para atualizar à mão:

- **Índice:** `AtlasDados.medoGanancia()` — alternative.me com `limit=0`, a série
  inteira desde 02/2018, guardada em memória por 1 h. Se a fonte cair, devolve a
  última série boa (`atlas.dados.fng.v1`) e a tela avisa de quando ela é.
- **Velas:** `AtlasDados.velasLongas(sym, intervalo, desde)` — Binance página por
  página. Ao abrir, a tela pede o diário desde 01/01/2018 dos 7 tokens vivos (cerca
  de 28 pedidos, espaçados pela fila do roteador). Intradiário só quando o usuário
  escolhe: 15m dos últimos 30 dias, 1h de 180 dias, 4h de 2 anos. Semanal sai do diário.
- **LUNA:** fixa em `dados-luna.js`. O par `LUNAUSDT` de hoje na Binance é a LUNA
  2.0, outro token; buscar ao vivo misturaria os dois. Depois de 13/05/2022 o
  preço fica parado no último valor (perda de ~99,99%).

As duas funções novas do roteador estão em `docs/apis/roteamento.md` e
`docs/apis/inventario.md`, com testes em `core/testes/atlas-dados.test.cjs`.

## Regras das contas (para não mudar sem querer)

- Tempo em dias UTC. Índice do dia = valor publicado naquele dia.
- **Onda de medo:** dias com índice ≤ limiar; dias separados por até 10 dias sem
  medo são a mesma onda; só contam ondas com 3 dias de medo ou mais.
- **Retorno por prazo:** comprar no fechamento do dia e vender no fechamento de
  H dias depois. Mediana e percentis pelo índice mais próximo, sem interpolar.
  Células do mapa com menos de 10 compras ficam vazias.
- **Marcos de lucro:** primeiro dia em que o fechamento chegou ao múltiplo. Pior
  momento é o menor fechamento antes do pico.
- **Aportes:** compra no fechamento a cada 7, 14 ou 30 dias, sem taxas. Reserva
  gasta o caixa inteiro no primeiro período de medo. Caixa não gasto conta pelo
  valor nominal. Token morto: depois do fim, o aporte vira caixa.
- **Aba Agora (cenário por ciclo, `cenario` em estatistica.js).** Momento
  parecido: queda desde o topo dos 365 dias anteriores dentro de ±margem (5, 10
  ou 15 pontos) da queda de hoje e, no critério "Medo + mesma queda", índice ≤
  limiar. **Ciclo = a mesma queda:** começa no primeiro momento parecido e dura
  até o preço voltar ao topo de onde aquela queda foi medida; momentos antes da
  volta são o mesmo ciclo. A linha do ciclo é a compra no primeiro momento dele.
  O ciclo que não voltou e chega até hoje é a queda atual: aparece marcado
  "agora" e fica fora do placar. Ciclo que começa nos últimos 10 dias não vira
  linha. A busca começa no 90º dia do token. O alvo vira um múltiplo do preço de
  hoje, aplicado ao preço de cada compra. Contar ciclos e não dias foi decisão do
  dono, depois de ler "7 de 9 momentos" como "80% de chance": os momentos de um
  mesmo tombo não são casos independentes. "Voltou ao topo" e "no lucro 1 ano
  depois" ficam lado a lado de propósito, porque o preço pode voltar e cair de novo.
- **Quedas e recuperação (aba Agora):** X% abaixo do topo dos 90 dias anteriores;
  depois que volta ao topo, a contagem recomeça no dia seguinte.
- O índice é diário: em 15m, 1h e 4h ele aparece em degraus; no semanal é a
  média da semana.

## Visual

Escuro, como o resto da bancada, com a paleta de `ferramenta.css` e as fontes do
ATLAS. Sem glow. Cores de estado: vermelho para medo e perda, verde para
ganância e ganho; os mapas de calor sempre trazem o número escrito, a cor nunca
carrega a informação sozinha. O logo pequeno do TradingView no canto do gráfico
é a atribuição exigida pela licença.

## Validação

```bash
node --test Ferramentas/medo-e-ganancia/estatistica.test.cjs core/testes/atlas-dados.test.cjs
```

Teste visual feito em 14/11 servindo a pasta (`py -3 -m http.server`) com uma
cópia da página sem a trava de login: todas as abas abriram com dados ao vivo,
sem erro no console e sem rolagem lateral.

## Pendente

- Arte final do card (`card-medo.webp`).
- Ideias que ficaram para depois: estudo de pool de liquidez por fase do índice
  (tempo dentro da faixa, volatilidade, perda impermanente), divergência entre
  preço e índice, e um módulo de economia comportamental (Kahneman) ligado aos
  números desta ferramenta.
