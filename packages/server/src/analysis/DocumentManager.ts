import {
  CacheComputeContext,
  CacheLoader,
  LoaderResult,
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
      async ([_, uri]): Promise<LoaderResult<ServerDocument>> => {
        const textResult = await this.readContent(uri);

        if (textResult.success) {
          const lineCounter = new LineCounter();
          const ast = parseDocument(textResult.data, { lineCounter });
          const filename = path.basename(fileURLToPath(uri));
          const yaml = new YamlDocument(ast, lineCounter);
          const hash = yaml.getHash();

          if (isOpenapiFile(filename)) {
            return {
              value: { type: "openapi", uri, yaml },
              hash,
            };
          } else if (isComponentFile(filename)) {
            return {
              value: { type: "component", uri, yaml },
              hash,
            };
          } else {
            return { value: { type: "tomb", uri }, hash: "" };
          }
        } else {
          return { value: { type: "tomb", uri }, hash: "" };
        }
      }
    );
  }

  // ---- Change Handlers -----
  invalidate(uri: string) {
    this.loader.invalidate(["serverDocument", uri]);
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
      console.info("[readContent] from documents", uri);
      return ok(text);
    }

    const loadTextResult = await this.vfs.readFile(fileURLToPath(uri));
    if (loadTextResult.success) {
      console.info("[readContent] from vfs", uri);
      return ok(loadTextResult.data);
    } else {
      console.error("Failed to read uri", uri, loadTextResult);
      return loadTextResult;
    }
  }
}
