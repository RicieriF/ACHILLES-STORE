# Customer Order e Fulfillment

## Limite entre Medusa e o domínio Achilles

O pagamento confirmado cria o pedido comercial pelo `createOrderWorkflow` oficial
do Medusa. Esse Order continua sendo a fonte de verdade para itens, endereço,
cliente, moeda, preços e frete. `CustomerOrder` é o complemento operacional da
Achilles: guarda a referência pública, vínculo idempotente com `PaymentIntent` e
Medusa Order, snapshots imutáveis e o estado da operação com fornecedores.

Uma constraint única em `customer_order.payment_intent_id`, combinada a um lock
advisory do PostgreSQL, impede que webhooks concorrentes criem dois pedidos. A
referência pública usa a sequência anual `ACH-AAAA-NNNNNN`. O endpoint público
exige referência e token aleatório; somente o HMAC do token é persistido.

## Plano, grupos e roteamento

Cada Customer Order possui um `SupplierFulfillmentPlan` versionado. Seus
`FulfillmentGroup`s agrupam itens pela rota escolhida e congelam oferta,
fornecedor, provider, modo de fulfillment, cotação, prazo e o `RoutingSnapshot`.
Esse snapshot registra custo entregue, disponibilidade, compatibilidade, score e
razões exclusivamente para uso interno.

O plano reutiliza o `SupplierRouter`; preço mais baixo não é critério isolado.
São avaliados oferta e fornecedor ativos, disponibilidade, prazo, custo, frete,
compliance, private label, saúde/capacidade do provider e modo de fulfillment.
`PRIVATE_LABEL_DROPSHIP`, `GENERIC_DROPSHIP` e `BRAZIL_STOCK` são representados
sem mudar o Customer Order. Estoque nacional preserva origem/prazo domésticos,
mas não infere regra tributária ausente.

Uma alternativa pode ser escolhida pelo operador antes da submissão. A troca
cria novo snapshot, incrementa a versão, invalida aprovação anterior e volta a
`APPROVAL_REQUIRED`. Não existe fallback automático depois da aprovação.

## Supplier Order Gate

`SupplierOrderGate` é a única passagem para supplier order. `PaymentIntent PAID`
nunca chama um provider diretamente. O gate pode ficar em `NOT_READY`,
`REVIEW_REQUIRED`, `APPROVAL_REQUIRED`, `APPROVED`, `BLOCKED`, `STALE` ou
`EXCEPTION`.

Antes da aprovação ele revalida:

- pagamento pago e não revertido;
- produto, compliance, oferta, fornecedor, estoque e quantidade;
- custo, câmbio/frete, endereço e método de envio;
- suporte a private label e identidade do importador quando aplicável;
- saúde e capacidades do provider;
- margem e ausência de supplier order equivalente.

`SupplierMarginProtection` nunca converte custo desconhecido em zero. Receita,
custo de produto, frete, taxa de pagamento e reserva são comparados ao limite
`SUPPLIER_MIN_MARGIN_PERCENT`. Alterações de custo/frete ou do fingerprint do
snapshot exigem revisão ou tornam a aprovação `STALE`.

A ação Admin `APROVAR PEDIDO AO FORNECEDOR` exige confirmação explícita e
congela fornecedor, oferta, itens, quantidades, custos, frete, total esperado,
moeda, endereço, método, timestamp e aprovador. Aprovar não chama fornecedor.

## Providers e sandbox

`SupplierOrderProvider` expõe capabilities de quote, estoque, criação,
pagamento, cancelamento e tracking, além de health. Os adapters
`AlibabaSupplierOrderProvider` e `CJSupplierOrderProvider` são fail-closed:
criação e pagamento reais permanecem desativados mesmo após aprovação.

Somente `TestSupplierOrderProvider` executa nesta tarefa. Ele é offline,
determinístico e idempotente, marca todos os registros como sandbox e simula
accepted, rejected, pending, falta de estoque, mudança de preço/frete, tracking
e falha. O fluxo manual permitido é:

`APPROVED → TEST ORDER CREATED → SUPPLIER_CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED`

`SupplierOrder` preserva custos esperados, timestamps e IDs operacionais. Uma
constraint parcial impede múltiplas ordens ativas equivalentes por grupo.
`FulfillmentTracking` aceita somente eventos válidos; o sandbox usa carrier e
tracking claramente identificados como TEST.

## Exceções, auditoria e eventos

`OrderException` mantém tipo, severidade, estado `OPEN`, `ACKNOWLEDGED` ou
`RESOLVED`, ator e timestamps sem apagar histórico. A auditoria registra as
transições sem payload de pagamento ou PII desnecessária. Eventos internos
preparam automação futura: `customer_order.created`, `supplier_plan.created`,
`supplier_gate.blocked`, `supplier_gate.approved`, `supplier_order.created`,
`supplier_order.confirmed`, `fulfillment.shipped`, `fulfillment.exception` e
`fulfillment.delivered`. Nenhum robô é ativado.

## Segurança e PII

Rotas Admin usam autenticação Medusa. A API pública entrega somente o DTO de
Customer Order tokenizado: referência, pagamento, itens, pacotes, ETA e tracking.
Ela não expõe fornecedor, Alibaba/CJ, offer, custos internos, margem, score,
aprovador ou notas. `SupplierRecipientDTO` é uma fronteira separada; no sandbox,
endereço, CEP e telefone são mascarados, e CPF, token de pagamento e margem não
são enviados.

As flags devem permanecer desativadas:

```dotenv
ALIBABA_ORDER_CREATE=false
ALIBABA_ORDER_PAY=false
CJ_ORDER_CREATE=false
CJ_ORDER_PAY=false
```

## Limitações deliberadas

- Não há criação, pagamento, refund ou cancelamento automático em fornecedor.
- Refund após supplier order exige intervenção operacional.
- Não há integração nova com fornecedor brasileiro nesta tarefa.
- Os produtos seed não gerenciam inventário Medusa; por isso não há reserva
  paralela. Quando estoque real for habilitado, a reserva deve usar o workflow
  nativo de Inventory/Reservation do Medusa.
- O Integration Hub futuro poderá adicionar Alibaba, CJ, fornecedores nacionais,
  distribuidores ou estoque próprio sem alterar Customer Order.
