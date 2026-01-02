import {
  Document,
  LineCounter,
  Range as YamlRange,
  Node,
  Scalar,
  Pair,
  YAMLMap,
  YAMLSeq,
  isScalar,
  isMap,
  isSeq,
} from "yaml";
import { Position, Range } from "vscode-languageserver-textdocument";
import { DefinitionLink } from "vscode-languageserver";
import { md5 } from "js-md5";
import {
  parseJsonPointer,
  parseUriWithJsonPointer,
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

// ----- Custom YAML Visitor -----

type YamlVisitorCallbacks<T> = {
  Scalar?: (node: Scalar, path: JsonPointerLoose) => T | undefined;
  Seq?: (node: YAMLSeq, path: JsonPointerLoose) => T | undefined;
  Map?: (node: YAMLMap, path: JsonPointerLoose) => T | undefined;
  Pair?: (
    pair: Pair,
    path: JsonPointerLoose,
    key: string
  ) => T | undefined;
};

/**
 * Custom YAML visitor that efficiently tracks JSON pointer paths (including array indices).
 * Returns early when a callback returns a non-undefined value.
 */
function visitYaml<T>(
  node: Node | null,
  path: JsonPointerLoose,
  callbacks: YamlVisitorCallbacks<T>
): T | undefined {
  if (!node) return undefined;

  if (isScalar(node)) {
    return callbacks.Scalar?.(node, path);
  }

  if (isSeq(node)) {
    const seqResult = callbacks.Seq?.(node, path);
    if (seqResult !== undefined) return seqResult;

    for (let i = 0; i < node.items.length; i++) {
      const childPath = [...path, i];
      const result = visitYaml(node.items[i] as Node, childPath, callbacks);
      if (result !== undefined) return result;
    }
  }

  if (isMap(node)) {
    const mapResult = callbacks.Map?.(node, path);
    if (mapResult !== undefined) return mapResult;

    for (const pair of node.items) {
      if (isScalar(pair.key)) {
        const key = String(pair.key.value);
        const childPath = [...path, key];

        const pairResult = callbacks.Pair?.(pair, childPath, key);
        if (pairResult !== undefined) return pairResult;

        const result = visitYaml(pair.value as Node, childPath, callbacks);
        if (result !== undefined) return result;
      }
    }
  }

  return undefined;
}

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
   * Get the YAML key at the given position, returning both the key name and its JSON pointer path.
   * Returns null if position is not on a key.
   */
  getKeyAtPosition(
    position: Position
  ): { key: string; path: JsonPointerLoose } | null {
    const offset = this.getOffsetByTextDocumentPosition(position);

    const result = visitYaml(this.ast.contents, [], {
      Pair: (pair, path, key) => {
        if (isScalar(pair.key) && pair.key.range) {
          const [start, , end] = pair.key.range;
          if (offset >= start && offset <= end) {
            return { key, path };
          }
        }
        return undefined;
      },
    });

    return result ?? null;
  }

  /**
   * Get the $ref string at the given position, or null if not on a $ref
   */
  getRefAtPosition(position: Position): { key: string; ref: string } | null {
    const offset = this.getOffsetByTextDocumentPosition(position);

    return (
      visitYaml(this.ast.contents, [], {
        Map: (node, path) => {
          if (!node.range) return undefined;
          const [start, , end] = node.range;
          if (offset < start || offset > end) return undefined;

          const refPair = node.items.find(
            (pair) => isScalar(pair.key) && pair.key.value === "$ref"
          );
          if (refPair && isScalar(refPair.value)) {
            // Find the nearest string key in the path (skip array indices)
            let key: string | undefined;
            for (let i = path.length - 1; i >= 0; i--) {
              if (typeof path[i] === "string") {
                key = path[i] as string;
                break;
              }
            }
            if (key) {
              return { key, ref: String(refPair.value.value) };
            }
          }
          return undefined;
        },
      }) ?? null
    );
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

  /**
   * Get the AST node at a given JSON pointer path.
   * Returns null if the path doesn't exist.
   */
  getNodeAtPath(path: JsonPointerLoose): Node | null {
    let currentNode: Node | null = this.ast.contents;

    for (const segment of path) {
      if (currentNode === null) return null;

      if (typeof segment === "number") {
        // Array index
        if (!isSeq(currentNode)) return null;
        currentNode = currentNode.items[segment] as Node | null;
      } else {
        // Object key
        if (!isMap(currentNode)) return null;
        const pair = currentNode.items.find(
          (p) => isScalar(p.key) && p.key.value === segment
        );
        if (!pair) return null;
        currentNode = pair.value as Node | null;
      }
    }

    return currentNode;
  }

  /**
   * Get the JavaScript value at a given JSON pointer path.
   * Returns undefined if the path doesn't exist.
   */
  getValueAtPath(path: JsonPointerLoose): unknown {
    const node = this.getNodeAtPath(path);
    if (!node) return undefined;
    return node.toJSON();
  }

  collectRefs(): CollectedRef[] {
    const refs: CollectedRef[] = [];

    visitYaml(this.ast.contents, [], {
      Map: (node) => {
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
        return undefined; // Continue traversal
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
          const targetResult = parseUriWithJsonPointer(
            String(refPair.value.value),
            uri
          );
          if (targetResult.success) {
            const targetNodeId = targetResult.data.url.toString();
            shapes.set(nodeId, { kind: "ref", target: targetNodeId });
          }
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

  /**
   * Get a hash of the YAML AST content.
   * Uses toJSON() which works even when the document has errors.
   */
  getHash(): string {
    const content = JSON.stringify(this.ast.toJSON());
    return md5(content);
  }
}
