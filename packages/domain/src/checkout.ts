import type { PublicCartDTO, PublicMoneyDTO } from "./public-catalog.js";
import type { DutiesMode, PublicShippingMethodDTO } from "./shipping.js";
import type { FulfillmentTaxMode } from "./payment.js";

export const checkoutStatuses = [
  "CART",
  "CUSTOMER",
  "ADDRESS",
  "SHIPPING",
  "REVIEW",
  "READY_FOR_PAYMENT",
  "PAYMENT_PENDING",
  "PAID",
  "PAYMENT_FAILED",
  "EXPIRED_SHIPPING",
  "REQUOTE_REQUIRED",
  "BLOCKED",
  "ERROR",
] as const;

export type CheckoutStatus = (typeof checkoutStatuses)[number];

export type PublicCheckoutCustomerDTO = {
  name: string;
  email: string;
  phone: string;
};

export type BrazilCheckoutAddressDTO = {
  postalCode: string;
  postalCodeFormatted: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  countryCode: "BR";
};

export type PublicCheckoutShippingGroupDTO = {
  id: string;
  label: string;
  itemLabels: readonly string[];
  methods: readonly PublicShippingMethodDTO[];
  selectedMethodId: string | null;
};

export type PublicCheckoutShippingSelectionDTO = {
  groupId: string;
  quoteId: string;
  methodName: string;
  price: PublicMoneyDTO;
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  dutiesMode: DutiesMode;
  dutiesNotice: string;
  expiresAt: string;
};

export type CheckoutTaxesDTO = {
  known: boolean;
  amount: PublicMoneyDTO | null;
  label: string;
};

export type CheckoutTotalsDTO = {
  products: PublicMoneyDTO;
  shippingByGroup: readonly {
    groupId: string;
    amount: PublicMoneyDTO;
  }[];
  shipping: PublicMoneyDTO;
  discounts: PublicMoneyDTO;
  taxes: CheckoutTaxesDTO;
  fulfillmentTaxMode: FulfillmentTaxMode;
  total: PublicMoneyDTO;
  currencyCode: "brl";
  capturedAt: string;
};

export type CheckoutReadinessDTO = {
  ready: boolean;
  reasons: readonly string[];
};

export type PublicCheckoutDTO = {
  id: string;
  cartId: string;
  status: CheckoutStatus;
  customer: PublicCheckoutCustomerDTO | null;
  address: BrazilCheckoutAddressDTO | null;
  cart: PublicCartDTO;
  shippingGroups: readonly PublicCheckoutShippingGroupDTO[];
  shippingSelections: readonly PublicCheckoutShippingSelectionDTO[];
  shipmentType: "SINGLE" | "MULTI_SHIPMENT";
  totals: CheckoutTotalsDTO | null;
  readiness: CheckoutReadinessDTO;
  expiresAt: string;
  updatedAt: string;
  notice: string | null;
};

export type FuturePaymentMethod = {
  type: "PIX" | "CARD" | "BOLETO";
  installments?: readonly { count: number; feeAmount: string; total: string }[];
};
