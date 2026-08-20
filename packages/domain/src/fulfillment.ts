export const fulfillmentModes = [
  "PRIVATE_LABEL_DROPSHIP",
  "GENERIC_DROPSHIP",
  "BRAZIL_STOCK",
] as const;

export type FulfillmentMode = (typeof fulfillmentModes)[number];

export const primaryFulfillmentMode: FulfillmentMode = "PRIVATE_LABEL_DROPSHIP";
