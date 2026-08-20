import { Module } from "@medusajs/framework/utils";
import SupplierDomainModuleService from "./service";

export const SUPPLIER_DOMAIN_MODULE = "supplier_domain";

export default Module(SUPPLIER_DOMAIN_MODULE, {
  service: SupplierDomainModuleService,
});
