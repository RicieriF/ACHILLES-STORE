# Arquitetura até a TASK 002

O projeto é um monorepo pnpm/Turborepo. `apps/storefront` é o canal Next.js em pt-BR. `apps/commerce` é o Medusa v2 com Admin. Contratos independentes ficam em `packages/domain`, validação de ambiente em `packages/config` e fornecedores atrás de `SupplierConnector`.

## Commerce core e persistência

PostgreSQL é o único banco suportado. O Compose usa PostgreSQL 17 e `DATABASE_URL` aceita somente `postgres`/`postgresql`. Módulos nativos do Medusa continuam responsáveis por Products, Variants, Inventory, Carts, Customers e Orders.

O módulo `supplier_domain` persiste apenas conceitos próprios:

- `Supplier`: identidade e provider independentes do Alibaba.
- `SupplierOffer`: referencia `product_id` do Medusa, sem duplicar o produto; vários offers podem apontar para o mesmo produto.
- Um índice parcial permite no máximo um `SupplierOffer.is_primary=true` por produto.
- `SupplierVariantMap`: associa variantes internas aos SKUs/IDs do fornecedor.
- `BrandingProfile`: instruções e custos de private label como strings decimais.
- `ProductPolicy`: fulfillment mode, sensibilidade e compliance do produto.

Links somente de leitura expõem `SupplierOffer -> Product` e `ProductPolicy -> Product`. URL, título, descrição e variantes públicas continuam pertencendo ao Product nativo e não mudam quando o fornecedor é substituído.

## Brasil e compliance

O seed configura canal `Achilles Store Brasil`, região `Brasil / BRL`, país `br`, moeda `brl`, cinco categorias outdoor e dois produtos fictícios. Locale e timezone são configurações de ambiente. Nenhuma regra tributária foi criada.

`ProductPolicy` suporta `PRIVATE_LABEL_DROPSHIP`, `GENERIC_DROPSHIP` e `BRAZIL_STOCK`. Sensibilidade `EDGED_TOOL` exige `REVIEW_REQUIRED` ou `BLOCKED`; `CONTROLLED_ITEM` permanece bloqueado pelo domínio. Itens controlados não fazem parte do seed/MVP.

## Operação

1. `pnpm docker:up`
2. `pnpm db:migrate`
3. `pnpm seed`
4. `pnpm dev`

`/health` é liveness. `/ready` consulta PostgreSQL e confirma as cinco tabelas próprias; nunca retorna ready quando o banco está indisponível ou a migração está incompleta.

## Limites

- Não há integração ou simulação de sucesso Alibaba.
- Não há compra/pagamento de fornecedor, Mercado Pago ou cálculo fiscal.
- O catálogo existente é exclusivamente fictício e de desenvolvimento.
- Logística de checkout e inventário em localização física serão configurados em tarefa posterior.
