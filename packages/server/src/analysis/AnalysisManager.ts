import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import { ServerDocumentManager } from "./DocumentManager.js";
import { Analysis } from "./Analysis.js";
import { analyzeSpecDocument } from "./analyze.js";
import { Workspace } from "../workspace/Workspace.js";
import { VFS } from "../vfs/VFS.js";
import { DocumentConnectivity } from "./Analysis.js";
import { md5 } from "js-md5";
import { fileURLToPath, pathToFileURL } from "url";
import { openapiFilePatterns } from "@openapi-lsp/core/constants";
import { DocumentReferenceManager } from "./DocumentReferenceManager.js";

export class AnalysisManager {
  loader: CacheLoader<["specDocument.analyze", string], Analysis>;
  documentConnectivityLoader: CacheLoader<
    ["documentConnectivity"],
    DocumentConnectivity
  >;

  constructor(
    private workspace: Workspace,
    private documentManager: ServerDocumentManager,
    private referenceManager: DocumentReferenceManager,
    private vfs: VFS,
    cache: QueryCache
  ) {
    this.loader = cache.createLoader(
      async ([_, uri], ctx): Promise<Analysis> => {
        const spec = await this.documentManager.load(ctx, uri);

        if (spec.type !== "openapi") {
          throw new Error(`Cannot analyze non-openapi document: ${spec.type}`);
        }

        return analyzeSpecDocument(spec);
      }
    );

    this.documentConnectivityLoader = cache.createLoader(
      async ([_], ctx): Promise<DocumentConnectivity> => {
        const dc = DocumentConnectivity.createDefault();

        const dfs = async (uri: string) => {
          const neighbors = new Set<string>();
          dc.graph.set(uri, neighbors);

          const rootDocument = await this.documentManager.load(ctx, uri);
          if (
            rootDocument.type === "openapi" ||
            rootDocument.type === "component"
          ) {
            const { references } = await this.referenceManager.load(ctx, uri);

            for (const { resolved } of references) {
              if (resolved.success) {
                const { uri: neighborUri } = resolved.data;

                if (neighborUri === uri) {
                  // Ignore self-references which does not contribute to connectivity.
                  continue;
                }

                // Concurrency: one dfs can only practice on one uri at one time.
                // Here, checking `!dc.graph.has(neighborUri)` not only implements dfs's algorithm
                // but also avoids competing with another async execution.
                neighbors.add(neighborUri);
                if (
                  resolved.data.type !== "tomb" &&
                  !dc.graph.has(neighborUri)
                ) {
                  // Will run to `dc.graph.set(uri, neighbors);` synchronously.
                  await dfs(neighborUri);
                }
              }
            }
          }
        };

        // Discover all roots from all workspace folders
        const allRoots: string[] = [];
        for (const folder of this.workspace.workspaceFolders) {
          const folderPath = fileURLToPath(folder.uri);
          const roots = await this.vfs.glob(
            openapiFilePatterns.map((p) => `**/${p}`),
            {
              cwd: folderPath,
              exclude: [
                this.workspace.configuration[
                  "openapi-lsp.discoverRoots.ignore"
                ],
              ],
            }
          );
          allRoots.push(
            ...roots.map(({ path }) => pathToFileURL(path).toString())
          );

          console.info(
            `Discovered root${
              roots.length !== 1 ? "s" : ""
            } ${new Intl.ListFormat("en-US").format(
              roots.map((root) => root.path)
            )} for workspace folder ${JSON.stringify(folder.name)}`
          );
        }

        await Promise.all(allRoots.map((uri) => dfs(uri)));

        console.log(AnalysisManager.toGraphviz(dc));

        return dc;
      }
    );
  }

  getAnalysis = async (uri: string): Promise<Analysis> => {
    return await this.loader.use(["specDocument.analyze", uri]);
  };

  load = (ctx: CacheComputeContext, uri: string): Promise<Analysis> => {
    return this.loader.load(ctx, ["specDocument.analyze", uri]);
  };

  static toGraphviz(dc: DocumentConnectivity): string {
    // Collect all URIs to find the longest common prefix
    const allUris: string[] = [];
    for (const [uri, neighbors] of dc.graph) {
      allUris.push(uri);
      for (const neighbor of neighbors) {
        allUris.push(neighbor);
      }
    }

    // Find longest common prefix
    const longestCommonPrefix = (strs: string[]): string => {
      if (strs.length === 0) return "";
      let prefix = strs[0];
      for (let i = 1; i < strs.length; i++) {
        while (!strs[i].startsWith(prefix)) {
          prefix = prefix.slice(0, -1);
          if (prefix === "") return "";
        }
      }
      return prefix;
    };

    const prefix = longestCommonPrefix(allUris);
    const trimUri = (uri: string) => uri.slice(prefix.length);

    const lines: string[] = ["digraph DocumentConnectivity {"];

    for (const [uri, neighbors] of dc.graph) {
      const from = JSON.stringify(trimUri(uri));
      for (const neighbor of neighbors) {
        const to = JSON.stringify(trimUri(neighbor));
        lines.push(`  ${from} -> ${to};`);
      }
    }

    lines.push("}");
    return lines.join("\n");
  }

  static logGraphviz(dc: DocumentConnectivity): void {
    console.debug(AnalysisManager.toGraphviz(dc));
  }

  static getConnectivityHash(dc: DocumentConnectivity): string {
    const hash = md5.create();
    const orderedKeys = dc.graph.keys();
    for (const key of orderedKeys) {
      hash.update(key);
      hash.update("\n\n"); // '\n' is escaped during URI creation
      const values = dc.graph.get(key)!;

      // No need to sort here since it retains insertion order, and it is stable with parsing order.
      for (const v of values) {
        hash.update(v);
        hash.update("\n");
      }
    }

    return hash.base64();
  }

  async discoverRoots(): Promise<DocumentConnectivity> {
    return await this.documentConnectivityLoader.use(["documentConnectivity"]);
  }
}
