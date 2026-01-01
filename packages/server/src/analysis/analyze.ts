import { OpenAPI, OpenAPIInput } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./ServerDocument.js";
import { ParseResult } from "./Analysis.js";
import { ZodError } from "zod";

export const parseSpecDocument = async (
  spec: SpecDocument
): Promise<ParseResult> => {
  try {
    // Try strict parsing first
    const document = OpenAPI.Document.parse(spec.yaml.ast.toJS());

    return {
      document,
      zodError: null,
    };
  } catch (e) {
    if (e instanceof ZodError) {
      const document = OpenAPIInput.Document.parse(
        spec.yaml.ast.toJS()
      );

      return {
        document,
        zodError: e,
      };
    } else {
      throw e;
    }
  }
};
