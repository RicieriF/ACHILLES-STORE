# Arquitetura da fundação

O projeto é um monorepo pnpm/Turborepo. `apps/storefront` é o canal Next.js em pt-BR. `apps/commerce` é o Medusa v2 e inclui o Medusa Admin. Contratos independentes ficam em `packages/domain`; validação de ambiente e feature flags ficam em `packages/config`; cada fornecedor vive atrás de `SupplierConnector`, começando pelo adaptador bloqueado em `integrations/alibaba`.

Alibaba não é fonte canônica do catálogo. Nesta tarefa o conector não chama APIs e falha explicitamente para todas as operações. Importação, frete, criação de pedido, pagamento e rastreamento são capacidades distintas. Todas começam desligadas; a capacidade de pagamento não possui implementação.

O domínio suporta `PRIVATE_LABEL_DROPSHIP`, `GENERIC_DROPSHIP` e `BRAZIL_STOCK`. Estimativas tributárias são implementadas futuramente por `ImportTaxStrategy`, sempre com premissas, alertas e `isGuaranteed: false`.

## Limites desta tarefa

- Não há catálogo, checkout, pedidos ou sincronização com fornecedores.
- Não há credenciais Alibaba nem simulação de sucesso externo.
- O endpoint `/health` indica vida do processo; `/ready` é a base de readiness do commerce. Uma verificação profunda do banco será adicionada quando os módulos persistentes forem introduzidos.
