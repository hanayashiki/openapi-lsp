import { OpenAPI } from "@openapi-lsp/core/openapi";
import { parseJsonPointer } from "@openapi-lsp/core/json-pointer";
import { Analysis, Definition } from "./Analysis.js";

/**
 * Resolve a $ref to its Definition by looking up in analysis.definitions
 * Returns null if ref cannot be resolved
 */
export function resolveRef(
  ref: OpenAPI.Reference,
  analysis: Analysis
): Definition | null {
  const parseResult = parseJsonPointer(ref.$ref);
  if (!parseResult.success) return null;

  const path = parseResult.data;

  return (
    analysis.definitions.find(
      (d) =>
        d.path.length === path.length && d.path.every((p, i) => p === path[i])
    ) ?? null
  );
}
