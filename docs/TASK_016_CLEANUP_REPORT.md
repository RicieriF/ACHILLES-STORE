# TASK 016 — Relatório de limpeza segura

Data da verificação: 2026-08-21.

O PostgreSQL local `achilles_store` foi consultado antes de qualquer remoção.
Os critérios exatos foram:

- SKU entre `ACH-CAND-001` e `ACH-CAND-015`;
- título exatamente igual a `TESTE`.

Resultado: nenhum produto correspondente foi encontrado. Portanto, nenhum
registro foi excluído.

Pedidos, pagamentos, fulfillment, fornecedores compartilhados, ofertas
comerciais e configurações permaneceram intactos. A aplicação também passou a
permitir exclusão definitiva apenas de produto em DRAFT sem ofertas, pedidos,
carrinhos, cotações ou decisões de roteamento vinculadas. Nos demais casos, a
ação recomendada é arquivar, preservando histórico e vínculos.
