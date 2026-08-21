# Navegação do Admin

A operação diária da Achilles usa somente **Início**, **Produtos**,
**Importar**, **Pedidos** e **Configurações**. Ferramentas de fornecedores,
compliance, integrações e diagnóstico permanecem acessíveis pela entrada
**Avançado**.

O Medusa Admin 2.19 permite ocultar oficialmente rotas customizadas quando elas
não declaram `label`, mas não oferece uma API pública para remover ou recolher
as entradas nativas Orders, Drafts, Products, Inventory, Customers, Promotions
e Price Lists. Essas rotas foram preservadas sem hacks de DOM ou CSS. A
duplicidade nativa remanescente é uma limitação conhecida do Admin Medusa.

O cleanup de fixtures é sempre explícito:

```bash
pnpm clean:test-data -- --dry-run
pnpm clean:test-data
```

Ele usa marcadores técnicos — provider TEST, sandbox, metadata de seed/fixture
e IDs CJ-FIXTURE — e nunca classifica registros apenas por nome ou e-mail. Em
production a operação é proibida; em staging exige
`ALLOW_STAGING_TEST_DATA_CLEANUP=true`.
