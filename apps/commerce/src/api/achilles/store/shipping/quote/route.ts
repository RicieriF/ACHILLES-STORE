import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ShippingQuoteEngine } from "../../../../../shipping/engine";
import { ShippingRateLimiter } from "../../../../../shipping/resilience";
import { publicShippingInput, sendShippingError } from "../http";

const limiter = new ShippingRateLimiter(12, 60_000);

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const input = publicShippingInput.parse(request.body);
    const forwarded = request.headers["x-forwarded-for"];
    const client = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(",")[0]?.trim() ?? "local");
    const limiterKey = [
      client,
      input.postalCode,
      input.variantId ?? input.cartId,
    ].join(":");
    if (!limiter.consume(limiterKey)) {
      response.status(429).json({
        code: "SHIPPING_RATE_LIMITED",
        message: "Muitas cotações. Aguarde um minuto e tente novamente.",
      });
      return;
    }
    const engine = new ShippingQuoteEngine(request.scope);
    const result = input.cartId
      ? await engine.quoteCart({
          cartId: input.cartId,
          postalCode: input.postalCode,
        })
      : await engine.quoteProduct({
          variantId: input.variantId ?? "",
          quantity: input.quantity,
          postalCode: input.postalCode,
        });
    response.json({ quote: result.publicQuote });
  } catch (error) {
    sendShippingError(response, error);
  }
}
