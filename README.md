# ACHILLES STORE

Commerce core modular do e-commerce outdoor brasileiro. A implementação atual cobre até a TASK 004 — Alibaba URL para ImportDraft revisável.

## Requisitos

- Node.js 24 LTS
- pnpm 11.20.0
- Docker com Compose para o PostgreSQL local

## Configuração local

1. Copie `.env.example` para `.env` e substitua os segredos de exemplo por valores locais fortes.
2. Execute `pnpm install`.
3. Inicie PostgreSQL com `pnpm docker:up` e aguarde o healthcheck.
4. Execute migrações oficiais e próprias com `pnpm db:migrate`.
5. Opcionalmente, carregue os dados fictícios com `pnpm seed`.
6. Inicie commerce/admin e storefront com `pnpm dev`.

O `.env` da raiz é a única fonte local do monorepo. Commerce e storefront
localizam a raiz pelo `pnpm-workspace.yaml`; não copie `.env` para os apps e não
automatize cópias de segredos.

O storefront responde em `http://localhost:3000` e commerce/Medusa Admin em `http://localhost:9000`. Os endpoints operacionais são:

- `GET /health`: comprova somente que o processo responde.
- `GET /ready`: retorna HTTP 200 somente quando configuração, PostgreSQL e tabelas obrigatórias estão prontos; caso contrário retorna HTTP 503.

## Configuração brasileira

- Região inicial: `Brasil / BRL`.
- País e moeda: `br` e `brl`.
- Canal principal: `Achilles Store Brasil`.
- Locale: `BUSINESS_LOCALE=pt-BR`.
- Timezone configurável: `DISPLAY_TIMEZONE=America/Sao_Paulo` por padrão.
- Custos próprios são strings decimais validadas, sem ponto flutuante JavaScript.

O seed é idempotente para canal, região, categorias e produtos, recusa `NODE_ENV=production` e usa somente produtos `[FICTÍCIO]`, sem imagens externas.

## Administração ACHILLES STORE

Abra `http://localhost:9000/app`. As extensões incluem fornecedores, produtos e
fornecedores, private label, compliance e Importações. As
APIs próprias ficam sob `/admin/achilles` e exigem autenticação Medusa.

Com `ALIBABA_PRODUCT_IMPORT=false` (padrão), Importações valida uma URL HTTPS
Alibaba e cria um draft manual sem chamada externa. Ativar deliberadamente a
flag permite somente coleta pública conservadora; credenciais oficiais não são
exigidas. `APPROVED` não cria Product nem SupplierOffer.

Endpoints: `POST/GET /admin/achilles/imports`, `GET/PATCH
/admin/achilles/imports/:id` e ações `reprocess`, `approve` e `reject`.

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

Testes persistentes exigem PostgreSQL. A CI inicia PostgreSQL 17, executa `pnpm db:migrate` e `pnpm seed` antes dos testes de integração.

## Segurança e limitações

Todas as flags Alibaba permanecem `false` por padrão. Não existem pedido ou
pagamento de fornecedor, Mercado Pago, checkout brasileiro completo, Pricing
Engine ou regras fiscais inventadas. A coleta opcional não contorna CAPTCHA,
login, rate limit ou proteção anti-bot. O seed não configura logística de checkout.

Fake Redis, Local Event Bus e locking em memória são aceitáveis somente no
desenvolvimento. Produção exigirá componentes duráveis. O aviso transitivo do
driver `pg` observado no seed pertence à árvore do Medusa e não foi escondido
com downgrade ou dependência duplicada.

Consulte `docs/ARCHITECTURE.md` para os limites entre Medusa e o domínio próprio.
