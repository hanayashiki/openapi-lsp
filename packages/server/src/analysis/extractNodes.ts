import {
  OpenAPI,
  getReferenceNominal,
  OpenAPITag,
} from "@openapi-lsp/core/openapi";
import { uriWithJsonPointerLoose } from "@openapi-lsp/core/json-pointer";
import { LocalShape, NodeId, NominalId } from "@openapi-lsp/core/solver";
import { visit } from "./Visitor.js";
import { SpecDocument } from "./ServerDocument.js";

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

        const targetNodeId = new URL(openapiNode.$ref, uri).toString();
        nodes.set(nodeId, { kind: "ref", target: targetNodeId });

        // Get the nominal (OpenAPI tag) this reference expects from its target
        const nominal: OpenAPITag | undefined =
          getReferenceNominal(openapiNode);
        if (nominal) {
          // If the target is external (different file), track as outgoing nominal
          if (!targetNodeId.startsWith(uri + "#")) {
            outgoingNominals.set(targetNodeId, nominal);
          }
        }
      },
    }
  );

  return { nodes, nominals, outgoingNominals };
}
