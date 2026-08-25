# Migração segura do Admin

O Simple Admin é uma segunda interface para o mesmo backend e banco. Ele não substitui nem remove o Admin atual.

Antes de torná-lo padrão, validar nos dois Admins: criação e edição de produto, preço pelo Pricing Engine, publicação no storefront, pedido, aprovação humana, rastreio e arquivamento.

O Medusa Admin técnico nunca será removido. Ele permanece em **Avançado**. O rollback é imediato com `ACHILLES_SIMPLE_ADMIN=false`.
