import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions } from "./types.js";
import { serializeRef } from "./serializeRef.js";

/**
 * Serialize an OpenAPI Reference to markdown for hover display
 */
export function serializeRefToMarkdown(
  ref: OpenAPI.Reference,
  options: SerializeOptions = {}
): string {
  const { name } = options;
  const typeName = serializeRef(ref);

  const prefix = name ? `type ${name} = ` : "";
  return `\`\`\`typescript\n${prefix}${typeName}\n\`\`\``;
}
