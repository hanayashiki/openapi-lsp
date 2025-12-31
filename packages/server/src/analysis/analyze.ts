import { OpenAPI, OpenAPIInput } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./ServerDocument.js";
import { Analysis } from "./Analysis.js";
import { getDefinitions } from "./getDefinitions.js";
import { ZodError } from "zod";

export const analyzeSpecDocument = async (
  spec: SpecDocument
): Promise<Analysis> => {
  try {
    // Try strict parsing first
    const document = OpenAPI.Document.parse(spec.yamlAst.toJS());

    return {
      document,
      zodError: null,
      definitions: getDefinitions(spec, document),
    };
  } catch (e) {
    if (e instanceof ZodError) {
      const document = OpenAPIInput.Document.parse(
        spec.yamlAst.toJS()
      );

      return {
        document,
        zodError: e,
        definitions: getDefinitions(spec, document),
      };
    } else {
      throw e;
    }
  }
};
