import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI MediaType to markdown for hover display
 */
export function serializeMediaTypeToMarkdown(
  mediaType: OpenAPI.MediaType,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  const parts: string[] = [];

  // Get schema from content (use first media type's schema)

  const schema = mediaType?.schema;

  if (schema) {
    const ctx: SerializerContext = {
      currentDepth: 0,
      maxDepth,
      indent: 0,
    };

    const serialized = serializeSchemaOrRef(schema, ctx);

    parts.push(
      `\`${name}\`\n\`\`\`typescript\n${serialized}\n\`\`\``
    );
  }

  return parts.join("\n\n");
}
