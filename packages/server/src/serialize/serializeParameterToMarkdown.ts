import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI Parameter to markdown for hover display
 */
export function serializeParameterToMarkdown(
  parameter: OpenAPI.Parameter,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2 } = options;
  const printer = new Printer(0);

  printer.writeParts("##", parameter.name, `(parameter)`);
  printer.newline();

  // Show location: query, header, path, cookie
  printer.write(`**in:** \`${parameter.in}\``);
  printer.newline();

  if (parameter.required) {
    printer.write("**Required**");
    printer.newline();
  }

  if (parameter.description) {
    printer.writeParts("### Description");
    printer.newline();
    printer.write(parameter.description);
    printer.newline();
  }

  if (parameter.schema) {
    printer.writeParts("### Schema");
    printer.newline();
    printer.write("```typescript");
    printer.newline();
    serializeSchemaOrRef(parameter.schema, {
      currentDepth: 0,
      maxDepth,
      printer,
    });
    printer.newline();
    printer.write("```");
    printer.newline();
  }

  return printer.toString();
}
