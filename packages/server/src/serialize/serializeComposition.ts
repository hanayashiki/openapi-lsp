import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { Printer } from "./Printer.js";
// oxlint-disable-next-line no-cycle
import { serializeSchemaOrRef } from "./serializeSchema.js";

const MAX_COMPOSITION_ITEMS = 3;

// Serialize composition (allOf, oneOf, anyOf)
export function serializeComposition(
  schemas: (OpenAPI.Schema | OpenAPI.Reference)[],
  operator: "&" | "|",
  ctx: SerializerContext
): void {
  const { printer } = ctx;

  // Limit to at most MAX_COMPOSITION_ITEMS items
  const truncated = schemas.length > MAX_COMPOSITION_ITEMS;
  const remainingCount = schemas.length - MAX_COMPOSITION_ITEMS;
  const schemasToSerialize = truncated
    ? schemas.slice(0, MAX_COMPOSITION_ITEMS)
    : schemas;

  // Serialize each schema to a temporary printer to get the string representation
  const serialized = schemasToSerialize.map((s) => {
    const tempPrinter = new Printer(0);
    serializeSchemaOrRef(s, {
      ...ctx,
      printer: tempPrinter,
      currentDepth: ctx.currentDepth + 1,
    });
    return tempPrinter.toString();
  });

  // Wrap complex types in parentheses if needed
  const parts = serialized.map((s) => {
    if (
      (operator === "&" && s.includes(" | ")) ||
      (operator === "|" && s.includes(" & "))
    ) {
      return `(${s})`;
    }
    return s;
  });

  // Add ellipsis if truncated
  if (truncated) {
    parts.push(`/* ... (${remainingCount} more) */`);
  }

  printer.write(parts.join(` ${operator} `));
}
