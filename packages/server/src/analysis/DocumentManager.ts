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
import { VFS, VFSError, GlobOptions } from "../vfs/VFS.js";
import { matchPathWithGlob } from "../vfs/glob.js";
import { ok, Result } from "@openapi-lsp/core/result";
import { isOpenapiFile, isComponentFile } from "@openapi-lsp/core/constants";
import { md5 } from "js-md5";

function matchFileUrlWithGlob(
  uri: string,
  patterns: string[],
  options: GlobOptions
): boolean {
  try {
    const filePath = fileURLToPath(uri);
    return matchPathWithGlob(filePath, patterns, options);
  } catch {
    // Skip non-file:// URIs
    return false;
  }
}

// Use a type compatible with CacheKey (no optional fields in the interface cause issues)
type GlobCacheKey = ["documentGlob", string[], { cwd: string; exclude: string[] | undefined }];

export class ServerDocumentManager {
  loader: CacheLoader<["serverDocument", string], ServerDocument>;
  globLoader: CacheLoader<GlobCacheKey, string[]>;

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

    this.globLoader = cache.createLoader(
      async ([_, patterns, options]): Promise<LoaderResult<string[]>> => {
        const matchedUris: string[] = [];
        for (const uri of this.documents.keys()) {
          if (matchFileUrlWithGlob(uri, patterns, options)) {
            matchedUris.push(uri);
          }
        }

        // Hash based on sorted URIs for stable comparison
        const sortedUris = [...matchedUris].sort();
        const hash = md5(sortedUris.join("\0"));

        return { value: matchedUris, hash };
      }
    );
  }

  // ---- Change Handlers -----
  invalidate(uri: string) {
    this.loader.invalidate(["serverDocument", uri]);

    // Invalidate glob queries that match this URI
    this.globLoader.invalidateMatching(([_, patterns, options]) =>
      matchFileUrlWithGlob(uri, patterns, options)
    );
  }

  getServerDocument = async (uri: string): Promise<ServerDocument> => {
    return await this.loader.use(["serverDocument", uri]);
  };

  load = (ctx: CacheComputeContext, uri: string): Promise<ServerDocument> => {
    return this.loader.load(ctx, ["serverDocument", uri]);
  };

  glob(pattern: string | string[], options: GlobOptions): string[] {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    const matchedUris: string[] = [];

    for (const uri of this.documents.keys()) {
      if (matchFileUrlWithGlob(uri, patterns, options)) {
        matchedUris.push(uri);
      }
    }

    return matchedUris;
  }

  loadGlob = (
    ctx: CacheComputeContext,
    pattern: string | string[],
    options: GlobOptions
  ): Promise<string[]> => {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return this.globLoader.load(ctx, [
      "documentGlob",
      patterns,
      { cwd: options.cwd, exclude: options.exclude },
    ]);
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
