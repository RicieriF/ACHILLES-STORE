# Resposta real do catálogo CJ

Captura sanitizada realizada em 25/08/2026 com o cliente CJ já configurado no
ambiente local e a busca `flashlight`. Nenhuma credencial, header ou token foi
registrado.

- endpoint Achilles autenticado: HTTP `200`
- `data.pageSize`: `20`
- `data.pageNumber`: `1`
- `data.totalRecords`: `24`
- `data.totalPages`: `2`
- lista: `data.content[].productList[]`
- página 1: 20 produtos
- página 2: 4 produtos; o endpoint normalizado retornou `page: 2`, `size: 20`

Após a correção, a resposta normalizada do endpoint Achilles para a primeira
página foi verificada com `items.length: 20`, `total: 24`, `page: 1` e
`size: 20`. O primeiro card normalizado trouxe título, imagem, SKU e o intervalo
de custo `4.49`–`5.43`.

Campos observados em cada produto:

- identificador: `id`
- nome: `nameEn`
- SKU: `sku`
- imagem: `bigImage`
- preço: `sellPrice`; pode ser valor único ou intervalo `mínimo -- máximo`
- moeda: `currency`; pode ser nula, caso em que a integração assume USD
- variantes: a listagem expõe apenas metadados opcionais; as variantes completas
  continuam sendo consultadas pelo endpoint de variantes existente antes da
  importação.

O contrato normalizado entregue às duas interfaces permanece `items`, `total`,
`page` e `size`. A resposta bruta da CJ não é exposta às UIs.
