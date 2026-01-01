import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import {
  Solver,
  LocalShape,
  NodeId,
  NominalId,
  JSONType,
} from "@openapi-lsp/core/solver";
import { ServerDocumentManager } from "./DocumentManager.js";
import {
  ParseResult,
  DocumentConnectivity,
  GroupAnalysisResult,
} from "./Analysis.js";
import { parseSpecDocument } from "./analyze.js";
import { extractNodes, extractStructuralNominals } from "./solver.js";
import { isNodeInDocument } from "@openapi-lsp/core/json-pointer";
import { extendMap } from "@openapi-lsp/core/collections";
import { OpenAPITag } from "@openapi-lsp/core/openapi";
import { Workspace } from "../workspace/Workspace.js";
import { VFS } from "../vfs/VFS.js";
import { md5 } from "js-md5";
import { fileURLToPath, pathToFileURL } from "url";
import { openapiFilePatterns } from "@openapi-lsp/core/constants";
import { DocumentReferenceManager } from "./DocumentReferenceManager.js";

export class AnalysisManager {
  parseResultLoader: CacheLoader<["specDocument.parse", string], ParseResult>;
  documentConnectivityLoader: CacheLoader<
    ["documentConnectivity"],
    DocumentConnectivity
  >;
  groupAnalysisLoader: CacheLoader<
    ["groupAnalysis", string],
    GroupAnalysisResult
  >;

  constructor(
    private workspace: Workspace,
    private documentManager: ServerDocumentManager,
    private referenceManager: DocumentReferenceManager,
    private vfs: VFS,
    cache: QueryCache
  ) {
    this.parseResultLoader = cache.createLoader(
      async ([_, uri], ctx): Promise<ParseResult> => {
        const spec = await this.documentManager.load(ctx, uri);

        if (spec.type !== "openapi") {
          throw new Error(`Cannot analyze non-openapi document: ${spec.type}`);
        }

        return parseSpecDocument(spec);
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

        return dc;
      }
    );

    this.groupAnalysisLoader = cache.createLoader(
      async ([_, groupId], ctx): Promise<GroupAnalysisResult> => {
        // 1. Load document connectivity
        // FIXME: retrieve upstreams from context, since `documentConnectivity` is updated on every change!
        const dc = await this.documentConnectivityLoader.load(ctx, [
          "documentConnectivity",
        ]);

        // 2. Get incoming types/nominals from upstream groups
        const incomingTypes = new Map<NodeId, JSONType[]>();
        const incomingNominals = new Map<NodeId, NominalId[]>();

        const upstreamGroupIds =
          dc.groupIncomingEdges.get(groupId) ?? new Set();
        for (const upstreamId of upstreamGroupIds) {
          const upstream = await this.groupAnalysisLoader.load(ctx, [
            "groupAnalysis",
            upstreamId,
          ]);

          // Collect outgoing types/nominals from upstream
          for (const [
            nodeId,
            type,
          ] of upstream.solveResult.getOutgoingTypes()) {
            if (!incomingTypes.has(nodeId)) incomingTypes.set(nodeId, []);
            incomingTypes.get(nodeId)!.push(type);
          }
          for (const [
            nodeId,
            nominal,
          ] of upstream.solveResult.getOutgoingNominals()) {
            if (!incomingNominals.has(nodeId)) incomingNominals.set(nodeId, []);
            incomingNominals.get(nodeId)!.push(nominal);
          }
        }

        // 3. Get member URIs for this group
        const memberUris = dc.analysisGroups.get(groupId) ?? new Set([groupId]);

        // 4. Extract nodes/nominals from each document
        const allNodes = new Map<NodeId, LocalShape>();
        const allNominals = new Map<NodeId, NominalId>();

        for (const uri of memberUris) {
          const doc = await this.documentManager.load(ctx, uri);
          if (doc.type === "openapi") {
            const parseResult = await this.parseResultLoader.load(ctx, [
              "specDocument.parse",
              uri,
            ]);
            const { nodes, nominals, outgoingNominals } = extractNodes(
              uri,
              doc,
              parseResult.document
            );

            extendMap(allNodes, nodes);
            extendMap(allNominals, nominals);
            extendMap(allNominals, outgoingNominals);
          }
          // Component files: nodes from YAML, nominals from structural propagation
          else if (doc.type === "component") {
            const shapes = doc.yaml.collectLocalShapes(uri);
            extendMap(allNodes, shapes);

            // For nodes with incoming nominals, extract structural nominals
            // This propagates nominals through the component's structure
            for (const [nodeId, incomings] of incomingNominals) {
              // Only process nodes that belong to this document
              if (!isNodeInDocument(nodeId, uri)) continue;

              for (const incomingNominal of incomings) {
                const { outgoing, local } =
                  extractStructuralNominals(
                    uri,
                    doc,
                    nodeId,
                    incomingNominal as OpenAPITag
                  ) ?? {};
                extendMap(allNominals, outgoing);
                extendMap(allNominals, local);
              }
            }
          }
        }

        // 5. Run the Solver
        const solver = new Solver();
        const solveResult = solver.solve({
          nodes: allNodes,
          nominals: allNominals,
          incomingTypes,
          incomingNominals,
        });

        return { groupId, solveResult };
      }
    );
  }

  async getParseResult(uri: string): Promise<ParseResult> {
    return await this.parseResultLoader.use(["specDocument.parse", uri]);
  }

  async load(ctx: CacheComputeContext, uri: string): Promise<ParseResult> {
    return await this.parseResultLoader.load(ctx, ["specDocument.parse", uri]);
  }

  async discoverRoots(): Promise<DocumentConnectivity> {
    return await this.documentConnectivityLoader.use(["documentConnectivity"]);
  }

  // ----- analytic algoritms -----
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

  /**
   * Compute SCCs using Kosaraju's algorithm and collect inter-group edges.
   * Only multi-file SCCs are stored in analysisGroups to save space.
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

    // Step 3: Second DFS to find SCCs, tracking numeric SCC index per node
    visited.clear();
    const uriToSccIndex = new Map<string, number>();
    const sccComponents: Set<string>[] = [];
    let sccIndex = 0;

    const dfsBuildSccs = (
      uri: string,
      component: Set<string>,
      index: number
    ) => {
      if (visited.has(uri)) return;
      visited.add(uri);
      component.add(uri);
      uriToSccIndex.set(uri, index);
      for (const neighbor of transposed.get(uri) ?? []) {
        dfsBuildSccs(neighbor, component, index);
      }
    };

    while (finishOrder.length > 0) {
      const uri = finishOrder.pop()!;
      if (!visited.has(uri)) {
        const component = new Set<string>();
        dfsBuildSccs(uri, component, sccIndex);
        sccComponents.push(component);
        sccIndex++;
      }
    }

    // Step 4: Collect inter-SCC edges using numeric indices
    const sccIncoming: Set<number>[] = sccComponents.map(() => new Set());

    for (const [fromUri, toUris] of graph) {
      const fromScc = uriToSccIndex.get(fromUri)!;
      for (const toUri of toUris) {
        const toScc = uriToSccIndex.get(toUri)!;
        if (fromScc !== toScc) {
          sccIncoming[toScc].add(fromScc);
        }
      }
    }

    // Step 5: Map numeric indices to string group IDs and populate dc
    const sccIndexToGroupId: string[] = sccComponents.map(
      (component) => [...component].sort()[0]
    );

    for (let i = 0; i < sccComponents.length; i++) {
      const component = sccComponents[i];
      const groupId = sccIndexToGroupId[i];

      // Only store multi-file SCCs in analysisGroups
      if (component.size > 1) {
        dc.analysisGroups.set(groupId, component);
        for (const member of component) {
          dc.uriToAnalysisGroupId.set(member, groupId);
        }
      }

      // Convert numeric incoming edges to string group IDs
      const incomingGroups = new Set<string>();
      for (const incomingScc of sccIncoming[i]) {
        incomingGroups.add(sccIndexToGroupId[incomingScc]);
      }
      dc.groupIncomingEdges.set(groupId, incomingGroups);
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

  // ----- Debug Helpers -----
  static logAnalysisGroups(dc: DocumentConnectivity): void {
    console.debug("Analysis Groups (SCCs):");
    for (const [groupId, members] of dc.analysisGroups) {
      console.debug(`  ${groupId}: [${[...members].join(", ")}]`);
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
}
