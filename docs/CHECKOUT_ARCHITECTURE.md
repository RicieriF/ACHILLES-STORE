# Checkout architecture (TASK 010)

The guest checkout owns customer contact, the Brazilian destination, public shipping groups, final shipping selections, and a backend totals snapshot. It stops at `READY_FOR_PAYMENT`; no payment intent, card form, PIX charge, boleto, supplier order, or supplier payment is created here.

## Boundaries

- `CheckoutSession` is related to the Medusa cart by `cart_id` and is provider-independent.
- `CheckoutShippingSelection` references a persisted shipping quote and stores only the customer price, ETA, expiry, and the commercial policy snapshot.
- Public DTOs expose packages and commercial methods, never supplier offers, provider routing, internal cost, margin, or subsidy.
- Only cart and checkout IDs may be kept in browser storage. Customer and address PII remain in PostgreSQL and are excluded from audit metadata.
- Address lookup uses `BrazilPostalAddressProvider`; `MANUAL` is the default and external lookup remains optional.

## Safe invalidation

Cart contents/prices and the material destination (`CEP`, city, UF) are fingerprinted. A change clears shipping selections and totals and requires a quote refresh. Expired quotes are never reused. Commercial eligibility and approved public pricing are rechecked before readiness.

This boundary lets later tasks respond to supplier stock loss, supplier price or shipping increases, unavailable shipping, provider fallback, multi-shipment, delayed tracking, and order exceptions without binding checkout to Alibaba, CJdropshipping, or another fulfillment provider.

## Future payment contract

`READY_FOR_PAYMENT` is the sole handoff to TASK 011. A future payment layer may offer PIX, card, and optionally boleto, including provider-supplied installment and fee details, without changing the checkout's assumption to “card only.” No installment promise is made by this task.

The planned Everyday Carry — EDC category and bundle concepts (EDC Essencial, Trabalho, Motorista, Pesca, and Outdoor) remain outside this task. A future bundle may stay one commercial cart item while preserving internal composition in the commerce/bundle domain.
