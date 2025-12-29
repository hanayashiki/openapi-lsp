import { OpenAPI } from "@openapi-lsp/core/openapi";
import { Analysis, Definition } from "./Analysis.js";
import { parseLocalRef } from "./parseLocalRef.js";

/**
 * Resolve a $ref to its Definition by looking up in analysis.definitions
 * Returns null if ref cannot be resolved
 */
export function resolveRef(
  ref: OpenAPI.Reference,
  analysis: Analysis
): Definition | null {
  const path = parseLocalRef(ref.$ref);
  if (!path) return null;

  return (
    analysis.definitions.find(
      (d) =>
        d.path.length === path.length && d.path.every((p, i) => p === path[i])
    ) ?? null
  );
}
