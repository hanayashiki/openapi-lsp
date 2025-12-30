import { OpenAPI } from "@openapi-lsp/core/openapi";

// Extract type name from $ref path and serialize it
// e.g., "#/components/schemas/Pet" → "Pet"
export function serializeRef(ref: OpenAPI.Reference): string {
  const parts = ref.$ref.split("/");
  return parts[parts.length - 1];
}
