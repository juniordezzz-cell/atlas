# Forma suave: uma escala só de cantos, superfícies e entrada (27/11/2026)

Aprovado pelo dono em 27/11 ("Aprovo, pode começar"), depois da auditoria.

## Queixas do dono

- "O site como um todo tá muito quadrado... as bordas estão sem suavidade nenhuma."
- "Tá apertado demais ali a aba de tokens."
- "Sempre quando eu troco de aba no site, a tela pisca 2 vezes."
- "Não é fazer remendo... É quebrar a parede e construir ela de novo."

## O que a auditoria achou

1. **Cantos:** cerca de 1.100 `border-radius` com 30 valores soltos (2, 3, 4, 5,
   6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24 px...). A escala do tema
   (`--atlas-r-*`) existia, mas só ~100 regras a usavam.
2. **Seções abertas:** o visual sereno (`themes/atlas-sereno.css`, carregado por
   último) tirava fundo, borda e canto de todo cartão, painel e número. A página
   virava blocos soltos separados por linhas retas: é o "quadrado" que o dono vê.
3. **Duas piscadas:** a troca de página já tem um esmaecimento (`@view-transition`
   em `core/atlas-secure.js`), e o conteúdo ainda tinha a própria animação de
   entrada, saindo do transparente com desfoque (`atlas-view-in` em
   `.view__inner`, `#app > .view`, `.page-enter`, e `atlas-kpi-in` nos números).
   Medido em 27/11 no Dashboard: a página pinta aos 580 ms e o conteúdo some e
   volta por cima do esmaecimento.
4. **Mercado:** cada troca de aba apagava tudo, mostrava "Carregando…" e montava
   de novo (erro da reforma de 26/11).
5. De passagem: no Dashboard, em 1440 px, a página ficava 151 px mais larga que a
   janela (`.charts` com `1.5fr 1fr 1fr`, sem `minmax(0, …)`) e cortava a
   distribuição por rede.

## Decisões

- **Uma escala de cantos**, definida num lugar só: `core/ui/atlas-shell.css`,
  o único CSS que TODA página carrega (inclusive Ferramentas e Finanças).
  `--atlas-r-xxs 4` · `xs 8` · `sm 12` · `md 16` · `lg 20` · `xl 24` · `pill`.
  `themes/atlas-theme.css` deixa de definir esses valores (só os apelidos
  `--radius`, `--r-*`, `--raio` continuam apontando para eles).
- **Todo canto do site usa a escala**, com o valor de reserva junto
  (`var(--atlas-r-sm, 12px)`), para funcionar até em página que não carrega o
  tema. Conversão: 1–5 px → xxs; 6–8 → xs; 9–13 → sm; 14–18 → md; 19–22 → lg;
  23–40 → xl; 50%, 99px e 999px → círculo e pílula ficam como estão; 0 fica 0.
- **Superfícies suaves no lugar das seções abertas:** cartões, painéis e números
  ganham fundo leve (`--sereno-fill`), sem contorno, canto `lg` (cartão) ou `md`
  (número). Some a linha reta entre fileiras de seções.
- **Uma entrada só:** a troca de página fica só com o `@view-transition`. Saem
  `atlas-view-in` das telas e `atlas-kpi-in` dos números. Modais continuam com
  a animação própria (não é troca de página).
- **Mercado:** cada aba é montada uma vez e fica guardada; trocar de aba só
  mostra ou esconde. A atualização de 5 em 5 min só roda na aba aberta, e a aba
  que estava parada há mais de 5 min atualiza quando volta a aparecer.
- **Aba Tokens com respiro:** linhas mais altas, ícone do token (regra do
  dono), nome por baixo do símbolo, colunas laterais mais largas.
- **Teste que trava o remendo:** `core/ui/atlas-forma.test.cjs` falha se
  aparecer `border-radius` com número solto fora da escala.

## Fora desta etapa

- Desmontar o resto do `atlas-sereno.css` (fundo, tipografia dos números,
  fonte mono → Inter) e levar para a camada única. Fica para a próxima etapa,
  área por área.
- Escala de espaçamento obrigatória (o teste cobre só os cantos por enquanto).
- Páginas de laboratório (`laboratorio/`, `estudio/`) e `referencias/`.
