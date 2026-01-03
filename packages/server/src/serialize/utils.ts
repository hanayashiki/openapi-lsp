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

// Valid JavaScript/TypeScript identifier regex
const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Format a property name for TypeScript output.
 * Returns the name as-is if it's a valid identifier, otherwise quotes it.
 */
export function formatPropertyName(name: string): string {
  if (VALID_IDENTIFIER.test(name)) {
    return name;
  }
  return JSON.stringify(name);
}
