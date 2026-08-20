# Arquitetura até a TASK 005

O projeto é um monorepo pnpm/Turborepo. `apps/storefront` é o canal Next.js em pt-BR. `apps/commerce` é o Medusa v2 com Admin. Contratos independentes ficam em `packages/domain`, validação de ambiente em `packages/config` e fornecedores atrás de `SupplierConnector`.

## Commerce core e persistência

PostgreSQL é o único banco suportado. O Compose usa PostgreSQL 17 e `DATABASE_URL` aceita somente `postgres`/`postgresql`. Módulos nativos do Medusa continuam responsáveis por Products, Variants, Inventory, Carts, Customers e Orders.

O módulo `supplier_domain` persiste apenas conceitos próprios:

- `Supplier`: identidade e provider independentes do Alibaba.
- `SupplierOffer`: referencia `product_id` do Medusa, sem duplicar o produto; vários offers podem apontar para o mesmo produto.
- Um índice parcial permite no máximo um `SupplierOffer.is_primary=true` por produto.
- `SupplierVariantMap`: associa variantes internas aos SKUs/IDs do fornecedor.
- `BrandingProfile`: instruções e custos de private label como strings decimais.
- `ProductPolicy`: fulfillment mode, sensibilidade e compliance do produto.
- `AuditEvent`: trilha extensível de ações administrativas sem segredos.
- `ImportDraft`: preserva dados brutos e sugestões normalizadas sem criar Product.
- `ImportAttempt`: snapshot essencial e limitado de cada tentativa, com método,
  resultado, erro e versões do parser/normalizador.
- `CostQuote`: custos disponíveis e parcelas brasileiras ainda pendentes;
  nunca é tratado como preço de venda.

Links somente de leitura expõem `SupplierOffer -> Product` e `ProductPolicy -> Product`. URL, título, descrição e variantes públicas continuam pertencendo ao Product nativo e não mudam quando o fornecedor é substituído.

## Brasil e compliance

O seed configura canal `Achilles Store Brasil`, região `Brasil / BRL`, país `br`, moeda `brl`, cinco categorias outdoor e dois produtos fictícios. Locale e timezone são configurações de ambiente. Nenhuma regra tributária foi criada.

`ProductPolicy` suporta `PRIVATE_LABEL_DROPSHIP`, `GENERIC_DROPSHIP` e `BRAZIL_STOCK`. Sensibilidade `EDGED_TOOL` exige `REVIEW_REQUIRED` ou `BLOCKED`; `CONTROLLED_ITEM` permanece bloqueado pelo domínio. Itens controlados não fazem parte do seed/MVP.

## Operação

1. `pnpm docker:up`
2. `pnpm db:migrate`
3. `pnpm seed`
4. `pnpm dev`

`/health` é liveness. `/ready` consulta PostgreSQL e confirma as tabelas próprias; nunca retorna ready quando o banco está indisponível ou a migração está incompleta.

## Admin e ambiente

As customizações usam UI routes nativas do Medusa, um widget em
`product.details` e APIs autenticadas em `/admin/achilles/*`. O módulo
`supplier_domain` permanece como fonte única de suppliers, offers, branding,
políticas e auditoria. Trocar a oferta principal nunca altera nem remove Product.

## Importador Alibaba seguro

O Admin e suas rotas dependem de `SupplierConnector`; somente
`AlibabaConnector` conhece a fonte Alibaba. O fluxo termina em `ImportDraft
APPROVED`: isso significa apenas dados revisados para a próxima etapa. Nenhum
Product, SupplierOffer, pedido ou pagamento é criado.

`ALIBABA_PRODUCT_IMPORT=false` é o padrão. Nesse modo a URL HTTPS é validada e
um draft manual `NEEDS_REVIEW` é persistido sem chamada externa. Quando a flag
é deliberadamente ativada, o conector usa somente página pública e JSON-LD
limitado; não contorna login, CAPTCHA, rate limit ou anti-bot. Ausência de dados
gera alertas e edição humana, nunca conteúdo inventado.

A barreira SSRF aceita apenas `https://www.alibaba.com`, rejeita IP, localhost,
DNS privado e redirect fora da allowlist. Coleta possui timeout, limite de
resposta, retry transitório limitado e redirect manual. Lock/cooldown local por
URL impede concorrência; poderá ser substituído por backend distribuído.

Normalização determinística mantém `raw → normalized`, padroniza whitespace,
moeda, decimal, MOQ, especificações e variantes. A triagem preliminar marca
lâminas como `REVIEW_REQUIRED` e itens controlados como `BLOCKED`; não é parecer
jurídico. Draft bloqueado não pode ser aprovado. A deduplicação reutiliza draft
ativo pela URL canônica e preserva o histórico de tentativas.

O `.env` da raiz é localizado pelo marcador do workspace. Apps não mantêm
cópias locais de segredos. Fake Redis, Local Event Bus e locking em memória são
somente opções de desenvolvimento; produção deverá usar implementações duráveis.

## Conversão para catálogo interno

Uma ação Admin confirmada converte apenas `ImportDraft APPROVED` e não bloqueado
em Product oficial Medusa `DRAFT`, sem sales channel e sem preços de variante.
O workflow aplica compensações reversas se SupplierOffer, VariantMap, CostQuote,
ProductPolicy ou proveniência falharem. Constraints únicas e lock por draft
impedem duplicação concorrente.

A proveniência usa `ImportDraft.converted_product_id`,
`SupplierOffer.import_draft_id`, `raw_source_reference` e
`ProductPolicy.import_draft_id`. Supplier desconhecido reutiliza um único
registro inativo `[PENDENTE]`, sem nome empresarial inventado. A oferta nasce
inativa e private label permanece não confirmado.

`commercial_readiness` é separado do readiness técnico: `PRICING_REQUIRED` para
triagem limpa e `COMPLIANCE_REQUIRED` para lâminas. Item `BLOCKED` não converte.
Uma proteção de API impede mudar Product importado para `published` nesta etapa.
O cálculo BRL somente existe após premissas explícitas no Pricing Engine.

## Pricing Engine e snapshots

O módulo `pricing` recebe somente premissas administrativas validadas. Ele não
chama Alibaba, gateway ou provider FX externo.

```text
SupplierOffer → CostQuote (estado atual) → PricingSnapshot v1, v2, ...
                                               └── aprovação humana/ator
```

`PricingSnapshot` preserva inputs, outputs, FX, estratégia tributária, versão do
motor, premissas, warnings e ator. Recalcular adiciona uma versão e nunca apaga
a anterior. O preço aprovado aponta para o snapshot aprovado; premissas novas
marcam o estado atual como `STALE` sem sobrescrever essa decisão.

As fronteiras são `FxRateProvider` (`MANUAL` implementado, externo futuro),
`ImportTaxStrategy` (`CUSTOMER_AS_IMPORTER`, `MERCHANT_AS_IMPORTER` e
`MANUAL_QUOTE`) e os rateios de frete `PER_UNIT`, `BY_QUANTITY` e `MANUAL`.
Tributação e frete são estimativas explícitas. A aritmética usa strings decimais,
`BigInt`, divisão e arredondamento half-up explícito.

Após aprovação, compliance `CLEAR` avança `commercial_readiness` para
`READY_FOR_REVIEW`; revisão pendente continua `COMPLIANCE_REQUIRED` e bloqueio
continua `BLOCKED`. Nenhuma operação de pricing altera Product status, sales
channel ou prices do Medusa.

## Limites

- Não há integração ou simulação de sucesso Alibaba.
- A coleta pública é conservadora e pode terminar incompleta; o fallback manual
  é o caminho suportado.
- O rate limiting desta etapa é local ao processo, não distribuído.
- Não há compra/pagamento de fornecedor, Mercado Pago ou cálculo fiscal.
- O catálogo existente é exclusivamente fictício e de desenvolvimento.
- Logística de checkout e inventário em localização física serão configurados em tarefa posterior.
