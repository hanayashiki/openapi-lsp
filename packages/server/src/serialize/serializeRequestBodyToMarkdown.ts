import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI RequestBody to markdown for hover display
 */
export function serializeRequestBodyToMarkdown(
  requestBody: OpenAPI.RequestBody,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  const printer = new Printer(0);

  printer.writeParts("##", name, `(requestBody)`);
  printer.newline();

  if (requestBody.description) {
    printer.writeParts("### Description");
    printer.newline();
    printer.writeParts(requestBody.description);
    printer.newline();
  }

  if (requestBody.required) {
    printer.writeParts("**Required**");
    printer.newline();
  }

  const content = requestBody.content;
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
