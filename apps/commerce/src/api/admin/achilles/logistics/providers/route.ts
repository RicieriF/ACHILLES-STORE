import { parseFeatureFlags } from "@achilles/config";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCatalogService } from "../../../../../catalog/service";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";
import {
  AlibabaShippingQuoteProvider,
  CJShippingQuoteProvider,
} from "../../../../../shipping/providers";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const flags = parseFeatureFlags(process.env);
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const [catalog, quotes] = await Promise.all([
    new PublicCatalogService(request.scope).getCatalog(),
    service.listShippingQuotes({}, { take: 20, order: { created_at: "DESC" } }),
  ]);
  response.json({
    providers: [
      {
        provider: "MANUAL",
        health: "HEALTHY",
        capabilities: ["LIVE_SHIPPING_QUOTE", "TRACKING", "ECONOMY", "EXPRESS"],
        reason: "Tabelas explícitas por SupplierOffer",
      },
      new AlibabaShippingQuoteProvider(
        flags.ALIBABA_FREIGHT_QUOTE,
      ).getCapabilities(),
      new CJShippingQuoteProvider(flags.CJ_SHIPPING_QUOTE).getCapabilities(),
    ],
    flags: {
      ALIBABA_FREIGHT_QUOTE: flags.ALIBABA_FREIGHT_QUOTE,
      ALIBABA_ORDER_CREATE: flags.ALIBABA_ORDER_CREATE,
      ALIBABA_ORDER_PAY: flags.ALIBABA_ORDER_PAY,
      CJ_SHIPPING_QUOTE: flags.CJ_SHIPPING_QUOTE,
      CJ_ORDER_CREATE: flags.CJ_ORDER_CREATE,
      CJ_ORDER_PAY: flags.CJ_ORDER_PAY,
    },
    products: catalog.products.map((product) => ({
      id: product.id,
      title: product.title,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        title: variant.title,
      })),
    })),
    recentQuotes: quotes,
  });
}
