# Launch readiness — TASK 015

Classificação: **READY_FOR_CONTROLLED_LAUNCH**, condicionada às configurações, credenciais TEST, produtos e dados legais/comerciais abaixo. Isto não significa `PRODUCTION READY` nem autoriza cobrança ou pedido real.

## READY

- Caminho auditado: Home → Categoria → Produto → Carrinho → CEP → Frete → Checkout → Pagamento TEST → Customer Order → Admin → Supplier Order Gate → sandbox → Tracking.
- Header desktop e mobile expõe a taxonomia estrutural fora de produção sem publicar produtos privados.
- `PublicCatalogPolicy` exige produto publicado, canal público, compliance `CLEAR`, oferta primária ativa e preço aprovado/corrente; BLOCKED e REVIEW_REQUIRED ficam fora.
- Shipping preserva quote, expiração, seleção, multi-shipment e fail-closed tributário.
- PaymentIntent preserva retry, idempotência e webhook autenticado; Mercado Pago permanece TEST-only nesta release.
- Customer Order nasce uma vez após `PAID`; referência e token impedem enumeração e o DTO público omite fornecedor, custo, margem e PII interna.
- Supplier Order Gate mantém aprovação humana e revalida custo, estoque, frete, provider e margem. Alibaba/CJ create/pay permanecem `false`.
- Admin, Integration Hub, launcher, health/readiness, CI, seed estrutural e cleanup seguro estão preparados.

## BLOCKED BY OWNER CONFIG

- Domínios finais, DNS, HTTPS, CORS, URLs de Storefront/Commerce/Admin e webhook Mercado Pago.
- Razão social, CNPJ aplicável, endereço, suporte, políticas comerciais e conteúdo legal revisado.
- Produtos, imagens autorizadas, preços, fornecedores, custos, fretes e aprovações de compliance reais.
- Infraestrutura gerenciada, backups/PITR, observabilidade e Redis antes de múltiplas réplicas.

## BLOCKED BY EXTERNAL PROVIDER

- Credenciais e validação TEST do Mercado Pago para Pix/cartão; cobrança PROD não é suportada por esta release.
- Domínio verificado e credenciais Resend para e-mail real.
- Autorizações oficiais Alibaba/CJ. Leitura/configuração pode ser preparada; criação e pagamento reais são proibidos.
- Definição logística/tributária validada com parceiros, contador e especialista aduaneiro.

## POST-LAUNCH

- Analytics real, NF-e/ERP, estoque Brasil operacional e rate limit/locking distribuídos.
- Automação de pedido/pagamento de fornecedor somente com autorização e controles adicionais.
- Otimizações e novas features guiadas por métricas e incidentes reais.

## KNOWN LIMITATIONS

- ViaCEP é opcional; endereço manual continua disponível quando OFF.
- TestEmailProvider não envia e-mail real.
- Event Bus, locking e rate limit locais atendem desenvolvimento/uma réplica, não escala horizontal.
- Páginas legais usam texto neutro e não exibem dados empresariais inexistentes.
- O ambiente limpo não contém produtos comerciais; categorias vazias são intencionais fora de produção.

## Domain readiness

Configurar `NEXT_PUBLIC_SITE_URL=https://<storefront>`, `NEXT_PUBLIC_COMMERCE_URL=https://<commerce>`, `PUBLIC_BASE_URL=https://<commerce>` e `STOREFRONT_BASE_URL=https://<storefront>`. O Admin fica em `https://<commerce>/app`; Mercado Pago usa `https://<commerce>/webhooks/mercado-pago`. CORS deve listar origens HTTPS exatas, nunca `*` em produção.

## Release controls

- `ALIBABA_ORDER_CREATE=false`, `ALIBABA_ORDER_PAY=false`, `CJ_ORDER_CREATE=false`, `CJ_ORDER_PAY=false`.
- `MERCADO_PAGO_ENVIRONMENT=TEST`; habilitar capabilities somente após credenciais e validação TEST.
- `PAYMENT_TEST_PROVIDER_ENABLED=false` fora de test/E2E.
- Executar migrations como etapa única antes do tráfego; usar `/ready`, `/health` e `/api/health` para promoção.
- Fazer dry-run e cleanup somente em development/test ou staging explicitamente autorizado; produção aborta.

## Validation record — 2026-08-20

- Instalação frozen, migrations, seed dev, formatter, lint, TypeScript e build concluídos.
- Testes: 229 unitários, 4 de integração e 18 E2E aprovados.
- Smoke pós-cleanup: Storefront, Commerce, Admin, `/ready`, `/health` e `/api/health` responderam HTTP 200.
- Cleanup transacional removeu os fixtures identificados de pedidos, pagamentos, checkouts, carrinhos, fornecedores/ofertas/produtos demo e categorias obsoletas; o dry-run posterior reportou zero alvos restantes.
- Preservados: 3 usuários Admin, 4 categorias oficiais e 186 registros de migration.
- Secret scan do repositório aprovado; nenhum segredo real foi adicionado.
