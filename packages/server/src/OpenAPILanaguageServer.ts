import { QueryCache } from "@openapi-lsp/core/queries";
import {
  parseUriWithJsonPointer,
  uriWithJsonPointerLoose,
  JsonPointerLoose,
  deriveIdentifierFromUri,
} from "@openapi-lsp/core/json-pointer";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DefinitionLink,
  DefinitionParams,
  Hover,
  HoverParams,
  MarkupKind,
  TextDocumentChangeEvent,
  TextDocuments,
} from "vscode-languageserver";
import { VFS } from "./vfs/VFS.js";
import { ServerDocumentManager } from "./analysis/DocumentManager.js";
import { Resolver } from "./analysis/Resolver.js";
import { Workspace } from "./workspace/Workspace.js";
import { DocumentReferenceManager } from "./analysis/DocumentReferenceManager.js";
import { AnalysisManager } from "./analysis/AnalysisManager.js";
import { DocumentConnectivity } from "./analysis/Analysis.js";
import {
  serializeToMarkdown,
  serializeLiteralToMarkdown,
} from "./serialize/index.js";
import { OpenAPI, OpenAPITag } from "@openapi-lsp/core/openapi";
import { SolveResult } from "@openapi-lsp/core/solver";
import { unwrap } from "@openapi-lsp/core/result";

/**
 * Check if a value is a $ref object
 */
function isReference(value: unknown): value is { $ref: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$ref" in value &&
    typeof (value as { $ref: unknown }).$ref === "string"
  );
}

export class OpenAPILanguageServer {
  cache: QueryCache;
  documentManager: ServerDocumentManager;
  resolver: Resolver;
  documentReferenceManager: DocumentReferenceManager;
  analysisManager: AnalysisManager;

  constructor(
    private workspace: Workspace,
    private documents: TextDocuments<TextDocument>,
    private vfs: VFS
  ) {
    this.cache = new QueryCache(
      this.workspace.configuration["openapi-lsp.debug.cache"]
    );
    this.documentManager = new ServerDocumentManager(
      this.documents,
      this.cache,
      this.vfs
    );
    this.resolver = new Resolver(this.documentManager, this.cache);
    this.documentReferenceManager = new DocumentReferenceManager(
      this.documentManager,
      this.resolver,
      this.cache
    );
    this.analysisManager = new AnalysisManager(
      this.workspace,
      this.documentManager,
      this.documentReferenceManager,
      this.vfs,
      this.cache
    );
  }

  async setup() {
    await this.analysisManager.discoverRoots();
  }

  async onDidOpen(event: TextDocumentChangeEvent<TextDocument>) {
    this.documentManager.onDidOpen(event.document);
  }

  // ----- TextDocuments handlers -----
  async onDidChangeContent(event: TextDocumentChangeEvent<TextDocument>) {
    this.documentManager.onDidChangeContent(event.document);
  }

  // ----- Language features handlers -----
  async onDefinition(
    params: DefinitionParams
  ): Promise<DefinitionLink[] | null> {
    const link =
      await this.documentReferenceManager.getDefinitionLinkAtPosition(
        params.textDocument.uri,
        params.position
      );
    return link ? [link] : null;
  }

  async onHover(params: HoverParams): Promise<Hover | null> {
    const uri = params.textDocument.uri;
    const spec = await this.documentManager.getServerDocument(uri);

    if (spec.type !== "openapi" && spec.type !== "component") {
      console.error(`[onHover] Not openapi/component: ${spec.type}`);
      return null;
    }

    // Determine target: either from $ref or from YAML key position
    let targetDocUri: string;
    let targetNodeId: string;
    let targetPath: JsonPointerLoose;

    const refResult = spec.yaml.getRefAtPosition(params.position);
    if (refResult) {
      // Case 1: Hovering over $ref
      const pointerResult = parseUriWithJsonPointer(refResult.ref, uri);
      if (!pointerResult.success) {
        console.error(`[onHover] Case1: Failed to parse ref: ${refResult.ref}`);
        return null;
      }
      targetDocUri = pointerResult.data.docUri;
      targetNodeId = pointerResult.data.url.toString();
      targetPath = pointerResult.data.jsonPointer;
    } else {
      // Case 2: Hovering over YAML key
      const keyResult = spec.yaml.getKeyAtPosition(params.position);
      if (!keyResult) {
        console.error(`[onHover] Case2: No key at position`);
        return null;
      }

      // Check if the value at this key is a $ref object
      const keyValue = spec.yaml.getValueAtPath(keyResult.path);
      if (keyValue && typeof keyValue === "object" && "$ref" in keyValue) {
        // Value is a reference - resolve it like Case 1
        const pointerResult = parseUriWithJsonPointer(
          keyValue.$ref as string,
          uri
        );
        if (!pointerResult.success) {
          console.error(
            `[onHover] Case2: Failed to parse $ref value: ${keyValue.$ref}`
          );
          return null;
        }
        targetDocUri = pointerResult.data.docUri;
        targetNodeId = pointerResult.data.url.toString();
        targetPath = pointerResult.data.jsonPointer;
      } else {
        // Regular value - use as-is
        targetDocUri = uri;
        targetNodeId = uriWithJsonPointerLoose(uri, keyResult.path);
        targetPath = keyResult.path;
      }
    }

    // Shared logic: get analysis, nominal, value, and serialize
    try {
      const dc = await this.analysisManager.documentConnectivityLoader.use([
        "documentConnectivity",
      ]);
      if (!dc.graph.has(targetDocUri)) {
        console.error(`[onHover] targetDocUri not in graph: ${targetDocUri}`);
        return null;
      }

      const groupId = DocumentConnectivity.getGroupId(dc, targetDocUri);
      const groupResult = await this.analysisManager.groupAnalysisLoader.use([
        "groupAnalysis",
        groupId,
      ]);

      const nominal = groupResult.solveResult.getCanonicalNominal(
        targetNodeId
      ) as OpenAPITag;

      const targetDoc = await this.documentManager.getServerDocument(
        targetDocUri
      );
      if (targetDoc.type === "tomb") {
        console.error(`[onHover] targetDoc is tomb: ${targetDocUri}`);
        return null;
      }

      const value = targetDoc.yaml.getValueAtPath(targetPath);
      if (value === undefined) {
        console.error(
          `[onHover] No value at path: ${JSON.stringify(targetPath)}`
        );
        return null;
      }

      // For Parameters, resolve any $ref items to their actual values
      let resolvedValue = value;
      if (nominal === "Parameters" && Array.isArray(value)) {
        resolvedValue = await this.resolveParameterRefs(
          value,
          targetNodeId,
          groupResult.solveResult
        );
      }

      const name: string =
        nominal === "PathItem"
          ? String(targetPath.at(-1) ?? "_")
          : unwrap(deriveIdentifierFromUri(targetNodeId)); // We create the URI from ourselve, cannot fail.

      // Serialize: use nominal serializer if available, else literal fallback
      const markdown = nominal
        ? serializeToMarkdown(nominal, resolvedValue, name)
        : serializeLiteralToMarkdown(resolvedValue, name);

      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: markdown,
        },
      };
    } catch (e) {
      console.error(`[onHover] Exception for ${targetNodeId}`, e);
      return null;
    }
  }

  /**
   * Resolve $ref items in a Parameters array to their actual values.
   * Uses the solver's getValueNodeId to find the ultimate target of each ref.
   * Parameter nodes are special: their `name` is at the value, so it would not be possible for us
   * to name the parameter unless we load it.
   */
  private async resolveParameterRefs(
    items: unknown[],
    parametersNodeId: string,
    solveResult: SolveResult
  ): Promise<OpenAPI.Parameter[]> {
    const resolved: OpenAPI.Parameter[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (isReference(item)) {
        // This is a $ref - resolve it using the solver
        const itemNodeId = `${parametersNodeId}/${i}`;
        const valueNodeId = solveResult.getValueNodeId(itemNodeId);

        if (valueNodeId) {
          // Parse the valueNodeId to get docUri and path
          const parseResult = parseUriWithJsonPointer(valueNodeId);
          if (parseResult.success) {
            const doc = await this.documentManager.getServerDocument(
              parseResult.data.docUri
            );
            if (doc.type !== "tomb") {
              const value = doc.yaml.getValueAtPath(
                parseResult.data.jsonPointer
              );
              if (value && typeof value === "object") {
                resolved.push(value as OpenAPI.Parameter);
                continue;
              }
            }
          }
        }
        // Fallback: skip unresolvable refs
        console.warn(
          `[resolveParameterRefs] Could not resolve ref at index ${i}`
        );
      } else if (item && typeof item === "object") {
        // Already a resolved Parameter object
        resolved.push(item as OpenAPI.Parameter);
      }
    }

    return resolved;
  }
}
