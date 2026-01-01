import { OpenAPI, OpenAPITag } from "@openapi-lsp/core/openapi";
import { serializeSchemaToMarkdown } from "./serializeSchemaToMarkdown.js";
import { serializeResponseToMarkdown } from "./serializeResponseToMarkdown.js";
import { serializeRequestBodyToMarkdown } from "./serializeRequestBodyToMarkdown.js";
import { serializeContentToMarkdown } from "./serializeContentToMarkdown.js";
import { serializeMediaTypeToMarkdown } from "./serializeMediaTypeToMarkdown.js";

/**
 * Serialize an OpenAPI value to markdown based on its nominal type.
 * Accepts string to avoid requiring callers to cast from SolveResult.getCanonicalNominal().
 */
export function serializeToMarkdown(
  nominal: OpenAPITag,
  value: unknown,
  name: string
): string {
  switch (nominal) {
    case "Schema":
      return serializeSchemaToMarkdown(value as OpenAPI.Schema, { name });
    case "Response":
      return serializeResponseToMarkdown(value as OpenAPI.Response, { name });
    case "RequestBody":
      return serializeRequestBodyToMarkdown(value as OpenAPI.RequestBody, {
        name,
      });
    case "Content":
      return serializeContentToMarkdown(value as OpenAPI.Content, { name });
    case "MediaType":
      return serializeMediaTypeToMarkdown(value as OpenAPI.MediaType, { name });
    default:
      // Fallback for other types
      return `**${nominal}**: ${name}`;
  }
}
