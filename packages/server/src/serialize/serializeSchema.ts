import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { isReference } from "./utils.js";
import { serializeRef } from "./serializeRef.js";
import { serializePrimitive } from "./serializePrimitive.js";
import { serializeObject } from "./serializeObject.js";
import { serializeArray } from "./serializeArray.js";
import { serializeComposition } from "./serializeComposition.js";

// Main schema serializer - handles Schema only (not Reference)
function serializeSchema(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): string {
  // Depth limit reached
  if (ctx.currentDepth > ctx.maxDepth) {
    return "...";
  }

  // Handle compositions first (they may not have type)
  if (schema.allOf && schema.allOf.length > 0) {
    return serializeComposition(schema.allOf, "&", ctx);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return serializeComposition(schema.oneOf, "|", ctx);
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return serializeComposition(schema.anyOf, "|", ctx);
  }

  // Infer type from structure if not explicit
  const type =
    schema.type ??
    (schema.properties ? "object" : schema.items ? "array" : undefined);

  switch (type) {
    case "object":
      return serializeObject(schema, ctx);
    case "array":
      return serializeArray(schema, ctx);
    case "string":
    case "integer":
    case "number":
    case "boolean":
    case "null":
      return serializePrimitive(schema);
    default:
      // Handle enum without explicit type
      if (schema.enum) {
        return serializePrimitive(schema);
      }
      return "unknown";
  }
}

// Wrapper that handles both Schema and Reference
export function serializeSchemaOrRef(
  schema: OpenAPI.Schema | OpenAPI.Reference,
  ctx: SerializerContext
): string {
  if (isReference(schema)) {
    return serializeRef(schema);
  }
  return serializeSchema(schema, ctx);
}
