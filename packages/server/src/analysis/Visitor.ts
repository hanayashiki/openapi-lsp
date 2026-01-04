import { getOpenAPITag, OpenAPI, OpenAPITag } from "@openapi-lsp/core/openapi";
import {
  Document as YamlDocument,
  Node,
  Scalar,
  YAMLMap,
  YAMLSeq,
  isMap,
  isScalar,
  isNode,
  isSeq,
} from "yaml";
import { SpecDocumentPath } from "./ServerDocument.js";

export interface VisitInput {
  document: OpenAPI.Document;
  yamlAst: YamlDocument;
}

export interface AstContext {
  path: SpecDocumentPath;
  astNode: YAMLMap | YAMLSeq;
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
  ServerVariables?: VisitorFn<OpenAPI.ServerVariables>;
  OAuthFlow?: VisitorFn<OpenAPI.OAuthFlow>;
  Example?: VisitorFn<OpenAPI.Example>;
  Examples?: VisitorFn<OpenAPI.Examples>;

  // Layer 2: Simple composed types
  ExternalDocumentation?: VisitorFn<OpenAPI.ExternalDocumentation>;
  OAuthFlows?: VisitorFn<OpenAPI.OAuthFlows>;
  Server?: VisitorFn<OpenAPI.Server>;
  Servers?: VisitorFn<OpenAPI.Servers>;

  // Layer 3: Schema
  Schema?: VisitorFn<OpenAPI.Schema>;
  Schemas?: VisitorFn<OpenAPI.Schemas>;

  // Layer 4: Schema-dependent types
  Encoding?: VisitorFn<OpenAPI.Encoding>;
  Encodings?: VisitorFn<OpenAPI.Encodings>;
  MediaType?: VisitorFn<OpenAPI.MediaType>;
  Content?: VisitorFn<OpenAPI.Content>;
  Header?: VisitorFn<OpenAPI.Header>;
  Headers?: VisitorFn<OpenAPI.Headers>;
  Link?: VisitorFn<OpenAPI.Link>;
  Links?: VisitorFn<OpenAPI.Links>;
  Response?: VisitorFn<OpenAPI.Response>;
  Responses?: VisitorFn<OpenAPI.Responses>;
  ComponentResponses?: VisitorFn<OpenAPI.ComponentResponses>;
  Parameter?: VisitorFn<OpenAPI.Parameter>;
  Parameters?: VisitorFn<OpenAPI.Parameters>;
  ComponentParameters?: VisitorFn<OpenAPI.ComponentParameters>;
  RequestBody?: VisitorFn<OpenAPI.RequestBody>;
  RequestBodies?: VisitorFn<OpenAPI.RequestBodies>;
  SecurityScheme?: VisitorFn<OpenAPI.SecurityScheme>;
  SecuritySchemes?: VisitorFn<OpenAPI.SecuritySchemes>;

  // Layer 5: Operation-level types
  SecurityRequirement?: VisitorFn<OpenAPI.SecurityRequirement>;
  Operation?: VisitorFn<OpenAPI.Operation>;
  PathItem?: VisitorFn<OpenAPI.PathItem>;
  Paths?: VisitorFn<OpenAPI.Paths>;
  Callback?: VisitorFn<OpenAPI.Callback>;
  Callbacks?: VisitorFn<OpenAPI.Callbacks>;

  // Layer 6: Components
  Components?: VisitorFn<OpenAPI.Components>;

  // Layer 7: Top-level types
  Tag?: VisitorFn<OpenAPI.Tag>;
  TagArray?: VisitorFn<OpenAPI.TagArray>;
  Info?: VisitorFn<OpenAPI.Info>;
  Document?: VisitorFn<OpenAPI.Document>;

  "*"?: VisitorFn<object>;
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

/**
 * Visit a fragment of an OpenAPI document starting from a non-root node.
 * Used for component files where we parse a subtree with a known nominal type.
 *
 * @param openapiNode - The parsed OpenAPI fragment (e.g., Schema, Response)
 * @param astNode - The YAML AST node corresponding to the fragment
 * @param basePath - The JSON pointer path prefix for the fragment
 * @param visitor - The visitor callbacks
 */
export const visitFragment = (
  openapiNode: object,
  astNode: YAMLMap,
  basePath: SpecDocumentPath,
  visitor: Visitor
) => {
  _visit({
    currentPath: basePath,
    currentAstNode: astNode,
    currentOpenAPINode: openapiNode,
    visitor,
    currentLink: undefined,
  });
};

/**
 * Visit a fragment of an OpenAPI document starting from an array node.
 * Used for array types like Parameters where the entry point is a sequence.
 *
 * @param openapiArray - The parsed OpenAPI array (e.g., Parameters)
 * @param astNode - The YAML AST sequence node corresponding to the array
 * @param basePath - The JSON pointer path prefix for the fragment
 * @param visitor - The visitor callbacks
 */
export const visitFragmentArray = (
  openapiArray: object[],
  astNode: YAMLSeq,
  basePath: SpecDocumentPath,
  visitor: Visitor
) => {
  _visit({
    currentPath: basePath,
    currentAstNode: astNode,
    currentOpenAPINode: openapiArray,
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
  function getVisitorsForTag(tag: OpenAPITag): VisitorFn<object>[] {
    return [visitor["*"], visitor[tag]].filter(
      (v): v is VisitorFn<object> => !!v
    );
  }

  if (isMap(currentAstNode)) {
    for (const pair of currentAstNode.items) {
      if (!isScalar(pair.key) || !isNode(pair.value)) {
        continue;
      }

      const key = pair.key.value as string;
      const nextAstNode = pair.value;
      // oxlint-disable-next-line
      const nextOpenAPINode = (currentOpenAPINode as any)[key];
      const nextPath = [...currentPath, key];

      if (nextOpenAPINode && typeof nextOpenAPINode === "object") {
        const tag = getOpenAPITag(nextOpenAPINode);
        // Call visitor for tagged nodes (both maps and sequences)
        if (tag && (isMap(nextAstNode) || isSeq(nextAstNode))) {
          getVisitorsForTag(tag).forEach((visitor) => {
            visitor({
              openapiNode: nextOpenAPINode as never,
              ast: {
                path: nextPath,
                astNode: nextAstNode,
              },
              parent: currentLink,
            });
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

      // oxlint-disable-next-line
      const nextOpenAPINode = (currentOpenAPINode as any)[i];
      const nextPath = [...currentPath, i];

      if (nextOpenAPINode && typeof nextOpenAPINode === "object") {
        const tag = getOpenAPITag(nextOpenAPINode);

        if (tag && isMap(nextAstNode)) {
          getVisitorsForTag(tag).forEach((visitor) => {
            visitor({
              openapiNode: nextOpenAPINode as never,
              ast: {
                path: nextPath,
                astNode: nextAstNode,
              },
              parent: currentLink,
            });
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
