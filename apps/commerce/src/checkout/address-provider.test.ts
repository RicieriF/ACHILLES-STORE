import { describe, expect, it, vi } from "vitest";
import {
  ManualBrazilPostalAddressProvider,
  ViaCepAddressProvider,
} from "./address-provider";
describe("ViaCepAddressProvider", () => {
  it("falls back to manual when disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await new ViaCepAddressProvider(
        false,
        new ManualBrazilPostalAddressProvider(),
        fetcher,
      ).lookup("01310100"),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("caches safe successful lookups", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          logradouro: "Av. Paulista",
          bairro: "Bela Vista",
          localidade: "São Paulo",
          uf: "SP",
        }),
        { status: 200 },
      ),
    );
    const provider = new ViaCepAddressProvider(
      true,
      new ManualBrazilPostalAddressProvider(),
      fetcher,
    );
    expect((await provider.lookup("01310-100"))?.state).toBe("SP");
    await provider.lookup("01310100");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("returns the manual fallback on network failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    await expect(
      new ViaCepAddressProvider(
        true,
        new ManualBrazilPostalAddressProvider(),
        fetcher,
      ).lookup("01310100"),
    ).resolves.toBeNull();
  });
});
