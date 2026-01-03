import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI MediaType to markdown for hover display
 */
export function serializeMediaTypeToMarkdown(
  mediaType: OpenAPI.MediaType,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  const printer = new Printer(0);

  printer.writeParts("##", name, `(media type)`);
  printer.newline();

  const schema = mediaType?.schema;

  if (schema) {
    printer.writeParts("### Content");
    printer.newline();

    printer.write("```typescript");
    printer.newline();
    serializeSchemaOrRef(schema, {
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
