import type {
  ProviderShippingQuote,
  ShippingDestination,
  ShippingProviderCapabilities,
  ShippingQuoteProvider,
  ShippingQuoteRequest,
} from "@achilles/domain";

export class ShippingProviderUnavailableError extends Error {
  readonly retryable = false;
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = "ShippingProviderUnavailableError";
  }
}

export type ManualShippingMethod = Omit<
  ProviderShippingQuote,
  "provider" | "providerReference" | "expiresAt"
> & {
  ttlSeconds: number;
  reference?: string | undefined;
};

export class ManualShippingQuoteProvider implements ShippingQuoteProvider {
  readonly provider = "MANUAL";

  constructor(
    private readonly methods: readonly ManualShippingMethod[],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  supportsDestination(destination: ShippingDestination): boolean {
    return (
      destination.countryCode === "BR" && /^\d{8}$/.test(destination.postalCode)
    );
  }

  supportsProduct(): boolean {
    return (
      this.methods.length > 0 &&
      this.methods.every((method) => method.assumptions.length > 0)
    );
  }

  getCapabilities(): ShippingProviderCapabilities {
    return {
      provider: this.provider,
      health: this.supportsProduct() ? "HEALTHY" : "UNAVAILABLE",
      capabilities: ["LIVE_SHIPPING_QUOTE", "TRACKING", "ECONOMY", "EXPRESS"],
      reason: this.supportsProduct()
        ? "Configuração manual explícita"
        : "Nenhuma tabela manual configurada",
    };
  }

  quote(
    input: ShippingQuoteRequest,
  ): Promise<readonly ProviderShippingQuote[]> {
    if (!this.supportsDestination(input.destination) || !this.supportsProduct())
      return Promise.reject(
        new ShippingProviderUnavailableError(
          this.provider,
          "Cotação manual não configurada para este destino/produto",
        ),
      );
    return Promise.resolve(
      this.methods.map((method) => ({
        provider: this.provider,
        serviceCode: method.serviceCode,
        methodName: method.methodName,
        currency: method.currency,
        amount: method.amount,
        estimatedMinimumDays: method.estimatedMinimumDays,
        estimatedMaximumDays: method.estimatedMaximumDays,
        trackingSupported: method.trackingSupported,
        dutiesMode: method.dutiesMode,
        warnings: method.warnings,
        assumptions: method.assumptions,
        providerReference: method.reference ?? null,
        expiresAt: new Date(
          this.clock().getTime() + method.ttlSeconds * 1_000,
        ).toISOString(),
      })),
    );
  }
}

abstract class DisabledExternalShippingProvider implements ShippingQuoteProvider {
  abstract readonly provider: string;
  abstract readonly endpointNames: readonly string[];

  constructor(private readonly enabled: boolean) {}

  supportsDestination(): boolean {
    return false;
  }

  supportsProduct(): boolean {
    return false;
  }

  getCapabilities(): ShippingProviderCapabilities {
    return {
      provider: this.provider,
      health: this.enabled ? "UNAVAILABLE" : "DISABLED",
      capabilities: [],
      reason: this.enabled
        ? "Flag ativa, mas autorização oficial não está configurada"
        : "Feature flag desativada",
    };
  }

  quote(
    _input: ShippingQuoteRequest,
  ): Promise<readonly ProviderShippingQuote[]> {
    return Promise.reject(
      new ShippingProviderUnavailableError(
        this.provider,
        this.enabled
          ? "Integração oficial ainda não autorizada/configurada"
          : "Feature flag de frete desativada",
      ),
    );
  }
}

export class AlibabaShippingQuoteProvider extends DisabledExternalShippingProvider {
  readonly provider = "ALIBABA";
  readonly endpointNames = [
    "alibaba.shipping.freight.calculate",
    "alibaba.order.freight.calculate",
  ] as const;
}

export class CJShippingQuoteProvider extends DisabledExternalShippingProvider {
  readonly provider = "CJ";
  readonly endpointNames = [] as const;
}

export class CJShippingProvider extends CJShippingQuoteProvider {}
