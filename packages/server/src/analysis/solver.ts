import {
  OpenAPIInput,
  getReferenceNominal,
  OpenAPITag,
} from "@openapi-lsp/core/openapi";
import {
  uriWithJsonPointerLoose,
  parseUriWithJsonPointer,
  JsonPointerLoose,
  isNodeInDocument,
} from "@openapi-lsp/core/json-pointer";
import { LocalShape, NodeId, NominalId } from "@openapi-lsp/core/solver";
import { visitFragment } from "./Visitor.js";
import { ServerDocument } from "./ServerDocument.js";
import { isMap, isScalar, isSeq, Node } from "yaml";

// ----- Extractors that gather info for `Solver` -----

export type ExtractionResult = {
  /** All shapes (prim, array, object, ref) in the traversed subtree */
  nodes: Map<NodeId, LocalShape>;
  /** Nominals for refs targeting external files */
  outgoingNominals: Map<NodeId, NominalId>;
  /** Nominals for refs targeting nodes within the same document */
  localNominals: Map<NodeId, NominalId>;
};

/**
 * Extract shapes and nominals from a document or fragment.
 *
 * This unified function handles both OpenAPI documents and component fragments:
 * - For OpenAPI documents: call with root nodeId and nominal="Document"
 * - For components: call with the specific nodeId and its expected nominal
 *
 * The function:
 * 1. Collects structural shapes (prim/array/object/ref) from the YAML AST
 * 2. Parses with lenient codec and visits to extract nominals from References
 *
 * @param uri - The document URI
 * @param doc - The server document (openapi or component)
 * @param nodeId - The node ID to extract from (use root for full documents)
 * @param nominal - The nominal type of the node (use "Document" for OpenAPI docs)
 * @returns Shapes and nominals, or undefined if extraction fails
 */
export function extractFromNode(
  uri: string,
  doc: ServerDocument,
  nodeId: NodeId,
  nominal: OpenAPITag
): ExtractionResult | undefined {
  if (doc.type === "tomb") {
    return;
  }

  const nodes = new Map<NodeId, LocalShape>();
  const outgoingNominals = new Map<NodeId, NominalId>();
  const localNominals = new Map<NodeId, NominalId>();

  // Get the parser for this nominal type
  const parser = (v: unknown) => OpenAPIInput[nominal].safeParse(v);

  // Extract the JSON pointer from the nodeId
  const parseResult = parseUriWithJsonPointer(nodeId);
  if (!parseResult.success) {
    return;
  }
  const basePath: JsonPointerLoose = parseResult.data.jsonPointer;

  // Navigate to the AST node at this path
  const astNode = doc.yaml.getNodeAtPath(basePath);
  if (!astNode || !isMap(astNode)) {
    return;
  }

  // Get the raw value at this path
  const rawValue = doc.yaml.getValueAtPath(basePath);
  if (!rawValue || typeof rawValue !== "object") {
    return;
  }

  // 1. Collect structural shapes from the AST subtree
  const collectShapes = (node: Node | null, path: JsonPointerLoose): void => {
    if (!node) return;
    const currentNodeId = uriWithJsonPointerLoose(uri, path);

    if (isScalar(node)) {
      nodes.set(currentNodeId, {
        kind: "prim",
        value: node.value as string | number | boolean | null,
      });
    } else if (isSeq(node)) {
      const fields: Record<string, NodeId> = {};
      for (let i = 0; i < node.items.length; i++) {
        const childPath = [...path, i];
        fields[String(i)] = uriWithJsonPointerLoose(uri, childPath);
        collectShapes(node.items[i] as Node, childPath);
      }
      nodes.set(currentNodeId, { kind: "array", fields });
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
          nodes.set(currentNodeId, { kind: "ref", target: targetNodeId });
        }
      } else {
        const fields: Record<string, NodeId> = {};
        for (const pair of node.items) {
          if (isScalar(pair.key)) {
            const key = String(pair.key.value);
            const childPath = [...path, key];
            fields[key] = uriWithJsonPointerLoose(uri, childPath);
            collectShapes(pair.value as Node, childPath);
          }
        }
        nodes.set(currentNodeId, { kind: "object", fields });
      }
    }
  };

  collectShapes(astNode, basePath);

  // 2. Parse with lenient codec to get tagged objects
  const taggedResult = parser(rawValue);
  if (!taggedResult.success) {
    console.error("Failed to parse with input type: ", rawValue);
    return;
  }

  // 3. Visit the parsed fragment to extract nominals from References
  visitFragment(taggedResult.data, astNode, basePath, {
    Reference: ({ openapiNode }) => {
      const targetResult = parseUriWithJsonPointer(openapiNode.$ref, uri);
      if (!targetResult.success) return;
      const targetNodeId = targetResult.data.url.toString();

      // Get the nominal this reference expects from its target
      const refNominal = getReferenceNominal(openapiNode);
      if (refNominal) {
        if (!isNodeInDocument(targetNodeId, uri)) {
          // External ref (different file)
          outgoingNominals.set(targetNodeId, refNominal);
        } else {
          // Local ref (same document)
          localNominals.set(targetNodeId, refNominal);
        }
      }
    },
  });

  return { nodes, outgoingNominals, localNominals };
}
