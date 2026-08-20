# PROJECT_SPEC.md

## Product
Working project name: Outdoor Commerce Platform

A Brazilian e-commerce platform for curated outdoor, camping, fishing, lighting, backpacks and related accessories sourced primarily from Chinese suppliers.

The long-term goal is private-label dropshipping:
customer buys from our Brazilian storefront -> our system creates an internal order -> a qualified supplier/fulfillment partner in China fulfills it under our brand -> shipment is delivered to the Brazilian customer.

The architecture must also support generic dropshipping during validation and Brazilian inventory for winning products.

## Business principles
1. We own the storefront, product catalog, customer relationship and retail pricing.
2. Alibaba is a supplier channel, not our storefront database.
3. A product can have multiple supplier offers.
4. Supplier replacement must not break customer-facing URLs.
5. Private-label capability belongs to a supplier offer/fulfillment configuration, not just the product.
6. No product is published automatically from a supplier URL.
7. Costs and margins are first-class data.

## Key entities
- StoreProduct
- StoreVariant
- Category
- Supplier
- SupplierOffer
- SupplierVariantMap
- BrandingProfile
- FulfillmentRoute
- ImportDraft
- CostQuote
- PricingRule
- ComplianceReview
- CustomerOrder
- SupplierOrder
- Shipment
- TrackingEvent
- WebhookEvent
- AuditEvent

## Core status models
Product:
DRAFT -> REVIEW -> ACTIVE -> PAUSED -> ARCHIVED

ImportDraft:
FETCHING -> PARSED -> NEEDS_REVIEW -> APPROVED -> REJECTED -> FAILED

Compliance:
PENDING -> CLEAR -> REVIEW_REQUIRED -> BLOCKED

SupplierOrder:
DRAFT -> APPROVAL_REQUIRED -> READY -> PLACED -> PAID -> FULFILLING -> SHIPPED -> DELIVERED
with FAILED/CANCELLED branches.

## Alibaba integration boundary
Start with a provider adapter.
Do not let application code call Alibaba endpoints directly outside AlibabaConnector.

V1:
- save source URL
- normalize/import product data where access permits
- allow manual supplementation of missing fields
- save supplier offer
- support manual re-sync

V2 after official API credentials/authorization:
- product info
- freight quote
- BuyNow/order creation where supported
- payment result
- dropshipping payment where supported
- logistics tracking

Every API capability must be feature-flagged.

## Private-label model
BrandingProfile:
- brand name
- logo asset reference
- packaging notes
- insert/manual notes
- language
- supplier instructions
- minimum order constraints
- setup cost
- per-unit branding cost

SupplierOffer:
- privateLabelSupported
- brandingMOQ
- brandingLeadTime
- sampleRequired
- customizationNotes

## Pricing engine
Inputs:
- supplier unit cost
- source currency
- FX rate + timestamp/source
- international shipping allocation
- customs/tax estimate strategy
- payment gateway fee
- local delivery when applicable
- branding/setup allocation
- returns/risk reserve
- target margin
- promotional discount constraints

Outputs:
- landed/estimated cost
- break-even retail price
- target retail price
- gross margin
- contribution margin estimate
- warnings
- assumptions snapshot

Store the snapshot used to approve a price.

## Brazilian import model
The system must support more than one customs/tax strategy because direct-to-consumer international shipment and merchant importation are not the same operation.

For initial development:
- estimates only
- assumptions visible
- manual override
- no legal/tax claims in checkout until the operational model is validated with accountant/customs specialist and, if applicable, Remessa Conforme/courier requirements.

## Customer experience
Required MVP pages:
- homepage
- category
- search
- product
- cart
- checkout
- order confirmation
- customer order/tracking
- policies/contact

Product page must clearly support:
- available variants
- shipping origin/estimated delivery model
- price
- availability
- returns/policy link
- accurate specifications

## Admin
Required:
- products
- imported drafts
- suppliers
- supplier offers
- pricing
- compliance queue
- orders
- supplier orders
- shipments/tracking
- settings/integration health

Primary action:
"Importar do Alibaba"
URL -> analysis -> draft -> review -> supplier offer -> pricing -> publish.

## Non-functional
- pt-BR first
- BRL retail currency first
- UTC internally; timezone-aware display
- responsive/mobile-first
- accessibility baseline
- SEO metadata/sitemap/schema where appropriate
- structured logs
- error monitoring integration ready
- audit trail on product price, supplier selection, supplier orders and compliance decisions

## Definition of done for MVP
A test customer can:
1. browse a real internal catalog
2. select a variant
3. add to cart
4. checkout using configured payment provider
5. receive order confirmation
6. see order status/tracking

An admin can:
1. paste an Alibaba URL
2. create a reviewable draft
3. associate supplier/offer
4. complete missing data
5. calculate/review price
6. approve/publish product
7. see a paid customer order
8. create/approve supplier-order workflow
9. attach/receive tracking
10. update the customer order lifecycle
