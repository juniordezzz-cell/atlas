# APIs do ATLAS

Pasta de referência de **todas as fontes de dados externas** do ATLAS: o que
cada uma entrega, limites, quem usa e qual é a reserva quando ela falha.
Leia antes de colocar qualquer chamada de rede nova no site.

| Arquivo | O que tem |
|---|---|
| [inventario.md](inventario.md) | Cada API, uma por uma: endereço, chave, limite, o que entrega, quem usa hoje |
| [roteamento.md](roteamento.md) | Para cada tipo de dado, a ordem das fontes (principal e reservas), e o que cada ferramenta usa |

Levantamento feito em 08/11/2026 lendo o código do ramo `main` (commit `bf90bf0`).

## O problema que motivou esta pasta

Em 08/11/2026 o dono abriu o **Conversor e Câmbio** e recebeu:

> Não foi possível carregar a cotação agora. A API pode estar limitando requisições.

A causa: a CoinGecko grátis atende poucos pedidos por minuto, e o limite é
**por endereço de internet** (todas as telas do ATLAS abertas no mesmo
computador dividem a mesma cota). O Conversor sozinho faz 4 a 5 pedidos à
CoinGecko ao abrir. As 8 ferramentas que vieram do site antigo chamam a
CoinGecko **direto**, sem passar pela cadeia de preço do ATLAS
(`core/atlas-precos.js`, que já usa a DefiLlama primeiro desde 16/10).

## As regras (valem para o site inteiro)

1. **Nenhuma tela chama API direto.** Tudo passa pelo roteador de dados (a
   fachada que será criada a partir de `core/atlas-precos.js` e de
   `core/providers/registry.js`). A tela pede um **tipo de dado** ("preço de
   SOL", "velas de 4 h de JUP", "dólar em reais"), não uma API.
2. **Toda informação tem pelo menos uma reserva.** A ordem está em
   [roteamento.md](roteamento.md). Se a principal falha, dá limite (429) ou
   volta vazia, o roteador passa para a próxima sem a tela saber.
3. **A CoinGecko é a última opção**, não a primeira, para tudo o que outra
   fonte entrega. Fica como principal só no que só ela tem (categorias).
4. **Último dado bom guardado, com data.** Se todas as fontes falharem, a tela
   mostra o último valor que deu certo e diz de quando é ("cotação de 08/11 às
   14:32"). Mensagem de erro só aparece quando não existe nem fonte nem dado
   guardado, e vem junto com um campo para digitar o valor à mão.
5. **Fila e disjuntor por fonte.** O roteador espaça os pedidos a cada fonte
   para não estourar o limite, e quando uma fonte devolve 429 ela fica de fora
   por alguns minutos (as outras atendem nesse tempo).
6. **Nenhuma chave de API no navegador.** Fonte que exige chave só pode ser
   usada pelo servidor (Supabase/`central-rwa`), nunca pela página.
7. **Mudou uma fonte? Atualize esta pasta no mesmo commit.**
