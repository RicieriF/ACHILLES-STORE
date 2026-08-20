# AGENTS.md — Outdoor Commerce Platform

## Mission
Build a production-grade Brazilian outdoor e-commerce platform focused on private-label dropshipping from China, starting with Alibaba suppliers, while preserving the ability to add other supplier networks and Brazilian stock later.

## Operating model
Primary fulfillment mode:
- PRIVATE_LABEL_DROPSHIP

Supported architecture from day one:
- PRIVATE_LABEL_DROPSHIP
- GENERIC_DROPSHIP
- BRAZIL_STOCK

The storefront belongs to us. Supplier pages are sources of supply, never the canonical product record.

## Core architecture
Use a modular monorepo. Prefer:
- Next.js + React + TypeScript for storefront/admin UI
- Medusa for commerce core unless a blocking incompatibility is proven
- PostgreSQL
- Prisma only if needed for custom service data; do not duplicate Medusa entities unnecessarily
- Tailwind CSS + shadcn/ui
- Vitest for unit/integration tests
- Playwright for critical end-to-end flows
- Docker for local reproducibility

Create a supplier abstraction that does not hard-code Alibaba:
- SupplierConnector
  - getProduct()
  - getVariants()
  - getPrice()
  - getAvailability()
  - getShippingQuote()
  - createOrder()
  - getOrder()
  - getTracking()
  - supportsPrivateLabel()
  - getBrandingOptions()

Implement AlibabaConnector behind that interface.

## Product ownership
A store product MUST remain valid if an Alibaba listing disappears.
Store:
- internal product id
- internal title/description/media
- category
- variants
- retail price
- product status
- fulfillment mode
- compliance status
- one or more SupplierOffer records

SupplierOffer contains:
- supplier/provider
- supplier product id
- source URL
- supplier SKU/variant mapping
- currency
- unit cost
- MOQ
- availability
- freight information
- branding/private-label capability
- last sync time
- sync status
- raw source snapshot/reference where legally/technically appropriate

## Publication safety
No imported product is auto-published.
Import flow:
URL -> fetch/analyze -> draft -> normalize -> price -> compliance review -> human approval -> publish.

Do not silently copy supplier marketing claims. Flag unsupported claims.

## Restricted/compliance-sensitive catalog
For MVP, DO NOT enable automatic publication of:
- firearms
- ammunition
- weapon parts
- controlled hunting items
- regulated self-defense weapons
- any item whose import/sale requires prior licensing unless compliance is explicitly implemented

Knives/canivetes and other edged tools must default to:
COMPLIANCE_REVIEW_REQUIRED

Camping, fishing accessories, backpacks, lighting and ordinary outdoor accessories can proceed subject to product-specific checks.

## Tax/import model
Do not hard-code one tax formula as legally universal.
Create an ImportTaxStrategy abstraction with at least:
- CUSTOMER_AS_IMPORTER
- MERCHANT_AS_IMPORTER
- MANUAL_QUOTE

All production tax numbers must be traceable to configuration/rules and display their assumptions.
Never represent an estimate as a guaranteed customs charge.

## Checkout and payments
Brazilian customer pays our storefront.
Do not send the customer to Alibaba checkout.
Supplier payment is a separate backend workflow.

Supplier payment automation must remain disabled until:
1. Alibaba API authorization is confirmed,
2. payment endpoint behavior is validated in a test/sandbox-safe workflow,
3. idempotency is implemented,
4. order totals are revalidated immediately before payment,
5. approval/risk limits are implemented.

Until then: create supplier order draft / manual payment workflow.

## Secrets
Never commit:
- API keys
- Alibaba app secrets/tokens
- payment credentials
- database passwords
- webhook secrets

Use environment variables and maintain .env.example with fake placeholders only.

## Engineering rules
- TypeScript strict mode.
- Avoid `any` unless documented and isolated at external API boundaries.
- Use schema validation for external data.
- Make all external integrations idempotent where applicable.
- Add retries with bounded exponential backoff only for safe/retryable operations.
- Preserve raw provider identifiers.
- Log correlation IDs for checkout/order/supplier-order flows.
- Do not delete working modules to simplify a task.
- Prefer additive, backward-compatible changes.
- Do not make broad rewrites unless the task explicitly requires it.

## Git discipline
Before modifying:
1. inspect repository status
2. read this AGENTS.md
3. inspect relevant code/tests

After modifying:
1. run formatter/linter
2. run unit tests
3. run relevant integration tests
4. run build/typecheck
5. run Playwright when touching storefront checkout/product critical flow
6. summarize exact changes and known limitations
7. leave repository in a clean, committed state when the environment permits commits

Do not amend unrelated previous work.

## Required quality gates
A feature is not complete because UI exists.
It must have:
- working backend behavior
- validation
- loading/error/empty states
- tests
- no exposed secrets
- documented environment variables
- failure behavior

## MVP milestones
M01 Foundation
M02 Commerce core
M03 Admin
M04 Supplier domain
M05 Alibaba import-by-URL draft workflow
M06 Storefront
M07 Pricing engine
M08 Checkout/payment
M09 Supplier order workflow
M10 Tracking/customer notifications
M11 Observability/security
M12 Production deployment

## First task
Read PROJECT_SPEC.md and TASK_001_BOOTSTRAP.md before implementing.
Do not begin Alibaba automatic purchasing in Task 001.
