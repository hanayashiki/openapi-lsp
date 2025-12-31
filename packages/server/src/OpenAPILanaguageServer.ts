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
import { getRefByPosition } from "./analysis/getRefByPosition.js";
import { parseLocalRef } from "./analysis/parseLocalRef.js";
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

export class OpenAPILanguageServer {
  cache: QueryCache;
  documentManager: ServerDocumentManager;

  constructor(
    private documents: TextDocuments<TextDocument>,
    private vfs: VFS
  ) {
    this.cache = new QueryCache();
    this.documentManager = new ServerDocumentManager(
      this.documents,
      this.cache,
      this.vfs
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
    const spec = await this.documentManager.getServerDocument(
      params.textDocument.uri
    );

    if (spec.type !== "openapi") return null;

    const analysis = (await this.cache.compute([
      "specDocument.analyze",
      params.textDocument.uri,
    ])) as Analysis;

    const ref = getRefByPosition(spec, params.position);
    if (!ref) return null;

    const path = parseLocalRef(ref.$ref);
    if (!path) return null;

    const definition = analysis.definitions.find(
      (d) =>
        d.path.length === path.length && d.path.every((p, i) => p === path[i])
    );
    if (!definition) return null;

    return [
      {
        targetUri: params.textDocument.uri,
        targetRange: definition.definitionRange,
        targetSelectionRange: definition.nameRange,
      },
    ];
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
    const ref = getRefByPosition(spec, params.position);
    if (ref) {
      definition = resolveRef(ref, analysis);
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
