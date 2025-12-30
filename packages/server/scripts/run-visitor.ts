import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import { Compile } from "typebox/compile";
import { getOpenAPITag, OpenAPI } from "@openapi-lsp/core/openapi";

const file = readFileSync(
  "/Users/chenyuwang/openapi-lsp/examples/petstore.openapi.yml",
  "utf-8"
);

const yamlAst = parseDocument(file);

const DocumentParser = Compile(OpenAPI.Document);

const document = DocumentParser.Decode(yamlAst.toJS());

console.log(getOpenAPITag(document.components?.schemas!.Pet!));