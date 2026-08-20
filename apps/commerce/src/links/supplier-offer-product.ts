import { defineLink } from "@medusajs/framework/utils";
import ProductModule from "@medusajs/medusa/product";
import SupplierDomainModule from "../modules/supplier-domain";
import { requireMedusaLinkable } from "./product-linkable";

export default defineLink(
  {
    linkable: SupplierDomainModule.linkable.supplierOffer,
    field: "product_id",
  },
  requireMedusaLinkable(ProductModule.linkable.product as unknown),
  { readOnly: true },
);
