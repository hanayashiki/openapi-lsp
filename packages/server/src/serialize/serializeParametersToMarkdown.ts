import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an array of OpenAPI Parameters to markdown for hover display.
 * Groups parameters by their `in` location (path, query, header, cookie).
 *
 * Important: Only accepts resolved Parameters - caller must resolve $refs first.
 */
export function serializeParametersToMarkdown(
  parameters: OpenAPI.Parameter[],
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2 } = options;
  const printer = new Printer(0);

  printer.writeParts("##", "Parameters");
  printer.newline();

  // Group by `in`
  const groups: Record<string, OpenAPI.Parameter[]> = {
    path: [],
    query: [],
    header: [],
    cookie: [],
  };

  for (const param of parameters) {
    groups[param.in]?.push(param);
  }

  for (const [location, params] of Object.entries(groups)) {
    if (params.length === 0) continue;

    printer.writeParts("---");
    printer.newline();

    printer.writeParts("###", location);
    printer.newline();

    // Build synthetic object schema from parameters
    const properties: Record<string, OpenAPI.Schema | OpenAPI.Reference> = {};
    const required: string[] = [];

    for (const param of params) {
      if (param.schema) {
        properties[param.name] = param.schema;
      }
      if (param.required) {
        required.push(param.name);
      }
    }

    // Serialize as object
    printer.write("```typescript");
    printer.newline();
    serializeSchemaOrRef(
      { type: "object", properties, required } satisfies OpenAPI.Schema,
      { currentDepth: 0, maxDepth, printer }
    );
    printer.newline();
    printer.write("```");
    printer.newline();
  }

  return printer.toString();
}
