# Checklist do primeiro lançamento controlado

Este checklist separa código pronto de dependências humanas. Nenhum valor empresarial, credencial ou produto real foi inventado.

## CODE COMPLETE

- Storefront responsivo, catálogo interno e taxonomia oficial: Lanternas, EDC, Cutelaria e Camping & Outdoor.
- Categorias estruturais visíveis em development/test/staging; produção continua escondendo categorias comerciais vazias.
- Gates públicos de produto, compliance, oferta e preço aprovados permanecem fail-closed.
- Carrinho, CEP manual, cotação/expiração/seleção de frete, checkout, PaymentIntent, pedido, Supplier Order Gate e tracking.
- Mercado Pago preparado somente para TEST; TestEmailProvider e fornecedores sandbox não simulam produção.
- Admin operacional, Integration Hub, health/readiness, build de produção, CI e launcher local.
- Cleanup transacional por marcação com dry-run e bloqueio de produção: `pnpm clean:test-data --dry-run`.
- Seed separado: `seed:dev`, `seed:e2e` e `seed:production`; o seed de produção cria somente taxonomia.

## NEEDS OWNER CONFIGURATION

- Definir domínio do storefront, domínio/API Commerce e URL final do Admin.
- Definir e-mail de suporte monitorado, telefone se exibido, razão social, CNPJ quando aplicável e endereço comercial/legal.
- Aprovar políticas finais de entrega, trocas/devoluções, privacidade, termos, contato e sobre.
- Definir política tributária/importador com contador e especialista aduaneiro.
- Configurar DNS, HTTPS, CORS exato, backups/PITR, logs, alertas e rollback do provedor.
- Escolher infraestrutura Redis/gateway distribuído antes de múltiplas réplicas.

## NEEDS REAL CREDENTIALS

- Mercado Pago: Public Key, Access Token e webhook secret de TEST; validar Pix e cartão com contas/cartões de teste antes de qualquer credencial real.
- Resend: `RESEND_API_KEY` e `EMAIL_FROM` de domínio verificado.
- Alibaba: App Key/Secret e autorização oficial futura; escrita e pagamento continuam OFF.
- CJ: API Key/Access Token e endpoint autorizado futuro; escrita e pagamento continuam OFF.
- Secret store do deployment para banco, JWT, cookie e webhooks. Nunca usar `.env.example` como fonte de segredo.

## NEEDS REAL PRODUCT

Para cada produto: título, descrição própria, fotos autorizadas, variantes/SKUs, fornecedor/oferta, custo, MOQ, frete, disponibilidade, compliance e preço aprovado com snapshot. Produto importado começa em draft e nunca é publicado automaticamente.

Cutelaria exige revisão específica e permanece `COMPLIANCE_REVIEW_REQUIRED` até aprovação humana. Produtos `BLOCKED`, `REVIEW_REQUIRED` ou sem preço aprovado não podem ser publicados/comprados.

## NEEDS LEGAL/COMMERCIAL DATA

- Identificação completa do vendedor, canais de atendimento e horários.
- Política de entrega real por modalidade/origem e tratamento de tributos/importação.
- Política de arrependimento, troca, devolução, garantia e reembolso revisada juridicamente.
- Textos finais de privacidade/LGPD, termos, contato e sobre.
- Preços, margens, promoções, disponibilidade, claims e documentação de fornecedores reais.

## POST-LAUNCH

- Ativar analytics somente após escolha do provider e consentimento/política adequados.
- Redis/rate limit distribuído para escala horizontal.
- NF-e/ERP e operação de BRAZIL_STOCK real.
- Automação de fornecedor apenas após autorização, sandbox, idempotência, limites de risco e nova aprovação.
- Melhorias de performance/UX somente com métricas e problemas observados no lançamento.
