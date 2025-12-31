import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { LineCounter, parseDocument } from "yaml";
import { ServerDocument } from "./ServerDocument.js";
import { YamlDocument } from "./YamlDocument.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node.js";
import { VFS, VFSError } from "../vfs/VFS.js";
import { ok, Result } from "@openapi-lsp/core/result";
import { isOpenapiFile, isComponentFile } from "@openapi-lsp/core/constants";

export class ServerDocumentManager {
  loader: CacheLoader<["serverDocument", string], ServerDocument>;

  constructor(
    private documents: TextDocuments<TextDocument>,
    cache: QueryCache,
    private vfs: VFS
  ) {
    this.loader = cache.createLoader(
      async ([_, uri]): Promise<ServerDocument> => {
        const textResult = await this.readContent(uri);

        if (textResult.success) {
          const lineCounter = new LineCounter();
          const ast = parseDocument(textResult.data, { lineCounter });
          const filename = path.basename(fileURLToPath(uri));

          if (isOpenapiFile(filename)) {
            return {
              type: "openapi",
              uri,
              yaml: new YamlDocument(ast, lineCounter),
            };
          } else if (isComponentFile(filename)) {
            return {
              type: "component",
              uri,
              yaml: new YamlDocument(ast, lineCounter),
            };
          } else {
            return { type: "tomb", uri };
          }
        } else {
          return { type: "tomb", uri };
        }
      }
    );
  }

  // ---- Change Handlers -----

  onDidOpen(_doc: TextDocument) {
    // No-op: loader handles cache setup on first use
  }

  onDidChangeContent(doc: TextDocument) {
    this.loader.invalidate(["serverDocument", doc.uri]);
  }

  getServerDocument = async (uri: string): Promise<ServerDocument> => {
    return await this.loader.use(["serverDocument", uri]);
  };

  load = (ctx: CacheComputeContext, uri: string): Promise<ServerDocument> => {
    return this.loader.load(ctx, ["serverDocument", uri]);
  };

  private async readContent(uri: string): Promise<Result<string, VFSError>> {
    const text = this.documents.get(uri)?.getText();
    if (text) {
      return ok(text);
    }

    const loadTextResult = await this.vfs.readFile(fileURLToPath(uri));
    if (loadTextResult.success) {
      return ok(loadTextResult.data);
    } else {
      console.error("Failed to read uri", uri, loadTextResult);
      return loadTextResult;
    }
  }
}
