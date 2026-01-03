import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI Content (Record<string, MediaType>) to markdown for hover display.
 * Displays each content type's schema one by one.
 */
export function serializeContentToMarkdown(
  content: OpenAPI.Content,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  const printer = new Printer(0);

  printer.writeParts("##", name, "(content)");
  printer.newline();

  const mediaTypes = Object.keys(content);

  for (const mediaType of mediaTypes) {
    const mediaTypeObj = content[mediaType];
    const schema = mediaTypeObj?.schema;

    printer.write(`\`${mediaType}\``);
    printer.newline();

    if (schema) {
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
  }

  return printer.toString();
}
