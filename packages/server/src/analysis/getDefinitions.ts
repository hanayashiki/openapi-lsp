import { isComponents, OpenAPI } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./SpecDocument.js";
import { Definition, DefinitionComponent } from "./Analysis.js";
import { offsetToRange } from "./utils.js";
import { visit, VisitorInput } from "./Visitor.js";

const createDefinitionCollector = (
  spec: SpecDocument,
  definitions: Definition[]
) => {
  return ({ openapiNode, ast, parent }: VisitorInput<DefinitionComponent>) => {
    if (!ast.keyNode?.range || !ast.astNode.range) return;

    const maybeComponentsParent = parent?.parent;

    definitions.push({
      path: ast.path,
      name:
        maybeComponentsParent && isComponents(maybeComponentsParent.node)
          ? String(ast.keyNode.value)
          : null,
      nameRange: offsetToRange(spec.lineCounter, ast.keyNode.range),
      definitionRange: offsetToRange(spec.lineCounter, ast.astNode.range),
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
    { document: openapi, yamlAst: spec.yamlAst },
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
    }
  );

  return definitions;
};
