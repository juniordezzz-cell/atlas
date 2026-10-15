# referencias/

Código de terceiros guardado como **referência**, não como parte do app.
Nada aqui é carregado pelo ATLAS.

**Catálogo completo dos repositórios do ATLAS** (inclusive as bibliotecas
que rodam em `assets/vendor/`): [REPOSITORIOS.md](REPOSITORIOS.md).

## magicui/ (submódulo git)

<https://github.com/magicuidesign/magicui>, licença MIT.
Componentes animados em **React + Tailwind + Motion**. O ATLAS é
HTML/CSS/JS puro, sem build, então os componentes não rodam direto:
cada efeito que entrar no ATLAS é **reescrito** em CSS/JS puro, tendo o
original como modelo.

- Componentes: `magicui/apps/www/registry/magicui/*.tsx`
- Clonar o ATLAS já com o submódulo: `git clone --recurse-submodules …`
- Num clone que já existe: `git submodule update --init`
- Atualizar para a versão mais nova do Magic UI:
  `git submodule update --remote referencias/magicui` e commitar.

## uiverse-galaxy/ (submódulo git, desde 15/10/2026)

<https://github.com/uiverse-io/galaxy>, licença MIT. Mais de 3.000 peças
em HTML + CSS puro (uma por arquivo, em `Buttons/`, `Cards/`, `loaders/`…).
Mesmo puro, não é carregado direto: a peça é copiada para o CSS do ATLAS,
adaptada aos tokens de cor, com o nome do arquivo de origem num
comentário. Já portado: a seta do "Abrir ferramenta"
(`css/ferramentas.css`, de `Buttons/satyamchaudharydev_modern-sheep-10.html`).
Navegar com prévia: <https://uiverse.io>.
