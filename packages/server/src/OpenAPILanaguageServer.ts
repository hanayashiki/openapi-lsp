import { QueryCache } from "@openapi-lsp/core/queries";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DefinitionLink,
  DefinitionParams,
  TextDocumentChangeEvent,
} from "vscode-languageserver";
import { parseDocument, LineCounter } from "yaml";
import { SpecDocument } from "./document/SpecDocument.js";
import { analyzeSpecDocument } from "./analysis/analyze.js";
import { Analysis } from "./analysis/Analysis.js";
import { getRefByPosition } from "./analysis/getRefByPosition.js";
import { parseLocalRef } from "./analysis/parseLocalRef.js";

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
    this.cache.invalidateByKey(["SpecDocument", event.document.uri]);
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
        targetSelectionRange: definition.componentNameRange,
      },
    ];
  }
}
