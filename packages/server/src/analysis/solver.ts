import {
  OpenAPI,
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
import { visit, visitFragment } from "./Visitor.js";
import { SpecDocument, ServerDocument } from "./ServerDocument.js";
import { isMap } from "yaml";

// ----- Extractors that gather info for `Solver` -----

export type ExtractedNodes = {
  /** All nodes with ref shapes (type shapes deferred) */
  nodes: Map<NodeId, LocalShape>;
  /** Local nominals (component names) - currently empty, deferred */
  nominals: Map<NodeId, NominalId>;
  /**
   * Nominals that refs in this document expect from external targets.
   * Maps target NodeId to the expected OpenAPI tag (Schema, Response, etc.)
   */
  outgoingNominals: Map<NodeId, NominalId>;
};

/**
 * Extract References and their expected nominals from an OpenAPI document.
 *
 * SIMPLIFIED: For now, we only propagate nominals, not types.
 * Type inference from Zod definitions is deferred.
 *
 * TODO: rename this shit
 *
 * @param uri - The document URI
 * @param spec - The parsed spec document with YAML AST
 * @param document - The parsed OpenAPI document
 * @returns Extracted nodes (refs only), nominals (empty for now), and outgoing nominals
 */
export function extractNodes(
  uri: string,
  spec: SpecDocument,
  document: OpenAPI.Document
): ExtractedNodes {
  const nodes = new Map<NodeId, LocalShape>();
  const nominals = new Map<NodeId, NominalId>();
  const outgoingNominals = new Map<NodeId, NominalId>();

  visit(
    { document, yamlAst: spec.yaml.ast },
    {
      Reference: ({ openapiNode, ast }) => {
        const nodeId = uriWithJsonPointerLoose(uri, ast.path);

        const targetResult = parseUriWithJsonPointer(openapiNode.$ref, uri);
        if (!targetResult.success) return;
        const targetNodeId = targetResult.data.url.toString();
        nodes.set(nodeId, { kind: "ref", target: targetNodeId });

        // Get the nominal (OpenAPI tag) this reference expects from its target
        const nominal: OpenAPITag | undefined =
          getReferenceNominal(openapiNode);
        if (nominal) {
          // If the target is external (different file), track as outgoing nominal
          if (!isNodeInDocument(targetNodeId, uri)) {
            outgoingNominals.set(targetNodeId, nominal);
          }
        }
      },
    }
  );

  return { nodes, nominals, outgoingNominals };
}

export type StructuralNominals = {
  /** Nominals for refs targeting external files */
  outgoing: Map<NodeId, NominalId>;
  /** Nominals for refs targeting nodes within the same document */
  local: Map<NodeId, NominalId>;
};

/**
 * Extract structural nominals from a component document fragment.
 *
 * Given a node that we know has a certain nominal, because of constraints or parsing results,
 * parse it with the lenient codec and visit to find nested $refs that
 * should also have nominals.
 *
 * @param uri - The document URI
 * @param doc - The component document with YAML AST
 * @param nodeId - The node ID that has an incoming nominal (e.g., "file:///user.yaml#/User")
 * @param nominal - The nominal type of the node (e.g., "Schema")
 * @returns Object with outgoing (external) and local (same document) nominals
 */
export function extractStructuralNominals(
  uri: string,
  doc: ServerDocument,
  nodeId: NodeId,
  nominal: OpenAPITag
): StructuralNominals | undefined {
  if (doc.type === "tomb") {
    return;
  }

  const outgoing = new Map<NodeId, NominalId>();
  const local = new Map<NodeId, NominalId>();

  // Get the parser for this nominal type
  const parser = (v: unknown) => OpenAPIInput[nominal].safeParse(v);

  // Extract the JSON pointer from the nodeId
  const parseResult = parseUriWithJsonPointer(nodeId);
  if (!parseResult.success) {
    return;
  }
  const path: JsonPointerLoose = parseResult.data.jsonPointer;

  // Navigate to the AST node at this path
  const astNode = doc.yaml.getNodeAtPath(path);
  if (!astNode || !isMap(astNode)) {
    return;
  }

  // Get the raw value at this path
  const rawValue = doc.yaml.getValueAtPath(path);
  if (!rawValue || typeof rawValue !== "object") {
    return;
  }

  // Parse with lenient codec to get tagged objects
  const taggedResult = parser(rawValue);
  if (!taggedResult.success) {
    console.error("Failed to parse with input type: ", rawValue);
    return;
  }

  // Visit the parsed fragment to extract $refs and their nominals
  visitFragment(taggedResult.data, astNode, path, {
    Reference: ({ openapiNode }) => {
      const targetResult = parseUriWithJsonPointer(openapiNode.$ref, uri);
      if (!targetResult.success) return;
      const targetNodeId = targetResult.data.url.toString();

      // Get the nominal this reference expects from its target
      const refNominal = getReferenceNominal(openapiNode);
      if (refNominal) {
        if (!isNodeInDocument(targetNodeId, uri)) {
          // External ref (different file)
          outgoing.set(targetNodeId, refNominal);
        } else {
          // Local ref (same document)
          local.set(targetNodeId, refNominal);
        }
      }
    },
  });

  return { outgoing, local };
}
