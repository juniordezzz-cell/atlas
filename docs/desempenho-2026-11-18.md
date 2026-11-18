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
