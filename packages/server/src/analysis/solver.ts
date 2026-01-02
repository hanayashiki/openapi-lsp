import {
  OpenAPIInput,
  getReferenceNominal,
  OpenAPITag,
  getOpenAPITag,
} from "@openapi-lsp/core/openapi";
import {
  uriWithJsonPointerLoose,
  parseUriWithJsonPointer,
  JsonPointerLoose,
  isNodeInDocument,
} from "@openapi-lsp/core/json-pointer";
import { NodeId, NominalId } from "@openapi-lsp/core/solver";
import { visitFragment, VisitorFn } from "./Visitor.js";
import { ServerDocument } from "./ServerDocument.js";
import { isMap } from "yaml";
import z from "zod";

// ----- Extractors that gather info for `Solver` -----

export type NominalCollectionResult = {
  /** Nominals for refs targeting external files */
  outgoingNominals: Map<NodeId, NominalId[]>;
  /** Nominals for refs targeting nodes within the same document + tags from parsing */
  localNominals: Map<NodeId, NominalId[]>;
};

// ----- Helper to add nominal to a Map<NodeId, NominalId[]> -----

function addNominal(
  map: Map<NodeId, NominalId[]>,
  id: NodeId,
  nom: NominalId
): void {
  if (!map.has(id)) map.set(id, []);
  const arr = map.get(id)!;
  if (!arr.includes(nom)) arr.push(nom);
}

/**
 * Collect nominals from parsing a document fragment at an entry point.
 * Called once per (nodeId, nominal) combination.
 *
 * This function handles nominal collection separately from shape collection:
 * - Shapes are collected once per document via YamlDocument.collectLocalShapes()
 * - Nominals are collected per entry point via this function
 *
 * @param uri - The document URI
 * @param doc - The server document
 * @param nodeId - The entry point node ID
 * @param nominal - The expected nominal type at the entry point
 * @returns Nominals discovered, or undefined if parsing fails
 */
export function collectNominalsFromEntryPoint(
  uri: string,
  doc: ServerDocument,
  nodeId: NodeId,
  nominal?: OpenAPITag
): NominalCollectionResult | undefined {
  if (doc.type === "tomb") {
    return undefined;
  }

  const outgoingNominals = new Map<NodeId, NominalId[]>();
  const localNominals = new Map<NodeId, NominalId[]>();

  // Get the parser for this nominal type
  const parser = (v: unknown) =>
    nominal ? OpenAPIInput[nominal].safeParse(v) : z.any().parse(v);

  // Extract JSON pointer from nodeId
  const parseResult = parseUriWithJsonPointer(nodeId);
  if (!parseResult.success) {
    return undefined;
  }
  const basePath: JsonPointerLoose = parseResult.data.jsonPointer;

  // Navigate to AST node
  const astNode = doc.yaml.getNodeAtPath(basePath);
  if (!astNode || !isMap(astNode)) {
    return undefined;
  }

  // Get raw value
  const rawValue = doc.yaml.getValueAtPath(basePath);
  if (!rawValue || typeof rawValue !== "object") {
    return undefined;
  }

  // Parse with lenient codec
  const taggedResult = parser(rawValue);
  if (!taggedResult.success) {
    console.error("Failed to parse with input type: ", rawValue);
    return undefined;
  }

  // Visit to extract nominals from tags and References
  if (nominal) {
    visitFragment(taggedResult.data, astNode, basePath, {
      "*": (({ ast, openapiNode }) => {
        const tag = getOpenAPITag(openapiNode);
        if (tag && tag !== "Reference") {
          addNominal(localNominals, uriWithJsonPointerLoose(uri, ast.path), tag);
        }
      }) satisfies VisitorFn<object>,
      Reference: ({ openapiNode }) => {
        const targetResult = parseUriWithJsonPointer(openapiNode.$ref, uri);
        if (!targetResult.success) return;
        const targetNodeId = targetResult.data.url.toString();

        const refNominal = getReferenceNominal(openapiNode);
        if (refNominal) {
          if (!isNodeInDocument(targetNodeId, uri)) {
            addNominal(outgoingNominals, targetNodeId, refNominal);
          } else {
            addNominal(localNominals, targetNodeId, refNominal);
          }
        }
      },
    });
  }

  return { outgoingNominals, localNominals };
}
