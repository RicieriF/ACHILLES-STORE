# Conexões de fornecedores

O Hub em **ACHILLES · Fornecedores** separa a plataforma (CJ/Alibaba), o fornecedor e cada `SupplierOffer`. Um produto pode manter várias ofertas; a importação nunca escolhe automaticamente uma oferta principal.

## CJdropshipping

Crie/consulte sua API Key na área de autorização da conta CJ e armazene-a somente no secret store do ambiente. Configure:

```dotenv
CJ_ENABLED=true
CJ_API_KEY=
CJ_ACCESS_TOKEN=
CJ_REFRESH_TOKEN=
CJ_BASE_URL=https://developers.cjdropshipping.com
```

O conector usa a API V2 oficial, mantém o token em memória, respeita a data de expiração devolvida pelo provedor e tenta refresh antes de solicitar um novo token pela API Key. O Admin recebe somente marcadores de configuração e erros sanitizados. Use **Testar conexão** no Hub antes de abrir o catálogo.

Consultas suportadas: Product List V2, detalhes, variantes, estoque com `last_checked_at`, warehouses globais, cálculo de frete e o endpoint atual `logistic/trackInfo`. Estoque e frete usam cache curto ou nenhum cache; warehouses usam cache maior. Respostas do provedor não são garantias comerciais.

## Alibaba

Crie uma aplicação na Alibaba Open Platform, solicite as permissões necessárias e mantenha as credenciais no secret store:

```dotenv
ALIBABA_ENABLED=true
ALIBABA_APP_KEY=
ALIBABA_APP_SECRET=
ALIBABA_ACCESS_TOKEN=
ALIBABA_REFRESH_TOKEN=
ALIBABA_API_BASE_URL=https://eco.taobao.com/router/rest
ALIBABA_HEALTHCHECK_PRODUCT_ID=
ALIBABA_OAUTH_REDIRECT_URI=
```

Cadastre a aplicação no Alibaba.com Open Platform, solicite as permissões ICBU Dropshipping e configure a Redirect URI exatamente como registrada. O fluxo de authorization code usa callback server-side e nunca devolve o access token ao Admin. Depois da autorização, configure um Product ID acessível para o health check e use **Testar conexão**.

O sistema não simula autorização: sem token válido e uma chamada oficial autorizada, o status não será `CONNECTED`. Permissões ausentes aparecem como **Permissão necessária**. Não é feito scraping. A consulta comercial é por Product ID/URL porque uma permissão oficial de busca geral não foi estabelecida para esta aplicação.

Métodos oficiais preparados: `alibaba.dropshipping.product.get`, `alibaba.shipping.freight.calculate` e `alibaba.order.logistics.tracking.get`. A leitura de produto cria um draft de importação com revisão humana e proteção contra duplicidade por provider + Product ID; plataforma, fornecedor real e `SupplierOffer` permanecem entidades separadas.

## Bloqueios obrigatórios

Em todos os ambientes desta missão:

```dotenv
CJ_ORDER_CREATE=false
CJ_ORDER_PAY=false
ALIBABA_ORDER_CREATE=false
ALIBABA_ORDER_PAY=false
```

Não há compra, pagamento ou fulfillment automático. Produtos obtidos de fornecedores devem nascer como `DRAFT`, passar por pricing, compliance e aprovação humana antes da publicação.
