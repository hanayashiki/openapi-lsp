import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { deriveIdentifierFromUri } from "@openapi-lsp/core/json-pointer";

// Extract type name from $ref path and serialize it
// e.g., "#/components/schemas/Pet" → "Pet"
export function serializeRef(
  ref: OpenAPI.Reference,
  ctx: SerializerContext
): void {
  const pointerResult = deriveIdentifierFromUri(ref.$ref as string, "file:///");

  ctx.printer.write(pointerResult.success ? pointerResult.data : "_");
}
