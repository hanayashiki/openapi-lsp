import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializerContext } from "./types.js";
// oxlint-disable-next-line no-cycle
import { serializeSchemaOrRef } from "./serializeSchema.js";

// Serialize composition (allOf, oneOf, anyOf)
export function serializeComposition(
  schemas: (OpenAPI.Schema | OpenAPI.Reference)[],
  operator: "&" | "|",
  ctx: SerializerContext
): string {
  const serialized = schemas.map((s) =>
    serializeSchemaOrRef(s, { ...ctx, currentDepth: ctx.currentDepth + 1 })
  );

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

  return parts.join(` ${operator} `);
}
