import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { isReference } from "./utils.js";
import { serializeRef } from "./serializeRef.js";
import { serializePrimitive } from "./serializePrimitive.js";
import { serializeObject } from "./serializeObject.js";
// oxlint-disable-next-line
import { serializeArray } from "./serializeArray.js";
import { serializeComposition } from "./serializeComposition.js";

// Main schema serializer - handles Schema only (not Reference)
function serializeSchema(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): void {
  const { printer } = ctx;

  // Depth limit reached
  if (ctx.currentDepth > ctx.maxDepth) {
    printer.write("...");
    return;
  }

  // Handle compositions first (they may not have type)
  if (schema.allOf && schema.allOf.length > 0) {
    serializeComposition(schema.allOf, "&", ctx);
    return;
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    serializeComposition(schema.oneOf, "|", ctx);
    return;
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    serializeComposition(schema.anyOf, "|", ctx);
    return;
  }

  // Infer type from structure if not explicit
  const type =
    schema.type ??
    (schema.properties ? "object" : schema.items ? "array" : undefined);

  switch (type) {
    case "object":
      serializeObject(schema, ctx);
      return;
    case "array":
      serializeArray(schema, ctx);
      return;
    case "string":
    case "integer":
    case "number":
    case "boolean":
    case "null":
      serializePrimitive(schema, ctx);
      return;
    default:
      // Handle enum without explicit type
      if (schema.enum) {
        serializePrimitive(schema, ctx);
        return;
      }
      printer.write("unknown");
  }
}

// Wrapper that handles both Schema and Reference
export function serializeSchemaOrRef(
  schema: OpenAPI.Schema | OpenAPI.Reference,
  ctx: SerializerContext
): void {
  if (isReference(schema)) {
    serializeRef(schema, ctx);
    return;
  }
  serializeSchema(schema, ctx);
}
