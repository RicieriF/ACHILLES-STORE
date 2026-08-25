# Achilles Simple Admin

Interface operacional para organizar a loja sem conhecer Medusa, IDs, SupplierOffer ou códigos internos.

## Endereços locais

- Simple Admin: `http://localhost:3001`
- Storefront: `http://localhost:3000`
- Backend: `http://localhost:9000`
- Medusa Admin fallback: `http://localhost:9000/app`

O login usa o mesmo usuário administrativo do Medusa. O token fica em `sessionStorage` e as requisições passam por um proxy same-origin com allowlist. Nenhum segredo é renderizado.

O menu contém Início, Minha Vitrine, Adicionar Produto, Pedidos, Clientes, Configurações e Avançado. Publicação, preço, arquivamento e tracking chamam os serviços existentes.

## Rollback

Defina `ACHILLES_SIMPLE_ADMIN=false` antes de usar o launcher. Ele abrirá o Medusa Admin atual. Nenhum dado precisa ser migrado ou revertido.
