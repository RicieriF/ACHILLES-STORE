import type {
  CustomerPaymentProvider,
  PaymentCapabilitiesDTO,
} from "@achilles/domain";
import { FakePaymentProvider } from "./test-provider";
import { MercadoPagoPaymentProvider } from "./mercado-pago-provider";

const enabled = (name: string): boolean => process.env[name] === "true";

export function resolvePaymentProvider(): CustomerPaymentProvider {
  if (enabled("PAYMENT_TEST_PROVIDER_ENABLED"))
    return new FakePaymentProvider();
  if (!enabled("MERCADO_PAGO_ENABLED"))
    throw new Error("PAYMENT_PROVIDER_DISABLED");
  return new MercadoPagoPaymentProvider({
    environment: process.env.MERCADO_PAGO_ENVIRONMENT,
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    publicKey:
      process.env.MERCADO_PAGO_PUBLIC_KEY ??
      process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
    pix: enabled("MERCADO_PAGO_PIX"),
    card: enabled("MERCADO_PAGO_CARD"),
    boleto: enabled("MERCADO_PAGO_BOLETO"),
  });
}

export function paymentCapabilities(): PaymentCapabilitiesDTO {
  try {
    return resolvePaymentProvider().getCapabilities();
  } catch {
    return {
      provider: "NONE",
      testMode: false,
      health: enabled("MERCADO_PAGO_ENABLED") ? "UNAVAILABLE" : "DISABLED",
      methods: { pix: false, card: false, boleto: false },
      publicKey: null,
    };
  }
}
