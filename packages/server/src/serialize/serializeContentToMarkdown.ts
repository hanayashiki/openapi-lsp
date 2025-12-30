import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
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

  const parts: string[] = [];

  if (name) {
    parts.push(`### ${name}`);
  }

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

  return parts.join("\n\n");
}
