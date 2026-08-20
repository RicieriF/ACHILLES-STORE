# TASK_001_BOOTSTRAP.md

## Objective
Create the reliable foundation of the project. Do not build automatic Alibaba purchasing yet.

## Required work
1. Initialize repository structure suitable for:
   - Next.js storefront
   - admin UI
   - commerce backend/core
   - integration packages
   - shared schemas/types
2. Add TypeScript strict configuration.
3. Add linting/formatting.
4. Add Vitest baseline.
5. Add Playwright baseline.
6. Add Docker/local PostgreSQL development configuration.
7. Add environment variable validation and `.env.example`.
8. Add CI workflow for:
   - install
   - lint
   - typecheck
   - unit tests
   - build
9. Add health/readiness endpoint(s).
10. Create the first domain contracts:
    - SupplierConnector interface
    - ImportTaxStrategy interface
    - fulfillment mode enum
    - supplier capability model
11. Add feature flags:
    - ALIBABA_PRODUCT_IMPORT
    - ALIBABA_FREIGHT_QUOTE
    - ALIBABA_ORDER_CREATE
    - ALIBABA_ORDER_PAY
    - ALIBABA_TRACKING
12. All Alibaba write/payment feature flags must default OFF.
13. Add architecture documentation and local run instructions.

## Acceptance criteria
- fresh clone can be bootstrapped following README
- local database can start
- app(s) start
- typecheck passes
- lint passes
- tests pass
- build passes
- no real secret exists in repository
- external integrations are represented by interfaces/stubs, not fake production behavior
- no automatic purchase is possible
- repository includes AGENTS.md

## Codex execution rules
Before coding:
- inspect versions and current official package compatibility
- prefer supported current versions
- explain any deviation from Medusa + Next.js

During coding:
- work in small coherent increments
- do not delete architecture docs
- do not create fake Alibaba success responses in production code

Before finishing:
- run all quality gates
- report exact commands/results
- report any blocked step with the actual error
- do not claim success for unrun tests
