import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
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

  const parts: string[] = [];

  if (name) {
    parts.push(`### ${name}`);
  }

  if (response.description) {
    parts.push(response.description);
  }

  const content = response.content;
  if (content) {
    const mediaTypes = Object.keys(content);

    for (const mediaType of mediaTypes) {
      const mediaTypeObj = content[mediaType];
      const schema = mediaTypeObj?.schema;

      if (schema) {
        const ctx: SerializerContext = {
          currentDepth: 0,
          maxDepth,
          indent: 0,
        };

        const serialized = serializeSchemaOrRef(schema, ctx);
        parts.push(
          `\`${mediaType}\`\n\`\`\`typescript\n${serialized}\n\`\`\``
        );
      }
    }
  }

  return parts.join("\n\n");
}
