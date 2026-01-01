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

        await Promise.all(
          allRoots.map((uri) => this.dfsConnectivity(ctx, dc, uri))
        );

        // Compute SCCs using Kosaraju's algorithm
        this.computeAnalysisGroups(dc);

        AnalysisManager.logGraphviz(dc);
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

  private async dfsConnectivity(
    ctx: CacheComputeContext,
    dc: DocumentConnectivity,
    uri: string
  ): Promise<void> {
    const neighbors = new Set<string>();
    dc.graph.set(uri, neighbors);

    const rootDocument = await this.documentManager.load(ctx, uri);
    if (rootDocument.type === "openapi" || rootDocument.type === "component") {
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
          if (resolved.data.type !== "tomb" && !dc.graph.has(neighborUri)) {
            // Will run to `dc.graph.set(uri, neighbors);` synchronously.
            await this.dfsConnectivity(ctx, dc, neighborUri);
          }
        }
      }
    }
  }

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
    lines.push("  compound=true;");

    // Draw SCCs as subgraph clusters (renders as boxes around grouped nodes)
    let clusterIndex = 0;
    for (const [_, members] of dc.analysisGroups) {
      lines.push(`  subgraph cluster_${clusterIndex++} {`);
      lines.push(`    style=rounded;`);
      lines.push(`    label="SCC";`);
      for (const member of members) {
        const name = JSON.stringify(trimUri(member));
        lines.push(`    ${name} [label=${name}];`);
      }
      lines.push(`  }`);
    }

    // Draw all edges
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

  /**
   * Compute SCCs using Kosaraju's algorithm.
   * Only multi-file SCCs are stored to save space.
   */
  private computeAnalysisGroups(dc: DocumentConnectivity): void {
    const graph = dc.graph;
    const vertices = [...graph.keys()];

    // Step 1: First DFS to get finish order
    const visited = new Set<string>();
    const finishOrder: string[] = [];

    const dfsForFinishOrder = (uri: string) => {
      if (visited.has(uri)) return;
      visited.add(uri);
      for (const neighbor of graph.get(uri) ?? []) {
        dfsForFinishOrder(neighbor);
      }
      finishOrder.push(uri);
    };

    for (const v of vertices) {
      dfsForFinishOrder(v);
    }

    // Step 2: Build transposed graph
    const transposed = new Map<string, Set<string>>();
    for (const v of vertices) {
      transposed.set(v, new Set());
    }
    for (const [from, neighbors] of graph) {
      for (const to of neighbors) {
        transposed.get(to)?.add(from);
      }
    }

    // Step 3: Second DFS in reverse finish order on transposed graph
    visited.clear();

    const dfsBuildSccs = (uri: string, component: Set<string>) => {
      if (visited.has(uri)) return;
      visited.add(uri);
      component.add(uri);
      for (const neighbor of transposed.get(uri) ?? []) {
        dfsBuildSccs(neighbor, component);
      }
    };

    while (finishOrder.length > 0) {
      const uri = finishOrder.pop()!;
      if (!visited.has(uri)) {
        const component = new Set<string>();
        dfsBuildSccs(uri, component);

        // Only include multi-file SCCs to save space
        if (component.size > 1) {
          // Group ID is the alphabetically smallest URI
          const groupId = [...component].sort()[0];
          dc.analysisGroups.set(groupId, component);
          for (const member of component) {
            dc.uriToAnalysisGroupId.set(member, groupId);
          }
        }
      }
    }
  }

  static logAnalysisGroups(dc: DocumentConnectivity): void {
    console.debug("Analysis Groups (SCCs):");
    for (const [groupId, members] of dc.analysisGroups) {
      console.debug(`  ${groupId}: [${[...members].join(", ")}]`);
    }
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
