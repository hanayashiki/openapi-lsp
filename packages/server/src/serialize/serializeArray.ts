import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

// Serialize array schema
export function serializeArray(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): string {
  if (!schema.items) {
    return "unknown[]";
  }

  const itemType = serializeSchemaOrRef(schema.items, {
    ...ctx,
    currentDepth: ctx.currentDepth + 1,
  });

  // Use Array<T> for complex types, T[] for simple
  if (
    itemType.includes(" | ") ||
    itemType.includes(" & ") ||
    itemType.includes("{")
  ) {
    return `Array<${itemType}>`;
  }
  return `${itemType}[]`;
}
