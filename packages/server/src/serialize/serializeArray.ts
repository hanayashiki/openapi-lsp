import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { Printer } from "./Printer.js";
// oxlint-disable-next-line
import { serializeSchemaOrRef } from "./serializeSchema.js";

// Serialize array schema
export function serializeArray(
  schema: OpenAPI.Schema,
  ctx: SerializerContext
): void {
  const { printer } = ctx;

  if (!schema.items) {
    printer.write("unknown[]");
    return;
  }

  // Serialize item type to a temporary printer to check complexity
  const tempPrinter = new Printer(0);
  serializeSchemaOrRef(schema.items, {
    ...ctx,
    printer: tempPrinter,
    currentDepth: ctx.currentDepth + 1,
  });
  const itemType = tempPrinter.toString();

  // Check if complex type (contains union, intersection, or object braces)
  const isComplex =
    itemType.includes(" | ") ||
    itemType.includes(" & ") ||
    itemType.includes("{");

  if (isComplex) {
    // For complex types, serialize directly to main printer for proper indentation
    printer.write("Array<");
    serializeSchemaOrRef(schema.items, {
      ...ctx,
      currentDepth: ctx.currentDepth + 1,
    });
    printer.write(">");
  } else {
    printer.write(`${itemType}[]`);
  }
}
