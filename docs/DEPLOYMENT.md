# Deployment — ACHILLES STORE

## Modelo de ambientes

`APP_ENV` deve ser definido explicitamente como `development`, `test`, `staging` ou `production`. `NODE_ENV` continua sendo o modo do runtime Node. Ausência de `APP_ENV` resulta em `development`; nunca em produção.

| Ambiente    | Providers de teste                       | Fornecedores reais                    | Uso                    |
| ----------- | ---------------------------------------- | ------------------------------------- | ---------------------- |
| development | permitidos se explicitamente habilitados | desabilitados por padrão              | máquina local          |
| test        | permitidos                               | desabilitados                         | CI offline             |
| staging     | permitidos somente por flag explícita    | somente leitura/configuração validada | homologação            |
| production  | proibidos                                | fail-closed se incompletos            | futuro, após aprovação |

## Topologia recomendada

- Storefront Next.js em Vercel ou runtime Node equivalente, com domínio HTTPS próprio.
- Commerce/Admin Medusa em serviço Node persistente compatível com Node 24, conectado ao PostgreSQL gerenciado.
- PostgreSQL 17 gerenciado, com backup, PITR e TLS.
- Redis gerenciado em staging/produção via `REDIS_URL` antes de substituir Event Bus/locking locais. O fake Redis, Local Event Bus e limites em memória não são adequados para múltiplas réplicas de produção.

Esta TASK prepara o deploy; não publica infraestrutura nem ativa credenciais reais.

## Build e release

1. Instalar com `pnpm install --frozen-lockfile`.
2. Executar `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`.
3. Executar `pnpm build`.
4. Aplicar `pnpm db:migrate` como etapa única e controlada antes de trocar tráfego.
5. Iniciar Commerce a partir de `apps/commerce/.medusa/server` com `medusa start` e Storefront com `next start`.
6. Verificar Commerce `/ready` (200), Commerce `/health` e Storefront `/api/health` antes de promover.

`pnpm seed` contém somente dados fictícios e recusa produção; não faz parte do release produtivo.

## Variáveis e segredos

Use o secret store do provedor. `.env.example` documenta nomes, nunca valores reais. Obrigatórias por deployment: `APP_ENV`, `DATABASE_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `JWT_SECRET`, `COOKIE_SECRET`, `PUBLIC_BASE_URL`, `STOREFRONT_BASE_URL` e URLs públicas do Next.

Providers ficam OFF até validação. Em especial `ALIBABA_ORDER_CREATE`, `ALIBABA_ORDER_PAY`, `CJ_ORDER_CREATE` e `CJ_ORDER_PAY` permanecem `false`. Mercado Pago só cobra se `MERCADO_PAGO_ENABLED=true`, credenciais completas e `MERCADO_PAGO_ENVIRONMENT=TEST`; produção não é liberada nesta TASK.

Após deploy, configure no Mercado Pago a URL exata:

`https://<commerce-domain>/webhooks/mercado-pago`

O Admin mostra essa URL derivada de `PUBLIC_BASE_URL`, sem revelar o webhook secret.

## Domínio, HTTPS, CORS e cookies

- TLS/HTTPS deve terminar no load balancer/provedor; redirecione HTTP para HTTPS.
- Nunca use `*` em `STORE_CORS`, `ADMIN_CORS` ou `AUTH_CORS` em produção. A validação de ambiente recusa wildcard.
- Liste origens completas de storefront e Admin. Revise a lista ao trocar domínio.
- Cookies de sessão do Admin permanecem sob autenticação Medusa. Em HTTPS, configure o proxy para encaminhar protocolo e host corretos, mantenha cookies `Secure` e `HttpOnly` e use `SameSite=Lax` salvo requisito cross-site documentado. Localhost preserva HTTP de desenvolvimento.
- O storefront envia CSP, proteção contra frame, `nosniff`, política de referência e permissões restritas. As origens do SDK Mercado Pago estão preparadas, mas devem ser revistas antes da ativação externa.

## Health, observabilidade e rollback

Use `/ready` como readiness e não envie tráfego se retornar 503. O Integration Hub exibe PostgreSQL, Commerce, Storefront e providers sem declarar conexão não testada. Logs devem permanecer estruturados e sem PII/segredos.

Rollback: preserve a imagem anterior, retire a release nova do tráfego e restaure a anterior. Migrações devem ser aditivas; não reverta banco destrutivamente. Se uma migração impedir rollback, interrompa a promoção e restaure backup/PITR em ambiente isolado antes de qualquer ação no banco ativo.

## Limitações de staging

Rate limit é local ao processo e serve apenas como baseline de uma réplica; use Redis/gateway distribuído antes de escala horizontal. Resend, CJ e Alibaba estão preparados por abstrações, mas sem health check autenticado nem envio/execução real. NF-e e ERP de estoque Brasil permanecem futuros.
