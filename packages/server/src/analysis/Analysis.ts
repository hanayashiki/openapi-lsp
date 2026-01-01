import { OpenAPI } from "@openapi-lsp/core/openapi";
import { Range } from "vscode-languageserver-textdocument";
import { SpecDocumentPath } from "./ServerDocument.js";
import { ZodError } from "zod";
import { ModuleResolutionResult } from "./ModuleResolution.js";

export interface Analysis {
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

/**
 * Document URI -> Referenced URIs
 */
export type DocumentConnectivity = {
  graph: Map<string, Set<string>>;
};

export namespace DocumentConnectivity {
  export const createDefault = (): DocumentConnectivity => {
    return {
      graph: new Map(),
    };
  };
}
/**
 * A group of mutual-referencing modules that must be analyzed together
 */
export interface AnalysisGroup {}
