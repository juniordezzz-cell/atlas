# Academy · Nível 1 — curso completo para quem nunca mexeu com cripto

Data: 20/10/2026 · Status: proposta, aguardando aprovação do dono (revisada após conferência de construtor)
Contexto anterior: [docs/academy-2026-10-20.md](../../academy-2026-10-20.md), sobre como o
curso entrou no site (abas, iframe, seletor de módulos).

## 1. Intenção e o porquê

O curso que veio da pasta `AtlasAcademy` é o **primeiro curso** do Academy. Os
mais avançados virão depois, e o nome definitivo deste curso ainda será escolhido.
O conteúdo atual é raso: cada aula é **um parágrafo** de 200 a 400 caracteres,
sem história, sem imagem e com quase nenhum dado. O dono quer que os 10 módulos
fiquem **muito mais completos antes de publicar**, para não ficar remendando o
curso já no ar.

O dono pediu, nas palavras dele:
- **Começar do início.** Exemplo: Criptografia começa pela cifra de César (cada
  letra trocada pela que vem 3 posições depois, A → D).
- **Infográficos, imagens, mais informação, mais dados, comparações e fontes.**
- **Público:** alguém que **nunca mexeu com cripto**.
- **Publicar tudo de uma vez**, quando estiver pronto. Hoje o curso está só no
  branch `docs/conector-mcp-design`, fora do `main`.
- A organização interna ficou a meu critério.

**Sucesso:** um leigo abre o Módulo 1, lê de ponta a ponta sem travar em palavra
desconhecida, vê como as ideias nasceram, mexe nos laboratórios e termina
sabendo explicar o assunto com as próprias palavras. Cada número afirmado tem
fonte e data.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Reescrever e ampliar as aulas dos 10 módulos para o público leigo.
- Uma abertura histórica em cada módulo: de onde a ideia veio e qual problema resolveu.
- Infográficos e ilustrações próprios, desenhados em SVG, em toda aula que tenha mecanismo.
- Dados reais com fonte e data de consulta, linhas do tempo e tabelas comparativas.
- Mais laboratórios interativos onde ajudam a entender (ex.: cifra de César).
- Avaliações maiores e glossário maior.

**Não-objetivos (ficam para depois)**
- Artigos, Links e Papers: o dono preenche aos poucos.
- Nome definitivo do curso e cursos dos Níveis 2 a 5.
- Reforma do visual geral do curso (cores, tipografia, layout da página).
  Os componentes novos seguem o estilo atual do curso.
- Dados ao vivo (cotações em tempo real). Os números são fotografias datadas.

**Anti-objetivos (deixariam o trabalho ruim mesmo funcionando)**
- Texto que usa jargão sem explicar. Todo termo novo é explicado na primeira vez.
- Números inventados ou sem data. Na dúvida, o número sai.
- Recomendação de investimento, "melhores moedas" e promessa de retorno.
- Imagens copiadas de sites ou bancos de imagem sem licença.
- Volume pelo volume: aula longa que repete o mesmo ponto.
- Quebrar o que já funciona: progresso salvo, notas, favoritos, busca e laboratórios atuais.

## 3. Restrições

- Site estático em JS puro, sem build. O curso roda no iframe de `academy/nivel-1/curso/`.
- Tudo funciona offline depois de carregado: sem CDN e sem imagem remota.
- Português do Brasil, linguagem direta e frases curtas.
- Fontes de dados grátis. Datas de consulta aparecem no texto.
- Os testes de `academy/nivel-1/curso/tests/academy.test.cjs` continuam passando
  (e crescem).
- O progresso salvo em `atlas-academy-v1` não pode ser perdido. Concluídos, notas
  e "último módulo" sobrevivem. Favoritos de aulas que mudaram de lugar podem cair,
  mas o carregamento descarta os inválidos sem quebrar.

## 4. Decisões já tomadas

**Do dono**
- Público leigo; curso de 10 módulos; começar pela história (César em Criptografia).
- Infográficos, imagens, dados, comparações e fontes em todos os módulos.
- Publicar só quando tudo estiver pronto.

**Minhas (o dono delegou a organização e pode vetar)**
1. **Os 10 módulos ficam, na mesma ordem.** Cada um ganha a própria abertura
   histórica. Por exemplo, Bitcoin começa pelos sistemas de dinheiro digital
   anteriores e pela crise de 2008, e Sistema financeiro começa pelo escambo e
   pela moeda.
2. **Some o filtro Iniciante / Intermediário / Avançado de dentro dos módulos.**
   Para um leigo, ele esconde conteúdo e confunde com os "Níveis 1 a 5" do Academy.
   Cada módulo vira **uma sequência linear de aulas**. Os tópicos marcados hoje
   como "Para avançar" (MEV, proxies, flash loans etc.) vão para uma seção final
   opcional, **"Indo além"**, marcada como opcional. A avaliação cobre só a parte principal.
3. **Uma aula, um formato.** Cada aula combina blocos nesta ordem típica:
   - texto explicativo (3 a 6 parágrafos curtos);
   - **"Pense assim"**: uma analogia do dia a dia;
   - **figura**: infográfico SVG com legenda e descrição para leitor de tela;
   - **exemplo com números**: hipotéticos, rotulados como tal;
   - **dado real**: número com fonte e data, quando houver;
   - **tabela comparativa**, quando houver o que comparar;
   - **"Em uma frase"**: o resumo da aula;
   - **termos novos**, ligados ao glossário;
   - **fontes**.
   Nem toda aula usa todos os blocos.
4. **Cada módulo tem:** a abertura histórica com **linha do tempo**, 8 a 15 aulas
   principais, "Indo além" opcional, laboratórios, uma avaliação de **8 a 12
   questões** (hoje são 3 a 5) e uma lista de fontes.
5. **Imagens são desenhadas por nós em SVG**, dentro do próprio arquivo:
   diagramas, linhas do tempo e ilustrações simples. Não baixamos fotos.
   Retratos e fotos históricas ficam fora desta etapa e podem entrar depois,
   com licença conferida.
6. **O conteúdo sai de `course.js` (um arquivo só, 69 KB)** e passa para **um
   arquivo por módulo** (`assets/js/content/m1.js` … `m10.js`), num formato de
   blocos. Assim cada módulo é escrito, revisado e testado separadamente.
   `course.js` fica com as fontes (`SOURCES`), o glossário e a lista de módulos.
7. **Primeiro um módulo piloto, depois os outros nove.** O Módulo 1
   (Criptografia, começando por César) sai completo junto com o novo formato de
   aula. O dono olha e aprova o estilo, e só então os outros 9 são escritos,
   cada um na sua sessão, em paralelo.
8. **Laboratórios atuais ficam.** Novos laboratórios só onde fazem diferença.
   Exemplos: cifra de César (cifrar, decifrar, quebrar por tentativa) e análise
   de frequência de letras no M1; "monte um bloco" no M2; calculadora de halving
   no M4; simulador de depeg simples no M7.
9. **Aba "Diagramas e gráficos" vira "Infográficos".** Ela passa a reunir,
   numa página só, todas as figuras das aulas do módulo, para revisar sem reler
   o texto. Os gráficos que existem hoje continuam ali. Quando um gráfico
   pertence claramente a uma aula, ele também aparece dentro dela.
10. **Fontes e termos ficam no arquivo de cada módulo.** Cada `mN.js` declara
   as próprias fontes e os próprios termos do glossário, com chaves prefixadas
   (`m4.whitepaper`). Na carga, tudo é juntado com as fontes que já existem
   (as chaves antigas continuam valendo). Assim as sessões paralelas não
   editam o mesmo arquivo. Um teste falha se houver chave repetida.
11. **Conferência de fatos.** Quem escreve cada módulo confere cada data e
   número na fonte citada. Depois, um revisor separado relê o módulo
   procurando erro factual e jargão sem explicação. O dono revisa o estilo no
   piloto e o resultado final, mas não precisa checar fatos.
12. **O plano de implementação cobre o formato novo e o Módulo 1** e para na
   aprovação do dono. Os outros 9 módulos ganham, cada um, um plano curto que
   segue o padrão aprovado no piloto.
13. **Fontes:** preferir documento primário (whitepaper, documentação oficial,
   NIST, banco central, BIS) e, para história, enciclopédias e livros de
   referência. Toda fonte nova entra em `SOURCES` com a data de consulta.

## 5. Roteiro de conteúdo por módulo (esqueleto; o detalhe fica com quem escreve)

| # | Módulo | Abertura histórica | Pontos que precisam existir |
|---|---|---|---|
| 1 | Criptografia | César (A→D), Vigenère, Enigma e Turing, chave pública (Diffie-Hellman 1976, RSA 1977) | cifra simétrica × assimétrica; hash; assinatura digital; chave privada/pública/endereço; frase de recuperação; por que "criptomoeda" usa assinatura e hash, não "esconde" o dinheiro |
| 2 | Blockchain | registro contábil, timestamping (Haber e Stornetta, 1991), o bloco gênese | o que é um registro compartilhado; bloco e encadeamento; nós; consenso PoW/PoS explicado do zero; confirmação; taxas e fila; L1/L2; explorador de blocos |
| 3 | Criptomoedas e carteiras | do e-gold ao primeiro token | moeda × token; o que a carteira guarda de fato; quente/fria/hardware/custodial; golpes comuns; oferta circulante/total/FDV |
| 4 | Bitcoin | DigiCash, b-money, bit gold, crise de 2008, whitepaper, pizza de 2010 | gasto duplo; UTXO; mineração; halving com tabela real; oferta máxima de 21 milhões; nós × mineradores; custódia |
| 5 | Smart contracts e Web3 | Nick Szabo (1994), Ethereum (2015), The DAO (2016) | o que é um contrato inteligente; gas; tokens ERC-20/NFT; carteira conectando em app; riscos e falhas conhecidas |
| 6 | DeFi | do banco ao "verão DeFi" de 2020 | empréstimo com garantia; health factor; AMM e pools; staking; APR × APY; perda impermanente. O conteúdo atual é grande e precisa ser reorganizado para leigo, não ampliado à força |
| 7 | Stablecoins | do padrão-ouro ao USDT (2014); colapso do UST (2022) | tipos (reservas, cripto-garantia, algorítmica); resgate; depeg; como ler relatório de reservas; dados de tamanho de mercado com data |
| 8 | RWA e tokenização | títulos ao portador, cartórios, primeiros fundos tokenizados | o que é ativo do mundo real; quem guarda o ativo fora da rede; renda, custos e liquidez; casos reais com data |
| 9 | Investimentos e gestão de risco | bolhas históricas (tulipas, pontocom), Markowitz | objetivo e prazo; volatilidade e drawdown com números; diversificação; correlação; rebalanceamento; golpes e promessas de retorno |
| 10 | Sistema financeiro global | escambo, moeda, bancos centrais, SWIFT, Pix | o que é dinheiro; pagamento × liquidação; crédito; câmbio e remessas; onde stablecoins e tokenização se encaixam |

## 6. O que fica a cargo de quem constrói

- Texto exato, analogias, exemplos e escolha dos dados de cada aula.
- Quantas aulas cada módulo terá, dentro de 8 a 15.
- Desenho dos SVGs, dentro do estilo atual do curso (fundo escuro, azul/ciano,
  traços finos) e legíveis no celular.
- Esquema exato dos blocos e do renderizador, desde que todo conteúdo novo
  passe pelo escape já usado no curso e que gráficos e figuras tenham descrição
  textual.
- Como migrar o progresso salvo (ids de aula e favoritos).

## 7. Como saber que ficou pronto

Por módulo:
- todas as aulas no formato novo, com abertura histórica e linha do tempo;
- pelo menos uma figura por aula que explica mecanismo;
- todo número real com fonte e data;
- avaliação de 8 a 12 questões, cada uma com explicação;
- termos novos no glossário;
- os testes passam, incluindo checagens novas (toda aula tem fonte, toda figura
  tem descrição, todo termo citado existe no glossário).

No curso inteiro:
- o dono aprovou o piloto (M1) antes dos outros;
- releitura final com olhar de leigo, procurando jargão sem explicação;
- só então: merge para o `main` e publicação.
