import {
  isComponents,
  isMediaType,
  isResponse,
  OpenAPI,
} from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./ServerDocument.js";
import { Definition, DefinitionComponent } from "./Analysis.js";
import { visit, VisitorInput } from "./Visitor.js";

const createDefinitionCollector = (
  spec: SpecDocument,
  definitions: Definition[]
) => {
  return ({ openapiNode, ast, parent }: VisitorInput<DefinitionComponent>) => {
    if (!ast.keyNode?.range || !ast.astNode.range) return;

    const maybeComponentsParent = parent?.parent;

    const keyName = String(ast.keyNode.value);

    let name: string | null = null;
    if (maybeComponentsParent && isComponents(maybeComponentsParent.node)) {
      name = keyName;
    } else if (isMediaType(openapiNode)) {
      name = keyName;
    } else if (isResponse(openapiNode)) {
      name = keyName;
    }

    definitions.push({
      path: ast.path,
      name,
      nameRange: spec.yaml.toTextDocumentRange(ast.keyNode.range),
      definitionRange: spec.yaml.toTextDocumentRange(ast.astNode.range),
      component: openapiNode,
    });
  };
};

export const getDefinitions = (
  spec: SpecDocument,
  openapi: OpenAPI.Document
): Definition[] => {
  const definitions: Definition[] = [];

  const collector = createDefinitionCollector(spec, definitions);

  visit(
    { document: openapi, yamlAst: spec.yaml.ast },
    {
      Schema: collector,
      Response: collector,
      Parameter: collector,
      Example: collector,
      RequestBody: collector,
      Header: collector,
      SecurityScheme: collector,
      Link: collector,
      Callback: collector,
      Reference: collector,
      MediaType: collector,
      Content: collector,
    }
  );

  return definitions;
};
