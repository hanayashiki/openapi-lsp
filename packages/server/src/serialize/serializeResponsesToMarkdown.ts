import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";
import { isReference } from "./utils.js";
import { serializeRef } from "./serializeRef.js";

/**
 * Serialize OpenAPI Responses to markdown for hover display.
 */
export function serializeResponsesToMarkdown(
  responses: OpenAPI.Responses,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2 } = options;

  const printer = new Printer(0);

  printer.writeParts("##", "Responses");
  printer.newline();

  for (const [status, response] of Object.entries(responses)) {
    printer.writeParts("---");
    printer.newline();

    printer.writeParts("###", "Status", status);
    printer.newline();

    // Handle $ref
    if (isReference(response)) {
      printer.write("```typescript");
      printer.newline();

      serializeRef(response, { currentDepth: 0, maxDepth, printer });
      printer.newline();

      printer.write("```");
      printer.newline();
      continue;
    }

    if (response.description) {
      printer.write(`#### Description`);
      printer.newline();

      printer.write(response.description);
      printer.newline();
      printer.newline();
    }

    const content = response.content;
    if (content) {
      const mediaTypes = Object.keys(content);
      const hasMultipleMediaTypes = mediaTypes.length > 1;

      if (hasMultipleMediaTypes) {
        printer.write(`#### Contents`);
        printer.newline();
      } else {
        printer.write(`#### Content`);
        printer.newline();
      }

      for (const mediaType of mediaTypes) {
        const mediaTypeObj = content[mediaType];
        const schema = mediaTypeObj?.schema;

        // Only show media type label if there are multiple
        if (hasMultipleMediaTypes) {
          printer.write(`\`${mediaType}\``);
          printer.newline();
        }

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
  }

  return printer.toString();
}
