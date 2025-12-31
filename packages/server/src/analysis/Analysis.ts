import { OpenAPI } from "@openapi-lsp/core/openapi";
import { Range } from "vscode-languageserver-textdocument";
import { SpecDocumentPath } from "./ServerDocument.js";
import { ZodError } from "zod";

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
