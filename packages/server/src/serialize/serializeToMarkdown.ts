import { OpenAPI, OpenAPITag } from "@openapi-lsp/core/openapi";
import { serializeSchemaToMarkdown } from "./serializeSchemaToMarkdown.js";
import { serializeResponseToMarkdown } from "./serializeResponseToMarkdown.js";
import { serializeRequestBodyToMarkdown } from "./serializeRequestBodyToMarkdown.js";
import { serializeContentToMarkdown } from "./serializeContentToMarkdown.js";
import { serializeMediaTypeToMarkdown } from "./serializeMediaTypeToMarkdown.js";
import { serializeResponsesToMarkdown } from "./serializeResponsesToMarkdown.js";
import { serializeParameterToMarkdown } from "./serializeParameterToMarkdown.js";
import { serializeParametersToMarkdown } from "./serializeParametersToMarkdown.js";
import { serializeOperationToMarkdown } from "./serializeOperationToMarkdown.js";
import { serializePathItemToMarkdown } from "./serializePathItemToMarkdown.js";

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
    case "Responses":
      return serializeResponsesToMarkdown(value as OpenAPI.Responses, { name });
    case "RequestBody":
      return serializeRequestBodyToMarkdown(value as OpenAPI.RequestBody, {
        name,
      });
    case "Content":
      return serializeContentToMarkdown(value as OpenAPI.Content, { name });
    case "MediaType":
      return serializeMediaTypeToMarkdown(value as OpenAPI.MediaType, { name });
    case "Parameter":
      return serializeParameterToMarkdown(value as OpenAPI.Parameter, { name });
    case "Parameters":
      return serializeParametersToMarkdown(value as OpenAPI.Parameter[], {
        name,
      });
    case "Operation":
      return serializeOperationToMarkdown(value as OpenAPI.Operation, {
        name,
      });
    case "PathItem":
      return serializePathItemToMarkdown(value as OpenAPI.PathItem, {
        name,
      });
    default:
      // Fallback for other types
      return `**${nominal}**: ${name}${
        value && Array.isArray(value)
          ? ` (${value.length} item${value.length >= 2 ? "s" : ""})`
          : value && typeof value === "object"
          ? ((length) => ` (${length} key${length >= 2 ? "s" : ""})`)(
              Object.keys(value).length
            )
          : ``
      }`;
  }
}
