import { OpenAPIInput } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "../document/SpecDocument.js";
import { Compile } from "typebox/compile";
import { SpecAnalysis } from "./SpecAnalysis.js";

const DocumentParser = Compile(OpenAPIInput.Document);

export const analyzeSpecDocument = async (
  spec: SpecDocument
): Promise<SpecAnalysis> => {
  const specInput = DocumentParser.Decode(spec.yamlAst.toJS());

  return {};
};
