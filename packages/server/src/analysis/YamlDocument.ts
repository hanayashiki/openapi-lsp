import {
  Document,
  LineCounter,
  Range as YamlRange,
  Node,
  Scalar,
  visit,
  isScalar,
  isMap,
} from "yaml";
import { Position, Range } from "vscode-languageserver-textdocument";
import { DefinitionLink } from "vscode-languageserver";
import {
  parseJsonPointer,
  isLocalPointer,
} from "@openapi-lsp/core/json-pointer";

export type CollectedRef = {
  ref: string;
  keyRange: Range;
  pointerRange: Range;
};

export class YamlDocument {
  constructor(
    public readonly ast: Document,
    public readonly lineCounter: LineCounter
  ) {}

  getOffsetByTextDocumentPosition(position: Position): number {
    const lineStart = this.lineCounter.lineStarts[position.line] ?? 0;
    return lineStart + position.character;
  }

  toTextDocumentRange(range: YamlRange): Range {
    const start = this.lineCounter.linePos(range[0]);
    const end = this.lineCounter.linePos(range[2]);
    return {
      start: { line: start.line - 1, character: start.col - 1 },
      end: { line: end.line - 1, character: end.col - 1 },
    };
  }

  /**
   * Get the $ref string at the given position, or null if not on a $ref
   */
  getRefAtPosition(position: Position): string | null {
    const offset = this.getOffsetByTextDocumentPosition(position);
    let result: string | null = null;

    visit(this.ast, {
      Map(_key, node) {
        if (!node.range) return undefined;
        const [start, , end] = node.range;
        if (offset < start || offset > end) return visit.SKIP;

        const refPair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === "$ref"
        );
        if (refPair && isScalar(refPair.value)) {
          result = refPair.value.value as string;
        }
        return undefined;
      },
    });

    return result;
  }

  /**
   * Get DefinitionLink for a local $ref path (e.g., "#/components/schemas/Pet")
   * Returns null if path doesn't exist or isn't a local ref
   */
  getDefinitionLinkByRef(
    ref: string,
    targetUri: string
  ): DefinitionLink | null {
    if (!isLocalPointer(ref)) {
      return null;
    }

    const parseResult = parseJsonPointer(ref);
    if (!parseResult.success) {
      return null;
    }

    const pathSegments = parseResult.data;

    // Handle root reference (empty path = whole document)
    if (pathSegments.length === 0) {
      const rootRange = this.ast.contents?.range;
      if (!rootRange) return null;
      const range = this.toTextDocumentRange(rootRange);
      return {
        targetUri,
        targetRange: range,
        targetSelectionRange: range,
      };
    }

    let currentNode: Node | null = this.ast.contents;
    let keyNode: Scalar | null = null;

    for (const segment of pathSegments) {
      if (!isMap(currentNode)) return null;

      const pair = currentNode.items.find(
        (p) => isScalar(p.key) && p.key.value === segment
      );
      if (!pair || !isScalar(pair.key)) return null;

      keyNode = pair.key;
      currentNode = pair.value as Node | null;
    }

    if (!currentNode?.range || !keyNode?.range) return null;

    return {
      targetUri,
      targetRange: this.toTextDocumentRange(currentNode.range),
      targetSelectionRange: this.toTextDocumentRange(keyNode.range),
    };
  }

  collectRefs(): CollectedRef[] {
    let refs: CollectedRef[] = [];

    visit(this.ast, {
      Map: (_key, node) => {
        const refPair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === "$ref"
        );
        if (refPair && isScalar(refPair.key) && isScalar(refPair.value)) {
          refs.push({
            ref: String(refPair.value.value),
            keyRange: this.toTextDocumentRange(refPair.key.range!),
            pointerRange: this.toTextDocumentRange(refPair.value.range!),
          });
        }
        return undefined;
      },
    });

    return refs;
  }
}
