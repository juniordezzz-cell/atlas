# Desempenho do site — etapa 1 (18/11/2026)

Revisão das 12 ferramentas pedida pelo dono. A etapa 1 cuidou do peso que vale
para o site inteiro. Nada mudou no visual.

| O quê | Antes | Depois |
|---|---|---|
| `assets/iconeatlas.png` (logo do menu, favicon, telas de módulo) | 1280 px, 2,1 MB | 128 px, 32 KB (exibido em no máximo 52 px) |
| Ícones do app instalado (`manifest.webmanifest`) | o mesmo PNG de 1280×1229 | `iconeatlas-192.png`, `iconeatlas-512.png` e `iconeatlas-maskable-512.png` (fundo #05080F e margem de segurança) |
| Fundo animado (`core/ui/atlas-cenario.js`) | importava o `index.js` da paper-shaders (~35 arquivos) | importa só `shader-mount.js`, `shaders/mesh-gradient.js` e `get-shader-color-from-string.js` |
| Botão do Oráculo (`atlas-shell.js`, Scanner, Finanças) | `atena.webp` 720 px, 145 KB | `atena-160.webp`, 10 KB. As telas grandes (abertura e palco do Oráculo) seguem com a de 720 px |
| Abertura das Finanças | `boot-hero.png`, 2,1 MB (cópia do ícone) | `boot-hero.webp` 640 px, 146 KB |
| Fontes das Finanças | Google Fonts | `themes/atlas-fonts.css` (do próprio ATLAS) |

Resultado medido no servidor local: as ferramentas caíram de cerca de 3 MB
e 60 arquivos para cerca de 480 KB e 27 arquivos (as Finanças, de 10 MB para
1,4 MB na primeira visita, por causa do service worker delas). Os caches
foram renovados: `sw.js` `atlas-v101` e Finanças `financas-v15`.

O original do ícone (1280 px) não fica no repositório: o histórico do git
guarda a versão anterior do arquivo, se precisar.

Próximas etapas da revisão: lista de 500 tokens sob demanda no DCA e nas
Estratégias (HTML de 827 KB); padrão de duas colunas nas calculadoras;
ajustes por ferramenta.

## Etapa 2 — DCA · Preço Médio e Estratégias de Pools (18/11/2026)

- **Retrato embutido mais leve** (`_fonte-quadro/build.js`): os 500 tokens
  continuam na lista, mas o gráfico de 7 dias de reserva (usado só quando a
  cotação ao vivo falha) fica para os 80 maiores e os favoritos padrão
  (`DEFAULT_WATCH`), com 4 algarismos. O `snap.json` continua completo.
  HTML: 827 KB → 305 KB.
- **Lista sob demanda** (`renderWatch` / `maisLinhas`): desenha 60 linhas e
  mais 60 a cada vez que a pessoa chega perto do fim da lista. Clique, estrela
  e Enter são tratados uma vez só na lista (`#wlist`), valendo para as linhas
  que entram depois. Elementos na página: ~4.600 → ~1.150. Abertura do DCA:
  2,3 s → ~1,0 s.
- A imagem `boot-hero.png` antiga das Finanças (2,1 MB, sem uso desde a
  etapa 1) saiu do repositório.

## Etapa 3 — padrão das calculadoras (18/11/2026)

- **Lucro Cripto, Staking e Juros Compostos** (`.wrap--calc`, `.calc-grade`):
  campos à esquerda (`.calc-ent`), resultado à direita (`.calc-res`), fixo
  à vista ao rolar a partir de 1100 px. No celular, empilha.
- **Conta ao vivo:** cada `app.js` recalcula 180 ms depois de qualquer
  campo, seletor ou botão de opção. O botão de calcular sumiu (CSS
  `.wrap--calc .acoes .btn--principal`). "Limpar" volta aos valores padrão e
  recalcula.
- **Abre com exemplo:** nota "exemplo" no topo do resultado (`#xx-ex`), que
  some no primeiro campo que a pessoa mexer. No Lucro, compra a 100 e venda a
  130, a não ser que venha `?compra=&venda=` do DCA. Sem os três números, o
  lado do resultado diz o que falta (`#lc-vazio`).
- **"Como ler" recolhível** (`<details class="explica">`).
- **Market Cap:** abre com a Solana de exemplo (com nota) quando não há
  `?token=`. "Como ler estes números" e "Glossário" ficam recolhíveis
  (`details.recolhe`), e o termo sublinhado abre o glossário antes de pular.
  Na comparação de tokens, o glossário também fica recolhível.
- **Celular:** o cabeçalho abre espaço para o botão do menu do site
  (`html.atlas-moldura .top{padding-left:46px}`), em `_comum/ferramenta.css`
  e no `estilo.css` do Market Cap.
