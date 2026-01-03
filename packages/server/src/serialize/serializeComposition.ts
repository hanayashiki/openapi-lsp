import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
import { Printer } from "./Printer.js";
// oxlint-disable-next-line no-cycle
import { serializeSchemaOrRef } from "./serializeSchema.js";

// Serialize composition (allOf, oneOf, anyOf)
export function serializeComposition(
  schemas: (OpenAPI.Schema | OpenAPI.Reference)[],
  operator: "&" | "|",
  ctx: SerializerContext
): void {
  const { printer } = ctx;

  // Serialize each schema to a temporary printer to get the string representation
  const serialized = schemas.map((s) => {
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

  printer.write(parts.join(` ${operator} `));
}
