import { JSONPointer } from "@openapi-lsp/core/openapi";
import { Range } from "vscode-languageserver-textdocument";

/**
 * Resolved definition of an OpenAPI component
 */
export type BaseSpecDefinition<T> = {
  componentNameRange: Range;
};

export type SchemaSpecDefinition = BaseSpecDefinition<"schema"> & {};

export type SpecDocumentDefinitions = Map<JSONPointer, SchemaSpecDefinition>;
