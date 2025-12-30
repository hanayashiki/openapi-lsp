import { OpenAPI, OpenAPIInput } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./SpecDocument.js";
import { Compile } from "typebox/compile";
import { Analysis } from "./Analysis.js";
import { AssertError } from "typebox/value";
import { none, some } from "@openapi-lsp/core/result";
import { getDefinitions } from "./getDefinitions.js";

const DocumentInputParser = Compile(OpenAPIInput.Document);
const DocumentParser = Compile(OpenAPI.Document);

export const analyzeSpecDocument = async (
  spec: SpecDocument
): Promise<Analysis> => {
  try {
    // Pass raw input first to capture all typebox validation errors
    const document = DocumentParser.Decode(spec.yamlAst.toJS());

    return {
      document,
      typeboxError: none(),
      definitions: getDefinitions(spec, document),
    };
  } catch (e) {
    if (e instanceof AssertError) {
      const fellbackInput = DocumentInputParser.Encode(spec.yamlAst.toJS());

      const document = DocumentParser.Decode(fellbackInput);

      return {
        document,
        typeboxError: some(e),
        definitions: getDefinitions(spec, document),
      };
    } else {
      throw e;
    }
  }
};
