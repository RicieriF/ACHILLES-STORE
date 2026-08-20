# ACHILLES STORE

Commerce core modular do e-commerce outdoor brasileiro. A implementação atual
cobre catálogo comercial, Customer Order, fulfillment e um Integration Hub
operacional fail-closed até a TASK 014.

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
6. Inicie commerce/admin e storefront com `pnpm dev` ou use `ACHILLES-STORE.bat`.

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

`ACHILLES · Integrações` consolida configuração sanitizada e health de Alibaba,
CJ, BRAZIL_STOCK, Mercado Pago, shipping, tracking e e-mail. `ACHILLES ·
Configurações` é somente leitura via ENV; chaves nunca são editadas em plaintext.
Consulte `docs/DEPLOYMENT.md` para staging, domínio, HTTPS, webhook e rollback.

Com `ALIBABA_PRODUCT_IMPORT=false` (padrão), Importações valida uma URL HTTPS
Alibaba e cria um draft manual sem chamada externa. Ativar deliberadamente a
flag permite somente coleta pública conservadora; credenciais oficiais não são
exigidas. `APPROVED` sozinho não cria Product nem SupplierOffer.

Após confirmação humana explícita, um ImportDraft `APPROVED` pode ser convertido
em Product Medusa `DRAFT`, Supplier/SupplierOffer inativa, CostQuote
`INCOMPLETE` e ProductPolicy. A conversão não consulta Alibaba, não associa o
sales channel público e não define preço de venda. Importar ≠ publicar; aprovar
ImportDraft ≠ vender; converter ≠ comprar fornecedor; CostQuote ≠ preço final.

Endpoints: `POST/GET /admin/achilles/imports`, `GET/PATCH
/admin/achilles/imports/:id` e ações `reprocess`, `approve`, `reject` e
`convert`.

### Pricing Engine

O motor opera exclusivamente sobre `CostQuote` e usa aritmética decimal baseada
em `BigInt`; dinheiro não é calculado com floating point JavaScript. O fluxo é:

`INCOMPLETE → premissas manuais → READY_FOR_PRICING → PRICED → aprovação humana`

Cada cálculo cria um `PricingSnapshot` versionado com inputs, outputs, FX,
estratégia tributária, premissas, warnings, versão do motor, horário e ator.
Alterar uma premissa ou SupplierOffer relevante marca o quote como `STALE` sem
apagar snapshots ou o preço anteriormente aprovado.

Fórmula v1: `landed cost` soma fornecedor convertido, frete internacional
unitário, tributo estimado, branding rateado e entrega local; break-even e preço
sugerido resolvem algebricamente gateway, reservas, buffer promocional e margem.
Tributos são estimativas, nunca garantia fiscal. FX é manual e congelado no
snapshot. Frete aceita `PER_UNIT`, `BY_QUANTITY` e `MANUAL`.

Rotas autenticadas: `GET/POST /admin/achilles/pricing/:id`, ações `calculate` e
`approve`, e `GET /admin/achilles/pricing/:id/history`. Calcular ≠ aprovar;
aprovar ≠ publicar. O Product continua `DRAFT`, sem sales channel e sem preço
aplicado automaticamente ao catálogo.

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

## Pedidos e fulfillment

Um `PaymentIntent PAID` cria um Order pelo workflow oficial do Medusa e uma
referência Achilles idempotente. O planejamento com fornecedores sempre passa
pelo Supplier Order Gate e por aprovação humana. Alibaba e CJ continuam
fail-closed; somente o provider TEST pode criar uma ordem sandbox.

Consulte `docs/FULFILLMENT.md` para Customer Order, roteamento, aprovação,
fallback, tracking, exceções e limites de PII.

## Segurança e limitações

Todas as flags de escrita/pagamento Alibaba e CJ permanecem `false` por padrão.
Não existe pedido ou pagamento real de fornecedor, provider FX pago ou regra
fiscal universal inventada. A coleta opcional não contorna CAPTCHA, login, rate
limit ou proteção anti-bot.

Fake Redis, Local Event Bus e locking em memória são aceitáveis somente no
desenvolvimento. Produção exigirá componentes duráveis. O aviso transitivo do
driver `pg` observado no seed pertence à árvore do Medusa e não foi escondido
com downgrade ou dependência duplicada.

Consulte `docs/ARCHITECTURE.md` para os limites entre Medusa e o domínio próprio.
