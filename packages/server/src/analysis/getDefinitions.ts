import { OpenAPI } from "@openapi-lsp/core/openapi";
import { SpecDocument } from "../document/SpecDocument.js";
import { Definition, DefinitionComponent } from "./Analysis.js";
import { isMap, isScalar, isNode } from "yaml";
import { offsetToRange } from "./utils.js";

const COMPONENT_CATEGORIES = [
  "schemas",
  "responses",
  "parameters",
  "examples",
  "requestBodies",
  "headers",
  "securitySchemes",
  "links",
  "callbacks",
] as const;

type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

const CATEGORY_TO_KIND: Record<ComponentCategory, DefinitionComponent["kind"]> =
  {
    schemas: "schema",
    responses: "response",
    parameters: "parameter",
    examples: "example",
    requestBodies: "requestBody",
    headers: "header",
    securitySchemes: "securityScheme",
    links: "link",
    callbacks: "callback",
  };

export const getDefinitions = (
  spec: SpecDocument,
  openapi: OpenAPI.Document
): Definition[] => {
  const definitions: Definition[] = [];
  const contents = spec.yamlAst.contents;

  if (!isMap(contents)) return definitions;

  // Find components node
  const componentsPair = contents.items.find(
    (pair) => isScalar(pair.key) && pair.key.value === "components"
  );
  if (!componentsPair || !isMap(componentsPair.value)) return definitions;

  const componentsMap = componentsPair.value;

  for (const category of COMPONENT_CATEGORIES) {
    const categoryPair = componentsMap.items.find(
      (pair) => isScalar(pair.key) && pair.key.value === category
    );
    if (!categoryPair || !isMap(categoryPair.value)) continue;

    const categoryMap = categoryPair.value;

    for (const item of categoryMap.items) {
      if (!isScalar(item.key) || !item.key.range) continue;

      const name = item.key.value as string;
      const valueNode = item.value;

      if (!isNode(valueNode) || !valueNode.range) continue;

      const componentValue = openapi.components?.[category]?.[name];
      if (!componentValue) continue;

      definitions.push({
        path: ["components", category, name],
        componentNameRange: offsetToRange(spec.lineCounter, item.key.range),
        definitionRange: offsetToRange(spec.lineCounter, valueNode.range),
        component: {
          kind: CATEGORY_TO_KIND[category],
          value: componentValue,
        } as DefinitionComponent,
      });
    }
  }

  return definitions;
};
