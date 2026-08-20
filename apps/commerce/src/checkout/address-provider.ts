export type BrazilPostalAddressLookup = {
  postalCode: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export interface BrazilPostalAddressProvider {
  readonly provider: string;
  lookup(postalCode: string): Promise<BrazilPostalAddressLookup | null>;
  getHealth?(): "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";
}

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export class ViaCepAddressProvider implements BrazilPostalAddressProvider {
  readonly provider = "VIACEP" as const;
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: BrazilPostalAddressLookup | null }
  >();
  constructor(
    private readonly enabled: boolean,
    private readonly fallback: BrazilPostalAddressProvider = new ManualBrazilPostalAddressProvider(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {}
  getHealth() {
    return this.enabled ? ("HEALTHY" as const) : ("DISABLED" as const);
  }
  async lookup(postalCode: string): Promise<BrazilPostalAddressLookup | null> {
    const normalized = postalCode.replace(/\D/g, "");
    if (!this.enabled || !/^\d{8}$/.test(normalized))
      return await this.fallback.lookup(normalized);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > this.clock()) return cached.value;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2_500);
    try {
      const response = await this.fetcher(
        `https://viacep.com.br/ws/${normalized}/json/`,
        { signal: controller.signal, headers: { accept: "application/json" } },
      );
      if (!response.ok) return await this.fallback.lookup(normalized);
      const data = (await response.json()) as ViaCepResponse;
      const value = data.erro
        ? null
        : {
            postalCode: normalized,
            street: data.logradouro?.trim() || null,
            neighborhood: data.bairro?.trim() || null,
            city: data.localidade?.trim() || null,
            state: data.uf?.trim() || null,
          };
      this.cache.set(normalized, {
        value,
        expiresAt: this.clock() + 3_600_000,
      });
      return value;
    } catch {
      return await this.fallback.lookup(normalized);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ManualBrazilPostalAddressProvider implements BrazilPostalAddressProvider {
  readonly provider = "MANUAL" as const;

  async lookup(_postalCode: string): Promise<null> {
    await Promise.resolve();
    return null;
  }
}
