import { OpenAPI } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./SpecDocument.js";
import { Position } from "vscode-languageserver-textdocument";
import { visit, isScalar } from "yaml";
import { positionToOffset } from "./utils.js";

export function getRefByPosition(
  spec: SpecDocument,
  position: Position
): OpenAPI.Reference | null {
  const offset = positionToOffset(spec.lineCounter, position);
  let result: OpenAPI.Reference | null = null;

  visit(spec.yamlAst, {
    Map(_key, node) {
      if (!node.range) return undefined;
      const [start, , end] = node.range;
      if (offset < start || offset > end) return visit.SKIP;

      const refPair = node.items.find(
        (pair) => isScalar(pair.key) && pair.key.value === "$ref"
      );
      if (refPair && isScalar(refPair.value)) {
        result = { $ref: refPair.value.value as string };
      }
      return undefined;
    },
  });

  return result;
}
