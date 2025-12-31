import { QueryCache } from "@openapi-lsp/core/queries";
import {
  isRequestBody,
  isSchema,
  isReference,
  isMediaType,
  isContent,
  isResponse,
} from "@openapi-lsp/core/openapi";
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
import { SpecDocument } from "./analysis/ServerDocument.js";
import { analyzeSpecDocument } from "./analysis/analyze.js";
import { Analysis } from "./analysis/Analysis.js";
import {
  serializeSchemaToMarkdown,
  serializeRequestBodyToMarkdown,
  serializeRefToMarkdown,
  serializeContentToMarkdown,
  serializeMediaTypeToMarkdown,
  serializeResponseToMarkdown,
  SerializeOptions,
} from "./serialize/index.js";
import { getDefinitionKeyByPosition } from "./analysis/getDefinitionKeyByPosition.js";
import { resolveRef } from "./analysis/resolveRef.js";
import { VFS } from "./vfs/VFS.js";
import { ServerDocumentManager } from "./analysis/DocumentManager.js";
import { Resolver } from "./analysis/Resolver.js";
import { Workspace } from "./workspace/Workspace.js";
import { DocumentReferenceManager } from "./analysis/DocumentReferenceManager.js";

export class OpenAPILanguageServer {
  cache: QueryCache;
  documentManager: ServerDocumentManager;
  resolver: Resolver;
  documentReferenceManager: DocumentReferenceManager;

  constructor(
    // @ts-ignore
    private _workspace: Workspace,
    private documents: TextDocuments<TextDocument>,
    private vfs: VFS
  ) {
    this.cache = new QueryCache();
    this.documentManager = new ServerDocumentManager(
      this.documents,
      this.cache,
      this.vfs
    );
    this.resolver = new Resolver(this.documentManager);
    this.documentReferenceManager = new DocumentReferenceManager(
      this.documentManager,
      this.resolver,
      this.cache
    );
  }

  async onDidOpen(event: TextDocumentChangeEvent<TextDocument>) {
    this.documentManager.onDidOpen(event.document);

    this.cache.set(["specDocument.analyze", event.document.uri], {
      computeFn: async (ctx): Promise<Analysis> => {
        const yamlAst = (await ctx.load([
          "serverDocument",
          event.document.uri,
        ])) as SpecDocument;

        return analyzeSpecDocument(yamlAst);
      },
    });
  }

  // ----- TextDocuments handlers -----
  async onDidChangeContent(event: TextDocumentChangeEvent<TextDocument>) {
    this.documentManager.onDidChangeContent(event.document);
  }

  // ----- Language features handlers -----
  async onDefinition(
    params: DefinitionParams
  ): Promise<DefinitionLink[] | null> {
    const link = await this.documentReferenceManager.getDefinitionLinkAtPosition(
      params.textDocument.uri,
      params.position
    );
    return link ? [link] : null;
  }

  async onHover(params: HoverParams): Promise<Hover | null> {
    const spec = await this.documentManager.getServerDocument(
      params.textDocument.uri
    );

    if (spec.type !== "openapi") return null;

    const analysis = (await this.cache.compute([
      "specDocument.analyze",
      params.textDocument.uri,
    ])) as Analysis;

    // Try to find definition from $ref
    let definition = null;
    const refStr = spec.yaml.getRefAtPosition(params.position);
    if (refStr) {
      definition = resolveRef({ $ref: refStr }, analysis);
    }

    // If not on a $ref, check if on a component key
    if (!definition) {
      definition = getDefinitionKeyByPosition(analysis, params.position);
    }

    if (!definition) {
      console.error("Cannot retrieve definition");
      return null;
    }

    let markdown: string | null = null;

    const serializeOptions: SerializeOptions = {
      name: definition.name,
    };

    if (isSchema(definition.component)) {
      markdown = serializeSchemaToMarkdown(
        definition.component,
        serializeOptions
      );
    } else if (isRequestBody(definition.component)) {
      markdown = serializeRequestBodyToMarkdown(
        definition.component,
        serializeOptions
      );
    } else if (isReference(definition.component)) {
      markdown = serializeRefToMarkdown(definition.component, serializeOptions);
    } else if (isMediaType(definition.component)) {
      markdown = serializeMediaTypeToMarkdown(
        definition.component,
        serializeOptions
      );
    } else if (isContent(definition.component)) {
      markdown = serializeContentToMarkdown(
        definition.component,
        serializeOptions
      );
    } else if (isResponse(definition.component)) {
      markdown = serializeResponseToMarkdown(
        definition.component,
        serializeOptions
      );
    }

    if (!markdown) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: markdown,
      },
    };
  }
}
