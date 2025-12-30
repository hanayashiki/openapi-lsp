import { getOpenAPITag, OpenAPI } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./SpecDocument.js";
import { Definition, DefinitionComponent } from "./Analysis.js";
import { offsetToRange } from "./utils.js";
import { visit, VisitorInput } from "./Visitor.js";

type ComponentKind = DefinitionComponent["kind"];

const createDefinitionCollector = (
  spec: SpecDocument,
  definitions: Definition[],
  kind: ComponentKind
) => {
  return ({ openapiNode, ast, parent }: VisitorInput<object>) => {
    if (!ast.keyNode?.range || !ast.astNode.range) return;

    const maybeComponentsParent = parent?.parent;

    definitions.push({
      path: ast.path,
      name:
        maybeComponentsParent &&
        getOpenAPITag(maybeComponentsParent.node) === "Components"
          ? String(ast.keyNode.value)
          : null,
      nameRange: offsetToRange(spec.lineCounter, ast.keyNode.range),
      definitionRange: offsetToRange(spec.lineCounter, ast.astNode.range),
      component: {
        kind,
        value: openapiNode,
      } as DefinitionComponent,
    });
  };
};

export const getDefinitions = (
  spec: SpecDocument,
  openapi: OpenAPI.Document
): Definition[] => {
  const definitions: Definition[] = [];

  visit(
    { document: openapi, yamlAst: spec.yamlAst },
    {
      Schema: createDefinitionCollector(spec, definitions, "schema"),
      Response: createDefinitionCollector(spec, definitions, "response"),
      Parameter: createDefinitionCollector(spec, definitions, "parameter"),
      Example: createDefinitionCollector(spec, definitions, "example"),
      RequestBody: createDefinitionCollector(spec, definitions, "requestBody"),
      Header: createDefinitionCollector(spec, definitions, "header"),
      SecurityScheme: createDefinitionCollector(
        spec,
        definitions,
        "securityScheme"
      ),
      Link: createDefinitionCollector(spec, definitions, "link"),
      Callback: createDefinitionCollector(spec, definitions, "callback"),
    }
  );
  // console.log('defs', JSON.stringify(definitions, null, 2))
  return definitions;
};
