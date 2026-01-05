import { OpenAPI } from "@openapi-lsp/core/openapi";
import { NodeId, SolveResult } from "@openapi-lsp/core/solver";
import { Range } from "vscode-languageserver-textdocument";
import { SpecDocumentPath } from "./ServerDocument.js";
import { ZodError } from "zod";
import { ModuleResolutionResult } from "./ModuleResolution.js";
import { md5 } from "js-md5";

export interface ParseResult {
  document: OpenAPI.Document;
  zodError: ZodError | null;
}

export type DefinitionComponent =
  | OpenAPI.Schema
  | OpenAPI.Response
  | OpenAPI.Parameter
  | OpenAPI.Example
  | OpenAPI.RequestBody
  | OpenAPI.Header
  | OpenAPI.SecurityScheme
  | OpenAPI.Link
  | OpenAPI.Callback
  | OpenAPI.Reference
  | OpenAPI.MediaType
  | OpenAPI.Content;

export type Definition = {
  path: SpecDocumentPath;
  name: string | null;
  nameRange: Range;
  definitionRange: Range;
  component: DefinitionComponent;
};

export type Reference = {
  path: SpecDocumentPath;
  /**
   * Range of the `$ref`
   */
  refKeyRange: Range;

  /**
   * Range of the json pointer string
   */
  refValueRange: Range;

  /**
   * The resolution result, might be an error
   */
  resolution: ModuleResolutionResult;
};

export interface Member {}

export type DocumentConnectivity = {
  /**
   * Document URI -> Referenced URIs
   */
  graph: Map<string, Set<string>>;

  /**
   * Groups of mutual-referencing docs that must be analyzed together, i.e. SCCs.
   *
   * Group URI -> Group Member URIs
   *
   * Group URI is the alphabetically smallest URI of the entire group.
   *
   * Group must consist of >= 2 elements. !group.has(key) indicates single file group
   * (which is most common in well-structured projects)
   */
  analysisGroups: Map<string, Set<string>>;

  uriToAnalysisGroupId: Map<string, string>;

  /**
   * Incoming edges for each group (including single-file groups).
   * Group ID -> Set of Group IDs that reference this group.
   *
   * For single-file groups, the group ID is the URI itself.
   */
  groupIncomingEdges: Map<string, Set<string>>;
};

export namespace DocumentConnectivity {
  export const createDefault = (): DocumentConnectivity => {
    return {
      graph: new Map(),
      analysisGroups: new Map(),
      uriToAnalysisGroupId: new Map(),
      groupIncomingEdges: new Map(),
    };
  };

  /**
   * Get group ID for a URI. Single-file groups use the URI itself.
   */
  export const getGroupId = (dc: DocumentConnectivity, uri: string): string =>
    dc.uriToAnalysisGroupId.get(uri) ?? uri;

  /**
   * Get member URIs for a group. Single-file groups return a Set containing just the group ID.
   */
  export const getMemberUris = (
    dc: DocumentConnectivity,
    groupId: string
  ): Set<string> => dc.analysisGroups.get(groupId) ?? new Set([groupId]);
}

/**
 * Result of analyzing a group (SCC) of documents.
 * Contains the solver result which can be used for type queries and
 * provides outgoing types/nominals for downstream groups.
 */
export type GroupAnalysisResult = {
  groupId: string;
  solveResult: SolveResult;
};

/**
 * Represents a single incoming reference to a target node.
 * Contains the source nodeId and the range in the source document
 * where the $ref is located.
 */
export type IncomingReference = {
  /** The nodeId of the referencing node (contains the $ref) */
  sourceNodeId: NodeId;
  /** URI of the source document */
  sourceUri: string;
  /** Range of the $ref key in the source document */
  keyRange: Range;
  /** Range of the $ref value (pointer string) in the source document */
  pointerRange: Range;
};

/**
 * Result of group reference analysis.
 * Maps each target nodeId to all incoming references.
 */
export type GroupReferenceAnalysisResult = {
  groupId: string;
  /** Map from target nodeId -> incoming references from within this group */
  incomingReferences: Map<NodeId, IncomingReference[]>;
  /** References from this group to external groups (for upstream propagation) */
  outgoingReferences: Map<NodeId, IncomingReference[]>;
};

export namespace GroupReferenceAnalysisResult {
  export function getHash(result: GroupReferenceAnalysisResult): string {
    return md5(
      JSON.stringify([
        [...result.incomingReferences.entries()].sort(([a], [b]) =>
          a.localeCompare(b)
        ),
        [...result.outgoingReferences.entries()].sort(([a], [b]) =>
          a.localeCompare(b)
        ),
      ])
    );
  }
}
