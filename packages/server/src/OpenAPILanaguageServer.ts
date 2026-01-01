import { QueryCache } from "@openapi-lsp/core/queries";
import { parseUriWithJsonPointer } from "@openapi-lsp/core/json-pointer";
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
import { serializeToMarkdown } from "./serialize/index.js";
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
      return null;
    }

    // Get $ref at position
    const refResult = spec.yaml.getRefAtPosition(params.position);
    if (!refResult) {
      return null;
    }

    try {
      // Build target NodeId
      const pointerResult = parseUriWithJsonPointer(refResult.ref, uri);

      if (!pointerResult.success) {
        return null;
      }

      const {
        jsonPointer: targetJsonPointer,
        url: targetUrl,
        docUri: targetDocUri,
      } = pointerResult.data;
      const targetNodeId = targetUrl.toString();

      // Get document connectivity
      const dc = await this.analysisManager.documentConnectivityLoader.use([
        "documentConnectivity",
      ]);

      if (!dc.graph.has(targetDocUri)) {
        return null;
      }

      // Get group analysis for target
      const groupId = DocumentConnectivity.getGroupId(dc, targetDocUri);
      const groupResult = await this.analysisManager.groupAnalysisLoader.use([
        "groupAnalysis",
        groupId,
      ]);

      // Get nominal (type tag like Schema, Response, etc.)
      const nominal = groupResult.solveResult.getCanonicalNominal(
        targetNodeId
      ) as OpenAPITag;
      if (!nominal) {
        console.info(
          `onHover is not available because ${targetNodeId} has no nominal`
        );
        return null;
      }

      // Extract name from ref
      const name = (targetJsonPointer.at(-1) ?? refResult.key) || "Unknown";

      // Resolve target document and get the value at path
      const targetDoc = await this.documentManager.getServerDocument(
        targetNodeId
      );

      if (targetDoc.type === "tomb") return null;

      const targetValue = this.getValueAtPath(
        targetDoc.yaml.ast.toJS(),
        targetJsonPointer
      );
      if (!targetValue) return null;

      // Serialize based on nominal type
      const markdown = serializeToMarkdown(nominal, targetValue, name);

      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: markdown,
        },
      };
    } catch {
      return null;
    }
  }

  private getValueAtPath(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const segment of path) {
      if (current === null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }
}
