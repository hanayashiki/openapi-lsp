import { QueryCache } from "@openapi-lsp/core/queries";
import { fileURLToPath } from "node:url";
import { LineCounter, parseDocument } from "yaml";
import { ServerDocument } from "./ServerDocument.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node.js";
import { VFS, VFSError } from "../vfs/VFS.js";
import { ok, Result } from "@openapi-lsp/core/result";

export class ServerDocumentManager {
  constructor(
    private documents: TextDocuments<TextDocument>,
    private cache: QueryCache,
    private vfs: VFS
  ) {
    // TODO: check workspace limit - do not resolve outside the workspace
  }

  onDidOpen(doc: TextDocument) {
    const { uri } = doc;
    this.setCache(uri);
  }

  private setCache = (uri: string) => {
    this.cache.set(["serverDocument", uri], {
      computeFn: async (): Promise<ServerDocument> => {
        const textResult = await this.readContent(uri);

        if (textResult.success) {
          const lineCounter = new LineCounter();

          return {
            type: "openapi",
            uri,
            yamlAst: parseDocument(textResult.data, { lineCounter }),
            lineCounter,
          };
        } else {
          return {
            type: "tomb",
            uri,
          };
        }
      },
    });
  };

  getServerDocument = async (uri: string): Promise<ServerDocument> => {
    return (await this.cache.compute([
      "serverDocument",
      uri,
    ])) as ServerDocument;
  };

  onDidChangeContent(doc: TextDocument) {
    this.cache.invalidateByKey(["serverDocument", doc.uri]);
  }

  async readContent(uri: string): Promise<Result<string, VFSError>> {
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
