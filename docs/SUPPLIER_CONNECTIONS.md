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
```

O sistema não simula autorização: sem token válido e uma chamada oficial autorizada, o status não será `CONNECTED`. Permissões ausentes aparecem como **Permissão necessária**. Não é feito scraping de conta.

## Bloqueios obrigatórios

Em todos os ambientes desta missão:

```dotenv
CJ_ORDER_CREATE=false
CJ_ORDER_PAY=false
ALIBABA_ORDER_CREATE=false
ALIBABA_ORDER_PAY=false
```

Não há compra, pagamento ou fulfillment automático. Produtos obtidos de fornecedores devem nascer como `DRAFT`, passar por pricing, compliance e aprovação humana antes da publicação.
