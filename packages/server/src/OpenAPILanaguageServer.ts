import { QueryCache } from "@openapi-lsp/core/queries";
import {
  parseUriWithJsonPointer,
  uriWithJsonPointerLoose,
  JsonPointerLoose,
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
import { OpenAPITag } from "@openapi-lsp/core/openapi";

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
    this.cache = new QueryCache();
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
    let name: string;

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
      name = String(targetPath.at(-1) ?? refResult.key) || "Unknown";
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
        name = keyResult.key; // Keep the original key name for display
      } else {
        // Regular value - use as-is
        targetDocUri = uri;
        targetNodeId = uriWithJsonPointerLoose(uri, keyResult.path);
        targetPath = keyResult.path;
        name = keyResult.key;
      }
    }

    // Shared logic: get analysis, nominal, value, and serialize
    try {
      const dc = await this.analysisManager.documentConnectivityLoader.use([
        "documentConnectivity",
      ]);
      if (!dc.graph.has(targetDocUri)) {
        console.error(
          `[onHover] targetDocUri not in graph: ${targetDocUri}`
        );
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

      // Serialize: use nominal serializer if available, else literal fallback
      const markdown = nominal
        ? serializeToMarkdown(nominal, value, name)
        : serializeLiteralToMarkdown(value, name);

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
}
