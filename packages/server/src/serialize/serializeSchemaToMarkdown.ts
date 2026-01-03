import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeSchemaOrRef } from "./serializeSchema.js";

/**
 * Serialize an OpenAPI Schema to TypeScript-like markdown for hover display
 */
export function serializeSchemaToMarkdown(
  schema: OpenAPI.Schema,
  options: SerializeOptions = {}
): string {
  const { maxDepth = 2, name } = options;

  // Build markdown output
  const parts: string[] = [];

  // Add title/description if schema is not a reference
  if (schema.title) {
    parts.push(`**${schema.title}**`);
  }
  if (schema.description) {
    parts.push(schema.description);
  }

  // Serialize schema with printer (0 base indent for code block content)
  const printer = new Printer(0);
  const ctx: SerializerContext = {
    currentDepth: 0,
    maxDepth,
    printer,
  };

  serializeSchemaOrRef(schema, ctx);
  const serialized = printer.toString();

  // Add code block
  const nameOrInline = name ? `type ${name} = ` : "";
  parts.push(`\`\`\`typescript\n${nameOrInline}${serialized}\n\`\`\``);

  return parts.join("\n\n");
}
