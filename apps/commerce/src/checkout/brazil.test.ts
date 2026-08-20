import { describe, expect, it } from "vitest";
import {
  checkoutAddressSchema,
  checkoutCustomerSchema,
  formatBrazilPostalCode,
  normalizeBrazilPhone,
} from "./brazil";
import { ManualBrazilPostalAddressProvider } from "./address-provider";

describe("checkout brasileiro", () => {
  it.each([
    ["(27) 99999-9999", "+5527999999999"],
    ["27 3333-4444", "+552733334444"],
    ["+55 11 98888-7777", "+5511988887777"],
  ])("normaliza telefone %s em E.164", (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it.each(["123", "00123456789", "+1 212 555 0100"])(
    "rejeita telefone não brasileiro %s",
    (input) => {
      expect(() => normalizeBrazilPhone(input)).toThrow();
    },
  );

  it("normaliza contato e email sem exigir conta ou CPF", () => {
    const customer = checkoutCustomerSchema.parse({
      name: "  Maria da Silva  ",
      email: "MARIA@EXAMPLE.COM",
      phone: "27999999999",
    });
    expect(customer).toEqual({
      name: "Maria da Silva",
      email: "maria@example.com",
      phone: "+5527999999999",
    });
    expect(customer).not.toHaveProperty("cpf");
  });

  it.each(["29216-090", "29216090"])(
    "aceita e normaliza CEP %s",
    (postalCode) => {
      const address = checkoutAddressSchema.parse(validAddress(postalCode));
      expect(address.postalCode).toBe("29216090");
      expect(formatBrazilPostalCode(address.postalCode)).toBe("29216-090");
    },
  );

  it.each(["ES", "sp", "DF", "TO"])("aceita UF válida %s", (state) => {
    expect(
      checkoutAddressSchema.parse(validAddress("29216090", state)).state,
    ).toBe(state.toUpperCase());
  });

  it.each(["XX", "NY", "E", "ESP"])("rejeita UF inválida %s", (state) => {
    expect(() =>
      checkoutAddressSchema.parse(validAddress("29216090", state)),
    ).toThrow();
  });

  it("persiste país BR e complemento opcional normalizado", () => {
    expect(checkoutAddressSchema.parse(validAddress("29216090"))).toMatchObject(
      {
        countryCode: "BR",
        complement: null,
        city: "Guarapari",
      },
    );
  });

  it("mantém checkout operacional com provider MANUAL", async () => {
    const provider = new ManualBrazilPostalAddressProvider();
    expect(provider.provider).toBe("MANUAL");
    await expect(provider.lookup("29216090")).resolves.toBeNull();
  });
});

function validAddress(postalCode: string, state = "ES") {
  return {
    postalCode,
    street: "Rua da Praia",
    number: "42",
    complement: "",
    neighborhood: "Centro",
    city: "Guarapari",
    state,
    countryCode: "BR",
  };
}
