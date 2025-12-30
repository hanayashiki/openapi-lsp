import { OpenAPI } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "./SpecDocument.js";
import { Definition, DefinitionComponent } from "./Analysis.js";
import { offsetToRange } from "./utils.js";
import { visit, VisitorInput } from "./Visitor.js";

type ComponentKind = DefinitionComponent["kind"];

const isComponentPath = (
  path: (string | number)[]
): path is ["components", string, string] => {
  return (
    path.length === 3 &&
    path[0] === "components" &&
    typeof path[1] === "string" &&
    typeof path[2] === "string"
  );
};

const createDefinitionCollector = (
  spec: SpecDocument,
  definitions: Definition[],
  kind: ComponentKind
) => {
  return ({ openapiNode, ast }: VisitorInput<object>) => {
    if (!isComponentPath(ast.path)) return;
    if (!ast.keyNode?.range || !ast.astNode.range) return;

    definitions.push({
      path: ast.path,
      componentNameRange: offsetToRange(spec.lineCounter, ast.keyNode.range),
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

  return definitions;
};
