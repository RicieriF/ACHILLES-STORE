import type { MedusaResponse } from "@medusajs/framework/http";
import { actorId, type AdminRequest } from "../../../http";
import {
  convertImportDraft,
  ImportConversionError,
} from "../../../../../../workflows/convert-import-draft";

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const id = request.params.id;
  if (!id) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "ID do draft ausente" });
    return;
  }
  try {
    const conversion = await convertImportDraft(
      request.scope,
      id,
      actorId(request),
    );
    response.status(conversion.idempotent ? 200 : 201).json({ conversion });
  } catch (error) {
    if (error instanceof ImportConversionError) {
      const status =
        error.code === "CONVERSION_IN_PROGRESS" ||
        error.code === "CONVERSION_CONFLICT" ||
        error.code === "INCONSISTENT_CONVERSION"
          ? 409
          : error.code === "DRAFT_NOT_FOUND"
            ? 404
            : 422;
      response
        .status(status)
        .json({ code: error.code, message: error.message });
      return;
    }
    throw error;
  }
}
