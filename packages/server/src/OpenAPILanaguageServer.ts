import { QueryCache } from "@openapi-lsp/core/queries";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DefinitionLink,
  DefinitionParams,
  Hover,
  HoverParams,
  MarkupKind,
  TextDocumentChangeEvent,
} from "vscode-languageserver";
import { parseDocument, LineCounter } from "yaml";
import { SpecDocument } from "./analysis/SpecDocument.js";
import { analyzeSpecDocument } from "./analysis/analyze.js";
import { Analysis } from "./analysis/Analysis.js";
import { getRefByPosition } from "./analysis/getRefByPosition.js";
import { parseLocalRef } from "./analysis/parseLocalRef.js";
import {
  serializeSchemaToMarkdown,
  serializeRequestBodyToMarkdown,
  SerializeOptions,
} from "./analysis/serializeSchema.js";
import { getComponentKeyByPosition } from "./analysis/getComponentKeyByPosition.js";
import { resolveRef } from "./analysis/resolveRef.js";

export class OpenAPILanguageServer {
  cache = new QueryCache();

  constructor() {}

  async onDidOpen(event: TextDocumentChangeEvent<TextDocument>) {
    this.cache.set(["specDocument.yamlAst", event.document.uri], {
      computeFn: async (): Promise<SpecDocument> => {
        const lineCounter = new LineCounter();
        return {
          type: "openapi",
          uri: event.document.uri,
          yamlAst: parseDocument(event.document.getText(), { lineCounter }),
          lineCounter,
        };
      },
    });

    this.cache.set(["specDocument.analyze", event.document.uri], {
      computeFn: async (ctx): Promise<Analysis> => {
        const yamlAst = (await ctx.load([
          "specDocument.yamlAst",
          event.document.uri,
        ])) as SpecDocument;

        return analyzeSpecDocument(yamlAst);
      },
    });
  }

  // ----- TextDocuments handlers -----
  async onDidChangeContent(event: TextDocumentChangeEvent<TextDocument>) {
    this.cache.invalidateByKey(["specDocument.yamlAst", event.document.uri]);
  }

  // ----- Language features handlers -----
  async onDefinition(
    params: DefinitionParams
  ): Promise<DefinitionLink[] | null> {
    const spec = (await this.cache.compute([
      "specDocument.yamlAst",
      params.textDocument.uri,
    ])) as SpecDocument;

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
    const spec = (await this.cache.compute([
      "specDocument.yamlAst",
      params.textDocument.uri,
    ])) as SpecDocument;

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
      definition = getComponentKeyByPosition(analysis, params.position);
    }

    if (!definition) return null;

    let markdown: string | null = null;

    const serializeOptions: SerializeOptions = {
      name: definition.name,
    };

    switch (definition.component.kind) {
      case "schema":
        markdown = serializeSchemaToMarkdown(
          definition.component.value,
          serializeOptions
        );
        break;
      case "requestBody":
        markdown = serializeRequestBodyToMarkdown(
          definition.component.value,
          serializeOptions
        );
        break;
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
