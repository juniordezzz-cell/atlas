# referencias/

Código de terceiros guardado como **referência**, não como parte do app.
Nada aqui é carregado pelo ATLAS.

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
