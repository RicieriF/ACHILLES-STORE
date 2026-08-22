# TASK 016.2 — Operational blockers

## Causa das fixtures no Admin

A suíte Playwright reutilizava o servidor local (`E2E_REUSE_SERVERS`) e o mesmo
PostgreSQL `achilles_store` do operador. Testes criavam produtos `[E2E]`,
rascunhos de importação AliExpress sem marcador técnico, pedidos da lanterna
fictícia e o usuário `e2e-admin@example.invalid`. O `seed:dev` recolocava
produtos `[FICTÍCIO]` depois da limpeza. O cleanup não cobria `import_draft`
marcado só por título.

## Isolamento

Playwright sobe o Commerce com `DATABASE_URL` em `achilles_store_e2e`.
`scripts/ensure-e2e-database.cts` cria esse banco no Postgres do Compose.
`reuseExistingServer` só é permitido se o servidor já estiver no banco E2E.
O Admin do operador permanece em `achilles_store`.

## Cleanup

`pnpm clean:test-data` continua explícito, idempotente e proibido em production.
Agora seleciona por marcadores técnicos:

- `metadata.achilles_test_fixture`
- `metadata.seed` de TASK/E2E
- `CJ-FIXTURE-*`
- handles `e2e-` / `ficticio-`
- URLs `example.invalid` / `fixture.invalid`
- `raw_provider_metadata.achilles_test_fixture` em importações

Todo create em `APP_ENV=test` grava o marcador. Títulos `[E2E]`/`[FICTÍCIO]`
são sinal adicional, nunca o único critério destrutivo.

## Seed

`pnpm seed:dev` cria só a estrutura (loja, região, canal, categorias, perfil
de entrega). `pnpm seed:demo` carrega o catálogo demonstrativo `[FICTÍCIO]`.
`pnpm seed:e2e` estrutura + demo marcada + admin E2E no banco isolado.

## Importação

CJ, Alibaba assistido e URL externa terminam no mesmo contrato: rascunho →
**Enviar para Produtos** → item em **Produtos**. O operador não vê “produto
interno”, DRAFT técnico nem SupplierOffer. A ficha nativa `/app/products/:id`
saiu do fluxo diário; permanece só como rota Medusa (AVANÇADO).

## Preço

A Edição rápida grava `price_brl` e chama `applySimpleRetailPrice`, que reusa
CostQuote + snapshot + aprovação do Pricing Engine existente. Não há motor
novo. O widget avançado de premissas continua em AVANÇADO.

## Publicação

O botão Publicar só habilita com checklist humano (preço, fornecedor, revisão).
`POST /admin/achilles/operations/products/:id/publish` anexa o canal público e
aplica o mesmo `PublicCatalogPolicy` para cadastro manual, CJ e importação
assistida. O middleware nativo também deixa de limitar o gate a
`achilles_import_draft_id`.

## Archive

Rascunho sem vínculo: Excluir. Rascunho com fornecedor ou produto publicado:
Arquivar. `achilles_archived=true` some da lista e do dashboard. Filtro
**Arquivados** recupera.

## Pedidos e tracking

Botões TEST/SANDBOX saíram da tela operacional e ficam em
AVANÇADO → Pedidos de teste (`?sandbox=1`). **Registrar rastreio** pede
transportadora, código e link, recusa `TEST` e mostra Pago / Aguardando
fornecedor / Pedido ao fornecedor / Enviado.

## Testes

E2E isolado cobre importar → produtos → preço → checklist → publicar →
vitrine, e pedido pago → aprovar → rastreio. Um teste final consulta
`achilles_store` e exige zero linhas com o marcador desta corrida.
