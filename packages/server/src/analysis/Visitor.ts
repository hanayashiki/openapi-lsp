import { getOpenAPITag, OpenAPI } from "@openapi-lsp/core/openapi";
import {
  Document as YamlDocument,
  Node,
  Scalar,
  YAMLMap,
  isMap,
  isScalar,
  isNode,
  isSeq,
} from "yaml";
import { SpecDocumentPath } from "./SpecDocument.js";

export interface VisitInput {
  document: OpenAPI.Document;
  yamlAst: YamlDocument;
}

export interface AstContext {
  path: SpecDocumentPath;
  astNode: YAMLMap;
  keyNode?: Scalar;
}

export interface OpenAPINodeLink {
  parent: OpenAPINodeLink | undefined;
  node: object;
}

export interface VisitorInput<OpenAPINode extends object> {
  openapiNode: OpenAPINode;
  ast: AstContext;
  parent: OpenAPINodeLink | undefined;
}

export type VisitorFn<OpenAPINode extends object> = (
  context: VisitorInput<OpenAPINode>
) => void;

export interface Visitor {
  // Layer 1: Leaf types
  Reference?: VisitorFn<OpenAPI.Reference>;
  XML?: VisitorFn<OpenAPI.XML>;
  Discriminator?: VisitorFn<OpenAPI.Discriminator>;
  Contact?: VisitorFn<OpenAPI.Contact>;
  License?: VisitorFn<OpenAPI.License>;
  ServerVariable?: VisitorFn<OpenAPI.ServerVariable>;
  OAuthFlow?: VisitorFn<OpenAPI.OAuthFlow>;
  Example?: VisitorFn<OpenAPI.Example>;

  // Layer 2: Simple composed types
  ExternalDocumentation?: VisitorFn<OpenAPI.ExternalDocumentation>;
  OAuthFlows?: VisitorFn<OpenAPI.OAuthFlows>;
  Server?: VisitorFn<OpenAPI.Server>;

  // Layer 3: Schema
  Schema?: VisitorFn<OpenAPI.Schema>;

  // Layer 4: Schema-dependent types
  Encoding?: VisitorFn<OpenAPI.Encoding>;
  MediaType?: VisitorFn<OpenAPI.MediaType>;
  Header?: VisitorFn<OpenAPI.Header>;
  Link?: VisitorFn<OpenAPI.Link>;
  Response?: VisitorFn<OpenAPI.Response>;
  Parameter?: VisitorFn<OpenAPI.Parameter>;
  RequestBody?: VisitorFn<OpenAPI.RequestBody>;
  SecurityScheme?: VisitorFn<OpenAPI.SecurityScheme>;

  // Layer 5: Operation-level types
  SecurityRequirement?: VisitorFn<OpenAPI.SecurityRequirement>;
  Operation?: VisitorFn<OpenAPI.Operation>;
  PathItem?: VisitorFn<OpenAPI.PathItem>;
  Callback?: VisitorFn<OpenAPI.Callback>;

  // Layer 6: Components
  Components?: VisitorFn<OpenAPI.Components>;

  // Layer 7: Top-level types
  Tag?: VisitorFn<OpenAPI.Tag>;
  Info?: VisitorFn<OpenAPI.Info>;
  Document?: VisitorFn<OpenAPI.Document>;
}

interface RecurseContext {
  currentPath: SpecDocumentPath;
  currentAstNode: Node<unknown>;
  currentOpenAPINode: object;
  visitor: Visitor;
  currentLink?: OpenAPINodeLink;
}

export const visit = (input: VisitInput, visitor: Visitor) => {
  const rootAstNode = input.yamlAst.contents;
  if (!rootAstNode || !isMap(rootAstNode)) {
    return;
  }

  visitor.Document?.({
    openapiNode: input.document,
    ast: {
      path: [],
      astNode: rootAstNode,
    },
    parent: undefined,
  });

  _visit({
    currentPath: [],
    currentAstNode: rootAstNode,
    currentOpenAPINode: input.document,
    visitor,
    currentLink: undefined,
  });
};

const _visit = ({
  currentPath,
  currentAstNode,
  currentOpenAPINode,
  visitor,
  currentLink,
}: RecurseContext) => {
  if (isMap(currentAstNode)) {
    for (const pair of currentAstNode.items) {
      if (!isScalar(pair.key) || !isNode(pair.value)) {
        continue;
      }

      const key = pair.key.value as string;
      const nextAstNode = pair.value;
      const nextOpenAPINode = (currentOpenAPINode as any)[key];
      const nextPath = [...currentPath, key];

      if (nextOpenAPINode && typeof nextOpenAPINode === "object") {
        const tag = getOpenAPITag(nextOpenAPINode);
        if (tag && isMap(nextAstNode)) {
          visitor[tag]?.({
            openapiNode: nextOpenAPINode as any,
            ast: {
              path: nextPath,
              astNode: nextAstNode,
              keyNode: pair.key,
            },
            parent: currentLink,
          });
        }

        _visit({
          currentPath: nextPath,
          currentAstNode: nextAstNode,
          currentOpenAPINode: nextOpenAPINode,
          visitor,
          currentLink: {
            node: nextOpenAPINode,
            parent: currentLink,
          },
        });
      }
    }
  } else if (isSeq(currentAstNode)) {
    for (let i = 0; i < currentAstNode.items.length; i++) {
      const nextAstNode = currentAstNode.items[i];
      if (!isNode(nextAstNode)) {
        continue;
      }

      const nextOpenAPINode = (currentOpenAPINode as any)[i];
      const nextPath = [...currentPath, i];

      if (nextOpenAPINode && typeof nextOpenAPINode === "object") {
        const tag = getOpenAPITag(nextOpenAPINode);

        if (tag && isMap(nextAstNode)) {
          visitor[tag]?.({
            openapiNode: nextOpenAPINode as any,
            ast: {
              path: nextPath,
              astNode: nextAstNode,
            },
            parent: currentLink,
          });
        }

        _visit({
          currentPath: nextPath,
          currentAstNode: nextAstNode,
          currentOpenAPINode: nextOpenAPINode,
          visitor,
          currentLink: {
            node: nextOpenAPINode,
            parent: currentLink,
          },
        });
      }
    }
  }
};
