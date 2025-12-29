import { QueryCache } from "@openapi-lsp/core/queries";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DefinitionLink,
  DefinitionParams,
  TextDocumentChangeEvent,
} from "vscode-languageserver";
import { parseDocument } from "yaml";
import { SpecDocument } from "./document/SpecDocument.js";
import { SpecDocumentDefinitions } from "./document/SpecDefinition.js";
import { analyzeSpecDocument } from "./analysis/analyze.js";
import { SpecAnalysis } from "./analysis/SpecAnalysis.js";

export class OpenAPILanguageServer {
  cache = new QueryCache();

  constructor() {}

  async onDidOpen(event: TextDocumentChangeEvent<TextDocument>) {
    this.cache.set(["specDocument.yamlAst", event.document.uri], {
      computeFn: async (): Promise<SpecDocument> => {
        return {
          type: "openapi",
          uri: event.document.uri,
          yamlAst: parseDocument(event.document.getText()),
        };
      },
    });

    this.cache.set(["specDocument.analyze", event.document.uri], {
      computeFn: async (ctx): Promise<SpecAnalysis> => {
        const yamlAst = (await ctx.load([
          "specDocument.yamlAst",
          event.document.uri,
        ])) as SpecDocument;

        return analyzeSpecDocument(yamlAst);
      },
    });

    this.cache.set(["specDocument.getDefinitions", event.document.uri], {
      computeFn: async (ctx): Promise<SpecDocumentDefinitions> => {
        const yamlAst = (await ctx.load([
          "specDocument.yamlAst",
          event.document.uri,
        ])) as SpecDocument;

        return new Map();
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
    return [];
  }
}
