import { OpenAPI } from "@openapi-lsp/core/openapi";
import { Range } from "vscode-languageserver-textdocument";
import { SpecDocumentPath } from "./ServerDocument.js";
import { ZodError } from "zod";
import { ModuleResolutionResult } from "./ModuleResolution.js";

export interface ParseResult {
  document: OpenAPI.Document;
  zodError: ZodError | null;
  definitions: Definition[];
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
};

export namespace DocumentConnectivity {
  export const createDefault = (): DocumentConnectivity => {
    return {
      graph: new Map(),
      analysisGroups: new Map(),
      uriToAnalysisGroupId: new Map(),
    };
  };
}
