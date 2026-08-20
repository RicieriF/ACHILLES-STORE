# ACHILLES STORE

Fundação modular do e-commerce outdoor brasileiro. Esta entrega cobre somente a `TASK_001_BOOTSTRAP`.

## Requisitos

- Node.js 24 LTS
- pnpm 11.20.0 (Corepack pode gerenciar a versão)
- Docker com Compose para o PostgreSQL local

## Configuração local

1. Copie `.env.example` para `.env` e troque os segredos de exemplo por valores locais fortes.
2. Execute `pnpm install`.
3. Inicie o PostgreSQL com `pnpm docker:up`.
4. Inicie commerce/admin e storefront com `pnpm dev`.

O storefront responde em `http://localhost:3000`, o commerce/Medusa Admin em `http://localhost:9000`, e os endpoints básicos são `http://localhost:3000/api/health`, `http://localhost:9000/health` e `http://localhost:9000/ready`.

## Quality gates

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## Segurança das integrações

Todas as flags Alibaba presentes em `.env.example` são `false`. O bootstrap não implementa compra nem pagamento automático e não retorna respostas falsas de produção. Consulte `docs/ARCHITECTURE.md`.
