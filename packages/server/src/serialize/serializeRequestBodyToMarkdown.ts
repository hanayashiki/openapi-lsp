import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
import { isReference } from "./utils.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI RequestBody to markdown for hover display
 */
export function serializeRequestBodyToMarkdown(
  requestBody: OpenAPI.RequestBody | OpenAPI.Reference,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  // If it's a reference, just show the ref
  if (isReference(requestBody)) {
    return `\`\`\`typescript\n(requestBody) ${name}\n\`\`\``;
  }

  const parts: string[] = [];

  // Add description if present
  if (requestBody.description) {
    parts.push(requestBody.description);
  }

  // Add required status
  if (requestBody.required) {
    parts.push("**Required**");
  }

  // Get schema from content (use first media type's schema)
  const content = requestBody.content;
  const mediaTypes = Object.keys(content);

  // Show each media type with its schema
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
      const nameOrInline = name ? `type ${name} = ` : "";
      parts.push(
        `\`${mediaType}\`\n\`\`\`typescript\n${nameOrInline}${serialized}\n\`\`\``
      );
    }
  }

  return parts.join("\n\n");
}
