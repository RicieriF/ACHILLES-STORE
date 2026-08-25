# Integrações oficiais de fornecedores

Pesquisa revisada em 25 de agosto de 2026. Somente documentação oficial foi
usada para habilitar capacidades. A ausência de uma permissão verificável é
tratada como integração não configurada, nunca como conexão funcional.

## Contrato e fluxo únicos

O contrato canônico continua sendo `SupplierConnector` e o resultado
`NormalizedSupplierProduct`, em `packages/domain/src/supplier.ts`. Ele preserva
o fornecedor e o identificador externo em `source.reference`, conteúdo próprio,
imagens em `source.media`, variantes, custo/faixa de custo, moeda, disponibilidade
consultada pelo conector e metadados de frete. Isso corresponde ao modelo
operacional `SupplierProduct` (supplier, supplier_product_id, title, description,
images, variants, cost, currency, stock, freight e source_url) sem criar um
segundo parser por interface.

O fluxo é sempre:

`fornecedor -> normalizador -> rascunho Achilles -> Minha Vitrine -> preço -> publicação`

Adicionar e publicar exigem ação humana. Criar e pagar pedido do fornecedor
continuam bloqueados por flags independentes e desativadas por padrão.

## CJdropshipping — prioridade 1

A [API V2 oficial da CJ](https://developers.cjdropshipping.com/en/api/api2/)
continua sendo o limite de produção da aplicação. Ela cobre catálogo, detalhes,
variantes, estoque, frete, pedidos e tracking. A Achilles habilita somente as
consultas autorizadas; `CJ_ORDER_CREATE` e `CJ_ORDER_PAY` permanecem `false`.

A CJ também publica um [servidor MCP oficial](https://developers.cjdropshipping.com/en/api/api2/mcp.html)
compatível com Codex por `stdio`. Ele oferece valor para pesquisa operacional,
mas o pacote também expõe ferramentas de escrita, como criação de pedido,
disputa e carrinho. O Codex CLI 0.147.0 instalado permite registrar o servidor,
porém não oferece uma opção documentada no comando `codex mcp add` para restringir
ferramentas individualmente. Por isso o MCP **não foi instalado**: autenticar o
pacote completo ampliaria a superfície de escrita e violaria o gate humano.
Uma futura ativação depende de uma versão oficial read-only ou de uma allowlist
de ferramentas confirmada pelo Codex. O conector API existente não foi removido.

## Alibaba Dropshipping — prioridade 2

O catálogo oficial [ICBU-DropShipping](https://developer.alibaba.com/docs/api.htm?apiId=55331)
lista consulta de produto, cálculo de frete, criação de pedido, pagamento e
tracking. A Achilles implementa somente `alibaba.dropshipping.product.get`,
`alibaba.shipping.freight.calculate` e
`alibaba.order.logistics.tracking.get` atrás de `SupplierConnector`.

Para conexão real, o operador precisa concluir o processo oficial da
[Alibaba Open Platform](https://openapi.alibaba.com/):

1. registrar uma conta de desenvolvedor e aplicação;
2. obter App Key e App Secret;
3. solicitar e receber aprovação das permissões ICBU Dropshipping;
4. cadastrar a Redirect URI;
5. concluir OAuth/autorização do vendedor e armazenar os tokens em secret store;
6. validar as chamadas de leitura pelo Hub de Integrações.

Sem essas aprovações, o Admin exibe “PRECISA CONFIGURAR” e mantém a importação
assistida por link. Não há scraping nem simulação de conexão.

## AliExpress — prioridade 3

Os portais oficiais públicos consultados não disponibilizaram documentação
AE-Dropshipper verificável neste ambiente. Nomes de métodos encontrados somente
em fontes de terceiros não são usados como contrato de produção. Portanto a
integração aparece como “PRECISA CONFIGURAR” e aceita apenas o fluxo assistido
por link já existente.

Antes de uma integração real, são obrigatórios: aplicação aprovada no portal
oficial AliExpress, App Key/App Secret, autorização OAuth, escopos AE-Dropshipper
e documentação oficial acessível para consulta de produto, recomendações,
imagem, frete, pedido, detalhes e tracking. Pedido e pagamento não serão
habilitados nesta etapa mesmo após obter credenciais.

## Gates permanentes

```dotenv
CJ_ORDER_CREATE=false
CJ_ORDER_PAY=false
ALIBABA_ORDER_CREATE=false
ALIBABA_ORDER_PAY=false
```

Segredos ficam apenas no ambiente/secret store. Status `CONNECTED` requer uma
verificação real persistida em runtime; presença de variável ou fixture de teste
não é apresentada como conexão de produção.
