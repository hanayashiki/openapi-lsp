import { OpenAPI } from "@openapi-lsp/core/openapi";
import { AssertError } from "typebox/value";
import { Option } from "@openapi-lsp/core/result";
import { Range } from "vscode-languageserver-textdocument";
import { SpecDocumentPath } from "./SpecDocument.js";

export interface Analysis {
  document: OpenAPI.Document;
  typeboxError: Option<AssertError>;
  definitions: Definition[];
}

export type DefinitionComponent =
  | { kind: "schema"; value: OpenAPI.Schema | OpenAPI.Reference }
  | { kind: "response"; value: OpenAPI.Response | OpenAPI.Reference }
  | { kind: "parameter"; value: OpenAPI.Parameter | OpenAPI.Reference }
  | { kind: "example"; value: OpenAPI.Example | OpenAPI.Reference }
  | { kind: "requestBody"; value: OpenAPI.RequestBody | OpenAPI.Reference }
  | { kind: "header"; value: OpenAPI.Header | OpenAPI.Reference }
  | {
      kind: "securityScheme";
      value: OpenAPI.SecurityScheme | OpenAPI.Reference;
    }
  | { kind: "link"; value: OpenAPI.Link | OpenAPI.Reference }
  | { kind: "callback"; value: OpenAPI.Callback | OpenAPI.Reference };

export type Definition = {
  path: SpecDocumentPath;
  name: string | null;
  nameRange: Range;
  definitionRange: Range;
  component: DefinitionComponent;
};
