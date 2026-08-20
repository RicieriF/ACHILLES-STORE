import type { MedusaResponse } from "@medusajs/framework/http";
import { AlibabaUrlError } from "@achilles/alibaba-connector";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { actorId, parseOrReply, type AdminRequest } from "../http";
import { createOrReuseDraft } from "./importer";
import { createImportInput, importListInput } from "./schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = parseOrReply(importListInput, request.query, response);
  if (!query) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const [drafts, count] = await service.listAndCountImportDrafts(
    query.status ? { status: query.status } : {},
    { skip: query.offset, take: query.limit, order: { created_at: "DESC" } },
  );
  response.json({ drafts, count, limit: query.limit, offset: query.offset });
}
export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(createImportInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  try {
    const result = await createOrReuseDraft(
      service,
      input.source_url,
      actorId(request),
    );
    response.status(result.reused ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof AlibabaUrlError) {
      response.status(400).json({ code: error.code, message: error.message });
      return;
    }
    throw error;
  }
}
