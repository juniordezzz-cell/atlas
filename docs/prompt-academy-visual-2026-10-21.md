# Prompt — Academy visual e interativo (21/10/2026)

> Prompt para colar numa sessão nova (Claude ou Codex). Escrito a partir do
> pedido do dono em 21/10: o curso do Nível 1 virou "só texto", com espaço
> vazio dos lados, sem imagem, sem gráfico e sem os infográficos pedidos.

---

## O prompt

Você vai reformar o **Academy do ATLAS**, começando pelo **Nível 1**
(`academy/nivel-1/curso/`). Leia antes: `AGENTS.md`,
`docs/academy-2026-10-20.md` (formato novo de aula, blocos, validador) e
`docs/visual-ferramentas-2026-10-15.md` (cenário WebGL + cards 3D, que é o
precedente visual).

### O problema
Hoje o curso é uma coluna de texto: cartões iguais, um atrás do outro
("01. …", "02. …", "03. …"), texto limitado a ~76 caracteres no meio de uma
tela larga, faixas vazias à esquerda e à direita, quase nenhuma figura, nenhum
gráfico que a pessoa mexa e nenhum infográfico. Os módulos 2 a 10 ainda estão
no formato antigo (`sections` em `course.js`). Parece apostila, e o assunto é
blockchain: **blocos de dados ligados por hash**. A pessoa precisa *ver* isso.

### O objetivo
O aluno entende o conceito olhando e mexendo, não só lendo. Regra de
proporção: **nenhuma aula com mais de ~3 parágrafos seguidos sem algo visual
ou interativo entre eles.** Texto curto explica o que a imagem mostra.

### Direção visual: "laboratório de blocos"
Futurista e 3D, mas legível. Escuro (azul-noite, azul-petróleo, toque de
violeta, como o cenário das Ferramentas). Blocos são o motivo visual do site:
cubos translúcidos ligados por linhas de hash.
- **Exceção ao visual sereno:** o Academy entra como segundo piloto, igual às
  Ferramentas. Movimento e 3D sim; neon, glow forte e grade HUD continuam
  fora. O 3D serve à explicação, nunca enfeita.
- `prefers-reduced-motion` → cena parada (um quadro estático bonito).
  Sem WebGL → SVG equivalente. Celular → cena mais simples, sem travar.

### O que construir

**1. Cenário 3D da trilha (topo do curso e "Início")**
Uma cadeia de blocos em Three.js flutuando no fundo. Cada bloco é um módulo do
Nível 1; os concluídos acendem, o atual pulsa devagar, os próximos ficam em
contorno. Clicar num bloco abre o módulo. Arrastar gira a cadeia.

**2. Layout de aula em duas colunas (desktop ≥ 1100px)**
Acabar com as faixas vazias. Texto à esquerda (~55%), **palco visual fixo à
direita** (sticky) que muda conforme a pessoa rola (*scrollytelling*): cada
parágrafo/passo aciona um estado da figura. Abaixo de 1100px vira uma coluna,
com a figura entre os parágrafos. O índice lateral da aula vira uma barra fina
de progresso com os títulos ao passar o mouse.

**3. Blocos de conteúdo novos** (somar ao registry e ao validador)
- `scene` — cena 3D pequena com estados (ex.: `{kind:'chain', steps:[…]}`).
- `interactive` — mini-laboratório embutido na aula (não só na aba Labs).
- `infographic` — infográfico em SVG com partes clicáveis que abrem a
  explicação de cada parte.
- `compare` — dois lados lado a lado (PoW × PoS, UTXO × contas, L1 × rollup).
- `steps` — passo a passo animado (ex.: a vida de uma transação).
- `stat` — número grande com fonte e data (substitui parte dos blocos `data`).

**4. Interações-chave do Nível 1** (mínimo uma por módulo)
| Conceito | Interação |
|---|---|
| Hash | Digite um texto, veja o hash mudar inteiro com uma letra trocada. |
| Bloco e encadeamento | Edite os dados de um bloco 3D e veja os blocos seguintes ficarem vermelhos (cadeia quebrada). |
| Carteira, nó, explorador | Diagrama com os três papéis; a transação "viaja" de um para o outro. |
| Transação ponto a ponto | Linha do tempo animada: assinar → mempool → bloco → confirmações. |
| Proof of Work | "Minere" um bloco: ajuste o nonce até o hash começar com zeros; mostrar tentativas. |
| Proof of Stake | Validadores com peso; sorteio animado e penalidade (slashing). |
| Finalidade e reorganização | Duas cadeias concorrentes; a mais pesada vence. |
| UTXO × contas | Moedas como "notas" que se dividem × saldo que sobe e desce. |
| Taxas e espaço | Bloco com espaço limitado enchendo; quem paga mais entra primeiro. |
| L1, rollup, sidechain | Camadas empilhadas em 3D; pacote de transações "sobe" para a L1. |
| Oráculos | Dado de fora entrando na cadeia por um portão, com as hipóteses visíveis. |

**5. Aba Infográficos**
Um infográfico por módulo, grande, exportável como PNG, que resume o módulo
inteiro numa tela.

**6. Reescrever os módulos 2–10 no formato novo**, um por vez, já usando os
blocos visuais. Módulo 2 (o do print) é o primeiro depois do piloto visual.

### Regras que continuam valendo
- HTML/CSS/JS puro, sem build e sem npm na página. Bibliotecas em
  `assets/vendor/<nome>-<versão>/`, com licença, e registradas em
  `referencias/REPOSITORIOS.md` no mesmo commit.
- O curso roda dentro do iframe; nada vaza para o shell.
- Fatos conferidos na fonte; número real sempre com fonte e data.
- Texto em pt-BR simples. Acessibilidade: toda cena tem `alt`/descrição, tudo
  funciona por teclado, contraste AA.
- `npm test` em `academy/nivel-1/curso/` passando, com testes para os blocos
  novos. Verificar no navegador com `?atlas-dev=1` em localhost, desktop e 375px.

### Ordem de entrega
1. Piloto: layout em duas colunas + scrollytelling + cenário 3D da trilha,
   aplicado ao **Módulo 1**. Mostrar ao dono antes de seguir.
2. Blocos novos no registry e no validador.
3. Módulo 2 reescrito com as interações da tabela.
4. Módulos 3–10, um por vez.

---

## Repositórios sugeridos

| Repositório | Para quê | Licença | Entra como |
|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | Cenas 3D: cadeia de blocos, camadas L1/L2, mineração. Roda em JS puro com `import` de módulo, sem build. | MIT | `assets/vendor/three-<versão>/` (só `three.module.min.js` + `OrbitControls`) |
| [greensock/GSAP](https://github.com/greensock/GSAP) | Animação e **ScrollTrigger** (palco que muda com a rolagem, passo a passo). Gratuito, inclusive os plugins, desde 2025. | Licença própria GSAP (uso livre) | `assets/vendor/gsap-<versão>/` (`gsap.min.js` + `ScrollTrigger.min.js`) |
| [russellsamora/scrollama](https://github.com/russellsamora/scrollama) | Alternativa leve ao ScrollTrigger, só para "qual passo está na tela". Usar se o GSAP parecer demais. | MIT | `assets/vendor/scrollama-<versão>.min.js` |

Já existem no projeto e devem ser reaproveitados: **Chart.js 4.4.1**
(gráficos dos laboratórios), **Paper Shaders** (fundo) e **Atropos** (cards
3D da lista de módulos).
