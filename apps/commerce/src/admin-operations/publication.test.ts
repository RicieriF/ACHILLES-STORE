import { describe, expect, it } from "vitest";
import {
  canPublishProduct,
  humanPublicationReasons,
  operatorPublicationBlockers,
} from "./publication";
import type { OperationalProductCandidate } from "./types";

const ready = (): OperationalProductCandidate => ({
  id: "prod_1",
  title: "Lanterna",
  handle: "lanterna",
  status: "draft",
  thumbnail: "https://example.invalid/lanterna.jpg",
  sku: "LANT-1",
  category: "Lanternas",
  categoryId: "pcat_1",
  retailPrice: 149,
  compareAtPrice: null,
  landedCost: 70,
  marginPercent: 53,
  stock: null,
  manageInventory: false,
  supplier: "Fornecedor",
  supplierId: "sup_1",
  offerStatus: "ACTIVE",
  provider: "CJ",
  origin: "https://example.invalid/source",
  offerId: "supoff_1",
  offerCount: 1,
  availability: "IN_STOCK",
  supplierAvailabilityQuantity: null,
  supplierLeadTimeDays: null,
  fulfillmentMode: "PRIVATE_LABEL_DROPSHIP",
  compliance: "CLEAR",
  commercialReadiness: "READY_FOR_REVIEW",
  pricingStatus: "PRICED",
  shippingStale: false,
  syncStatus: "SYNCED",
  lastSyncAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  featured: false,
  archived: false,
});

describe("operator publication checklist", () => {
  it("allows a complete draft", () => {
    expect(operatorPublicationBlockers(ready())).toEqual([]);
    expect(canPublishProduct(ready())).toBe(true);
  });

  it("lists human blockers without internal codes", () => {
    expect(
      operatorPublicationBlockers({
        ...ready(),
        retailPrice: null,
        pricingStatus: "INCOMPLETE",
        offerId: null,
        offerStatus: null,
        compliance: "PENDING",
        category: null,
      }),
    ).toEqual([
      "Defina o preço",
      "Vincule um fornecedor",
      "Aguarde a revisão",
      "Escolha uma categoria",
    ]);
  });

  it("translates catalog policy reasons", () => {
    expect(
      humanPublicationReasons(["PRICE_NOT_APPROVED", "COMPLIANCE_NOT_CLEAR"]),
    ).toEqual(["Defina o preço", "Aguarde a revisão"]);
  });
});
