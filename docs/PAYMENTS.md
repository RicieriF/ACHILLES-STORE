# Pagamentos do cliente

## Escopo e arquitetura

O checkout cria um `PaymentIntent` por tentativa lógica e fala exclusivamente com a abstração `CustomerPaymentProvider`. A implementação inicial é `MercadoPagoPaymentProvider`, usando Checkout Transparente e Orders API, e existe um `FakePaymentProvider` determinístico para testes sem internet.

O total é lido no backend de `CheckoutSession.totals_snapshot.total`, em BRL. Antes da tentativa, o serviço revalida carrinho, publicação, preço, endereço, seleções de frete, expiração, snapshot e política tributária. `UNKNOWN` bloqueia pagamento. Nesta etapa, apenas uma seleção cujas obrigações estejam confirmadas como DDP produz `DDP_CONFIRMED`; nenhum imposto é estimado ou inventado.

`X-Idempotency-Key` é derivado de checkout, método e identificador UUID da tentativa. Repetir a mesma tentativa devolve o registro existente. Uma nova tentativa após falha usa novo UUID e preserva checkout, endereço, frete e total enquanto ainda forem válidos.

## Configuração segura

Tudo começa desligado:

```dotenv
MERCADO_PAGO_ENABLED=false
MERCADO_PAGO_PIX=false
MERCADO_PAGO_CARD=false
MERCADO_PAGO_BOLETO=false
MERCADO_PAGO_ENVIRONMENT=TEST
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=
```

`MERCADO_PAGO_ENVIRONMENT` precisa ser exatamente `TEST`; outro valor falha fechado. A Public Key pode chegar ao navegador. Access Token e webhook secret são somente backend. Nunca copie credenciais reais para `.env.example`, logs ou commits. O modo automático de produção não existe nesta tarefa.

Para a suíte local, `PAYMENT_TEST_PROVIDER_ENABLED=true` habilita o fixture explicitamente. Nunca habilite esse provider em produção. `PAYMENT_TEST_WEBHOOK_SECRET` é separado do secret Mercado Pago.

## Pix

Pix exige CPF com dígitos verificadores válidos. O valor normalizado fica em `TaxpayerIdentity`; respostas públicas exibem somente `***.***.***-NN`. QR Code, copia e cola e expiração vêm do Mercado Pago. Gerar QR mantém o intent `PENDING`; somente consulta autenticada ao provider ou webhook válido pode avançar a `PAID`. A representação visual do provider fake é marcada `TESTE — NÃO PAGÁVEL` e não finge ser um QR real.

## Cartão e limite PCI

Em Mercado Pago, os campos de cartão são renderizados pelo MercadoPago.js/Card Payment Brick. Número, CVV, validade completa e track data não passam pelo backend Achilles, não são persistidos e não são logados. O backend aceita somente token de uso único, identificador do método e parcelas fornecidas pelo Brick. O token é transmitido diretamente para a Orders API e nunca é escrito em `PaymentIntent` ou `AuditEvent`.

Parcelas e custos devem vir do Mercado Pago. A UI não promete quantidade de parcelas ou ausência de juros sem retorno do provider. Boleto está modelado como capability, mas permanece desativado.

## Webhook e polling

`POST /webhooks/mercado-pago` valida `x-signature` por HMAC-SHA256, usando o manifesto documentado (`data.id`, `x-request-id`, `ts`) e tolerância temporal de cinco minutos. O backend então consulta a Orders API; não confia em um status enviado pelo browser/notificação. `PaymentProviderEvent` tem unicidade por provider/evento, guarda apenas hash sanitizado e torna duplicatas idempotentes.

`GET /achilles/store/payment-intents/:id/status` é fallback com rate limit. Webhook é o mecanismo principal.

## Credenciais e validação manual TEST

Crie aplicação no painel Mercado Pago, use vendedor/comprador de teste e credenciais de teste separadas. Configure as flags somente no ambiente local, registre a URL do webhook e teste Pix/cartão conforme os cartões de teste oficiais. Nunca use dinheiro ou credenciais de produção. A validação externa é opcional e não faz parte da suíte offline.

## Privacidade, auditoria e separação de fornecedores

CPF não vai para URL, localStorage, analytics, mensagens de erro ou auditoria. AuditEvent registra apenas IDs internos, método, valor, moeda, provider e transição. Token e QR bruto são excluídos do audit.

Pagamento do cliente `PAID` **não** autoriza pedido nem pagamento ao fornecedor. Não existe chamada a Alibaba/CJ neste módulo. `ALIBABA_ORDER_CREATE`, `ALIBABA_ORDER_PAY`, `CJ_ORDER_CREATE` e `CJ_ORDER_PAY` continuam `false`. Refund é um placeholder que falha de modo seguro até existir workflow de aprovação.
