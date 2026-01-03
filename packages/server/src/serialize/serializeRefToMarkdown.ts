import { OpenAPI } from "@openapi-lsp/core/openapi";
import type { SerializeOptions, SerializerContext } from "./types.js";
import { Printer } from "./Printer.js";
import { serializeRef } from "./serializeRef.js";

/**
 * Serialize an OpenAPI Reference to markdown for hover display
 */
export function serializeRefToMarkdown(
  ref: OpenAPI.Reference,
  options: SerializeOptions = {}
): string {
  const { name, maxDepth = 2 } = options;

  const printer = new Printer(0);
  const ctx: SerializerContext = {
    currentDepth: 0,
    maxDepth,
    printer,
  };

  serializeRef(ref, ctx);
  const typeName = printer.toString();

  const prefix = name ? `type ${name} = ` : "";
  return `\`\`\`typescript\n${prefix}${typeName}\n\`\`\``;
}
