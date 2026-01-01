import { OpenAPI } from "@openapi-lsp/core/openapi";
import { parseJsonPointer } from "@openapi-lsp/core/json-pointer";
import { ParseResult, Definition } from "./Analysis.js";

/**
 * Resolve a $ref to its Definition by looking up in parseResult.definitions
 * Returns null if ref cannot be resolved
 */
export function resolveRef(
  ref: OpenAPI.Reference,
  parseResult: ParseResult
): Definition | null {
  const pointerParseResult = parseJsonPointer(ref.$ref);
  if (!pointerParseResult.success) return null;

  const path = pointerParseResult.data;

  return (
    parseResult.definitions.find(
      (d) =>
        d.path.length === path.length && d.path.every((p, i) => p === path[i])
    ) ?? null
  );
}
