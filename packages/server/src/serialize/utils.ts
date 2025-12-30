import { OpenAPI } from "@openapi-lsp/core/openapi";

// Type guard for $ref
export function isReference(value: unknown): value is OpenAPI.Reference {
  return (
    typeof value === "object" &&
    value !== null &&
    "$ref" in value &&
    typeof (value as OpenAPI.Reference).$ref === "string"
  );
}

// Create indentation string
export function indent(level: number): string {
  return "  ".repeat(level);
}
