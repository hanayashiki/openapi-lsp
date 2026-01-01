import {
  Document,
  LineCounter,
  Range as YamlRange,
  Node,
  Scalar,
  visit,
  isScalar,
  isMap,
  isSeq,
  isPair,
} from "yaml";
import { Position, Range } from "vscode-languageserver-textdocument";
import { DefinitionLink } from "vscode-languageserver";
import {
  parseJsonPointer,
  isLocalPointer,
  uriWithJsonPointerLoose,
  JsonPointerLoose,
} from "@openapi-lsp/core/json-pointer";
import { LocalShape, NodeId } from "@openapi-lsp/core/solver";

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
  getRefAtPosition(position: Position): { key: string; ref: string } | null {
    const offset = this.getOffsetByTextDocumentPosition(position);
    let result: { key: string; ref: string } | null = null;

    visit(this.ast, {
      Map(_key, node, ctx) {
        if (!node.range) return undefined;
        const [start, , end] = node.range;
        if (offset < start || offset > end) return visit.SKIP;

        const refPair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === "$ref"
        );
        if (refPair && isScalar(refPair.value)) {
          const parent = ctx.at(-1);
          const ref = String(refPair.value.value);

          if (parent && isPair(parent) && isScalar(parent.key)) {
            result = {
              key: String(parent.key.value),
              ref,
            };
          }
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

  /**
   * Collect LocalShape for all nodes in the document.
   * Traverses the YAML AST and creates shapes for primitives, arrays, objects, and refs.
   */
  collectLocalShapes(uri: string): Map<NodeId, LocalShape> {
    const shapes = new Map<NodeId, LocalShape>();

    const visitNode = (node: Node | null, path: JsonPointerLoose): void => {
      if (!node) return;
      const nodeId = uriWithJsonPointerLoose(uri, path);

      if (isScalar(node)) {
        shapes.set(nodeId, {
          kind: "prim",
          value: node.value as string | number | boolean | null,
        });
      } else if (isSeq(node)) {
        const fields: Record<string, NodeId> = {};
        for (let i = 0; i < node.items.length; i++) {
          const childPath = [...path, i];
          fields[String(i)] = uriWithJsonPointerLoose(uri, childPath);
          visitNode(node.items[i] as Node, childPath);
        }
        shapes.set(nodeId, { kind: "array", fields });
      } else if (isMap(node)) {
        // Check for $ref first
        const refPair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === "$ref"
        );
        if (refPair && isScalar(refPair.value)) {
          const targetNodeId = new URL(
            String(refPair.value.value),
            uri
          ).toString();
          shapes.set(nodeId, { kind: "ref", target: targetNodeId });
        } else {
          const fields: Record<string, NodeId> = {};
          for (const pair of node.items) {
            if (isScalar(pair.key)) {
              const key = String(pair.key.value);
              const childPath = [...path, key];
              fields[key] = uriWithJsonPointerLoose(uri, childPath);
              visitNode(pair.value as Node, childPath);
            }
          }
          shapes.set(nodeId, { kind: "object", fields });
        }
      }
    };

    visitNode(this.ast.contents, []);
    return shapes;
  }
}
