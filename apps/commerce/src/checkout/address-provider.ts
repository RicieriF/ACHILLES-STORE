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
}

export class ManualBrazilPostalAddressProvider implements BrazilPostalAddressProvider {
  readonly provider = "MANUAL" as const;

  async lookup(_postalCode: string): Promise<null> {
    await Promise.resolve();
    return null;
  }
}
