import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI Response to markdown for hover display.
 * The name is expected to be the status code (e.g., "200", "404").
 */
export function serializeResponseToMarkdown(
  response: OpenAPI.Response,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  const printer = new Printer(0);

  printer.writeParts("##", name, `(response)`);
  printer.newline();

  if (response.description) {
    printer.writeParts("### Description");
    printer.newline();
    printer.writeParts(response.description);
    printer.newline();
  }

  const content = response.content;
  if (content) {
    const mediaTypes = Object.keys(content);

    printer.writeParts(
      mediaTypes.length >= 2
        ? "### Contents"
        : mediaTypes.length === 1
        ? "### Content"
        : ""
    );

    printer.newline();

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
  }

  return printer.toString();
}
